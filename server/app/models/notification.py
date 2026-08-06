"""Notification document schema and helpers."""

from datetime import datetime, timezone


NOTIFICATION_TYPES = [
    "student_inactive",
    "repo_created",
    "repo_deleted",
    "new_achievement",
    "sync_failed",
    "invalid_username",
    "sync_completed",
    "info",
]


def create_notification(title, message, notification_type="info", student_id=None):
    """Create a notification document."""
    return {
        "title": title,
        "message": message,
        "type": notification_type,
        "student_id": student_id,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }


def serialize_notification(notif):
    """Serialize notification for JSON response."""
    if not notif:
        return None
    return {
        "id": str(notif["_id"]),
        "title": notif.get("title", ""),
        "message": notif.get("message", ""),
        "type": notif.get("type", "info"),
        "student_id": str(notif["student_id"]) if notif.get("student_id") else None,
        "read": notif.get("read", False),
        "created_at": (
            notif["created_at"].isoformat() if notif.get("created_at") else None
        ),
    }
