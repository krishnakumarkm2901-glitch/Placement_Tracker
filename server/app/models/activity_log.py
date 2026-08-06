"""Activity log document schema and helpers."""

from datetime import datetime, timezone


def create_activity_log(user_id, action, details="", entity_type="", entity_id=None):
    """Create an activity log document."""
    return {
        "user_id": user_id,
        "action": action,
        "details": details,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "ip_address": "",
        "created_at": datetime.now(timezone.utc),
    }


def serialize_activity_log(log):
    """Serialize activity log for JSON response."""
    if not log:
        return None
    return {
        "id": str(log["_id"]),
        "user_id": str(log.get("user_id", "")),
        "action": log.get("action", ""),
        "details": log.get("details", ""),
        "entity_type": log.get("entity_type", ""),
        "entity_id": str(log["entity_id"]) if log.get("entity_id") else None,
        "created_at": (
            log["created_at"].isoformat() if log.get("created_at") else None
        ),
    }
