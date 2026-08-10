"""Leaderboard routes."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.student import serialize_student_summary
from app.utils.decorators import rate_limit
from app.cache import cached_response

leaderboards_bp = Blueprint("leaderboards", __name__)


@leaderboards_bp.route("", methods=["GET"])
@jwt_required()
@rate_limit()
@cached_response(ttl=120, prefix="leaderboard")
def get_leaderboard():
    """Get overall leaderboard with filters."""
    limit = min(int(request.args.get("limit", 50)), 100)
    sort_by = request.args.get("sort_by", "github_score")
    department = request.args.get("department")
    year = request.args.get("year")

    allowed_sorts = {
        "github_score": "github_score",
        "commits": "analytics.total_commits",
        "repos": "analytics.total_repos",
        "streak": "analytics.current_streak",
        "contributions": "analytics.total_contributions",
        "stars": "analytics.total_stars",
    }

    sort_field = allowed_sorts.get(sort_by, "github_score")

    query = {"is_active": True}
    if department:
        query["department"] = department
    if year:
        query["year"] = year

    students = list(
        db.students.find(query)
        .sort(sort_field, -1)
        .limit(limit)
    )
    entries = [serialize_student_summary(student) for student in students]
    response_fields = {
        "github_score": "github_score",
        "commits": "total_commits",
        "repos": "total_repos",
        "contributions": "total_contributions",
        "stars": "total_stars",
    }
    response_field = response_fields.get(sort_by, "github_score")
    entries.sort(key=lambda entry: entry.get(response_field, 0), reverse=True)

    leaderboard = []
    for i, entry in enumerate(entries[:limit], 1):
        entry["rank"] = i
        leaderboard.append(entry)

    return jsonify({"leaderboard": leaderboard}), 200


@leaderboards_bp.route("/top-contributors", methods=["GET"])
@jwt_required()
def top_contributors():
    """Get top contributors."""
    limit = min(int(request.args.get("limit", 10)), 50)
    students = list(
        db.students.find({"is_active": True})
        .sort("analytics.total_contributions", -1)
        .limit(limit)
    )
    return jsonify({
        "contributors": [
            {
                "rank": i,
                **serialize_student_summary(s),
            }
            for i, s in enumerate(students, 1)
        ]
    }), 200


@leaderboards_bp.route("/streaks", methods=["GET"])
@jwt_required()
def top_streaks():
    """Get top streak holders."""
    limit = min(int(request.args.get("limit", 10)), 50)
    students = list(
        db.students.find({"is_active": True})
        .sort("analytics.longest_streak", -1)
        .limit(limit)
    )
    return jsonify({
        "streaks": [
            {
                "rank": i,
                **serialize_student_summary(s),
                "longest_streak": s.get("analytics", {}).get("longest_streak", 0),
            }
            for i, s in enumerate(students, 1)
        ]
    }), 200
