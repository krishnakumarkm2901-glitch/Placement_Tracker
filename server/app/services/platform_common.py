"""Shared helpers used by coding-platform integrations."""

from datetime import datetime, timezone


from app.services.http_session import HEADERS, get_http_session


def normalize_platform_username(value):
    """Accept a username, @username, or full profile URL (including query parameters and trailing slashes)."""
    value = str(value or "").strip()
    if not value:
        return ""
    # Strip query parameters or anchor fragments
    value = value.split("?")[0].split("#")[0].rstrip("/")
    if "/" in value:
        parts = [p for p in value.split("/") if p]
        if parts:
            value = parts[-1]
            if value.lower() in {"profile", "users", "u", "members"} and len(parts) > 1:
                value = parts[-2]
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
