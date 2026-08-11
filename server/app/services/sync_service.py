"""Sync service — orchestrates GitHub data synchronization."""

from datetime import datetime, timezone
from bson import ObjectId
from app.extensions import db
from app.services.github_service import github_service
from app.services.achievement_service import evaluate_achievements
from app.services.platform_service import sync_coding_profiles, FETCHERS
from app.models.repository import create_repository, calculate_repo_quality
from app.models.notification import create_notification
import time

# Module-level sync state
sync_state = {
    "is_syncing": False,
    "progress": 0,
    "total": 0,
    "current_student": "",
    "last_sync": None,
    "last_status": "idle",
    "errors": [],
}


def get_sync_status():
    """Return current sync state."""
    last_sync = sync_state["last_sync"]
    if last_sync and last_sync.tzinfo is None:
        last_sync = last_sync.replace(tzinfo=timezone.utc)
    return {
        **sync_state,
        "last_sync": last_sync.astimezone(timezone.utc).isoformat() if last_sync else None,
    }


def sync_student_safely(student_id):
    """Run an individual sync and always leave a terminal status on failure."""
    try:
        return sync_student(student_id)
    except Exception as exc:
        db.students.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {
                "sync_status": "failed",
                "sync_error": str(exc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        return False


def normalize_all_student_usernames():
    """Normalize all student platform usernames in DB (strip @, URLs, spaces)."""
    from app.services.platform_common import normalize_platform_username
    students = list(db.students.find({"is_active": True}))
    for student in students:
        usernames = student.get("platform_usernames") or {}
        gh = normalize_platform_username(student.get("github_username") or usernames.get("github"))
        lc = normalize_platform_username(student.get("leetcode_username") or usernames.get("leetcode"))
        cc = normalize_platform_username(student.get("codechef_username") or usernames.get("codechef"))
        hr = normalize_platform_username(student.get("hackerrank_username") or usernames.get("hackerrank"))

        norm_dict = {"github": gh, "leetcode": lc, "codechef": cc, "hackerrank": hr}

        db.students.update_one(
            {"_id": student["_id"]},
            {"$set": {
                "github_username": gh,
                "leetcode_username": lc,
                "codechef_username": cc,
                "hackerrank_username": hr,
                "platform_usernames": norm_dict,
            }}
        )


def sync_all_students():
    """Sync GitHub and every configured coding platform continuously for all active students until fully synced."""
    global sync_state

    if sync_state["is_syncing"]:
        return {"error": "Sync already in progress"}

    normalize_all_student_usernames()
    students = list(db.students.find({"is_active": True}))
    sync_state.update({
        "is_syncing": True,
        "progress": 0,
        "total": len(students),
        "current_student": "",
        "last_status": "in_progress",
        "errors": [],
    })

    def _sync_student_worker(student):
        s_id = str(student["_id"])
        s_name = student.get("name", "")
        try:
            if student.get("github_username"):
                sync_student(s_id)
            sync_coding_profiles(s_id)
            return s_name, None
        except Exception as e:
            return s_name, str(e)

    try:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        # Pass 1: High-speed parallel sync across all active students
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(_sync_student_worker, s): s for s in students}
            completed = 0
            for future in as_completed(futures):
                s_name, err = future.result()
                completed += 1
                sync_state["progress"] = completed
                sync_state["current_student"] = s_name
                if err:
                    sync_state["errors"].append({"student": s_name, "error": err})

        # Continuous Pass: Automatically retry any remaining unsynced student profiles
        for pass_num in range(2):
            unsynced = list(db.students.find({
                "is_active": True,
                "$or": [
                    {"sync_status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                    {"platform_profiles.codechef.status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                    {"platform_profiles.leetcode.status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                    {"platform_profiles.hackerrank.status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                ]
            }))
            if not unsynced:
                break
            with ThreadPoolExecutor(max_workers=5) as executor:
                retry_futures = {executor.submit(_sync_student_worker, s): s for s in unsynced}
                for future in as_completed(retry_futures):
                    future.result()

        sync_state.update({
            "is_syncing": False,
            "progress": len(students),
            "last_sync": datetime.now(timezone.utc),
            "last_status": "completed_with_errors" if sync_state["errors"] else "completed",
            "current_student": "",
        })

        db.notifications.insert_one(
            create_notification(
                "Sync Completed",
                f"Continuous sync completed for {len(students)} students.",
                "sync_completed",
            )
        )

    except Exception as e:
        sync_state.update({
            "is_syncing": False,
            "last_status": "failed",
            "current_student": "",
        })
        db.notifications.insert_one(
            create_notification("Sync Failed", str(e), "sync_failed")
        )

    return sync_state


from concurrent.futures import ThreadPoolExecutor, as_completed


def sync_all_students_for_platform(platform):
    """Sync only the requested platform for every active student concurrently."""
    global sync_state

    supported_platforms = {"github"} | set(FETCHERS.keys())
    if platform not in supported_platforms:
        return {"error": f"Unsupported platform: {platform}"}

    if sync_state["is_syncing"]:
        return {"error": "Sync already in progress"}

    normalize_all_student_usernames()
    students = list(db.students.find({"is_active": True}))
    sync_state.update({
        "is_syncing": True,
        "progress": 0,
        "total": len(students),
        "current_student": "",
        "last_status": "in_progress",
        "errors": [],
    })

    def _sync_worker(student):
        s_id = str(student["_id"])
        s_name = student.get("name", "")
        err_entry = None
        try:
            if platform == "github":
                sync_student(s_id)
            else:
                profiles = sync_coding_profiles(s_id, platform=platform)
                profile = profiles.get(platform, {})
                if profile.get("status") in {"failed", "rate_limited"}:
                    err_entry = {
                        "student": s_name,
                        "platform": platform,
                        "error": profile.get("error", f"{platform} sync status: {profile.get('status')}"),
                    }
        except Exception as e:
            err_entry = {
                "student": s_name,
                "platform": platform,
                "error": str(e),
            }
        return s_name, err_entry

    try:
        max_workers = 20
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_student = {executor.submit(_sync_worker, student): student for student in students}
            completed_count = 0
            for future in as_completed(future_to_student):
                s_name, err_entry = future.result()
                completed_count += 1
                sync_state["progress"] = completed_count
                sync_state["current_student"] = s_name
                if err_entry:
                    sync_state["errors"].append(err_entry)

        sync_state.update({
            "is_syncing": False,
            "progress": len(students),
            "last_sync": datetime.now(timezone.utc),
            "last_status": "completed_with_errors" if sync_state["errors"] else "completed",
            "current_student": "",
        })

        db.notifications.insert_one(
            create_notification(
                "Sync Completed",
                f"Processed {len(students)} students for {platform} with {len(sync_state['errors'])} errors.",
                "sync_completed",
            )
        )

    except Exception as e:
        sync_state.update({
            "is_syncing": False,
            "last_status": "failed",
            "current_student": "",
        })
        db.notifications.insert_one(
            create_notification("Sync Failed", str(e), "sync_failed")
        )

    return sync_state


def sync_student(student_id):
    """Sync a single student's GitHub data."""
    student = db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        return None

    username = student.get("github_username", "")
    if not username:
        return None

    db.students.update_one(
        {"_id": ObjectId(student_id)},
        {"$set": {"sync_status": "syncing", "updated_at": datetime.now(timezone.utc)}},
    )

    # ── Fetch profile ───────────────────────────────────────────────
    profile = github_service.get_user_profile(username)
    if not profile:
        # The REST API may be temporarily rate-limited without a token. The
        # public profile calendar lives on github.com, so preserve previously
        # fetched repository data and still refresh contributions when a
        # profile has already been synced once.
        public_contributions = github_service.get_public_contribution_data(username)
        if student.get("github_profile") and public_contributions:
            from datetime import timedelta
            days = public_contributions.get("contribution_days", [])
            now = datetime.now(timezone.utc)
            week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
            month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
            year_ago = (now - timedelta(days=365)).strftime("%Y-%m-%d")
            current_streak, longest_streak = github_service.calculate_streak(days)
            public_commit_total = public_contributions.get("total_commits", 0)
            if not public_commit_total:
                public_commit_total = public_contributions.get("total_contributions", 0)
            db.students.update_one(
                {"_id": ObjectId(student_id)},
                {"$set": {
                    "analytics.total_contributions": public_contributions.get("total_contributions", 0),
                    "analytics.total_commits": public_commit_total,
                    "analytics.contribution_data": days,
                    "analytics.weekly_contributions": sum(d.get("count", 0) for d in days if d.get("date", "") >= week_ago),
                    "analytics.monthly_contributions": sum(d.get("count", 0) for d in days if d.get("date", "") >= month_ago),
                    "analytics.yearly_contributions": sum(d.get("count", 0) for d in days if d.get("date", "") >= year_ago),
                    "analytics.current_streak": current_streak,
                    "analytics.longest_streak": longest_streak,
                    "sync_status": "synced",
                    "last_synced": now,
                    "updated_at": now,
                }},
            )
            return True
        db.students.update_one(
            {"_id": ObjectId(student_id)},
            {
                "$set": {
                    "sync_status": "failed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        db.notifications.insert_one(
            create_notification(
                "Invalid GitHub Username",
                f"Could not fetch profile for {username}",
                "invalid_username",
                ObjectId(student_id),
            )
        )
        return None

    # ── Fetch repositories ──────────────────────────────────────────
    repos_data = github_service.get_user_repos(username)
    total_stars = 0
    total_forks = 0
    authored_commit_total = github_service.get_user_commits_count(username)
    total_commits = authored_commit_total or 0
    has_commit_count = authored_commit_total is not None
    all_languages = {}

    # Preserve project commit totals if a later GitHub request is rate-limited.
    previous_commit_counts = {
        repo.get("name"): repo.get("commit_count", 0)
        for repo in db.repositories.find(
            {"student_id": ObjectId(student_id)},
            {"name": 1, "commit_count": 1},
        )
    }

    # Remove old repos and insert fresh
    db.repositories.delete_many({"student_id": ObjectId(student_id)})

    for repo_data in repos_data:
        repo_doc = create_repository(ObjectId(student_id), repo_data)

        # Fetch languages
        languages = github_service.get_repo_languages(username, repo_data["name"])
        if not languages and repo_data.get("language"):
            # The repository payload still includes its primary language when
            # GitHub's more detailed languages endpoint is rate-limited.
            languages = {repo_data["language"]: max(repo_data.get("size", 0), 1)}
        repo_doc["languages"] = languages
        for lang, bytes_count in languages.items():
            all_languages[lang] = all_languages.get(lang, 0) + bytes_count

        # Check README
        readme_details = github_service.get_repo_readme_details(
            username,
            repo_data["name"],
            repo_data.get("default_branch") or "main",
        )
        repo_doc["quality_details"] = readme_details

        # Calculate quality
        quality_score, quality_details = calculate_repo_quality(repo_doc)
        repo_doc["quality_score"] = quality_score
        repo_doc["quality_details"].update(quality_details)

        # Commit count
        commits = github_service.get_repo_commits_count(
            username, repo_data["name"], author=username
        )
        effective_commit_count = (
            commits
            if commits is not None
            else previous_commit_counts.get(repo_data["name"], 0)
        )
        repo_doc["commit_count"] = effective_commit_count
        if authored_commit_total is None:
            if commits is not None or repo_data["name"] in previous_commit_counts:
                has_commit_count = True
            total_commits += effective_commit_count

        total_stars += repo_data.get("stargazers_count", 0)
        total_forks += repo_data.get("forks_count", 0)

        db.repositories.insert_one(repo_doc)
        time.sleep(0.3)  # Rate limit

    # ── Fetch contribution data (GraphQL) ───────────────────────────
    contribution_data = github_service.get_contribution_data(username)
    contribution_days = []
    total_contributions = 0
    weekly_contributions = 0
    monthly_contributions = 0
    yearly_contributions = 0
    total_prs = 0
    total_issues = 0

    if contribution_data:
        contribution_days = contribution_data.get("contribution_days", [])
        total_contributions = contribution_data.get("total_contributions", 0)
        total_prs = contribution_data.get("total_prs", 0)
        total_issues = contribution_data.get("total_issues", 0)
        contribution_commits = contribution_data.get("total_commits", 0)
        if contribution_data.get("commit_count_exact"):
            has_commit_count = True
            total_commits = contribution_commits
        elif contribution_commits:
            has_commit_count = True
            total_commits = max(total_commits, contribution_commits)
        elif not has_commit_count and total_contributions:
            # Without a token GitHub's public calendar does not separate
            # contribution types. It remains a dependable last-resort count
            # when commit-specific REST endpoints are rate-limited.
            has_commit_count = True
            total_commits = total_contributions

        # Calculate weekly / monthly
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        year_ago = (now - timedelta(days=365)).strftime("%Y-%m-%d")

        for day in contribution_days:
            d = day.get("date", "")
            c = day.get("count", 0)
            if d >= week_ago:
                weekly_contributions += c
            if d >= month_ago:
                monthly_contributions += c
            if d >= year_ago:
                yearly_contributions += c

    # PR and Issue data
    pr_data = github_service.get_pr_data(username)
    issue_data = github_service.get_issue_data(username)

    # ── Streak ──────────────────────────────────────────────────────
    current_streak, longest_streak = github_service.calculate_streak(contribution_days)

    # ── Most used language ──────────────────────────────────────────
    most_used_language = ""
    if all_languages:
        most_used_language = max(all_languages, key=all_languages.get)

    # ── Update student ──────────────────────────────────────────────
    update_data = {
        "github_profile": profile,
        "analytics": {
            "total_repos": len(repos_data),
            "total_commits": total_commits if has_commit_count else student.get("analytics", {}).get("total_commits", 0),
            "total_contributions": total_contributions,
            "total_stars": total_stars,
            "total_forks": total_forks,
            "total_issues": issue_data.get("total", total_issues),
            "total_prs": pr_data.get("total", total_prs),
            "pr_data": pr_data,
            "issue_data": issue_data,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "most_used_language": most_used_language,
            "languages": all_languages,
            "contribution_data": contribution_days,
            "weekly_contributions": weekly_contributions,
            "monthly_contributions": monthly_contributions,
            "yearly_contributions": yearly_contributions,
        },
        "last_synced": datetime.now(timezone.utc),
        "sync_status": "synced",
        "updated_at": datetime.now(timezone.utc),
    }

    db.students.update_one(
        {"_id": ObjectId(student_id)},
        {"$set": update_data, "$unset": {"github_score": "", "scores": ""}},
    )

    # ── Evaluate achievements ───────────────────────────────────────
    from app.services.platform_storage import save_platform_profile
    save_platform_profile(
        ObjectId(student_id), "github", profile, username, update_data["analytics"]
    )

    evaluate_achievements(student_id)

    return True
