"""Daily tasks (daily coding problems) routes."""

from flask import Blueprint, request, jsonify
import requests
from flask_jwt_extended import jwt_required
from datetime import datetime, timezone
from app.utils.decorators import admin_required, rate_limit
from app.extensions import db

daily_tasks_bp = Blueprint("daily_tasks", __name__)


def _today_string(dt=None):
    dt = dt or datetime.now(timezone.utc)
    return dt.date().isoformat()


@daily_tasks_bp.route("/today", methods=["GET"])
@rate_limit()
def get_today_tasks():
    """Return today's tasks for a platform (query param `platform`)."""
    platform = request.args.get("platform", "leetcode")
    date = request.args.get("date") or _today_string()
    doc = db.daily_tasks.find_one({"platform": platform, "date": date})
    if not doc:
        # No tasks set for today – try fetching LeetCode's active daily challenge
        if platform == 'leetcode':
            try:
                query = '''query { activeDailyCodingChallengeQuestion { date question { questionId title titleSlug difficulty } } }'''
                resp = requests.post('https://leetcode.com/graphql', json={'query': query}, headers={'Content-Type': 'application/json'}, timeout=5)
                data = resp.json()
                q = data.get('data', {}).get('activeDailyCodingChallengeQuestion', {}) or {}
                question = q.get('question')
                if question:
                    prob = {
                        'id': question.get('questionId'),
                        'title': question.get('title'),
                        'url': f"https://leetcode.com/problems/{question.get('titleSlug')}/",
                        'difficulty': question.get('difficulty')
                    }
                    return jsonify({"date": date, "platform": platform, "problems": [prob]}), 200
            except Exception:
                # ignore network/parse errors and fall through to empty response
                pass
        return jsonify({"date": date, "platform": platform, "problems": []}), 200
    doc.pop("_id", None)
    # convert datetimes
    if "updated_at" in doc and hasattr(doc["updated_at"], "isoformat"):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return jsonify(doc), 200


@daily_tasks_bp.route("", methods=["GET"])
@rate_limit()
def list_daily_tasks():
    """List historical daily tasks for a platform. Query params: platform, limit, skip."""
    platform = request.args.get("platform", "leetcode")
    try:
        limit = int(request.args.get("limit", 10))
    except Exception:
        limit = 10
    try:
        skip = int(request.args.get("skip", 0))
    except Exception:
        skip = 0

    cursor = db.daily_tasks.find({"platform": platform}).sort("date", -1).skip(skip).limit(limit)
    items = []
    for doc in cursor:
        doc.pop("_id", None)
        if "updated_at" in doc and hasattr(doc["updated_at"], "isoformat"):
            doc["updated_at"] = doc["updated_at"].isoformat()
        items.append(doc)
    total = db.daily_tasks.count_documents({"platform": platform})
    return jsonify({"platform": platform, "total": total, "items": items}), 200


@daily_tasks_bp.route("", methods=["POST"])
@admin_required
def set_daily_tasks():
    """Create or update daily tasks for a platform.

    Expects JSON: { date?: 'YYYY-MM-DD', platform: 'leetcode', problems: [{ id, title, url }, ...] }
    """
    data = request.get_json() or {}
    platform = data.get("platform")
    problems = data.get("problems")
    date = data.get("date") or _today_string()
    if not platform or not isinstance(problems, list) or len(problems) == 0:
        return jsonify({"error": "Required fields: platform, problems (non-empty list)"}), 400

    doc = {
        "platform": platform,
        "date": date,
        "problems": problems[:6],
        "updated_at": datetime.now(timezone.utc),
    }

    db.daily_tasks.update_one({"platform": platform, "date": date}, {"$set": doc}, upsert=True)
    doc.pop("updated_at", None)
    return jsonify({"message": "Daily tasks saved", "daily_tasks": doc}), 200
