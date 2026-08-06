"""Notification routes."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from bson import ObjectId
from app.extensions import db
from app.models.notification import serialize_notification
from app.utils.decorators import rate_limit
from app.utils.helpers import get_pagination_params

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("", methods=["GET"])
@jwt_required()
@rate_limit()
def get_notifications():
    """Get notifications with pagination."""
    page, limit, skip = get_pagination_params(request)
    unread_only = request.args.get("unread", "false").lower() == "true"

    query = {}
    if unread_only:
        query["read"] = False

    total = db.notifications.count_documents(query)
    notifications = list(
        db.notifications.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    unread_count = db.notifications.count_documents({"read": False})

    return jsonify({
        "notifications": [serialize_notification(n) for n in notifications],
        "unread_count": unread_count,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
        },
    }), 200


@notifications_bp.route("/<notification_id>/read", methods=["PATCH"])
@jwt_required()
def mark_read(notification_id):
    """Mark a notification as read."""
    try:
        db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}},
        )
    except Exception:
        return jsonify({"error": "Invalid notification ID"}), 400

    return jsonify({"message": "Marked as read"}), 200


@notifications_bp.route("/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_read():
    """Mark all notifications as read."""
    db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return jsonify({"message": "All notifications marked as read"}), 200


@notifications_bp.route("/<notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification."""
    try:
        db.notifications.delete_one({"_id": ObjectId(notification_id)})
    except Exception:
        return jsonify({"error": "Invalid notification ID"}), 400
    return jsonify({"message": "Notification deleted"}), 200
