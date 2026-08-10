"""Student document schema and helpers."""

from datetime import datetime, timezone


def serialize_datetime(value):
    """Return an ISO timestamp with an explicit timezone.

    MongoDB stores datetimes as UTC but PyMongo commonly returns them without
    tzinfo. Without the UTC marker, browsers incorrectly interpret the value
    as local time instead of converting it to the user's local timezone.
    """
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def create_student(name, department, year, github_username, email, platform_usernames=None):
    """Create a student document."""
    platform_usernames = platform_usernames or {}
    return {
        "name": name,
        "department": department,
        "year": year,
        "github_username": github_username,
        "leetcode_username": platform_usernames.get("leetcode", ""),
        "codechef_username": platform_usernames.get("codechef", ""),
        "hackerrank_username": platform_usernames.get("hackerrank", ""),
        "platform_usernames": {
            "github": github_username,
            **platform_usernames,
        },
        "platform_profiles": {},
        "email": email,
        "github_profile": {},
        "analytics": {
            "total_repos": 0,
            "total_commits": 0,
            "total_contributions": 0,
            "total_stars": 0,
            "total_forks": 0,
            "total_issues": 0,
            "total_prs": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "most_used_language": "",
            "languages": {},
            "contribution_data": [],
            "commit_data": [],
            "weekly_contributions": 0,
            "monthly_contributions": 0,
            "yearly_contributions": 0,
        },
        "achievements": [],
        "last_synced": None,
        "sync_status": "pending",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


def serialize_student(student):
    """Serialize student for JSON response."""
    if not student:
        return None
    from app.services.platform_storage import load_platform_data
    student = load_platform_data(student)
    # Use pre-computed score if available; only recalculate if missing
    github_score = student.get("github_score")
    scores = student.get("scores")
    if github_score is None or not scores:
        from app.services.analytics_service import calculate_github_score
        github_score, scores = calculate_github_score(str(student["_id"]))
    return {
        "id": str(student["_id"]),
        "name": student.get("name", ""),
        "department": student.get("department", ""),
        "year": student.get("year", ""),
        "github_username": student.get("github_username", ""),
        "leetcode_username": student.get("leetcode_username", student.get("platform_usernames", {}).get("leetcode", "")),
        "codechef_username": student.get("codechef_username", student.get("platform_usernames", {}).get("codechef", "")),
        "hackerrank_username": student.get("hackerrank_username", student.get("platform_usernames", {}).get("hackerrank", "")),
        "platform_usernames": student.get("platform_usernames", {"github": student.get("github_username", "")}),
        "platform_profiles": student.get("platform_profiles", {}),
        "email": student.get("email", ""),
        "github_profile": student.get("github_profile", {}),
        "github_score": github_score,
        "scores": scores,
        "analytics": student.get("analytics", {}),
        "achievements": student.get("achievements", []),
        "last_synced": serialize_datetime(student.get("last_synced")),
        "sync_status": student.get("sync_status", "pending"),
        "is_active": student.get("is_active", True),
        "created_at": serialize_datetime(student.get("created_at")),
        "updated_at": serialize_datetime(student.get("updated_at")),
    }


def serialize_student_summary(student):
    """Lightweight fast serialization for list views."""
    if not student:
        return None
    github_score = student.get("github_score", 0)
    if not github_score and "analytics" in student:
        analytics = student.get("analytics") or {}
        commits = analytics.get("total_commits", 0)
        repos = analytics.get("total_repos", 0)
        contributions = analytics.get("total_contributions", 0)
        github_score = min(100, int(commits * 0.4 + contributions * 0.4 + repos * 2))

    return {
        "id": str(student["_id"]),
        "name": student.get("name", ""),
        "department": student.get("department", ""),
        "year": student.get("year", ""),
        "github_username": student.get("github_username", ""),
        "leetcode_username": student.get("leetcode_username", student.get("platform_usernames", {}).get("leetcode", "")),
        "codechef_username": student.get("codechef_username", student.get("platform_usernames", {}).get("codechef", "")),
        "hackerrank_username": student.get("hackerrank_username", student.get("platform_usernames", {}).get("hackerrank", "")),
        "platform_usernames": student.get("platform_usernames", {"github": student.get("github_username", "")}),
        "platform_profiles": student.get("platform_profiles", {}),
        "github_score": github_score,
        "total_repos": student.get("analytics", {}).get("total_repos", 0),
        "total_commits": student.get("analytics", {}).get("total_commits", 0),
        "total_contributions": student.get("analytics", {}).get("total_contributions", 0),
        "current_streak": student.get("analytics", {}).get("current_streak", 0),
        "most_used_language": student.get("analytics", {}).get("most_used_language", ""),
        "avatar_url": student.get("github_profile", {}).get("avatar_url", ""),
        "last_synced": serialize_datetime(student.get("last_synced")),
        "sync_status": student.get("sync_status", "pending"),
        "is_active": student.get("is_active", True),
    }
