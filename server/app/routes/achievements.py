"""Achievement routes."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson import ObjectId
from app.extensions import db
from app.models.achievement import serialize_achievement, ACHIEVEMENT_DEFINITIONS
from app.utils.decorators import rate_limit

achievements_bp = Blueprint("achievements", __name__)


@achievements_bp.route("", methods=["GET"])
@jwt_required()
@rate_limit()
def get_all_achievements():
    """Get all possible achievements."""
    achievements = [
        {
            "key": key,
            "title": defn["title"],
            "description": defn["description"],
            "icon": defn["icon"],
        }
        for key, defn in ACHIEVEMENT_DEFINITIONS.items()
    ]
    return jsonify({"achievements": achievements}), 200


@achievements_bp.route("/student/<student_id>", methods=["GET"])
@jwt_required()
def get_student_achievements(student_id):
    """Get achievements for a specific student."""
    try:
        oid = ObjectId(student_id)
    except Exception:
        return jsonify({"error": "Invalid student ID"}), 400

    achievements = list(db.achievements.find({"student_id": oid}).sort("earned_at", -1))

    # Get all possible achievements for progress tracking
    earned_keys = [a.get("key") for a in achievements]
    all_achievements = []
    for key, defn in ACHIEVEMENT_DEFINITIONS.items():
        all_achievements.append({
            "key": key,
            "title": defn["title"],
            "description": defn["description"],
            "icon": defn["icon"],
            "earned": key in earned_keys,
            "earned_at": next(
                (serialize_achievement(a)["earned_at"] for a in achievements if a.get("key") == key),
                None,
            ),
        })

    return jsonify({
        "achievements": all_achievements,
        "earned_count": len(earned_keys),
        "total_count": len(ACHIEVEMENT_DEFINITIONS),
    }), 200
