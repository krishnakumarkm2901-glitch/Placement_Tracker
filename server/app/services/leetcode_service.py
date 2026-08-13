"""LeetCode public profile integration."""

import json
from datetime import datetime, timedelta, timezone

import requests

from app.services.platform_common import HEADERS, platform_result, normalize_platform_username


QUESTION_DIFFICULTY_CACHE = {}


from app.services.http_session import get_http_session, HEADERS


def get_question_difficulty(title_slug):
    """Fetch and cache difficulty for a question slug."""
    if not title_slug:
        return "MEDIUM"
    if title_slug in QUESTION_DIFFICULTY_CACHE:
        return QUESTION_DIFFICULTY_CACHE[title_slug]
    try:
        query = """query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { difficulty } }"""
        session = get_http_session()
        res = session.post(
            "https://leetcode.com/graphql",
            json={"query": query, "variables": {"titleSlug": title_slug}},
            headers=HEADERS,
            timeout=5,
        )
        diff = (res.json().get("data") or {}).get("question", {}).get("difficulty") or "Medium"
        diff_upper = diff.upper()
        QUESTION_DIFFICULTY_CACHE[title_slug] = diff_upper
        return diff_upper
    except Exception:
        return "MEDIUM"


def fetch_leetcode(username):
    username = normalize_platform_username(username)
    if not username:
        raise ValueError("LeetCode username is empty")

    query = """query userProfile($username: String!) { allQuestionsCount { difficulty count } matchedUser(username: $username) { username profile { realName ranking reputation starRating userAvatar company school countryName } badges { id displayName icon creationDate } languageProblemCount { languageName problemsSolved } tagProblemCounts { advanced { tagName tagSlug problemsSolved } intermediate { tagName tagSlug problemsSolved } fundamental { tagName tagSlug problemsSolved } } submitStats { acSubmissionNum { difficulty count submissions } totalSubmissionNum { difficulty count submissions } } userCalendar { activeYears streak totalActiveDays submissionCalendar } } recentSubmissionList(username: $username, limit: 20) { title titleSlug timestamp statusDisplay lang } userContestRanking(username: $username) { attendedContestsCount rating globalRanking topPercentage } }"""
    import time
    session = get_http_session()
    response = None
    for attempt in range(3):
        try:
            response = session.post("https://leetcode.com/graphql", json={"query": query, "variables": {"username": username}}, headers=HEADERS, timeout=10)
            if response.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            response.raise_for_status()
            break
        except Exception as err:
            if attempt == 2:
                raise err
            time.sleep(1.5 + attempt)

    if not response or not response.ok:
        raise ValueError("Could not connect to LeetCode API")

    payload = response.json().get("data") or {}
    user = payload.get("matchedUser")
    if not user:
        raise ValueError("LeetCode profile not found")
    accepted_rows = user.get("submitStats", {}).get("acSubmissionNum", [])
    total_rows = user.get("submitStats", {}).get("totalSubmissionNum", [])
    solved = {item["difficulty"].lower(): item["count"] for item in accepted_rows}
    accepted_submissions = next((item.get("submissions", 0) for item in accepted_rows if item.get("difficulty") == "All"), 0)
    total_submissions = next((item.get("submissions", 0) for item in total_rows if item.get("difficulty") == "All"), 0)
    question_totals = {item["difficulty"].lower(): item["count"] for item in payload.get("allQuestionsCount", [])}
    contest = payload.get("userContestRanking") or {}
    profile = user.get("profile") or {}
    calendar = user.get("userCalendar") or {}
    try:
        submission_calendar = json.loads(calendar.get("submissionCalendar") or "{}")
    except (TypeError, ValueError):
        submission_calendar = {}

    yearly_submissions = sum(int(count or 0) for count in submission_calendar.values())

    # IST timezone (Asia/Kolkata: UTC+5:30)
    IST = timezone(timedelta(hours=5, minutes=30))
    today_ist = datetime.now(IST).date()

    # Convert timestamps to IST dates for active submission days
    active_dates = {
        datetime.fromtimestamp(int(ts), tz=IST).date()
        for ts, count in submission_calendar.items()
        if int(count or 0) > 0
    }

    # Calculate live current streak: count consecutive active days starting STRICTLY from today_ist
    cursor = today_ist
    current_streak = 0
    while cursor in active_dates:
        current_streak += 1
        cursor -= timedelta(days=1)

    # Calculate longest/max streak across all active dates
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

    raw_recent = [item for item in (payload.get("recentSubmissionList") or []) if item.get("statusDisplay") == "Accepted"]
    recent = []
    seen_slugs = set()
    for item in raw_recent:
        slug = item.get("titleSlug") or item.get("title")
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        item_copy = dict(item)
        item_copy["difficulty"] = QUESTION_DIFFICULTY_CACHE.get(slug, "MEDIUM")
        recent.append(item_copy)

    metrics = {
        "solved": solved.get("all", 0), "easy": solved.get("easy", 0), "medium": solved.get("medium", 0), "hard": solved.get("hard", 0),
        "ranking": profile.get("ranking"), "contest_rating": round(contest.get("rating") or 0), "contests": contest.get("attendedContestsCount") or 0,
        "active_days": calendar.get("totalActiveDays") or len(active_dates),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "streak": current_streak,
        "badges": len(user.get("badges") or []),
        "submissions": total_submissions, "yearly_submissions": yearly_submissions, "acceptance_rate": round(accepted_submissions / total_submissions * 100, 2) if total_submissions else 0,
        "total_questions": question_totals.get("all", 0), "total_easy": question_totals.get("easy", 0), "total_medium": question_totals.get("medium", 0), "total_hard": question_totals.get("hard", 0),
    }
    raw = {"avatar_url": profile.get("userAvatar"), "real_name": profile.get("realName"), "company": profile.get("company"), "school": profile.get("school"), "country": profile.get("countryName"), "reputation": profile.get("reputation") or 0, "badges": user.get("badges") or [], "languages": user.get("languageProblemCount") or [], "skills": user.get("tagProblemCounts") or {}, "submission_calendar": submission_calendar, "recent_submissions": recent}
    return platform_result("leetcode", username, f"https://leetcode.com/u/{username}/", metrics, raw)

