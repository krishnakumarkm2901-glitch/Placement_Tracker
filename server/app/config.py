import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"

    # MongoDB
    MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017/Placement_Tracker")
    MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "Placement_Tracker")

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 86400))  # 24h
    JWT_REFRESH_TOKEN_EXPIRES = int(
        os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 2592000)
    )  # 30d

    # GitHub
    GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
    GITHUB_API_URL = "https://api.github.com"
    GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

    # CORS
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Sync
    SYNC_INTERVAL_HOURS = int(os.getenv("SYNC_INTERVAL_HOURS", 12))

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", 100))
