from flask import Flask, jsonify
from app.config import Config
from app.extensions import init_db, init_cors, init_jwt
from app.database import db
import bcrypt
from datetime import datetime, timezone


def create_app():
    """Flask application factory."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # ── Initialize extensions ───────────────────────────────────────
    init_cors(app)
    init_jwt(app)
    init_db(app)

    # ── Register blueprints ─────────────────────────────────────────
    from app.routes.auth import auth_bp
    from app.routes.students import students_bp
    from app.routes.github import github_bp
    from app.routes.analytics import analytics_bp
    from app.routes.leaderboards import leaderboards_bp
    from app.routes.reports import reports_bp
    from app.routes.notifications import notifications_bp
    from app.routes.achievements import achievements_bp
    from app.routes.daily_tasks import daily_tasks_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(github_bp, url_prefix="/api/github")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(leaderboards_bp, url_prefix="/api/leaderboards")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(achievements_bp, url_prefix="/api/achievements")
    app.register_blueprint(daily_tasks_bp, url_prefix="/api/daily-tasks")

    # ── Seed default admin ──────────────────────────────────────────
    with app.app_context():
        _seed_admin()
        from app.services.platform_storage import initialize_platform_collections
        initialize_platform_collections()

    # ── Start scheduler ─────────────────────────────────────────────
    from app.tasks.scheduler import init_scheduler

    init_scheduler(app)

    # ── Error handlers ──────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({"error": "Unprocessable entity"}), 422

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Rate limit exceeded. Try again later."}), 429

    # ── Root & Health check ──────────────────────────────────────────
    @app.route("/")
    @app.route("/api")
    def root():
        return jsonify({
            "name": "Placement Tracker API",
            "status": "online",
            "message": "Placement Tracker backend service is running successfully.",
            "health": "/api/health",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    @app.route("/api/health")
    def health():
        return jsonify({"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()})

    return app


def _seed_admin():
    """Create default admin account if none exists."""
    if db.users.count_documents({"role": "admin"}) == 0:
        hashed = bcrypt.hashpw("Krishnakm2901@".encode("utf-8"), bcrypt.gensalt(rounds=12))
        db.users.insert_one(
            {
                "name": "Admin",
                "email": "krishnakumarkm2901@gmail.com",
                "password": hashed.decode("utf-8"),
                "role": "admin",
                "avatar": "",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        # print("✅ Default admin seeded: admin@gitpulse.com / admin123")
