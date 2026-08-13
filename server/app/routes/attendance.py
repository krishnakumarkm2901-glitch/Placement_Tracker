"""Attendance routes — daily solving attendance from pre-synced platform data.

CRITICAL DESIGN RULE
────────────────────
This module NEVER makes live requests to LeetCode, HackerRank, CodeChef, or
GitHub during attendance calculation. All platform data is read from MongoDB
collections that are populated by the background sync service.

TIMEZONE
────────
All date calculations use Indian Standard Time (Asia/Kolkata, UTC+5:30).

QUERY BUDGET
────────────
The entire ``get_all_attendance`` endpoint uses exactly 5 MongoDB queries
regardless of student count:
  1. students (with projection)
  2. leetcode_profiles (bulk)
  3. codechef_profiles (bulk)
  4. hackerrank_profiles (bulk)
  5. daily_tasks (for the requested month)

Everything else is computed in-memory in Python.
"""

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
from app.cache import cached_response, cache_invalidate

attendance_bp = Blueprint("attendance", __name__)
logger = logging.getLogger("placement_tracker.attendance")

# Indian Standard Time (Asia/Kolkata: UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

# Only the fields we need from the students collection
_STUDENT_PROJECTION = {
    "_id": 1,
    "name": 1,
    "department": 1,
    "year": 1,
}


# ---------------------------------------------------------------------------
# Pure-computation helpers (NO database access, IST time zone)
# ---------------------------------------------------------------------------

