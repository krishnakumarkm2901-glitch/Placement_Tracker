"""Daily tasks (daily coding problems) routes."""

from flask import Blueprint, request, jsonify
import requests
from flask_jwt_extended import jwt_required
from datetime import datetime, timezone
import re
from app.utils.decorators import admin_required, rate_limit
from app.extensions import db

daily_tasks_bp = Blueprint("daily_tasks", __name__)


def _today_string(dt=None):
    dt = dt or datetime.now(timezone.utc)
    return dt.date().isoformat()


HACKERRANK_ALIASES = {
    'python-if-else': 'py-if-else',
    'say-hello-world-with-python': 'py-hello-world',
    'print-function': 'python-print',
    'arithmetic-operators': 'python-arithmetic-operators',
    'python-division': 'python-division',
    'loops': 'python-loops',
    'write-a-function': 'write-a-function',
}

def _format_problem(prob, platform, index):
    if isinstance(prob, str):
        prob = {"title": prob}
    title = str(prob.get("title") or prob.get("url") or f"Problem #{index}").strip()
    url = str(prob.get("url") or "").strip()

    if not url or not url.startswith("http"):
        p = (platform or "leetcode").lower()
        if title.startswith("http://") or title.startswith("https://"):
            url = title
        elif p == "codechef":
            clean_slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')
            code = clean_slug.upper() if ' ' in title else title.upper()
            url = f"https://www.codechef.com/problems/{code}"
        elif p == "hackerrank":
            slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')
            slug = HACKERRANK_ALIASES.get(slug, slug)
            url = f"https://www.hackerrank.com/challenges/{slug}/problem"
        else:
            slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')
            url = f"https://leetcode.com/problems/{slug}/"

    return {
        "id": str(prob.get("id") or index),
        "title": title,
        "url": url,
        "difficulty": prob.get("difficulty")
    }


@daily_tasks_bp.route("/today", methods=["GET"])
@rate_limit()
def get_today_tasks():
    """Return today's tasks for a platform (query param `platform`)."""
    platform = request.args.get("platform", "leetcode")
    date = request.args.get("date") or _today_string()
    doc = db.daily_tasks.find_one({"platform": platform, "date": date})
    if not doc:
        return jsonify({"date": date, "platform": platform, "problems": []}), 200
    doc.pop("_id", None)
    # convert datetimes
    if "updated_at" in doc and hasattr(doc["updated_at"], "isoformat"):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return jsonify(doc), 200


@daily_tasks_bp.route("/leetcode-daily", methods=["GET"])
@rate_limit()
def get_leetcode_daily_challenge():
    """Fetch the actual LeetCode Daily Challenge for today from LeetCode or cache."""
    date_str = request.args.get("date") or _today_string()
    
    # 1. Try to find in cache
    try:
        cached = db.leetcode_daily_challenge.find_one({"date": date_str})
        if cached:
            cached.pop("_id", None)
            return jsonify(cached), 200
    except Exception:
        pass

    # 2. If not cached, fetch from LeetCode GraphQL
    try:
        query = """
        query {
            activeDailyCodingChallengeQuestion {
                date
                link
                question {
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                }
            }
        }
        """
        resp = requests.post(
            'https://leetcode.com/graphql',
            json={'query': query},
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            q = data.get('data', {}).get('activeDailyCodingChallengeQuestion', {}) or {}
            question = q.get('question')
            if question:
                frontend_id = question.get('questionFrontendId') or question.get('questionId')
                title = question.get('title')
                slug = question.get('titleSlug')
                difficulty = question.get('difficulty')
                
                if title and slug:
                    challenge_doc = {
                        "date": date_str,
                        "id": str(frontend_id),
                        "title": title,
                        "titleSlug": slug,
                        "difficulty": difficulty or "Medium",
                        "url": f"https://leetcode.com/problems/{slug}/"
                    }
                    # Save to cache
                    try:
                        db.leetcode_daily_challenge.update_one(
                            {"date": date_str},
                            {"$set": challenge_doc},
                            upsert=True
                        )
                    except Exception:
                        pass
                    return jsonify(challenge_doc), 200
    except Exception:
        pass
        
    return jsonify({"error": "Failed to fetch LeetCode daily challenge"}), 500


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

    formatted_problems = [_format_problem(p, platform, i + 1) for i, p in enumerate(problems[:6])]

    doc = {
        "platform": platform,
        "date": date,
        "problems": formatted_problems,
        "updated_at": datetime.now(timezone.utc),
    }

    db.daily_tasks.update_one({"platform": platform, "date": date}, {"$set": doc}, upsert=True)
    doc.pop("updated_at", None)
    return jsonify({"message": "Daily tasks saved", "daily_tasks": doc}), 200
