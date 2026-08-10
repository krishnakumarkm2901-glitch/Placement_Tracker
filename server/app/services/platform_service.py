"""Coordinate synchronization across coding-platform integrations in parallel with incremental DB updates."""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from bson import ObjectId

from app.extensions import db
from app.services.codechef_service import fetch_codechef
from app.services.hackerrank_service import fetch_hackerrank
from app.services.leetcode_service import fetch_leetcode
from app.services.platform_common import normalize_platform_username
from app.services.platform_storage import COLLECTIONS, save_platform_profile

logger = logging.getLogger(__name__)

FETCHERS = {
    "leetcode": fetch_leetcode,
    "codechef": fetch_codechef,
    "hackerrank": fetch_hackerrank,
}


def _sync_single_platform(student_id, platform_name, username, current_profiles):
    """Fetch profile for one platform, returning (platform_name, profile_dict, error)."""
    fetcher = FETCHERS.get(platform_name)
    if not fetcher:
        return platform_name, None, "Unsupported platform"

    try:
        profile = fetcher(username)
        return platform_name, profile, None
    except Exception as exc:
        timestamp = datetime.now(timezone.utc).isoformat()
        logger.warning(
            f"[{timestamp}] Platform sync failed | Student ID: {student_id} | Platform: {platform_name} | Username: {username} | Error: {exc}"
        )

        old_profile = current_profiles.get(platform_name)
        if old_profile and old_profile.get("status") == "synced":
            # Preserve existing synced data on transient error
            return platform_name, old_profile, str(exc)

        is_rate_limit = "429" in str(exc) or "rate" in str(exc).lower()
        is_invalid = "invalid" in str(exc).lower() or "format" in str(exc).lower() or " " in str(username)
        status = "rate_limited" if is_rate_limit else ("invalid_username" if is_invalid else ("not_found" if "not found" in str(exc).lower() else "failed"))
        failed_profile = {
            "platform": platform_name,
            "username": username,
            "status": status,
            "error": str(exc),
            "last_synced": timestamp,
        }
        return platform_name, failed_profile, str(exc)


def sync_coding_profiles(student_id, platform=None):
    """Sync coding platform profiles in parallel with incremental DB updates."""
    student = db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        return {}

    usernames = student.get("platform_usernames", {})
    existing_profiles = dict(student.get("platform_profiles", {}))
    platforms_to_sync = [platform] if platform else list(FETCHERS.keys())

    tasks = []
    for platform_name in platforms_to_sync:
        raw_username = usernames.get(platform_name) or student.get(f"{platform_name}_username")
        username = normalize_platform_username(raw_username)

        # REQUIREMENT 4: SKIP EMPTY USERNAMES BEFORE CALLING ANY API
        if not username:
            if platform_name in existing_profiles:
                existing_profiles.pop(platform_name, None)
                db[COLLECTIONS[platform_name]].delete_one({"student_id": student["_id"]})
            continue

        tasks.append((platform_name, username))

    if tasks:
        # REQUIREMENT 6: FAST PARALLEL PLATFORM SYNC USING ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=len(tasks)) as executor:
            futures = [
                executor.submit(_sync_single_platform, str(student["_id"]), p_name, u_name, existing_profiles)
                for p_name, u_name in tasks
            ]
            for future in futures:
                p_name, profile_result, _ = future.result()
                if profile_result:
                    existing_profiles[p_name] = profile_result
                    # Save individual collection profile
                    u_name_matched = next((u for p, u in tasks if p == p_name), "")
                    save_platform_profile(student["_id"], p_name, profile_result, u_name_matched)

    # Normalize usernames for DB storage
    normalized_usernames = {
        key: normalize_platform_username(value) for key, value in usernames.items()
    }
    normalized_usernames["github"] = student.get(
        "github_username", normalized_usernames.get("github", "")
    )

    # REQUIREMENT 7: INCREMENTAL DATABASE UPDATE (Only $set changed fields)
    updated_fields = {}

    if student.get("platform_usernames") != normalized_usernames:
        updated_fields["platform_usernames"] = normalized_usernames
        updated_fields["leetcode_username"] = normalized_usernames.get("leetcode", "")
        updated_fields["codechef_username"] = normalized_usernames.get("codechef", "")
        updated_fields["hackerrank_username"] = normalized_usernames.get("hackerrank", "")

    if student.get("platform_profiles") != existing_profiles:
        updated_fields["platform_profiles"] = existing_profiles

    if updated_fields:
        updated_fields["updated_at"] = datetime.now(timezone.utc)
        db.students.update_one({"_id": student["_id"]}, {"$set": updated_fields})

    return existing_profiles


__all__ = [
    "FETCHERS",
    "sync_coding_profiles",
]
