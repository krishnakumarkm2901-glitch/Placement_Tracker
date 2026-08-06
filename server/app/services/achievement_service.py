"""Achievement service — evaluate and award badges."""

from bson import ObjectId
from app.extensions import db
from app.models.achievement import ACHIEVEMENT_DEFINITIONS, create_achievement
from app.models.notification import create_notification


def evaluate_achievements(student_id):
    """Check and award new achievements for a student."""
    student = db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        return []

    analytics = student.get("analytics", {})
    existing = [a.get("key") for a in student.get("achievements", [])]
    repos = list(db.repositories.find({"student_id": ObjectId(student_id)}))

    # Build context for achievement conditions
    context = {
        "total_repos": analytics.get("total_repos", 0),
        "total_commits": analytics.get("total_commits", 0),
        "total_contributions": analytics.get("total_contributions", 0),
        "current_streak": analytics.get("current_streak", 0),
        "longest_streak": analytics.get("longest_streak", 0),
        "languages": analytics.get("languages", {}),
        "total_stars": analytics.get("total_stars", 0),
        "total_forks": analytics.get("total_forks", 0),
        "has_ai_repo": any(
            any(t in ["ai", "ml", "machine-learning", "deep-learning", "artificial-intelligence"]
                for t in r.get("topics", []))
            for r in repos
        ),
        "all_repos_have_readme": all(
            r.get("quality_details", {}).get("has_readme", False)
            for r in repos
        ) if repos else False,
        "external_contributions": sum(1 for r in repos if r.get("fork", False)),
    }

    # Check for rank
    rank_cursor = db.students.find(
        {"is_active": True}, {"_id": 1}
    ).sort("github_score", -1)
    rank = 1
    for s in rank_cursor:
        if str(s["_id"]) == student_id:
            break
        rank += 1
    context["rank"] = rank

    new_achievements = []
    for key, defn in ACHIEVEMENT_DEFINITIONS.items():
        if key not in existing:
            try:
                if defn["condition"](context):
                    ach = create_achievement(ObjectId(student_id), key)
                    db.achievements.insert_one(ach)
                    new_achievements.append(ach)

                    # Add to student's achievements list
                    db.students.update_one(
                        {"_id": ObjectId(student_id)},
                        {"$push": {"achievements": {"key": key, "title": defn["title"], "icon": defn["icon"], "earned_at": ach["earned_at"]}}},
                    )

                    # Notification
                    db.notifications.insert_one(
                        create_notification(
                            "New Achievement!",
                            f'{student.get("name", "")} earned "{defn["title"]}" {defn["icon"]}',
                            "new_achievement",
                            ObjectId(student_id),
                        )
                    )
            except Exception:
                continue

    return new_achievements
