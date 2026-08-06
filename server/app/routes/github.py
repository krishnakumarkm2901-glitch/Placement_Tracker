"""GitHub sync routes."""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.utils.decorators import admin_required, rate_limit
from app.services.sync_service import (
    sync_all_students, sync_all_students_for_platform, sync_student_safely, get_sync_status
)
from app.utils.helpers import parse_object_id

github_bp = Blueprint("github", __name__)


@github_bp.route("/sync", methods=["POST"])
@admin_required
@rate_limit(max_requests=5, window_seconds=300)
def trigger_sync():
    """Trigger GitHub, LeetCode, CodeChef, and HackerRank sync."""
    import threading
    thread = threading.Thread(target=sync_all_students, daemon=True)
    thread.start()
    return jsonify({"message": "All-platform sync started", "status": get_sync_status()}), 200


@github_bp.route("/sync/<student_id>", methods=["POST"])
@admin_required
@rate_limit(max_requests=10, window_seconds=60)
def trigger_student_sync(student_id):
    """Trigger sync for a single student."""
    oid = parse_object_id(student_id)
    if not oid:
        return jsonify({"error": "Invalid student ID"}), 400

    import threading
    thread = threading.Thread(
        target=sync_student_safely, args=(student_id,), daemon=True
    )
    thread.start()
    return jsonify({"message": "Student sync started"}), 200


@github_bp.route("/sync/platform/<platform>", methods=["POST"])
@admin_required
@rate_limit(max_requests=5, window_seconds=300)
def trigger_platform_sync(platform):
    """Trigger sync for a single platform across all students."""
    import threading
    thread = threading.Thread(target=sync_all_students_for_platform, args=(platform,), daemon=True)
    thread.start()
    return jsonify({"message": f"{platform.capitalize()} sync started", "status": get_sync_status()}), 200


@github_bp.route("/sync/status", methods=["GET"])
@jwt_required()
def sync_status():
    """Get current sync status."""
    return jsonify(get_sync_status()), 200
