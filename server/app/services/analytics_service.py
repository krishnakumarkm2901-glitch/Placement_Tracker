"""Analytics service — GitHub Score calculation and data aggregation."""

from app.extensions import db
from bson import ObjectId


def calculate_github_score(student_id):
    """
    Calculate the GitHub Score (0-100) for a student.

    Breakdown:
        Repositories      = 25 marks
        Commits           = 35 marks
        Pull Requests     = 20 marks
        README            = 10 marks
        Profile Completion = 10 marks
    """
    student = db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        return 0, {}

    analytics = student.get("analytics", {})
    repos = list(db.repositories.find({"student_id": ObjectId(student_id)}))

    repo_count = analytics.get("total_repos", 0)
    total_commits = analytics.get("total_commits", 0)
    total_prs = analytics.get("total_prs", 0)

    readme_exists = any(r.get("quality_details", {}).get("has_readme") for r in repos)
    detailed_readme = any(r.get("quality_details", {}).get("detailed_readme") for r in repos)
    profile = student.get("github_profile", {})
    username = (student.get("github_username") or "").lower()
    profile_readme = any(
        (r.get("name") or "").lower() == username
        and r.get("quality_details", {}).get("has_readme")
        for r in repos
    )

    scores = {
        "repositories": 0 if repo_count == 0 else 5 if repo_count <= 2 else 10 if repo_count <= 5 else 15 if repo_count <= 10 else 20 if repo_count <= 20 else 25,
        "commits": 5 if total_commits <= 50 else 10 if total_commits <= 100 else 20 if total_commits <= 250 else 30 if total_commits <= 500 else 35,
        "pull_requests": 0 if total_prs == 0 else 5 if total_prs <= 5 else 10 if total_prs <= 10 else 15 if total_prs <= 20 else 20,
        "readme": 10 if detailed_readme else (5 if readme_exists else 0),
        "profile_completion": sum([
            2 if profile.get("avatar_url") else 0,
            2 if profile.get("bio") else 0,
            2 if profile.get("location") else 0,
            2 if profile.get("blog") else 0,
            2 if profile_readme else 0,
        ]),
    }
    total = sum(scores.values())

    return total, scores


