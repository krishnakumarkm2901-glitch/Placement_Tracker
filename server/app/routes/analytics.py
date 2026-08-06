"""Analytics and dashboard routes."""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.utils.decorators import rate_limit
from app.services.analytics_service import (
    get_dashboard_stats,
    get_department_stats,
    get_language_stats,
    get_contribution_trends,
)

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/dashboard", methods=["GET"])
@jwt_required()
@rate_limit()
def dashboard():
    """Get dashboard statistics."""
    stats = get_dashboard_stats()
    return jsonify(stats), 200


@analytics_bp.route("/departments", methods=["GET"])
@jwt_required()
@rate_limit()
def departments():
    """Get department-wise analytics."""
    data = get_department_stats()
    return jsonify({"departments": data}), 200


@analytics_bp.route("/languages", methods=["GET"])
@jwt_required()
@rate_limit()
def languages():
    """Get language distribution."""
    data = get_language_stats()
    return jsonify({"languages": data}), 200


@analytics_bp.route("/contributions", methods=["GET"])
@jwt_required()
@rate_limit()
def contributions():
    """Get contribution trends."""
    data = get_contribution_trends()
    return jsonify({"trends": data}), 200
