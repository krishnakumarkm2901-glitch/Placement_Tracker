"""Attendance routes — compute daily solving attendance from platform submission calendars."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import calendar as cal
import re
import logging

from app.extensions import db
from app.utils.decorators import admin_required, rate_limit
from app.services.platform_storage import COLLECTIONS

attendance_bp = Blueprint("attendance", __name__)
logger = logging.getLogger("placement_tracker.attendance")


# ---------------------------------------------------------------------------
# Helpers — per-day, per-platform solved counts
# ---------------------------------------------------------------------------

def _get_daily_platform_counts(student_id, year, month, lc_doc=None, cc_doc=None, hr_doc=None):
    """Return a dict  {day_int: {"leetcode": N, "codechef": N, "hackerrank": N}}
    for every day in *month/year* where the student had at least one accepted
    submission on any of the three platforms.

    Unlike the old `_get_submission_dates` which returned a flat set of active
    day numbers, this version preserves per-platform counts so the admin can
    see *where* the attendance came from.
    """
    _, last = cal.monthrange(year, month)

    # Pre-build date-string → day mapping for CodeChef / HackerRank
    month_dates = {}  # "YYYY-MM-DD" → day_int
    for day in range(1, last + 1):
        month_dates[f"{year:04d}-{month:02d}-{day:02d}"] = day

    # result keyed by day_int
    counts = {}  # day → {"leetcode": n, "codechef": n, "hackerrank": n}

    def _ensure(day):
        if day not in counts:
            counts[day] = {"leetcode": 0, "codechef": 0, "hackerrank": 0}

    # --- LeetCode ----------------------------------------------------------
    if lc_doc:
        lc_calendar = (lc_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
        if isinstance(lc_calendar, dict):
            for ts_str, count_val in lc_calendar.items():
                n = int(count_val or 0)
                if n <= 0:
                    continue
                try:
                    dt = datetime.fromtimestamp(int(ts_str), tz=timezone.utc)
                    if dt.year == year and dt.month == month:
                        _ensure(dt.day)
                        counts[dt.day]["leetcode"] += n
                except (ValueError, OSError, OverflowError):
                    pass
        else:
            logger.debug("LeetCode submission_calendar is not a dict for student %s: %s",
                         student_id, type(lc_calendar))

    # --- CodeChef ----------------------------------------------------------
    if cc_doc:
        cc_calendar = (cc_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
        if isinstance(cc_calendar, dict):
            for date_str, count_val in cc_calendar.items():
                n = int(count_val or 0)
                if n <= 0:
                    continue
                day = month_dates.get(date_str)
                if day is None:
                    # Try normalising "YYYY-M-D" → "YYYY-MM-DD"
                    try:
                        parts = [int(p) for p in str(date_str).split("-")]
                        if len(parts) == 3:
                            norm = f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
                            day = month_dates.get(norm)
                    except (ValueError, TypeError):
                        pass
                if day is not None:
                    _ensure(day)
                    counts[day]["codechef"] += n

    # --- HackerRank --------------------------------------------------------
    if hr_doc:
        hr_calendar = (hr_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
        if isinstance(hr_calendar, dict):
            for date_str, count_val in hr_calendar.items():
                n = int(count_val or 0)
                if n <= 0:
                    continue
                day = month_dates.get(str(date_str))
                if day is None:
                    # HackerRank sometimes uses timestamps
                    try:
                        ts = int(date_str)
                        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                        if dt.year == year and dt.month == month:
                            day = dt.day
                    except (ValueError, OSError, OverflowError):
                        pass
                    # Also try normalising "YYYY-M-D"
                    if day is None:
                        try:
                            parts = [int(p) for p in str(date_str).split("-")]
                            if len(parts) == 3:
                                norm = f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
                                day = month_dates.get(norm)
                        except (ValueError, TypeError):
                            pass
                if day is not None:
                    _ensure(day)
                    counts[day]["hackerrank"] += n

    return counts


# ---------------------------------------------------------------------------
# Helpers — daily-task completion check
# ---------------------------------------------------------------------------

def _extract_slug(url, platform):
    """Extract the problem slug/code from a URL (mirrors daily_task_reports logic)."""
    url = str(url or "").strip()
    if not url:
        return ""
    if platform == "leetcode":
        m = re.search(r"leetcode\.com/problems/([^/?#]+)", url)
        if m:
            return m.group(1).strip("/").lower()
    elif platform == "codechef":
        m = re.search(r"codechef\.com/problems/([^/?#]+)", url)
        if m:
            return m.group(1).strip("/").upper()
    elif platform == "hackerrank":
        m = re.search(r"hackerrank\.com/challenges/([^/?#]+)", url)
        if m:
            return m.group(1).strip("/").lower()
    return ""


def _slug_from_title(title, platform):
    """Fallback slug from a problem title."""
    title = str(title or "").strip()
    if not title:
        return ""
    if platform == "codechef":
        return re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-").upper()
    return re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-").lower()


def _get_student_solved_slugs(student_id, platform, lc_doc=None, cc_doc=None, hr_doc=None):
    """Return the set of problem slugs a student has solved on *platform*.

    Accepts pre-fetched platform docs to avoid redundant DB queries.
    """
    doc = {"leetcode": lc_doc, "codechef": cc_doc, "hackerrank": hr_doc}.get(platform)

    # Fallback: query DB if doc not pre-fetched
    if doc is None:
        for sid in [student_id, str(student_id)]:
            doc = db[COLLECTIONS[platform]].find_one({"student_id": sid})
            if doc:
                break
    if not doc:
        return set()

    profile = doc.get("profile") or {}
    raw = profile.get("raw") or {}
    solved = set()

    if platform == "leetcode":
        for sub in raw.get("recent_submissions", []):
            slug = sub.get("titleSlug", "")
            if slug:
                solved.add(slug.lower())

    elif platform == "codechef":
        for act in raw.get("recent_activity", []):
            status = str(act.get("status", "")).lower()
            if "accepted" in status or "(100)" in str(act.get("result", "")):
                url = act.get("problem_url", "")
                slug = _extract_slug(url, "codechef")
                if slug:
                    solved.add(slug.upper())
                name = act.get("problem", "")
                if name:
                    solved.add(name.strip().upper())

    elif platform == "hackerrank":
        for ch in raw.get("recent_challenges", []):
            slug = ch.get("slug", "")
            if slug:
                solved.add(slug.lower())
            title = ch.get("title", "")
            if title:
                solved.add(_slug_from_title(title, "hackerrank"))

    return solved


def _check_daily_task_completion(student_id, year, month, lc_doc=None, cc_doc=None, hr_doc=None):
    """Return a set of day-of-month integers where the student completed at
    least one problem from the portal's assigned daily tasks.

    This checks *all* platforms' daily tasks for each date in the month.
    """
    _, last = cal.monthrange(year, month)
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year:04d}-{month:02d}-{last:02d}"

    # Fetch all daily task docs for this month (across all platforms)
    task_docs = list(db.daily_tasks.find({
        "date": {"$gte": start, "$lte": end},
    }))
    if not task_docs:
        return set()

    # Group tasks by date
    tasks_by_date = {}  # date_str → [task_doc, ...]
    for td in task_docs:
        d = td.get("date")
        if d:
            tasks_by_date.setdefault(d, []).append(td)

    # Pre-compute solved slugs per platform (once)
    solved_by_platform = {}
    for platform in ("leetcode", "codechef", "hackerrank"):
        solved_by_platform[platform] = _get_student_solved_slugs(
            student_id, platform,
            lc_doc=lc_doc, cc_doc=cc_doc, hr_doc=hr_doc,
        )

    completed_days = set()
    for date_str, task_list in tasks_by_date.items():
        try:
            day = int(date_str.split("-")[2])
        except (IndexError, ValueError):
            continue

        for task_doc in task_list:
            platform = task_doc.get("platform", "leetcode")
            problems = task_doc.get("problems", [])
            if not problems:
                continue

            student_slugs = solved_by_platform.get(platform, set())
            for prob in problems:
                slug = _extract_slug(prob.get("url", ""), platform) or _slug_from_title(prob.get("title", ""), platform)
                if not slug:
                    continue
                if platform == "codechef":
                    match = slug.upper() in {s.upper() for s in student_slugs}
                else:
                    match = slug.lower() in {s.lower() for s in student_slugs}
                if match:
                    completed_days.add(day)
                    break  # one match is enough for this task_doc
            if day in completed_days:
                break  # no need to check other task_docs for this date

    return completed_days


# ---------------------------------------------------------------------------
# Core attendance computation
# ---------------------------------------------------------------------------

def _compute_student_attendance(student, year, month, today, days_in_month,
                                lc_doc=None, cc_doc=None, hr_doc=None):
    """Compute attendance for a single student.

    Formula per day:
        platform_solved = leetcode + hackerrank + codechef
        present = daily_task_completed OR platform_solved > 0

    Returns a dict with daily status (including per-platform counts),
    total solves, and attendance rate.
    """
    student_id = student["_id"]

    # Per-day per-platform counts from submission calendars
    platform_counts = _get_daily_platform_counts(
        student_id, year, month,
        lc_doc=lc_doc, cc_doc=cc_doc, hr_doc=hr_doc,
    )

    # Daily task completion days
    task_completed_days = _check_daily_task_completion(
        student_id, year, month,
        lc_doc=lc_doc, cc_doc=cc_doc, hr_doc=hr_doc,
    )

    daily_status = []
    present_count = 0
    total_platform_solved = 0
    countable_days = 0

    for day in range(1, days_in_month + 1):
        date_obj = datetime(year, month, day, tzinfo=timezone.utc).date()

        if date_obj > today:
            daily_status.append({
                "day": day,
                "status": "future",
                "leetcode": 0,
                "codechef": 0,
                "hackerrank": 0,
                "daily_task": False,
                "platform_solved": 0,
            })
        else:
            countable_days += 1
            day_counts = platform_counts.get(day, {"leetcode": 0, "codechef": 0, "hackerrank": 0})
            lc = day_counts.get("leetcode", 0)
            cc = day_counts.get("codechef", 0)
            hr = day_counts.get("hackerrank", 0)
            platform_solved = lc + cc + hr
            task_done = day in task_completed_days

            is_present = task_done or platform_solved > 0
            if is_present:
                present_count += 1
            total_platform_solved += platform_solved

            daily_status.append({
                "day": day,
                "status": "present" if is_present else "absent",
                "leetcode": lc,
                "codechef": cc,
                "hackerrank": hr,
                "daily_task": task_done,
                "platform_solved": platform_solved,
            })

    rate = round(present_count / countable_days * 100, 1) if countable_days > 0 else 0

    return {
        "student_id": str(student_id),
        "name": student.get("name", ""),
        "department": student.get("department", ""),
        "year": student.get("year", ""),
        "daily": daily_status,
        "solves": total_platform_solved,
        "present_days": present_count,
        "total_days": countable_days,
        "rate": rate,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@attendance_bp.route("", methods=["GET"])
@rate_limit()
def get_all_attendance():
    """Return all students' attendance for a given month.

    Query params: month (1-12), year (YYYY), department, student_year
    """
    now = datetime.now(timezone.utc)
    try:
        month = int(request.args.get("month", now.month))
    except (ValueError, TypeError):
        month = now.month
    try:
        year = int(request.args.get("year", now.year))
    except (ValueError, TypeError):
        year = now.year

    # Clamp values
    month = max(1, min(12, month))
    year = max(2020, min(2100, year))

    _, days_in_month = cal.monthrange(year, month)
    today = now.date()

    # Build student query
    query = {"is_active": True}
    department = request.args.get("department")
    if department and department != "All":
        query["department"] = department
    student_year = request.args.get("student_year")
    if student_year and student_year != "All":
        query["year"] = student_year

    students = list(db.students.find(query).sort("name", 1))

    # Pre-fetch platform profiles in bulk to avoid N+1 queries
    student_ids = []
    for s in students:
        s_id = s.get("_id")
        if s_id:
            student_ids.extend([s_id, str(s_id)])

    lc_docs = {}
    cc_docs = {}
    hr_docs = {}

    if student_ids:
        for platform, target_dict in [
            ("leetcode", lc_docs),
            ("codechef", cc_docs),
            ("hackerrank", hr_docs),
        ]:
            try:
                for doc in db[COLLECTIONS[platform]].find(
                    {"student_id": {"$in": student_ids}}, maxTimeMS=10000
                ):
                    sid = doc.get("student_id")
                    if sid:
                        target_dict[sid] = doc
                        target_dict[str(sid)] = doc
            except Exception as err:
                logger.error("Error pre-fetching %s profiles in bulk: %s", platform, str(err))

    results = []
    for student in students:
        sid = student["_id"]
        att = _compute_student_attendance(
            student,
            year,
            month,
            today,
            days_in_month,
            lc_doc=lc_docs.get(sid) or lc_docs.get(str(sid)),
            cc_doc=cc_docs.get(sid) or cc_docs.get(str(sid)),
            hr_doc=hr_docs.get(sid) or hr_docs.get(str(sid)),
        )
        results.append(att)

    # Collect unique departments and years for filter dropdowns
    all_departments = sorted(db.students.distinct("department", {"is_active": True}))
    all_years = sorted(db.students.distinct("year", {"is_active": True}))

    return jsonify({
        "month": month,
        "year": year,
        "days_in_month": days_in_month,
        "students": results,
        "filters": {
            "departments": all_departments,
            "years": all_years,
        },
    }), 200


@attendance_bp.route("/student/<student_id>", methods=["GET"])
@jwt_required()
@rate_limit()
def get_student_attendance(student_id):
    """Return attendance for a single student. Students can only view their own data."""
    identity = get_jwt_identity()
    user = db.users.find_one({"_id": ObjectId(identity)})

    # Allow admin to view any student; students can only view themselves
    if user and user.get("role") != "admin":
        if user.get("student_id") and str(user["student_id"]) != student_id:
            return jsonify({"error": "You can only view your own attendance"}), 403

    student = db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    now = datetime.now(timezone.utc)
    try:
        month = int(request.args.get("month", now.month))
    except (ValueError, TypeError):
        month = now.month
    try:
        year = int(request.args.get("year", now.year))
    except (ValueError, TypeError):
        year = now.year

    month = max(1, min(12, month))
    year = max(2020, min(2100, year))

    _, days_in_month = cal.monthrange(year, month)
    today = now.date()

    lc_doc = None
    cc_doc = None
    hr_doc = None

    sid_variants = [ObjectId(student_id), str(student_id)]
    for platform, var_name in [("leetcode", "lc_doc"), ("codechef", "cc_doc"), ("hackerrank", "hr_doc")]:
        try:
            doc = db[COLLECTIONS[platform]].find_one(
                {"student_id": {"$in": sid_variants}}, maxTimeMS=5000
            )
            if var_name == "lc_doc":
                lc_doc = doc
            elif var_name == "cc_doc":
                cc_doc = doc
            else:
                hr_doc = doc
        except Exception as err:
            logger.error("Error fetching %s profile for student %s: %s", platform, student_id, str(err))

    att = _compute_student_attendance(
        student,
        year,
        month,
        today,
        days_in_month,
        lc_doc=lc_doc,
        cc_doc=cc_doc,
        hr_doc=hr_doc,
    )
    att["days_in_month"] = days_in_month

    return jsonify(att), 200
