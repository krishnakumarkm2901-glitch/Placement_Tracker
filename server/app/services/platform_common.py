"""Shared helpers used by coding-platform integrations."""

from datetime import datetime, timezone


from app.services.http_session import HEADERS, get_http_session


def normalize_platform_username(value):
    """Accept a username, @username, or full profile URL."""
    value = str(value or "").strip().rstrip("/")
    if "/" in value:
        value = value.rsplit("/", 1)[-1]
    return value.lstrip("@").strip()


def platform_result(platform, username, profile_url, metrics, raw=None, avatar_url=None):
    raw_dict = raw or {}
    avatar = avatar_url or raw_dict.get("avatar_url") or raw_dict.get("avatar")
    return {
        "platform": platform,
        "username": username,
        "profile_url": profile_url,
        "avatar_url": avatar,
        "metrics": metrics,
        "raw": raw_dict,
        "status": "synced",
        "last_synced": datetime.now(timezone.utc).isoformat(),
    }
