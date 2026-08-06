from flask_jwt_extended import JWTManager
from flask_cors import CORS

from app.database import init_db as init_database, db

jwt = JWTManager()


def init_db(app):
    """Initialize MongoDB connection."""
    return init_database(app)


def init_cors(app):
    """Initialize CORS."""
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_URL"]}},
        supports_credentials=True,
    )


def init_jwt(app):
    """Initialize JWT."""
    jwt.init_app(app)
