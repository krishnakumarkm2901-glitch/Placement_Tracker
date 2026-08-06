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
    """Aggregate dashboard statistics."""
    from app.models.student import serialize_student_summary

    student_documents = list(db.students.find({}))
    student_summaries = [serialize_student_summary(student) for student in student_documents]
    total_students = db.students.count_documents({})
    active_students = db.students.count_documents({"is_active": True})

    pipeline_repos = [{"$group": {"_id": None, "total": {"$sum": "$analytics.total_repos"}}}]
    total_repos_result = list(db.students.aggregate(pipeline_repos))
    total_repos = total_repos_result[0]["total"] if total_repos_result else 0

    pipeline_commits = [{"$group": {"_id": None, "total": {"$sum": "$analytics.total_commits"}}}]
    total_commits_result = list(db.students.aggregate(pipeline_commits))
    total_commits = total_commits_result[0]["total"] if total_commits_result else 0

    pipeline_contributions = [{"$group": {"_id": None, "total": {"$sum": "$analytics.total_contributions"}}}]
    total_contributions_result = list(db.students.aggregate(pipeline_contributions))
    total_contributions = total_contributions_result[0]["total"] if total_contributions_result else 0

    avg_score = round(
        sum(student.get("github_score", 0) for student in student_summaries) / len(student_summaries), 1
    ) if student_summaries else 0

    pipeline_avg_streak = [{"$group": {"_id": None, "avg": {"$avg": "$analytics.current_streak"}}}]
    avg_streak_result = list(db.students.aggregate(pipeline_avg_streak))
    avg_streak = round(avg_streak_result[0]["avg"], 1) if avg_streak_result and avg_streak_result[0]["avg"] else 0

    # Synced today
    from datetime import datetime, timezone, timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    synced_today = db.students.count_documents({"last_synced": {"$gte": today_start}})

    # Inactive (no sync in 7 days or never synced)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    inactive = db.students.count_documents({
        "$or": [
            {"last_synced": None},
            {"last_synced": {"$lt": week_ago}},
        ]
    })

    # Most active department
    pipeline_dept = [
        {"$group": {"_id": "$department", "avg_score": {"$avg": "$github_score"}, "count": {"$sum": 1}}},
        {"$sort": {"avg_score": -1}},
        {"$limit": 1},
    ]
    dept_result = list(db.students.aggregate(pipeline_dept))
    most_active_dept = dept_result[0]["_id"] if dept_result else "N/A"

    # Most used language
    pipeline_lang = [
        {"$unwind": {"path": "$analytics.languages", "preserveNullAndEmptyArrays": False}},
    ]
    # Simpler approach: count from students
    all_students = db.students.find({}, {"analytics.most_used_language": 1})
    lang_counts = {}
    for s in all_students:
        lang = s.get("analytics", {}).get("most_used_language", "")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
    most_used_lang = max(lang_counts, key=lang_counts.get) if lang_counts else "N/A"

    # Top contributor
    top = max(student_summaries, key=lambda student: student.get("github_score", 0), default=None)
    top_contributor = {
        "name": top.get("name", "N/A"),
        "github_username": top.get("github_username", ""),
        "score": top.get("github_score", 0),
        "avatar": top.get("avatar_url", ""),
    } if top else None

    platform_charts = {
        "github": [],
        "leetcode": [],
        "codechef": [],
        "hackerrank": [],
    }
    for student in student_documents:
        name = student.get("name", "Student")
        analytics = student.get("analytics", {}) or {}
        profiles = student.get("platform_profiles", {}) or {}
        usernames = student.get("platform_usernames", {}) or {}

        if student.get("github_username"):
            platform_charts["github"].append({
                "name": name,
                "repositories": analytics.get("total_repos", 0) or 0,
                "commits": analytics.get("total_commits", 0) or 0,
                "contributions": analytics.get("total_contributions", 0) or 0,
            })

        if usernames.get("leetcode"):
            metrics = (profiles.get("leetcode") or {}).get("metrics", {}) or {}
            platform_charts["leetcode"].append({
                "name": name,
                "solved": metrics.get("solved", 0) or 0,
                "easy": metrics.get("easy", 0) or 0,
                "medium": metrics.get("medium", 0) or 0,
                "hard": metrics.get("hard", 0) or 0,
            })

        if usernames.get("codechef"):
            metrics = (profiles.get("codechef") or {}).get("metrics", {}) or {}
            platform_charts["codechef"].append({
                "name": name,
                "rating": metrics.get("rating", 0) or 0,
                "stars": metrics.get("stars", 0) or 0,
                "problems_solved": metrics.get("problems_solved", 0) or 0,
                "global_rank": metrics.get("global_rank", 0) or 0,
                "country_rank": metrics.get("country_rank", 0) or 0,
            })

        if usernames.get("hackerrank"):
            metrics = (profiles.get("hackerrank") or {}).get("metrics", {}) or {}
            platform_charts["hackerrank"].append({
                "name": name,
                "badges": metrics.get("badges", 0) or 0,
                "certificates": metrics.get("certificates", 0) or 0,
                "followers": metrics.get("followers", 0) or 0,
            })

    return {
        "total_students": total_students,
        "active_students": active_students,
        "total_repos": total_repos,
        "total_commits": total_commits,
        "total_contributions": total_contributions,
        "avg_score": avg_score,
        "avg_streak": avg_streak,
        "synced_today": synced_today,
        "inactive_students": inactive,
        "most_active_department": most_active_dept,
        "most_used_language": most_used_lang,
        "top_contributor": top_contributor,
        "platform_charts": platform_charts,
    }


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
    return [
        {"language": lang, "bytes": count, "percentage": round((count / total) * 100, 1)}
        for lang, count in sorted(combined.items(), key=lambda x: x[1], reverse=True)[:15]
    ]


def get_contribution_trends():
    """Get monthly contribution trends."""
    students = db.students.find({}, {"analytics.contribution_data": 1})
    monthly = {}
    for s in students:
        for day in s.get("analytics", {}).get("contribution_data", []):
            month = day.get("date", "")[:7]  # YYYY-MM
            if month:
                monthly[month] = monthly.get(month, 0) + day.get("count", 0)

    return [
        {"month": m, "contributions": c}
        for m, c in sorted(monthly.items())[-12:]
    ]