def get_dashboard_stats():
    """Aggregate dashboard statistics using a single $facet pipeline."""
    from app.cache import cache_get, cache_set
    from app.models.student import serialize_student_summary

    CACHE_KEY = "dashboard_stats"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    from datetime import datetime, timezone, timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Single $facet pipeline replaces 7 separate aggregations
    pipeline = [
        {"$facet": {
            "totals": [{"$group": {
                "_id": None,
                "total_students": {"$sum": 1},
                "active_students": {"$sum": {"$cond": [{"$eq": ["$is_active", True]}, 1, 0]}},
                "total_repos": {"$sum": "$analytics.total_repos"},
                "total_commits": {"$sum": "$analytics.total_commits"},
                "total_contributions": {"$sum": "$analytics.total_contributions"},
                "avg_score": {"$avg": "$github_score"},
                "avg_streak": {"$avg": "$analytics.current_streak"},
            }}],
            "synced_today": [
                {"$match": {"last_synced": {"$gte": today_start}}},
                {"$count": "count"},
            ],
            "inactive": [
                {"$match": {"$or": [
                    {"last_synced": None},
                    {"last_synced": {"$lt": week_ago}},
                ]}},
                {"$count": "count"},
            ],
            "top_dept": [
                {"$group": {"_id": "$department", "avg_score": {"$avg": "$github_score"}, "count": {"$sum": 1}}},
                {"$sort": {"avg_score": -1}},
                {"$limit": 1},
            ],
            "top_contributor": [
                {"$sort": {"github_score": -1}},
                {"$limit": 1},
                {"$project": {"name": 1, "github_username": 1, "github_score": 1, "github_profile.avatar_url": 1}},
            ],
        }},
    ]

    facet_result = list(db.students.aggregate(pipeline))
    facet = facet_result[0] if facet_result else {}

    totals = facet.get("totals", [{}])[0] if facet.get("totals") else {}
    synced_today = facet.get("synced_today", [{}])[0].get("count", 0) if facet.get("synced_today") else 0
    inactive = facet.get("inactive", [{}])[0].get("count", 0) if facet.get("inactive") else 0
    top_dept_result = facet.get("top_dept", [])
    top_result = facet.get("top_contributor", [])

    # Most used language — lightweight query with projection
    lang_counts = {}
    for s in db.students.find({}, {"analytics.most_used_language": 1}):
        lang = s.get("analytics", {}).get("most_used_language", "")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
    most_used_lang = max(lang_counts, key=lang_counts.get) if lang_counts else "N/A"

    top_contributor = None
    if top_result:
        t = top_result[0]
        top_contributor = {
            "name": t.get("name", "N/A"),
            "github_username": t.get("github_username", ""),
            "score": t.get("github_score", 0),
            "avatar": t.get("github_profile", {}).get("avatar_url", ""),
        }

    # Platform charts — single query with projection for needed fields only
    student_documents = list(db.students.find(
        {},
        {
            "name": 1, "github_username": 1,
            "analytics.total_repos": 1, "analytics.total_commits": 1,
            "analytics.total_contributions": 1,
            "platform_profiles": 1, "platform_usernames": 1,
            "leetcode_username": 1, "codechef_username": 1, "hackerrank_username": 1,
        }
    ))

    platform_charts = {"github": [], "leetcode": [], "codechef": [], "hackerrank": []}
    for student in student_documents:
        name = student.get("name", "Student")
        analytics = student.get("analytics", {}) or {}
        profiles = student.get("platform_profiles", {}) or {}
        usernames = student.get("platform_usernames", {}) or {}

        gh_user = student.get("github_username") or (usernames.get("github") if isinstance(usernames, dict) else "")
        if gh_user:
            platform_charts["github"].append({
                "name": name,
                "repositories": analytics.get("total_repos", 0) or 0,
                "commits": analytics.get("total_commits", 0) or 0,
                "contributions": analytics.get("total_contributions", 0) or 0,
            })

        lc_user = student.get("leetcode_username") or (usernames.get("leetcode") if isinstance(usernames, dict) else "")
        if lc_user:
            metrics = (profiles.get("leetcode") or {}).get("metrics", {}) or {}
            platform_charts["leetcode"].append({
                "name": name,
                "solved": metrics.get("solved", 0) or 0,
                "easy": metrics.get("easy", 0) or 0,
                "medium": metrics.get("medium", 0) or 0,
                "hard": metrics.get("hard", 0) or 0,
            })

        cc_user = student.get("codechef_username") or (usernames.get("codechef") if isinstance(usernames, dict) else "")
        if cc_user:
            metrics = (profiles.get("codechef") or {}).get("metrics", {}) or {}
            platform_charts["codechef"].append({
                "name": name,
                "rating": metrics.get("rating", 0) or 0,
                "stars": metrics.get("stars", 0) or 0,
                "problems_solved": metrics.get("problems_solved", 0) or 0,
                "global_rank": metrics.get("global_rank", 0) or 0,
                "country_rank": metrics.get("country_rank", 0) or 0,
            })

        hr_user = student.get("hackerrank_username") or (usernames.get("hackerrank") if isinstance(usernames, dict) else "")
        if hr_user:
            metrics = (profiles.get("hackerrank") or {}).get("metrics", {}) or {}
            platform_charts["hackerrank"].append({
                "name": name,
                "badges": metrics.get("badges", 0) or 0,
                "certificates": metrics.get("certificates", 0) or 0,
                "followers": metrics.get("followers", 0) or 0,
            })

    # Bulk fetch platform profiles for student streaks
    from app.services.streak_service import calculate_student_streaks
    from app.services.platform_storage import COLLECTIONS

    student_ids = [s["_id"] for s in student_documents if s.get("_id")]
    id_variants = []
    for sid in student_ids:
        id_variants.extend([sid, str(sid)])

    lc_docs = {doc.get("student_id"): doc for doc in db[COLLECTIONS["leetcode"]].find({"student_id": {"$in": id_variants}})}
    cc_docs = {doc.get("student_id"): doc for doc in db[COLLECTIONS["codechef"]].find({"student_id": {"$in": id_variants}})}
    hr_docs = {doc.get("student_id"): doc for doc in db[COLLECTIONS["hackerrank"]].find({"student_id": {"$in": id_variants}})}

    # Bulk fetch daily tasks once instead of querying in the loop
    tasks = list(db.daily_tasks.find({}))

    student_streaks = []
    for student in student_documents:
        sid = student.get("_id")
        if not sid:
            continue
        lc_doc = lc_docs.get(sid) or lc_docs.get(str(sid))
        cc_doc = cc_docs.get(sid) or cc_docs.get(str(sid))
        hr_doc = hr_docs.get(sid) or hr_docs.get(str(sid))

        streak_data = calculate_student_streaks(student, lc_doc=lc_doc, cc_doc=cc_doc, hr_doc=hr_doc, tasks=tasks)
        student_streaks.append({
            "student_id": str(sid),
            "name": student.get("name", ""),
            "department": student.get("department", ""),
            "year": student.get("year", ""),
            "leetcode_today": streak_data.get("leetcode", {}).get("solved_today", 0),
            "hackerrank_today": streak_data.get("hackerrank", {}).get("solved_today", 0),
            "codechef_today": streak_data.get("codechef", {}).get("solved_today", 0),
            "current_streak": streak_data.get("overall_current_streak", 0),
            "longest_streak": streak_data.get("overall_longest_streak", 0),
            "leetcode_streak": streak_data.get("leetcode", {}).get("current_streak", 0),
            "hackerrank_streak": streak_data.get("hackerrank", {}).get("current_streak", 0),
            "codechef_streak": streak_data.get("codechef", {}).get("current_streak", 0),
            "last_activity_date": streak_data.get("last_activity_date"),
            "last_updated": streak_data.get("last_updated"),
        })

    # Sort streaks descending
    student_streaks.sort(key=lambda x: (x["current_streak"], x["leetcode_today"] + x["hackerrank_today"] + x["codechef_today"]), reverse=True)

    result = {
        "total_students": totals.get("total_students", 0),
        "active_students": totals.get("active_students", 0),
        "total_repos": totals.get("total_repos", 0),
        "total_commits": totals.get("total_commits", 0),
        "total_contributions": totals.get("total_contributions", 0),
        "avg_score": round(totals.get("avg_score", 0) or 0, 1),
        "avg_streak": round(totals.get("avg_streak", 0) or 0, 1),
        "synced_today": synced_today,
        "inactive_students": inactive,
        "most_active_department": top_dept_result[0]["_id"] if top_dept_result else "N/A",
        "most_used_language": most_used_lang,
        "top_contributor": top_contributor,
        "platform_charts": platform_charts,
        "student_streaks": student_streaks,
    }

    cache_set(CACHE_KEY, result, ttl=60)
    return result


