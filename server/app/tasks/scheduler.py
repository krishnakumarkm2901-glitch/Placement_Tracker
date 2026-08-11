"""APScheduler configuration for automatic GitHub sync."""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = BackgroundScheduler()


def init_scheduler(app):
    """Initialize the scheduler with the sync job."""
    from app.config import Config

    if scheduler.running:
        return

    def sync_job():
        with app.app_context():
            from app.services.sync_service import sync_all_students
            print("[SYNC] Scheduled sync started...")
            sync_all_students()

    def auto_retry_job():
        with app.app_context():
            from app.database import db
            from app.services.sync_service import sync_all_students
            unsynced_count = db.students.count_documents({
                "is_active": True,
                "$or": [
                    {"sync_status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                    {"platform_profiles.codechef.status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                    {"platform_profiles.leetcode.status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                    {"platform_profiles.hackerrank.status": {"$in": ["pending", "failed", "rate_limited", "syncing"]}},
                ]
            })
            if unsynced_count > 0:
                print(f"[AUTO-SYNC] Found {unsynced_count} pending/failed profiles. Starting automatic sync...")
                sync_all_students()

    scheduler.add_job(
        func=sync_job,
        trigger=IntervalTrigger(hours=Config.SYNC_INTERVAL_HOURS),
        id="github_sync",
        name="GitHub Sync",
        replace_existing=True,
    )

    scheduler.add_job(
        func=auto_retry_job,
        trigger=IntervalTrigger(minutes=5),
        id="auto_retry_sync",
        name="Auto Retry Unsynced Profiles",
        replace_existing=True,
    )

    scheduler.start()
    print(f"[SCHEDULER] Started: full sync every {Config.SYNC_INTERVAL_HOURS} hours, auto-retry every 5 minutes")