def _parse_lc_calendar(lc_doc, year, month):
    """Extract {day_int: count} from a LeetCode profile doc's submission_calendar.

    LeetCode stores timestamps (unix seconds) -> submission count.
    Converts timestamps to IST (Asia/Kolkata) date boundaries.
    """
    result = {}
    if not lc_doc:
        return result
    lc_calendar = (lc_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
    if not isinstance(lc_calendar, dict):
        return result
    for ts_str, count_val in lc_calendar.items():
        n = int(count_val or 0)
        if n <= 0:
            continue
        try:
            # Convert unix timestamp to IST date
            dt = datetime.fromtimestamp(int(ts_str), tz=IST)
            if dt.year == year and dt.month == month:
                result[dt.day] = result.get(dt.day, 0) + n
        except (ValueError, OSError, OverflowError):
            pass
    return result


def _parse_date_calendar(doc, year, month, month_dates):
    """Extract {day_int: count} from a CodeChef or HackerRank profile doc.

    These platforms use "YYYY-MM-DD" date strings (sometimes un-padded).
    HackerRank may also use unix timestamps for some keys.
    """
    result = {}
    if not doc:
        return result
    calendar = (doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
    if not isinstance(calendar, dict):
        return result
    for date_str, count_val in calendar.items():
        n = int(count_val or 0)
        if n <= 0:
            continue
        day = month_dates.get(str(date_str))
        if day is None:
            # Try normalising "YYYY-M-D" -> "YYYY-MM-DD"
            try:
                parts = [int(p) for p in str(date_str).split("-")]
                if len(parts) == 3:
                    norm = f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
                    day = month_dates.get(norm)
            except (ValueError, TypeError):
                pass
        if day is None:
            # HackerRank sometimes uses unix timestamps
            try:
                ts = int(date_str)
                dt = datetime.fromtimestamp(ts, tz=IST)
                if dt.year == year and dt.month == month:
                    day = dt.day
            except (ValueError, OSError, OverflowError):
                pass
        if day is not None:
            result[day] = result.get(day, 0) + n
    return result


def _extract_slug(url, platform):
    """Extract the problem slug/code from a URL."""
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


def _get_solved_slugs_from_doc(doc, platform):
    """Return the set of problem slugs a student has solved.

    Works entirely from the pre-fetched platform doc — NO database access.
    """
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


def _check_daily_task_completion_pure(lc_doc, cc_doc, hr_doc, tasks_by_date):
    """Return a set of day-of-month integers where the student completed at
    least one problem from the portal's assigned daily tasks.

    This is a PURE function — no database access. ``tasks_by_date`` is
    pre-fetched once and shared across all students.
    """
    if not tasks_by_date:
        return set()

    solved_by_platform = {
        "leetcode": _get_solved_slugs_from_doc(lc_doc, "leetcode"),
        "codechef": _get_solved_slugs_from_doc(cc_doc, "codechef"),
        "hackerrank": _get_solved_slugs_from_doc(hr_doc, "hackerrank"),
    }

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
            if not student_slugs:
                continue

            for prob in problems:
                slug = (_extract_slug(prob.get("url", ""), platform)
                        or _slug_from_title(prob.get("title", ""), platform))
                if not slug:
                    continue
                if platform == "codechef":
                    match = slug.upper() in {s.upper() for s in student_slugs}
                else:
                    match = slug.lower() in {s.lower() for s in student_slugs}
                if match:
                    completed_days.add(day)
                    break
            if day in completed_days:
                break

    return completed_days


# ---------------------------------------------------------------------------
# Core attendance computation (pure — no DB, IST boundaries)
# ---------------------------------------------------------------------------

def _compute_student_attendance(student, year, month, today_ist, days_in_month,
                                month_dates, tasks_by_date,
                                lc_doc=None, cc_doc=None, hr_doc=None):
    """Compute attendance for a single student.

    Formula per day:
        platform_solved = leetcode + hackerrank + codechef (from submission calendars)
        present = daily_task_completed OR platform_solved > 0

    This function does ZERO database queries.
    """
    lc_counts = _parse_lc_calendar(lc_doc, year, month)
    cc_counts = _parse_date_calendar(cc_doc, year, month, month_dates)
    hr_counts = _parse_date_calendar(hr_doc, year, month, month_dates)

    task_completed_days = _check_daily_task_completion_pure(
        lc_doc, cc_doc, hr_doc, tasks_by_date,
    )

    daily_status = []
    present_count = 0
    total_platform_solved = 0
    countable_days = 0

    for day in range(1, days_in_month + 1):
        date_obj = datetime(year, month, day, tzinfo=IST).date()

        if date_obj > today_ist:
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
            lc = lc_counts.get(day, 0)
            cc = cc_counts.get(day, 0)
            hr = hr_counts.get(day, 0)
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
        "student_id": str(student["_id"]),
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
# Bulk data fetchers (ONE query each)
# ---------------------------------------------------------------------------

def _bulk_fetch_platform_docs(student_ids):
    """Fetch all platform profile docs for the given student IDs in 3 queries."""
    lc_docs = {}
    cc_docs = {}
    hr_docs = {}

    if not student_ids:
        return lc_docs, cc_docs, hr_docs

    for platform, target_dict in [
        ("leetcode", lc_docs),
        ("codechef", cc_docs),
        ("hackerrank", hr_docs),
    ]:
        try:
            for doc in db[COLLECTIONS[platform]].find(
                {"student_id": {"$in": student_ids}}
            ):
                sid = doc.get("student_id")
                if sid is not None:
                    target_dict[sid] = doc
                    target_dict[str(sid)] = doc
        except Exception as err:
            logger.error("Error bulk-fetching %s profiles: %s", platform, err)

    return lc_docs, cc_docs, hr_docs


def _fetch_month_tasks(year, month):
    """Fetch daily tasks for the given month in ONE query."""
    _, last = cal.monthrange(year, month)
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year:04d}-{month:02d}-{last:02d}"

    tasks_by_date = {}
    try:
        for td in db.daily_tasks.find({"date": {"$gte": start, "$lte": end}}):
            d = td.get("date")
            if d:
                tasks_by_date.setdefault(d, []).append(td)
    except Exception as err:
        logger.error("Error fetching daily tasks for %s-%s: %s", year, month, err)

    return tasks_by_date


def _build_month_dates(year, month):
    """Build "YYYY-MM-DD" -> day_int lookup for the given month."""
    _, last = cal.monthrange(year, month)
    return {f"{year:04d}-{month:02d}-{day:02d}": day for day in range(1, last + 1)}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@attendance_bp.route("", methods=["GET"])
@rate_limit()
@cached_response(ttl=60, prefix="attendance_all")
def get_all_attendance():
    """Return all students' attendance for a given month.

    Query params: month (1-12), year (YYYY), department, student_year, refresh (true/1)

    Uses exactly 5 MongoDB queries regardless of student count.
    """
    if request.args.get("refresh", "").lower() in ("true", "1", "yes"):
        cache_invalidate("attendance_all")

    now_ist = datetime.now(IST)
    try:
        month = int(request.args.get("month", now_ist.month))
    except (ValueError, TypeError):
        month = now_ist.month
    try:
        year = int(request.args.get("year", now_ist.year))
    except (ValueError, TypeError):
        year = now_ist.year

    month = max(1, min(12, month))
    year = max(2020, min(2100, year))

    _, days_in_month = cal.monthrange(year, month)
    today_ist = now_ist.date()

    # ── Query 1: Students ──
    query = {"is_active": True}
    department = request.args.get("department")
    if department and department != "All":
        query["department"] = department
    student_year = request.args.get("student_year")
    if student_year and student_year != "All":
        query["year"] = student_year

    students = list(db.students.find(query, _STUDENT_PROJECTION).sort("name", 1))

    student_ids = []
    for s in students:
        s_id = s.get("_id")
        if s_id is not None:
            student_ids.extend([s_id, str(s_id)])

    # ── Queries 2-4: Bulk platform profiles ──
    lc_docs, cc_docs, hr_docs = _bulk_fetch_platform_docs(student_ids)

    # ── Query 5: Daily tasks for this month ──
    tasks_by_date = _fetch_month_tasks(year, month)
    month_dates = _build_month_dates(year, month)

    # ── Pure computation ──
    results = []
    for student in students:
        sid = student["_id"]
        att = _compute_student_attendance(
            student, year, month, today_ist, days_in_month,
            month_dates, tasks_by_date,
            lc_doc=lc_docs.get(sid) or lc_docs.get(str(sid)),
            cc_doc=cc_docs.get(sid) or cc_docs.get(str(sid)),
            hr_doc=hr_docs.get(sid) or hr_docs.get(str(sid)),
        )
        results.append(att)

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

    if user and user.get("role") != "admin":
        if user.get("student_id") and str(user["student_id"]) != student_id:
            return jsonify({"error": "You can only view your own attendance"}), 403

    student = db.students.find_one({"_id": ObjectId(student_id)}, _STUDENT_PROJECTION)
    if not student:
        return jsonify({"error": "Student not found"}), 404

    now_ist = datetime.now(IST)
    try:
        month = int(request.args.get("month", now_ist.month))
    except (ValueError, TypeError):
        month = now_ist.month
    try:
        year = int(request.args.get("year", now_ist.year))
    except (ValueError, TypeError):
        year = now_ist.year

    month = max(1, min(12, month))
    year = max(2020, min(2100, year))

    _, days_in_month = cal.monthrange(year, month)
    today_ist = now_ist.date()

    sid_variants = [ObjectId(student_id), str(student_id)]

    lc_doc = None
    cc_doc = None
    hr_doc = None
    for platform, attr in [("leetcode", "lc_doc"), ("codechef", "cc_doc"), ("hackerrank", "hr_doc")]:
        try:
            doc = db[COLLECTIONS[platform]].find_one({"student_id": {"$in": sid_variants}})
            if attr == "lc_doc":
                lc_doc = doc
            elif attr == "cc_doc":
                cc_doc = doc
            else:
                hr_doc = doc
        except Exception as err:
            logger.error("Error fetching %s profile for student %s: %s", platform, student_id, err)

    tasks_by_date = _fetch_month_tasks(year, month)
    month_dates = _build_month_dates(year, month)

    att = _compute_student_attendance(
        student, year, month, today_ist, days_in_month,
        month_dates, tasks_by_date,
        lc_doc=lc_doc, cc_doc=cc_doc, hr_doc=hr_doc,
    )
    att["days_in_month"] = days_in_month

    return jsonify(att), 200


@attendance_bp.route("/refresh", methods=["POST"])
@jwt_required()
@admin_required
def refresh_attendance():
    """Invalidate cached attendance data and trigger platform sync recalculation."""
    cache_invalidate("attendance_all")
    return jsonify({
        "message": "Attendance cache invalidated successfully. Attendance recalculated.",
        "timestamp": datetime.now(IST).isoformat(),
    }), 200
