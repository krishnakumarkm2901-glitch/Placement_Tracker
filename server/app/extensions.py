from flask_jwt_extended import JWTManager
from flask_cors import CORS

from app.database import init_db as init_database, db

jwt = JWTManager()


def init_db(app):
    """Initialize MongoDB connection."""
    return init_database(app)


def init_cors(app):
    """Initialize CORS with support for Vercel, local dev, and custom frontend URLs."""
    frontend_url = app.config.get("FRONTEND_URL", "")
    if not frontend_url or frontend_url == "*":
        origins = "*"
    else:
        origins = [origin.strip() for origin in frontend_url.split(",") if origin.strip()]
        # Support Vercel deployment origins and localhost
        origins.append(r"https://.*\.vercel\.app")
        origins.append(r"http://localhost:.*")
        origins.append(r"http://127\.0\.0\.1:.*")

    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    )


def init_jwt(app):
    """Initialize JWT."""
    jwt.init_app(app)
