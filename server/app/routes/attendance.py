"""Attendance routes — compute daily solving attendance from platform submission calendars."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import calendar as cal
import logging

from app.extensions import db
from app.utils.decorators import admin_required, rate_limit
from app.services.platform_storage import COLLECTIONS

attendance_bp = Blueprint("attendance", __name__)
logger = logging.getLogger("placement_tracker.attendance")


def _get_submission_dates(student_id, year, month, lc_doc=None, cc_doc=None, hr_doc=None):
    """Collect all dates in the given month where the student had at least one
    accepted submission on LeetCode, CodeChef, or HackerRank.

    Returns a set of day-of-month integers (1-based).
    """
    active_days = set()
    first_day = datetime(year, month, 1, tzinfo=timezone.utc)
    _, last = cal.monthrange(year, month)
    last_day = datetime(year, month, last, 23, 59, 59, tzinfo=timezone.utc)

    # Build reference dates for the requested month
    month_dates_str = set()  # "YYYY-MM-DD" strings
    month_timestamps = {}     # unix_ts -> day_of_month
    for day in range(1, last + 1):
        dt = datetime(year, month, day, tzinfo=timezone.utc)
        month_dates_str.add(dt.strftime("%Y-%m-%d"))
        # Pre-compute all possible midnight timestamps for LeetCode calendar lookup
        ts = int(dt.timestamp())
        month_timestamps[str(ts)] = day

    # Also include timestamps for different timezone offsets (LeetCode uses various)
    for day in range(1, last + 1):
        for hour_offset in range(0, 24):
            dt = datetime(year, month, day, hour_offset, tzinfo=timezone.utc)
            ts = int(dt.timestamp())
            month_timestamps[str(ts)] = day



    # --- LeetCode ---
    if lc_doc:
        lc_calendar = (lc_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
        if isinstance(lc_calendar, dict):
            for ts_str, count in lc_calendar.items():
                if int(count or 0) > 0 and ts_str in month_timestamps:
                    active_days.add(month_timestamps[ts_str])
                elif int(count or 0) > 0:
                    # Fallback: convert timestamp to date and check
                    try:
                        dt = datetime.fromtimestamp(int(ts_str), tz=timezone.utc)
                        if dt.year == year and dt.month == month:
                            active_days.add(dt.day)
                    except (ValueError, OSError):
                        pass

    # --- CodeChef ---
    if cc_doc:
        cc_calendar = (cc_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
        if isinstance(cc_calendar, dict):
            for date_str, count in cc_calendar.items():
                if int(count or 0) > 0 and date_str in month_dates_str:
                    day = int(date_str.split("-")[2])
                    active_days.add(day)

    # --- HackerRank ---
    if hr_doc:
        hr_calendar = (hr_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
        if isinstance(hr_calendar, dict):
            for date_str, count in hr_calendar.items():
                if int(count or 0) > 0 and date_str in month_dates_str:
                    day = int(date_str.split("-")[2])
                    active_days.add(day)

    return active_days


def _get_daily_task_dates(year, month):
    """Return a set of date strings (YYYY-MM-DD) that have daily tasks assigned."""
    _, last = cal.monthrange(year, month)
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year:04d}-{month:02d}-{last:02d}"
    docs = db.daily_tasks.find({
        "date": {"$gte": start, "$lte": end}
    })
    return {doc["date"] for doc in docs}


def _compute_student_attendance(student, year, month, today, days_in_month, task_dates, lc_doc=None, cc_doc=None, hr_doc=None):
    """Compute attendance for a single student. Returns a dict with daily status,
    total solves, and attendance rate."""
    student_id = student["_id"]
    active_days = _get_submission_dates(student_id, year, month, lc_doc=lc_doc, cc_doc=cc_doc, hr_doc=hr_doc)

    daily_status = []
    present_count = 0
    countable_days = 0  # days up to today that had tasks or are past

    for day in range(1, days_in_month + 1):
        date_obj = datetime(year, month, day, tzinfo=timezone.utc).date()
        date_str = f"{year:04d}-{month:02d}-{day:02d}"

        if date_obj > today:
            daily_status.append({"day": day, "status": "future"})
        else:
            countable_days += 1
            is_present = day in active_days
            if is_present:
                present_count += 1
            daily_status.append({"day": day, "status": "present" if is_present else "absent"})

    rate = round(present_count / countable_days * 100, 1) if countable_days > 0 else 0

    return {
        "student_id": str(student_id),
        "name": student.get("name", ""),
        "department": student.get("department", ""),
        "year": student.get("year", ""),
        "daily": daily_status,
        "solves": present_count,
        "total_days": countable_days,
        "rate": rate,
    }


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
    task_dates = _get_daily_task_dates(year, month)

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
        try:
            for doc in db[COLLECTIONS["leetcode"]].find({"student_id": {"$in": student_ids}}, maxTimeMS=5000):
                sid = doc.get("student_id")
                if sid:
                    lc_docs[sid] = doc
                    lc_docs[str(sid)] = doc
        except Exception as err:
            logger.error("Error pre-fetching LeetCode profiles in bulk: %s", str(err))

        try:
            for doc in db[COLLECTIONS["codechef"]].find({"student_id": {"$in": student_ids}}, maxTimeMS=5000):
                sid = doc.get("student_id")
                if sid:
                    cc_docs[sid] = doc
                    cc_docs[str(sid)] = doc
        except Exception as err:
            logger.error("Error pre-fetching CodeChef profiles in bulk: %s", str(err))

        try:
            for doc in db[COLLECTIONS["hackerrank"]].find({"student_id": {"$in": student_ids}}, maxTimeMS=5000):
                sid = doc.get("student_id")
                if sid:
                    hr_docs[sid] = doc
                    hr_docs[str(sid)] = doc
        except Exception as err:
            logger.error("Error pre-fetching HackerRank profiles in bulk: %s", str(err))

    results = []
    for student in students:
        sid = student["_id"]
        att = _compute_student_attendance(
            student,
            year,
            month,
            today,
            days_in_month,
            task_dates,
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
        "debug_leetcode_count": len(lc_docs),
        "debug_codechef_count": len(cc_docs),
        "debug_student_ids_len": len(student_ids),
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
    task_dates = _get_daily_task_dates(year, month)

    lc_doc = None
    cc_doc = None
    hr_doc = None

    try:
        lc_doc = db[COLLECTIONS["leetcode"]].find_one({"student_id": {"$in": [ObjectId(student_id), str(student_id)]}}, maxTimeMS=5000)
    except Exception as err:
        logger.error("Error fetching LeetCode profile for student %s: %s", student_id, str(err))

    try:
        cc_doc = db[COLLECTIONS["codechef"]].find_one({"student_id": {"$in": [ObjectId(student_id), str(student_id)]}}, maxTimeMS=5000)
    except Exception as err:
        logger.error("Error fetching CodeChef profile for student %s: %s", student_id, str(err))

    try:
        hr_doc = db[COLLECTIONS["hackerrank"]].find_one({"student_id": {"$in": [ObjectId(student_id), str(student_id)]}}, maxTimeMS=5000)
    except Exception as err:
        logger.error("Error fetching HackerRank profile for student %s: %s", student_id, str(err))

    att = _compute_student_attendance(
        student,
        year,
        month,
        today,
        days_in_month,
        task_dates,
        lc_doc=lc_doc,
        cc_doc=cc_doc,
        hr_doc=hr_doc,
    )
    att["days_in_month"] = days_in_month

    return jsonify(att), 200


@attendance_bp.route("/diag", methods=["GET"])
def attendance_diag():
    try:
        students = list(db.students.find({"is_active": True}))
        student_count = len(students)
        
        lc_count = db[COLLECTIONS["leetcode"]].count_documents({})
        cc_count = db[COLLECTIONS["codechef"]].count_documents({})
        hr_count = db[COLLECTIONS["hackerrank"]].count_documents({})
        
        student_ids = []
        for s in students:
            s_id = s.get("_id")
            if s_id:
                student_ids.append(s_id)
                student_ids.append(str(s_id))
                if isinstance(s_id, str):
                    try:
                        student_ids.append(ObjectId(s_id))
                    except Exception:
                        pass
                        
        lc_bulk = list(db[COLLECTIONS["leetcode"]].find({"student_id": {"$in": student_ids}}))
        cc_bulk = list(db[COLLECTIONS["codechef"]].find({"student_id": {"$in": student_ids}}))
        
        sample_student = students[0] if students else None
        sample_lc_doc = None
        sample_cc_doc = None
        sample_lc_calendar = None
        sample_cc_calendar = None
        
        # Build the actual lc_docs map in the same way get_all_attendance does
        lc_docs = {}
        for doc in lc_bulk:
            sid = doc.get("student_id")
            if sid:
                lc_docs[sid] = doc
                lc_docs[str(sid)] = doc

        target_student = None
        for s in students:
            if s.get("name") == "SURENDHAR M":
                target_student = s
                break
        
        lookup_trace = {}
        active_days_computed = []
        if target_student:
            tsid = target_student["_id"]
            
            # Fetch profiles
            lc_doc = db[COLLECTIONS["leetcode"]].find_one({"student_id": tsid}) or db[COLLECTIONS["leetcode"]].find_one({"student_id": str(tsid)})
            cc_doc = db[COLLECTIONS["codechef"]].find_one({"student_id": tsid}) or db[COLLECTIONS["codechef"]].find_one({"student_id": str(tsid)})
            
            # Calculate submission dates
            act_days = _get_submission_dates(tsid, 2026, 8, lc_doc=lc_doc, cc_doc=cc_doc)
            active_days_computed = list(act_days)
            
            # Map lookups trace
            lc_doc_from_map = lc_docs.get(tsid) or lc_docs.get(str(tsid))
            
            lookup_trace = {
                "name": target_student.get("name"),
                "id_repr": repr(tsid),
                "id_type": str(type(tsid)),
                "lc_doc_found_directly": lc_doc is not None,
                "lc_doc_found_in_map": lc_doc_from_map is not None,
                "cc_doc_found": cc_doc is not None,
                "active_days_computed": active_days_computed,
            }

        if sample_student:
            sample_lc_doc = db[COLLECTIONS["leetcode"]].find_one({"student_id": sample_student["_id"]})
            if not sample_lc_doc:
                sample_lc_doc = db[COLLECTIONS["leetcode"]].find_one({"student_id": str(sample_student["_id"])})
            if sample_lc_doc:
                sample_lc_calendar = sample_lc_doc.get("profile", {}).get("raw", {}).get("submission_calendar")
            
            sample_cc_doc = db[COLLECTIONS["codechef"]].find_one({"student_id": sample_student["_id"]})
            if not sample_cc_doc:
                sample_cc_doc = db[COLLECTIONS["codechef"]].find_one({"student_id": str(sample_student["_id"])})
            if sample_cc_doc:
                sample_cc_calendar = sample_cc_doc.get("profile", {}).get("raw", {}).get("submission_calendar")
                
        # Get first 3 keys of lc_docs
        lc_keys = []
        for k in list(lc_docs.keys())[:6]:
            lc_keys.append({"key_repr": repr(k), "key_type": str(type(k))})

        # List indexes
        lc_indexes = list(db[COLLECTIONS["leetcode"]].list_indexes())
        cc_indexes = list(db[COLLECTIONS["codechef"]].list_indexes())
        
        # Format indexes for JSON serialization
        lc_idx_info = [{"name": idx["name"], "key": list(idx["key"].items())} for idx in lc_indexes]
        cc_idx_info = [{"name": idx["name"], "key": list(idx["key"].items())} for idx in cc_indexes]

        return jsonify({
            "student_count": student_count,
            "leetcode_count": lc_count,
            "codechef_count": cc_count,
            "hackerrank_count": hr_count,
            "leetcode_bulk_found": len(lc_bulk),
            "codechef_bulk_found": len(cc_bulk),
            "lc_docs_keys_sample": lc_keys,
            "lookup_trace": lookup_trace,
            "leetcode_indexes": lc_idx_info,
            "codechef_indexes": cc_idx_info,
            "sample_student": {
                "name": sample_student.get("name") if sample_student else None,
                "id": str(sample_student["_id"]) if sample_student else None,
                "id_type": str(type(sample_student["_id"])) if sample_student else None,
                "has_lc_profile": sample_lc_doc is not None,
                "lc_calendar": sample_lc_calendar,
                "has_cc_profile": sample_cc_doc is not None,
                "cc_calendar": sample_cc_calendar,
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
