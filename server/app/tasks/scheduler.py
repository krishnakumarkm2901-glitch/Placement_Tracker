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
            print("⏰ Scheduled sync started...")
            sync_all_students()

    scheduler.add_job(
        func=sync_job,
        trigger=IntervalTrigger(hours=Config.SYNC_INTERVAL_HOURS),
        id="github_sync",
        name="GitHub Sync",
        replace_existing=True,
    )

    scheduler.start()
    print(f"📅 Scheduler started: syncing every {Config.SYNC_INTERVAL_HOURS} hours")
