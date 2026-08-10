import logging
from pymongo import MongoClient, errors

_mongo_client = None
_db = None

logger = logging.getLogger("placement_tracker.database")


class _MongoDBProxy:
    """Lazy proxy for the MongoDB database instance."""

    def __getattr__(self, name):
        if _db is None:
            raise RuntimeError("Database has not been initialized. Call init_db(app) first.")
        return getattr(_db, name)

    def __getitem__(self, item):
        if _db is None:
            raise RuntimeError("Database has not been initialized. Call init_db(app) first.")
        return _db[item]

    def __bool__(self):
        return _db is not None


db = _MongoDBProxy()


def init_db(app):
    global _mongo_client, _db
    import re
    uri = app.config.get("MONGODB_URI", "mongodb://localhost:27017/Placement_Tracker")
    db_name = app.config.get("MONGODB_DB_NAME", "Placement_Tracker")

    masked_uri = re.sub(r"://([^@]+)@", "://***:***@", uri)
    logger.info("Connecting to MongoDB host: %s", masked_uri)
    logger.info("Target Database: '%s', Target Collection: 'users'", db_name)
    print(f"MongoDB Host: {masked_uri}")
    print(f"Database Name: {db_name}")
    print(f"Collection Name: users")

    _mongo_client = MongoClient(
        uri,
        retryWrites=True,
        retryReads=True,
        maxPoolSize=10,
        minPoolSize=2,
        connectTimeoutMS=10000,
        socketTimeoutMS=20000,
        serverSelectionTimeoutMS=5000,
        compressors="zstd,snappy,zlib",
    )

    try:
        # Startup connection ping test
        _mongo_client.admin.command("ping")
        logger.info("MongoDB Connected Successfully to '%s'", db_name)
        print("MongoDB Connected Successfully")
    except (errors.ConnectionFailure, errors.ServerSelectionTimeoutError, Exception) as err:
        logger.error("MongoDB Connection Failed: %s", str(err))
        print(f"MongoDB Connection Failed: {err}")
        if not app.config.get("DEBUG", False):
            raise err

    _db = _mongo_client[db_name]
    _create_indexes()
    return _db


def _create_indexes():
    if _db is None:
        return
    try:
        _db.users.create_index("email", unique=True)
        try:
            index_info = _db.students.index_information()
            if "github_username_1" in index_info:
                # Drop legacy index if it doesn't use partial filtering for non-empty usernames
                opts = index_info["github_username_1"]
                if not opts.get("partialFilterExpression") and not opts.get("sparse"):
                    _db.students.drop_index("github_username_1")
        except Exception:
            pass

        _db.students.create_index(
            "github_username",
            unique=True,
            partialFilterExpression={"github_username": {"$gt": ""}}
        )
        _db.students.create_index("email", unique=True)
        _db.students.create_index("department")
        _db.students.create_index("year")
        _db.students.create_index("created_at")
        _db.students.create_index("name")
        _db.students.create_index("github_score")
        _db.students.create_index([("is_active", 1), ("created_at", -1)])
        _db.students.create_index([("is_active", 1), ("github_score", -1)])
        _db.students.create_index([("is_active", 1), ("name", 1)])
        _db.notifications.create_index("created_at")
        _db.notifications.create_index("read")
        _db.activity_logs.create_index("created_at")
        _db.activity_logs.create_index("user_id")
        logger.info("MongoDB indexes verified successfully.")
    except Exception as err:
        logger.warning("Note on MongoDB index verification: %s", str(err))
