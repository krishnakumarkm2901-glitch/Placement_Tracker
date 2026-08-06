"""Achievement document schema and helpers."""

from datetime import datetime, timezone


ACHIEVEMENT_DEFINITIONS = {
    "first_repo": {
        "title": "First Repository",
        "description": "Created your first repository",
        "icon": "🏆",
        "condition": lambda a: a.get("total_repos", 0) >= 1,
    },
    "streak_30": {
        "title": "30-Day Streak",
        "description": "Maintained a 30-day contribution streak",
        "icon": "🔥",
        "condition": lambda a: a.get("longest_streak", 0) >= 30,
    },
    "commits_100": {
        "title": "100 Commits",
        "description": "Made 100 commits across all repositories",
        "icon": "⭐",
        "condition": lambda a: a.get("total_commits", 0) >= 100,
    },
    "top_contributor": {
        "title": "Top Contributor",
        "description": "Reached the top 10 in overall leaderboard",
        "icon": "🚀",
        "condition": lambda a: a.get("rank", 999) <= 10,
    },
    "polyglot": {
        "title": "Full Stack Developer",
        "description": "Used 5 or more programming languages",
        "icon": "💻",
        "condition": lambda a: len(a.get("languages", {})) >= 5,
    },
    "ai_developer": {
        "title": "AI Developer",
        "description": "Created a repository with AI/ML topics",
        "icon": "🤖",
        "condition": lambda a: a.get("has_ai_repo", False),
    },
    "doc_expert": {
        "title": "Documentation Expert",
        "description": "All repositories have README files",
        "icon": "📚",
        "condition": lambda a: a.get("all_repos_have_readme", False) and a.get("total_repos", 0) >= 3,
    },
    "open_source": {
        "title": "Open Source Contributor",
        "description": "Contributed to external repositories",
        "icon": "📦",
        "condition": lambda a: a.get("external_contributions", 0) >= 1,
    },
}


def create_achievement(student_id, achievement_key):
    """Create an achievement document."""
    defn = ACHIEVEMENT_DEFINITIONS.get(achievement_key, {})
    return {
        "student_id": student_id,
        "key": achievement_key,
        "title": defn.get("title", achievement_key),
        "description": defn.get("description", ""),
        "icon": defn.get("icon", "🏅"),
        "earned_at": datetime.now(timezone.utc),
    }


def serialize_achievement(ach):
    """Serialize achievement for JSON response."""
    if not ach:
        return None
    return {
        "id": str(ach["_id"]) if ach.get("_id") else None,
        "key": ach.get("key", ""),
        "title": ach.get("title", ""),
        "description": ach.get("description", ""),
        "icon": ach.get("icon", "🏅"),
        "earned_at": (
            ach["earned_at"].isoformat() if ach.get("earned_at") else None
        ),
    }
