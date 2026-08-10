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


def load_platform_data(student):
    """Hydrate API-compatible fields from the dedicated collections."""
    student_id = student.get("_id")
    if not student_id:
        return student
    github = db.github_profiles.find_one({"student_id": student_id})
    if github:
        student["github_profile"] = github.get("profile", {})
        student["analytics"] = github.get("analytics", student.get("analytics", {}))
    profiles = dict(student.get("platform_profiles", {}) or {})
    for platform in ("leetcode", "codechef", "hackerrank"):
        stored = db[COLLECTIONS[platform]].find_one({"student_id": student_id})
        if stored:
            profiles[platform] = stored.get("profile", {})
    student["platform_profiles"] = profiles
    return student


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

