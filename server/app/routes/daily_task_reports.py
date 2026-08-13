"""Daily Task Reports — compare assigned daily problems against student solutions."""

import re
import logging
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required
from bson import ObjectId
from datetime import datetime, timezone

from app.extensions import db
from app.utils.decorators import admin_required, rate_limit
from app.services.platform_storage import COLLECTIONS

logger = logging.getLogger(__name__)
daily_task_reports_bp = Blueprint("daily_task_reports", __name__)


def _today_string():
    return datetime.now(timezone.utc).date().isoformat()


def _extract_slug(url, platform):
    """Extract the problem slug / code from a task URL or title."""
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
    """Fallback: derive a slug from the problem title."""
    title = str(title or "").strip()
    if not title:
        return ""
    if platform == "codechef":
        return re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-").upper()
    return re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-").lower()


def _parse_solved_slugs_from_doc(doc, platform):
    """Parse the set of solved problem slugs/codes from a platform profile document."""
    if not doc:
        return set()

    profile = doc.get("profile") or {}
    raw = profile.get("raw") or {}
    solved = set()

    if platform == "leetcode":
        # recent_submissions has titleSlug for accepted problems
        for sub in raw.get("recent_submissions", []):
            slug = sub.get("titleSlug", "")
            if slug:
                solved.add(slug.lower())

    elif platform == "codechef":
        # recent_activity has problem_url with problem codes
        for act in raw.get("recent_activity", []):
            status = str(act.get("status", "")).lower()
            if "accepted" in status or "(100)" in str(act.get("result", "")):
                url = act.get("problem_url", "")
                slug = _extract_slug(url, "codechef")
                if slug:
                    solved.add(slug.upper())
                # Also try extracting from the problem name
                name = act.get("problem", "")
                if name:
                    solved.add(name.strip().upper())

    elif platform == "hackerrank":
        # recent_challenges has slug for solved challenges
        for ch in raw.get("recent_challenges", []):
            slug = ch.get("slug", "")
            if slug:
                solved.add(slug.lower())
            # Also try title-based matching
            title = ch.get("title", "")
            if title:
                solved.add(_slug_from_title(title, "hackerrank"))

    return solved


def _get_student_solved_slugs(student_id, platform):
    """Get the set of problem slugs the student has solved on a platform."""
    student_id_variants = [student_id]
    if isinstance(student_id, ObjectId):
        student_id_variants.append(str(student_id))
    else:
        try:
            student_id_variants.append(ObjectId(student_id))
        except Exception:
            pass

    doc = None
    for sid in student_id_variants:
        doc = db[COLLECTIONS[platform]].find_one({"student_id": sid})
        if doc:
            break
    return _parse_solved_slugs_from_doc(doc, platform)


def _compute_report(platform, date):
    """Compute the daily task report for a platform and date."""
    # 1. Get assigned daily tasks
    task_doc = db.daily_tasks.find_one({"platform": platform, "date": date})
    if not task_doc:
        return {
            "platform": platform,
            "date": date,
            "problems": [],
            "students": [],
            "summary": {"total_students": 0, "fully_completed": 0, "partially_completed": 0, "not_started": 0},
        }

    problems = task_doc.get("problems", [])
    if not problems:
        return {
            "platform": platform,
            "date": date,
            "problems": [],
            "students": [],
            "summary": {"total_students": 0, "fully_completed": 0, "partially_completed": 0, "not_started": 0},
        }

    # Extract slugs for each assigned problem
    problem_slugs = []
    for prob in problems:
        url = prob.get("url", "")
        title = prob.get("title", "")
        slug = _extract_slug(url, platform) or _slug_from_title(title, platform)
        problem_slugs.append({
            "title": title,
            "url": url,
            "slug": slug,
            "difficulty": prob.get("difficulty"),
        })

    total_assigned = len(problem_slugs)

    # 2. Get all students with a username for this platform
    username_field = f"{platform}_username"
    platform_key = f"platform_usernames.{platform}"
    students = list(db.students.find({
        "is_active": True,
        "$or": [
            {username_field: {"$exists": True, "$ne": ""}},
            {platform_key: {"$exists": True, "$ne": ""}},
        ],
    }).sort("name", 1))

    # Bulk-fetch coding profiles for all these students in ONE query
    student_ids = [student["_id"] for student in students if student.get("_id")]
    valid_references = []
    for sid in student_ids:
        valid_references.extend([sid, str(sid)])

    profiles_by_student = {}
    if valid_references:
        coll = COLLECTIONS[platform]
        for doc in db[coll].find({"student_id": {"$in": valid_references}}):
            sid = doc.get("student_id")
            if sid is not None:
                profiles_by_student[sid] = doc
                profiles_by_student[str(sid)] = doc

    # 3. For each student, check which problems they solved
    results = []
    fully_completed = 0
    partially_completed = 0
    not_started = 0

    for student in students:
        username = (
            student.get("platform_usernames", {}).get(platform, "")
            or student.get(f"{platform}_username", "")
        )
        if not username or not str(username).strip():
            continue

        sid = student["_id"]
        doc = profiles_by_student.get(sid) or profiles_by_student.get(str(sid))
        solved_slugs = _parse_solved_slugs_from_doc(doc, platform)

        # Match each assigned problem
        completed_problems = []
        not_completed_problems = []
        for ps in problem_slugs:
            slug = ps["slug"]
            is_solved = False
            if slug:
                if platform == "codechef":
                    is_solved = slug.upper() in {s.upper() for s in solved_slugs}
                else:
                    is_solved = slug.lower() in {s.lower() for s in solved_slugs}
            if is_solved:
                completed_problems.append(ps["title"])
            else:
                not_completed_problems.append(ps["title"])

        completed_count = len(completed_problems)
        not_completed_count = len(not_completed_problems)

        if completed_count == total_assigned:
            status = "Completed"
            fully_completed += 1
        elif completed_count > 0:
            status = "Not Completed"
            partially_completed += 1
        else:
            status = "Not Completed"
            not_started += 1

        results.append({
            "student_id": str(student["_id"]),
            "name": student.get("name", ""),
            "department": student.get("department", ""),
            "year": student.get("year", ""),
            "username": str(username).strip(),
            "total_assigned": total_assigned,
            "completed_count": completed_count,
            "not_completed_count": not_completed_count,
            "completed_problems": completed_problems,
            "not_completed_problems": not_completed_problems,
            "status": status,
            "date": date,
        })

    report = {
        "platform": platform,
        "date": date,
        "problems": [{"title": ps["title"], "url": ps["url"], "difficulty": ps.get("difficulty")} for ps in problem_slugs],
        "students": results,
        "summary": {
            "total_students": len(results),
            "fully_completed": fully_completed,
            "partially_completed": partially_completed,
            "not_started": not_started + (len(results) - fully_completed - partially_completed - not_started if not_started == 0 else 0),
        },
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }

    # 4. Store / cache the report
    db.daily_task_reports.update_one(
        {"platform": platform, "date": date},
        {"$set": report},
        upsert=True,
    )

    return report


