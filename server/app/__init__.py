import logging
import os
from flask import Flask, jsonify, send_file, send_from_directory, request
from flask_compress import Compress
from app.config import Config
from app.extensions import init_db, init_cors, init_jwt
from app.database import db
import bcrypt
from datetime import datetime, timezone


def create_app():
    """Flask application factory."""
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
    )
    dist_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "client", "dist"))
    app = Flask(__name__, static_folder=dist_folder, static_url_path="")
    app.config.from_object(Config)

    # ── Initialize extensions ───────────────────────────────────────
    Compress(app)
    app.config['COMPRESS_MIMETYPES'] = [
        'application/json', 'text/html', 'text/css',
        'text/xml', 'application/javascript', 'text/javascript',
    ]
    app.config['COMPRESS_MIN_SIZE'] = 256
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
    from app.routes.attendance import attendance_bp
    from app.routes.daily_task_reports import daily_task_reports_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(github_bp, url_prefix="/api/github")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(leaderboards_bp, url_prefix="/api/leaderboards")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(achievements_bp, url_prefix="/api/achievements")
    app.register_blueprint(daily_tasks_bp, url_prefix="/api/daily-tasks")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(daily_task_reports_bp, url_prefix="/api/daily-task-reports")

    # ── Seed default admin ──────────────────────────────────────────
    with app.app_context():
        _seed_admin()
        from app.services.platform_storage import initialize_platform_collections
        initialize_platform_collections()

    # ── Start scheduler ─────────────────────────────────────────────
    from app.tasks.scheduler import init_scheduler

    init_scheduler(app)

    # ── Error handlers & SPA Serving ────────────────────────────────
    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({"error": "Unprocessable entity"}), 422

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Rate limit exceeded. Try again later."}), 429

    # ── Health & API index ──────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()})

    @app.route("/api")
    def api_index():
        return jsonify({
            "name": "Placement Tracker API",
            "status": "online",
            "health": "/api/health",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    # ── Explicit Root Route (Serves React UI for /) ────────────────
    @app.route("/")
    def root_index():
        index_file = os.path.join(dist_folder, "index.html")
        if os.path.exists(index_file):
            return send_file(index_file), 200
        return jsonify({
            "name": "Placement Tracker API",
            "status": "online",
            "message": "Backend API is running. Run 'npm --prefix client run build' to generate frontend UI.",
            "health": "/api/health",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    # ── SPA Catch-All Error Handler (Serves React UI for non-API routes) ──
    @app.errorhandler(404)
    def not_found_or_spa(e):
        path = request.path.lstrip("/")
        if path.startswith("api/") or path == "api":
            return jsonify({"error": "Resource not found"}), 404

        target_file = os.path.join(dist_folder, path)
        if path and os.path.exists(target_file) and not os.path.isdir(target_file):
            return send_from_directory(dist_folder, path)

        index_file = os.path.join(dist_folder, "index.html")
        if os.path.exists(index_file):
            return send_file(index_file), 200

        return jsonify({
            "name": "Placement Tracker API",
            "status": "online",
            "message": "Backend API is running. Run 'npm --prefix client run build' to generate frontend UI.",
            "health": "/api/health",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 404

    return app


def _seed_admin():
    """Ensure default admin account exists with updated Nit2027@ credentials."""
    email = "krishnakumarkm2901@gmail.com"
    hashed = bcrypt.hashpw("Nit2027@".encode("utf-8"), bcrypt.gensalt(rounds=12))
    hashed_str = hashed.decode("utf-8")

    db.users.update_one(
        {"email": email},
        {
            "$set": {
                "name": "Admin",
                "email": email,
                "password": hashed_str,
                "role": "admin",
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "avatar": "",
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )
