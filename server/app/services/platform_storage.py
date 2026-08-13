"""Persistence helpers for platform-specific MongoDB collections."""

from datetime import datetime, timezone

from app.extensions import db


COLLECTIONS = {
    "github": "github_profiles",
    "leetcode": "leetcode_profiles",
    "codechef": "codechef_profiles",
    "hackerrank": "hackerrank_profiles",
}


def cleanup_orphaned_platform_profiles():
    """Remove platform records whose parent student no longer exists."""
    student_ids = list(db.students.distinct("_id"))
    valid_references = student_ids + [str(student_id) for student_id in student_ids]
    deleted = {}
    for platform, collection_name in COLLECTIONS.items():
        result = db[collection_name].delete_many(
            {"student_id": {"$nin": valid_references}}
        )
        deleted[platform] = result.deleted_count
    return deleted


def save_platform_profile(student_id, platform, profile, username="", analytics=None):
    """Upsert one student's platform data into its dedicated collection."""
    document = {
        "student_id": student_id,
        "platform": platform,
        "username": username or (profile or {}).get("username", ""),
        "profile": profile or {},
        "updated_at": datetime.now(timezone.utc),
    }
    if analytics is not None:
        document["analytics"] = analytics
    db[COLLECTIONS[platform]].update_one(
        {"student_id": student_id}, {"$set": document}, upsert=True
    )


from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))


def _recalculate_profile_streaks(profile, platform):
    """Ensure loaded profile metrics accurately reflect real IST current_streak & longest_streak."""
    if not profile or not isinstance(profile, dict):
        return profile
    metrics = profile.get("metrics")
    if not isinstance(metrics, dict):
        return profile

    from app.services.streak_service import compute_consecutive_streak, get_active_dates_lc, get_active_dates_date_str
    today_ist = datetime.now(IST).date()

    if platform == "leetcode":
        active_dates = get_active_dates_lc(profile)
    else:
        active_dates = get_active_dates_date_str(profile)

    if active_dates:
        curr, max_s = compute_consecutive_streak(active_dates, today_ist)
        metrics["current_streak"] = curr
        metrics["longest_streak"] = max_s
        metrics["streak"] = curr
    elif "current_streak" in metrics:
        metrics["current_streak"] = 0
        metrics["streak"] = 0

    return profile


def load_platform_data(student):
    """Hydrate API-compatible fields from the dedicated collections."""
    student_id = student.get("_id")
    if not student_id:
        return student
    github = db.github_profiles.find_one({"student_id": {"$in": [student_id, str(student_id)]}})
    if github:
        student["github_profile"] = github.get("profile", {})
        student["analytics"] = github.get("analytics", student.get("analytics", {}))
    profiles = dict(student.get("platform_profiles", {}) or {})
    for platform in ("leetcode", "codechef", "hackerrank"):
        stored = db[COLLECTIONS[platform]].find_one({"student_id": {"$in": [student_id, str(student_id)]}})
        if stored:
            prof = stored.get("profile", {})
            prof = _recalculate_profile_streaks(prof, platform)
            profiles[platform] = prof
    student["platform_profiles"] = profiles
    return student


def load_platform_data_bulk(students):
    """Hydrate API-compatible fields for a list of students using 4 bulk queries total."""
    if not students:
        return []

    student_id_map = {}
    valid_references = []
    for s in students:
        s_id = s.get("_id")
        if s_id:
            student_id_map[s_id] = s
            student_id_map[str(s_id)] = s
            valid_references.extend([s_id, str(s_id)])

    if not valid_references:
        return students

    # Bulk query 1: github_profiles
    for gh in db.github_profiles.find({"student_id": {"$in": valid_references}}):
        target = student_id_map.get(gh.get("student_id"))
        if target:
            target["github_profile"] = gh.get("profile", {})
            target["analytics"] = gh.get("analytics", target.get("analytics", {}))

    # Bulk queries 2, 3, 4: competitive programming profiles
    for platform in ("leetcode", "codechef", "hackerrank"):
        coll = COLLECTIONS[platform]
        for pd in db[coll].find({"student_id": {"$in": valid_references}}):
            target = student_id_map.get(pd.get("student_id"))
            if target:
                profiles = dict(target.get("platform_profiles", {}) or {})
                prof = pd.get("profile", {})
                prof = _recalculate_profile_streaks(prof, platform)
                profiles[platform] = prof
                target["platform_profiles"] = profiles

    return students


def initialize_platform_collections():
    """Create indexes and migrate existing embedded profiles safely."""
    for collection_name in COLLECTIONS.values():
        db[collection_name].create_index("student_id", unique=True)
        db[collection_name].create_index("username")
    cleanup_orphaned_platform_profiles()

    # Bulk-fetch existing profile student_ids to avoid N individual find_one() calls
    existing_github_ids = set(
        doc["student_id"] for doc in db.github_profiles.find({}, {"student_id": 1})
    )
    existing_platform_ids = {}
    for platform in ("leetcode", "codechef", "hackerrank"):
        existing_platform_ids[platform] = set(
            doc["student_id"] for doc in db[COLLECTIONS[platform]].find({}, {"student_id": 1})
        )

    for student in db.students.find({}):
        student_id = student["_id"]
        if (student.get("github_profile") or student.get("analytics")) and student_id not in existing_github_ids:
            save_platform_profile(student_id, "github", student.get("github_profile", {}), student.get("github_username", ""), student.get("analytics", {}))
        profiles = student.get("platform_profiles", {}) or {}
        usernames = student.get("platform_usernames", {}) or {}
        for platform in ("leetcode", "codechef", "hackerrank"):
            if profiles.get(platform) and student_id not in existing_platform_ids.get(platform, set()):
                save_platform_profile(student_id, platform, profiles[platform], usernames.get(platform, ""))

