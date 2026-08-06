"""Common utility helpers."""

from bson import ObjectId
from datetime import datetime, timezone


def parse_object_id(id_str):
    """Safely parse a string to ObjectId."""
    try:
        return ObjectId(id_str)
    except Exception:
        return None


def get_pagination_params(request):
    """Extract pagination parameters from request args."""
    try:
        page = max(int(request.args.get("page", 1)), 1)
        limit = min(max(int(request.args.get("limit", 20)), 1), 100)
    except (ValueError, TypeError):
        page, limit = 1, 20
    skip = (page - 1) * limit
    return page, limit, skip


def build_sort(request, default_field="created_at", default_order=-1):
    """Build MongoDB sort from request args."""
    sort_field = request.args.get("sort_by", default_field)
    sort_order = -1 if request.args.get("sort_order", "desc") == "desc" else 1
    allowed_fields = [
        "created_at", "name", "github_score",
        "department", "year", "total_repos", "total_commits",
        "current_streak", "updated_at",
    ]
    if sort_field not in allowed_fields:
        sort_field = default_field
    return [(sort_field, sort_order)]


def format_datetime(dt):
    """Format datetime for display."""
    if not dt:
        return ""
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def now_utc():
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)