def get_department_stats():
    """Get analytics grouped by department."""
    pipeline = [
        {
            "$group": {
                "_id": "$department",
                "student_count": {"$sum": 1},
                "avg_score": {"$avg": "$github_score"},
                "total_repos": {"$sum": "$analytics.total_repos"},
                "total_commits": {"$sum": "$analytics.total_commits"},
                "avg_streak": {"$avg": "$analytics.current_streak"},
            }
        },
        {"$sort": {"avg_score": -1}},
    ]
    results = list(db.students.aggregate(pipeline))
    return [
        {
            "department": r["_id"],
            "student_count": r["student_count"],
            "avg_score": round(r["avg_score"] or 0, 1),
            "total_repos": r["total_repos"],
            "total_commits": r["total_commits"],
            "avg_streak": round(r["avg_streak"] or 0, 1),
        }
        for r in results
    ]


def get_language_stats():
    """Get language distribution across all students."""
    from app.cache import cache_get, cache_set
    CACHE_KEY = "language_stats"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    combined = {}
    for repo in db.repositories.find({}, {"languages": 1, "language": 1, "size": 1}):
        langs = repo.get("languages") or {}
        if not langs and repo.get("language"):
            # Older and rate-limited syncs may only have GitHub's primary
            # language. Repository size is a useful proportional fallback.
            langs = {repo["language"]: max(repo.get("size", 0), 1)}
        for lang, bytes_count in langs.items():
            if lang and isinstance(bytes_count, (int, float)) and bytes_count > 0:
                combined[lang] = combined.get(lang, 0) + bytes_count

    # Preserve compatibility with databases synced before repositories were
    # stored individually.
    if not combined:
        for student in db.students.find({}, {"analytics.languages": 1}):
            for lang, bytes_count in (student.get("analytics", {}).get("languages") or {}).items():
                if lang and isinstance(bytes_count, (int, float)) and bytes_count > 0:
                    combined[lang] = combined.get(lang, 0) + bytes_count

    total = sum(combined.values()) or 1
    result = [
        {"language": lang, "bytes": count, "percentage": round((count / total) * 100, 1)}
        for lang, count in sorted(combined.items(), key=lambda x: x[1], reverse=True)[:15]
    ]
    cache_set(CACHE_KEY, result, ttl=120)
    return result


def get_contribution_trends():
    """Get monthly contribution trends."""
    from app.cache import cache_get, cache_set
    CACHE_KEY = "contribution_trends"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    students = db.students.find({}, {"analytics.contribution_data": 1})
    monthly = {}
    for s in students:
        for day in s.get("analytics", {}).get("contribution_data", []):
            month = day.get("date", "")[:7]  # YYYY-MM
            if month:
                monthly[month] = monthly.get(month, 0) + day.get("count", 0)

    result = [
        {"month": m, "contributions": c}
        for m, c in sorted(monthly.items())[-12:]
    ]
    cache_set(CACHE_KEY, result, ttl=120)
    return result

