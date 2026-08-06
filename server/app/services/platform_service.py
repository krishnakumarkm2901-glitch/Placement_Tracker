"""Coordinate synchronization across coding-platform integrations."""

from datetime import datetime, timezone

from bson import ObjectId

from app.extensions import db
from app.services.codechef_service import fetch_codechef
from app.services.hackerrank_service import fetch_hackerrank
from app.services.leetcode_service import fetch_leetcode
from app.services.platform_common import normalize_platform_username
from app.services.platform_storage import COLLECTIONS, save_platform_profile


FETCHERS = {
    "leetcode": fetch_leetcode,
    "codechef": fetch_codechef,
    "hackerrank": fetch_hackerrank,
}


def sync_coding_profiles(student_id, platform=None):
    student = db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        return {}

    usernames = student.get("platform_usernames", {})
    profiles = dict(student.get("platform_profiles", {}))
    platforms_to_sync = [platform] if platform else FETCHERS.keys()
    for platform_name in platforms_to_sync:
        fetcher = FETCHERS.get(platform_name)
        if not fetcher:
            continue

        username = normalize_platform_username(usernames.get(platform_name))
        if not username:
            profiles.pop(platform_name, None)
            db[COLLECTIONS[platform_name]].delete_one({"student_id": student["_id"]})
            continue
        try:
            profiles[platform_name] = fetcher(username)
        except Exception as exc:
            profiles[platform_name] = {
                "platform": platform_name,
                "username": username,
                "status": "failed",
                "error": str(exc),
                "last_synced": datetime.now(timezone.utc).isoformat(),
            }
        save_platform_profile(student["_id"], platform_name, profiles[platform_name], username)

    normalized_usernames = {
        key: normalize_platform_username(value) for key, value in usernames.items()
    }
    normalized_usernames["github"] = student.get(
        "github_username", normalized_usernames.get("github", "")
    )
    db.students.update_one(
        {"_id": student["_id"]},
        {"$set": {
            "platform_usernames": normalized_usernames,
            "leetcode_username": normalized_usernames.get("leetcode", ""),
            "codechef_username": normalized_usernames.get("codechef", ""),
            "hackerrank_username": normalized_usernames.get("hackerrank", ""),
            "platform_profiles": profiles,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return profiles


__all__ = [
    "normalize_platform_username",
    "sync_coding_profiles",
    "fetch_leetcode",
    "fetch_codechef",
    "fetch_hackerrank",
]