@daily_task_reports_bp.route("", methods=["GET"])
@admin_required
@rate_limit()
def get_daily_task_report():
    """Get or compute a daily task report.

    Query params: platform (required), date (YYYY-MM-DD, defaults to today), search, refresh
    """
    platform = request.args.get("platform", "leetcode")
    if platform not in {"leetcode", "codechef", "hackerrank"}:
        return jsonify({"error": "Platform must be leetcode, codechef, or hackerrank"}), 400

    date = request.args.get("date") or _today_string()
    search = request.args.get("search", "").strip().lower()
    refresh = request.args.get("refresh", "").lower() in ("true", "1", "yes")

    # Check for cached report (unless refresh requested)
    if not refresh:
        cached = db.daily_task_reports.find_one({"platform": platform, "date": date})
        if cached:
            cached.pop("_id", None)
            # Apply search filter
            if search:
                cached["students"] = [
                    s for s in cached.get("students", [])
                    if search in s.get("name", "").lower() or search in s.get("username", "").lower()
                ]
            return jsonify(cached), 200

    # Compute fresh report
    report = _compute_report(platform, date)
    report.pop("_id", None)

    # Apply search filter
    if search:
        report["students"] = [
            s for s in report.get("students", [])
            if search in s.get("name", "").lower() or search in s.get("username", "").lower()
        ]

    return jsonify(report), 200


@daily_task_reports_bp.route("/dates", methods=["GET"])
@admin_required
@rate_limit()
def get_available_dates():
    """Return dates that have daily tasks assigned for a platform."""
    platform = request.args.get("platform", "leetcode")
    if platform not in {"leetcode", "codechef", "hackerrank"}:
        return jsonify({"error": "Platform must be leetcode, codechef, or hackerrank"}), 400

    limit = min(int(request.args.get("limit", 30)), 90)
    docs = db.daily_tasks.find(
        {"platform": platform},
        {"date": 1, "_id": 0}
    ).sort("date", -1).limit(limit)

    dates = [doc["date"] for doc in docs]
    return jsonify({"platform": platform, "dates": dates}), 200


@daily_task_reports_bp.route("/export", methods=["GET"])
@admin_required
@rate_limit()
def export_daily_task_report():
    """Export the daily task report as an Excel (.xlsx) spreadsheet."""
    from app.services.report_service import export_excel

    platform = request.args.get("platform", "leetcode")
    if platform not in {"leetcode", "codechef", "hackerrank"}:
        return jsonify({"error": "Platform must be leetcode, codechef, or hackerrank"}), 400

    date = request.args.get("date") or _today_string()
    search = request.args.get("search", "").strip().lower()

    # Fetch report
    cached = db.daily_task_reports.find_one({"platform": platform, "date": date})
    if cached:
        cached.pop("_id", None)
        report = cached
    else:
        report = _compute_report(platform, date)
        report.pop("_id", None)

    students = report.get("students", [])
    if search:
        students = [
            s for s in students
            if search in s.get("name", "").lower() or search in s.get("username", "").lower()
        ]

    # Prepare data rows for export
    export_rows = []
    for s in students:
        row = dict(s)
        row["completed_problems_str"] = ", ".join(s.get("completed_problems", [])) or "None"
        row["not_completed_problems_str"] = ", ".join(s.get("not_completed_problems", [])) or "None"
        export_rows.append(row)

    columns = [
        ("name", "Student Name"),
        ("username", "Username"),
        ("department", "Department"),
        ("year", "Year"),
        ("total_assigned", "Total Assigned Problems"),
        ("completed_count", "Completed Problems Count"),
        ("not_completed_count", "Not Completed Problems Count"),
        ("status", "Completion Status"),
        ("date", "Date"),
        ("completed_problems_str", "Completed Problems"),
        ("not_completed_problems_str", "Not Completed Problems"),
    ]

    sheet_name = f"{platform.title()} Daily Tasks"
    filename = f"Daily_Task_Report_{platform}_{date}.xlsx"
    excel_file = export_excel(export_rows, columns, sheet_name=sheet_name)

    return Response(
        excel_file,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

