"""Streak calculation service using Asia/Kolkata (IST = UTC+5:30) date boundaries.

STREAK RULE
───────────
- Dates are evaluated in Indian Standard Time (Asia/Kolkata, UTC+5:30).
- Consecutive days are counted backwards starting STRICTLY from today (IST).
- If today (IST) has no activity, current streak is 0.
- Overall Current Streak = consecutive active days with qualifying activity on
  LeetCode, HackerRank, CodeChef, or Portal Daily Tasks.
"""

from datetime import datetime, timezone, timedelta
from bson import ObjectId
from app.extensions import db
from app.services.platform_storage import COLLECTIONS

IST = timezone(timedelta(hours=5, minutes=30))


def get_active_dates_lc(lc_doc):
    """Extract set of IST active dates for LeetCode."""
    active_dates = set()
    if not lc_doc:
        return active_dates
    cal = (lc_doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
    if not isinstance(cal, dict):
        return active_dates
    for ts_str, count in cal.items():
        if int(count or 0) > 0:
            try:
                dt = datetime.fromtimestamp(int(ts_str), tz=IST)
                active_dates.add(dt.date())
            except (ValueError, OSError, OverflowError):
                pass
    return active_dates


def get_active_dates_date_str(doc):
    """Extract set of IST active dates for CodeChef or HackerRank."""
    active_dates = set()
    if not doc:
        return active_dates
    cal = (doc.get("profile") or {}).get("raw", {}).get("submission_calendar", {})
    if not isinstance(cal, dict):
        return active_dates
    for date_key, count in cal.items():
        if int(count or 0) > 0:
            # Check unix timestamp
            try:
                ts = int(date_key)
                dt = datetime.fromtimestamp(ts, tz=IST)
                active_dates.add(dt.date())
                continue
            except (ValueError, TypeError, OSError, OverflowError):
                pass
            # Check YYYY-MM-DD
            try:
                parts = [int(p) for p in str(date_key).split("-")]
                if len(parts) == 3:
                    active_dates.add(datetime(parts[0], parts[1], parts[2], tzinfo=IST).date())
            except (ValueError, TypeError):
                pass
    return active_dates


def get_daily_task_completed_dates(student_id, lc_doc=None, cc_doc=None, hr_doc=None, tasks=None):
    """Get dates where student completed portal's assigned daily tasks."""
    completed = set()
    try:
        if tasks is None:
            tasks = list(db.daily_tasks.find({}))
        if not tasks:
            return completed

        from app.routes.attendance import _get_solved_slugs_from_doc, _extract_slug, _slug_from_title
        solved_by_platform = {
            "leetcode": _get_solved_slugs_from_doc(lc_doc, "leetcode"),
            "codechef": _get_solved_slugs_from_doc(cc_doc, "codechef"),
            "hackerrank": _get_solved_slugs_from_doc(hr_doc, "hackerrank"),
        }
        for task_doc in tasks:
            date_str = task_doc.get("date")
            platform = task_doc.get("platform", "leetcode")
            problems = task_doc.get("problems", [])
            if not date_str or not problems:
                continue
            try:
                parts = [int(p) for p in date_str.split("-")]
                task_date = datetime(parts[0], parts[1], parts[2], tzinfo=IST).date()
            except (ValueError, IndexError):
                continue

            student_slugs = solved_by_platform.get(platform, set())
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
                    completed.add(task_date)
                    break
    except Exception:
        pass
    return completed


def compute_consecutive_streak(active_dates, today_ist=None):
    """
    Calculate current streak and longest streak from a set of active dates.

    STREAK RULE:
    - Today = datetime.now(IST).date()
    - Start cursor = today_ist
    - If today_ist is NOT in active_dates -> current_streak = 0!
    - If today_ist IS in active_dates -> count 1, then decrement cursor to today_ist - 1 day, etc.
    - Longest streak = max consecutive active days in any contiguous sequence.
    """
    if today_ist is None:
        today_ist = datetime.now(IST).date()

    cursor = today_ist
    current_streak = 0
    while cursor in active_dates:
        current_streak += 1
        cursor -= timedelta(days=1)

    longest_streak = 0
    streak = 0
    if active_dates:
        day = min(active_dates)
        end = max(active_dates)
        while day <= end:
            if day in active_dates:
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 0
            day += timedelta(days=1)

    return current_streak, longest_streak


def calculate_student_streaks(student, lc_doc=None, cc_doc=None, hr_doc=None, tasks=None):
    """
    Full streak metrics for a student.
    """
    sid = student.get("_id")
    if not sid:
        return {}

    if lc_doc is None:
        lc_doc = db[COLLECTIONS["leetcode"]].find_one({"student_id": {"$in": [sid, str(sid)]}})
    if cc_doc is None:
        cc_doc = db[COLLECTIONS["codechef"]].find_one({"student_id": {"$in": [sid, str(sid)]}})
    if hr_doc is None:
        hr_doc = db[COLLECTIONS["hackerrank"]].find_one({"student_id": {"$in": [sid, str(sid)]}})

    today_ist = datetime.now(IST).date()

    lc_dates = get_active_dates_lc(lc_doc)
    cc_dates = get_active_dates_date_str(cc_doc)
    hr_dates = get_active_dates_date_str(hr_doc)
    task_dates = get_daily_task_completed_dates(sid, lc_doc, cc_doc, hr_doc, tasks=tasks)

    lc_curr, lc_long = compute_consecutive_streak(lc_dates, today_ist)
    cc_curr, cc_long = compute_consecutive_streak(cc_dates, today_ist)
    hr_curr, hr_long = compute_consecutive_streak(hr_dates, today_ist)

    overall_dates = lc_dates | cc_dates | hr_dates | task_dates
    overall_curr, overall_long = compute_consecutive_streak(overall_dates, today_ist)

    past_dates = [d for d in overall_dates if d <= today_ist]
    last_act = max(past_dates).strftime("%Y-%m-%d") if past_dates else None

    # Count solves today per platform
    from app.routes.attendance import _parse_lc_calendar, _parse_date_calendar, _build_month_dates
    month_dates = _build_month_dates(today_ist.year, today_ist.month)
    lc_month = _parse_lc_calendar(lc_doc, today_ist.year, today_ist.month)
    cc_month = _parse_date_calendar(cc_doc, today_ist.year, today_ist.month, month_dates)
    hr_month = _parse_date_calendar(hr_doc, today_ist.year, today_ist.month, month_dates)

    lc_today = lc_month.get(today_ist.day, 0)
    cc_today = cc_month.get(today_ist.day, 0)
    hr_today = hr_month.get(today_ist.day, 0)

    # Last synced timestamp across profiles
    timestamps = []
    for doc in (lc_doc, cc_doc, hr_doc):
        if doc and doc.get("updated_at"):
            timestamps.append(doc["updated_at"])

    if student.get("last_synced"):
        timestamps.append(student["last_synced"])

    last_updated_str = max(timestamps).isoformat() if timestamps else datetime.now(IST).isoformat()

    return {
        "overall_current_streak": overall_curr,
        "overall_longest_streak": overall_long,
        "leetcode": {"current_streak": lc_curr, "longest_streak": lc_long, "solved_today": lc_today},
        "hackerrank": {"current_streak": hr_curr, "longest_streak": hr_long, "solved_today": hr_today},
        "codechef": {"current_streak": cc_curr, "longest_streak": cc_long, "solved_today": cc_today},
        "last_activity_date": last_act,
        "last_updated": last_updated_str,
    }
