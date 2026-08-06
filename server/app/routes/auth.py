"""Authentication routes."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
import bcrypt
from datetime import timedelta
from app.extensions import db
from app.models.user import create_user, serialize_user
from app.utils.validators import validate_email
from app.utils.decorators import rate_limit

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def login():
    """Authenticate user and return JWT tokens."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(
        identity=str(user["_id"]),
        expires_delta=timedelta(hours=24),
        additional_claims={"role": user.get("role", "student")},
    )
    refresh_token = create_refresh_token(
        identity=str(user["_id"]),
        expires_delta=timedelta(days=30),
    )

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": serialize_user(user),
    }), 200


@auth_bp.route("/register", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=60)
def register():
    """Register a new user (admin only can create admin accounts)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "student")

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    user_doc = create_user(name, email, hashed.decode("utf-8"), role)
    result = db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    access_token = create_access_token(
        identity=str(result.inserted_id),
        expires_delta=timedelta(hours=24),
        additional_claims={"role": role},
    )

    return jsonify({
        "access_token": access_token,
        "user": serialize_user(user_doc),
    }), 201


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    identity = get_jwt_identity()
    user = db.users.find_one({"_id": __import__("bson").ObjectId(identity)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    access_token = create_access_token(
        identity=identity,
        expires_delta=timedelta(hours=24),
        additional_claims={"role": user.get("role", "student")},
    )
    return jsonify({"access_token": access_token}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_profile():
    """Get current user profile."""
    identity = get_jwt_identity()
    user = db.users.find_one({"_id": __import__("bson").ObjectId(identity)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": serialize_user(user)}), 200
