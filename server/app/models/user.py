"""User document schema and helpers."""

from datetime import datetime, timezone
from bson import ObjectId


def create_user(name, email, password_hash, role="student", avatar="", student_id=None):
    """Create a user document."""
    user = {
        "name": name,
        "email": email,
        "password": password_hash,
        "role": role,
        "avatar": avatar,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if student_id:
        user["student_id"] = student_id
    return user


def serialize_user(user):
    """Serialize user for JSON response (exclude password)."""
    if not user:
        return None
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", "student"),
        "avatar": user.get("avatar", ""),
        "student_id": str(user["student_id"]) if user.get("student_id") else None,
        "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else None,
    }
