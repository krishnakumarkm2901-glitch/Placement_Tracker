"""GitHub sync routes."""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.utils.decorators import admin_required, rate_limit
from app.services.sync_service import (
    sync_all_students, sync_all_students_for_platform, sync_student_safely, get_sync_status
)
from app.utils.helpers import parse_object_id

github_bp = Blueprint("github", __name__)


from app.database import db


def _check_needs_sync(platform=None):
    students = list(db.students.find({"is_active": True}))
    if not students:
        return False

    for student in students:
        if platform:
            if platform == "github":
                if student.get("sync_status") != "synced":
                    return True
            else:
                user = (student.get("platform_usernames") or {}).get(platform) or student.get(f"{platform}_username")
                if user and (student.get("platform_profiles") or {}).get(platform, {}).get("status") != "synced":
                    return True
        else:
            if student.get("github_username") and student.get("sync_status") != "synced":
                return True
            profiles = student.get("platform_profiles") or {}
            usernames = student.get("platform_usernames") or {}
            for p in ["leetcode", "codechef", "hackerrank"]:
                user = usernames.get(p) or student.get(f"{p}_username")
                if user and (profiles.get(p) or {}).get("status") != "synced":
                    return True

    return False


@github_bp.route("/sync", methods=["POST"])
@admin_required
@rate_limit(max_requests=5, window_seconds=300)
def trigger_sync():
    """Trigger GitHub, LeetCode, CodeChef, and HackerRank sync."""
    if not _check_needs_sync():
        return jsonify({
            "message": "Nothing to sync. All platform profiles are already up to date!",
            "nothing_to_sync": True,
            "status": get_sync_status(),
        }), 200

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
    if not _check_needs_sync(platform):
        return jsonify({
            "message": f"Nothing to sync. All {platform.capitalize()} profiles are already up to date!",
            "nothing_to_sync": True,
            "status": get_sync_status(),
        }), 200

    import threading
    thread = threading.Thread(target=sync_all_students_for_platform, args=(platform,), daemon=True)
    thread.start()
    return jsonify({"message": f"{platform.capitalize()} sync started", "status": get_sync_status()}), 200


@github_bp.route("/sync/status", methods=["GET"])
@jwt_required()
def sync_status():
    """Get current sync status."""
    return jsonify(get_sync_status()), 200
