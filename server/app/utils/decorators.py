"""Custom decorators for route protection and rate limiting."""

from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.extensions import db
from bson import ObjectId
import time

# Simple in-memory rate limiter
_rate_limit_store = {}


def admin_required(fn):
    """Decorator to restrict access to admin users only."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        identity = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(identity)})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


def rate_limit(max_requests=100, window_seconds=60):
    """Simple rate limiting decorator."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            ip = request.remote_addr or "unknown"
            key = f"{ip}:{fn.__name__}"
            now = time.time()

            if key not in _rate_limit_store:
                _rate_limit_store[key] = []

            # Clean old entries
            _rate_limit_store[key] = [
                t for t in _rate_limit_store[key] if now - t < window_seconds
            ]

            if len(_rate_limit_store[key]) >= max_requests:
                return (
                    jsonify({"error": "Rate limit exceeded. Try again later."}),
                    429,
                )

            _rate_limit_store[key].append(now)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
