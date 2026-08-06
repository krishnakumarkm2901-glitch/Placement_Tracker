from pymongo import MongoClient

_mongo_client = None
_db = None


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
    _mongo_client = MongoClient(app.config["MONGODB_URI"])
    _db = _mongo_client[app.config["MONGODB_DB_NAME"]]
    _create_indexes()
    return _db


def _create_indexes():
    _db.users.create_index("email", unique=True)
    _db.students.create_index("github_username", unique=True)
    _db.students.create_index("email", unique=True)
    _db.students.create_index("department")
    _db.students.create_index("year")
    _db.notifications.create_index("created_at")
    _db.notifications.create_index("read")
    _db.activity_logs.create_index("created_at")
    _db.activity_logs.create_index("user_id")
