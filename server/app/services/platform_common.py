"""Shared helpers used by coding-platform integrations."""

from datetime import datetime, timezone


HEADERS = {
    "User-Agent": "Mozilla/5.0 Placement-Tracker/1.0",
    "Accept": "application/json,text/html",
}


def normalize_platform_username(value):
    """Accept a username, @username, or full profile URL."""
    value = str(value or "").strip().rstrip("/")
    if "/" in value:
        value = value.rsplit("/", 1)[-1]
    return value.lstrip("@").strip()


def platform_result(platform, username, profile_url, metrics, raw=None):
    return {
        "platform": platform,
        "username": username,
        "profile_url": profile_url,
        "metrics": metrics,
        "raw": raw or {},
        "status": "synced",
        "last_synced": datetime.now(timezone.utc).isoformat(),
    }
