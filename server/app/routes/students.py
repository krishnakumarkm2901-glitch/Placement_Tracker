"""Student CRUD routes."""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from app.extensions import db
from app.models.student import create_student, serialize_student, serialize_student_summary
from app.models.repository import serialize_repository, get_quality_suggestions
from app.utils.decorators import admin_required, rate_limit
from app.utils.validators import validate_student_input, sanitize_string, normalize_github_username
from app.utils.helpers import get_pagination_params, parse_object_id
from app.services.github_service import github_service
from app.services.sync_service import sync_student_safely
from app.services.platform_service import normalize_platform_username, sync_coding_profiles
from app.services.platform_storage import cleanup_orphaned_platform_profiles
from datetime import datetime, timezone
import threading
import re
from io import BytesIO
from zipfile import ZipFile, BadZipFile
from xml.etree import ElementTree
import csv

students_bp = Blueprint("students", __name__)


def _sync_imported_students(student_ids):
    for student_id in student_ids:
        sync_student_safely(student_id)
        sync_coding_profiles(student_id)


def _excel_column_index(reference):
    letters = re.match(r"[A-Z]+", reference or "A")
    index = 0
    for letter in (letters.group(0) if letters else "A"):
        index = index * 26 + ord(letter) - 64
    return index - 1


def _read_xlsx_rows(upload):
    """Read cell values from the first worksheet without external packages."""
    with ZipFile(upload) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("{*}si"):
                shared.append("".join(node.text or "" for node in item.findall(".//{*}t")))
        root = ElementTree.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        result = []
        for row in root.findall(".//{*}sheetData/{*}row"):
            values = []
            for cell in row.findall("{*}c"):
                index = _excel_column_index(cell.get("r"))
                while len(values) <= index:
                    values.append(None)
                cell_type = cell.get("t")
                if cell_type == "inlineStr":
                    value = "".join(node.text or "" for node in cell.findall(".//{*}t"))
                else:
                    node = cell.find("{*}v")
                    value = node.text if node is not None else None
                    if cell_type == "s" and value is not None:
                        value = shared[int(value)]
                values[index] = value
            result.append(tuple(values))
        return result


@students_bp.route("/public", methods=["GET"])
@rate_limit()
def get_public_students():
    """Public read-only student summaries for the live GitHub portal."""
    students = list(
        db.students.find({"is_active": True})
        .sort("github_score", -1)
        .limit(200)
    )
    return jsonify({
        "students": [serialize_student_summary(student) for student in students],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }), 200


@students_bp.route("/public/<student_id>", methods=["GET"])
@rate_limit()
def get_public_student(student_id):
    """Public read-only GitHub analytics for one active student."""
    oid = parse_object_id(student_id)
    if not oid:
        return jsonify({"error": "Invalid student ID"}), 400
    student = db.students.find_one({"_id": oid, "is_active": True})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    repositories = list(
        db.repositories.find({"student_id": oid}).sort("updated_at_github", -1)
    )
    result = serialize_student(student)
    # Academic contact and internal identifiers are never exposed publicly.
    result.pop("email", None)
    result["repositories"] = []
    for repository in repositories:
        serialized = serialize_repository(repository)
        serialized["suggestions"] = get_quality_suggestions(repository)
        result["repositories"].append(serialized)
    return jsonify({"student": result}), 200


@students_bp.route("/public/platform/<platform>", methods=["GET"])
@rate_limit()
def get_public_platform_students(platform):
    """Return platform metrics, optionally refreshing live LeetCode data."""
    if platform not in {"github", "leetcode", "codechef", "hackerrank"}:
        return jsonify({"error": "Unsupported platform"}), 400
    cleanup_orphaned_platform_profiles()
    students = list(db.students.find({"is_active": True}).limit(200))
    if platform == "leetcode" and request.args.get("live") == "1":
        from datetime import timedelta
        from app.services.leetcode_service import fetch_leetcode
        from app.services.platform_storage import save_platform_profile

        refresh_before = datetime.now(timezone.utc) - timedelta(seconds=45)
        for student in students:
            username = (student.get("platform_usernames") or {}).get("leetcode")
            if not username:
                continue
            stored = db.leetcode_profiles.find_one({"student_id": student["_id"]})
            if stored and stored.get("updated_at") and stored["updated_at"].replace(tzinfo=timezone.utc) >= refresh_before:
                continue
            try:
                profile = fetch_leetcode(username)
                save_platform_profile(student["_id"], "leetcode", profile, username)
                db.students.update_one(
                    {"_id": student["_id"]},
                    {"$set": {"platform_profiles.leetcode": profile, "updated_at": datetime.now(timezone.utc)}},
                )
                student.setdefault("platform_profiles", {})["leetcode"] = profile
            except Exception:
                # Keep the most recently synchronized profile when LeetCode is temporarily unavailable.
                pass
    return jsonify({"platform": platform, "students": [serialize_student_summary(item) for item in students], "updated_at": datetime.now(timezone.utc).isoformat()}), 200


@students_bp.route("", methods=["GET"])
@admin_required
@rate_limit()
def get_students():
    """Get all students with pagination, search, and filters."""
    page, limit, skip = get_pagination_params(request)

    # Build query
    query = {}
    search = request.args.get("search", "").strip()
    if search:
        search = sanitize_string(search)
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"github_username": {"$regex": search, "$options": "i"}},
            {"leetcode_username": {"$regex": search, "$options": "i"}},
            {"codechef_username": {"$regex": search, "$options": "i"}},
            {"hackerrank_username": {"$regex": search, "$options": "i"}},
            {"platform_usernames.github": {"$regex": search, "$options": "i"}},
            {"platform_usernames.leetcode": {"$regex": search, "$options": "i"}},
            {"platform_usernames.codechef": {"$regex": search, "$options": "i"}},
            {"platform_usernames.hackerrank": {"$regex": search, "$options": "i"}},
        ]

    department = request.args.get("department")
    if department:
        query["department"] = sanitize_string(department)

    year = request.args.get("year")
    if year:
        query["year"] = sanitize_string(year)

    is_active = request.args.get("is_active")
    if is_active is not None:
        query["is_active"] = is_active.lower() == "true"

    # Sorting
    sort_by = request.args.get("sort_by", "created_at")
    sort_order = -1 if request.args.get("sort_order", "desc") == "desc" else 1
    allowed_sort = ["created_at", "name", "github_score", "department", "year"]
    if sort_by not in allowed_sort:
        sort_by = "created_at"

    total = db.students.count_documents(query)
    students = list(
        db.students.find(query)
        .sort(sort_by, sort_order)
        .skip(skip)
        .limit(limit)
    )

    return jsonify({
        "students": [serialize_student_summary(s) for s in students],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
        },
    }), 200


@students_bp.route("/<student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    """Get a single student with full details."""
    oid = parse_object_id(student_id)
    if not oid:
        return jsonify({"error": "Invalid student ID"}), 400

    student = db.students.find_one({"_id": oid})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    current_user = db.users.find_one({"_id": ObjectId(get_jwt_identity())})
    if not current_user:
        return jsonify({"error": "User not found"}), 401
    if current_user.get("role") != "admin" and current_user.get("student_id") != oid:
        return jsonify({"error": "You can only view your own GitHub activity"}), 403

    # Include repositories
    repos = list(db.repositories.find({"student_id": oid}).sort("updated_at_github", -1))
    serialized_repos = []
    for r in repos:
        sr = serialize_repository(r)
        sr["suggestions"] = get_quality_suggestions(r)
        serialized_repos.append(sr)

    result = serialize_student(student)
    result["repositories"] = serialized_repos

    return jsonify({"student": result}), 200


@students_bp.route("", methods=["POST"])
@admin_required
@rate_limit()
def add_student():
    """Add a new student."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    is_valid, errors = validate_student_input(data)
    if not is_valid:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    # Resolve the identity directly from GitHub; name and the internal unique
    # identifier are not entered manually.
    github_username = normalize_github_username(data["github_username"])
    email = sanitize_string(data["email"]).lower()
    profile = github_service.get_user_profile(github_username)
    if not profile:
        return jsonify({
            "error": "GitHub user could not be found or GitHub API is unavailable"
        }), 404

    canonical_username = profile.get("login") or github_username
    github_username = canonical_username
    github_name = profile.get("name") or canonical_username

    if db.students.find_one({"github_username": {"$regex": f"^{github_username}$", "$options": "i"}}):
        return jsonify({"error": "GitHub username already registered"}), 409
    if db.students.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    student_doc = create_student(
        name=sanitize_string(github_name),
        department=sanitize_string(data["department"]),
        year=sanitize_string(str(data["year"])),
        github_username=github_username,
        email=email,
        platform_usernames={
            "leetcode": normalize_platform_username(sanitize_string(data.get("leetcode_username", ""))),
            "codechef": normalize_platform_username(sanitize_string(data.get("codechef_username", ""))),
            "hackerrank": normalize_platform_username(sanitize_string(data.get("hackerrank_username", ""))),
        },
    )

    result = db.students.insert_one(student_doc)
    student_doc["_id"] = result.inserted_id
    db.students.update_one(
        {"_id": result.inserted_id},
        {"$set": {"github_profile": profile, "sync_status": "syncing"}},
    )
    student_doc["github_profile"] = profile
    student_doc["sync_status"] = "syncing"

    # Fetch repositories, authored commits, languages, contributions and
    # scores immediately after creation without holding the HTTP request open.
    thread = threading.Thread(
        target=sync_student_safely, args=(str(result.inserted_id),), daemon=True
    )
    thread.start()
    threading.Thread(target=sync_coding_profiles, args=(str(result.inserted_id),), daemon=True).start()

    return jsonify({
        "message": "GitHub user added; data fetch started",
        "student": serialize_student(student_doc),
    }), 201


@students_bp.route("/import-template", methods=["GET"])
@admin_required
def download_import_template():
    """Download an Excel-compatible CSV template for bulk imports."""
    output = BytesIO(
        b"github_username,leetcode_username,codechef_username,hackerrank_username,email,department,year\r\n"
        b"octocat,leetcode_user,gfg_user,hackerrank_user,student@example.edu,CSE,4\r\n"
    )
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="Placement_Tracker_student_import.csv",
        mimetype="text/csv",
    )


@students_bp.route("/import", methods=["POST"])
@admin_required
@rate_limit(max_requests=5, window_seconds=60)
def import_students():
    """Validate and import students from an Excel workbook."""
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify({"error": "Select an Excel file to import"}), 400
    extension = upload.filename.lower().rsplit(".", 1)[-1]
    if extension not in {"xlsx", "csv"}:
        return jsonify({"error": "Only .xlsx and .csv Excel files are supported"}), 400

    try:
        if extension == "xlsx":
            workbook_rows = _read_xlsx_rows(upload)
        else:
            text = upload.stream.read().decode("utf-8-sig")
            workbook_rows = list(csv.reader(text.splitlines()))
        rows = iter(workbook_rows)
        raw_headers = next(rows, None)
        headers = [str(value or "").strip().lower().replace(" ", "_") for value in (raw_headers or [])]
        required = {"github_username", "email", "department", "year"}
        missing = sorted(required.difference(headers))
        if missing:
            return jsonify({"error": f"Missing required columns: {', '.join(missing)}"}), 400

        imported_ids = []
        errors = []
        imported = []
        for row_number, values in enumerate(rows, start=2):
            row = dict(zip(headers, values))
            if not any(value is not None and str(value).strip() for value in values):
                continue
            if row_number > 501:
                errors.append({"row": row_number, "error": "Import is limited to 500 students"})
                break

            payload = {
                "github_username": normalize_github_username(str(row.get("github_username") or "")),
                "email": sanitize_string(str(row.get("email") or "")).lower(),
                "department": sanitize_string(str(row.get("department") or "")),
                "year": sanitize_string(str(row.get("year") or "").replace(".0", "")),
            }
            valid, validation_errors = validate_student_input(payload)
            if not valid:
                errors.append({"row": row_number, "error": "; ".join(validation_errors)})
                continue
            if db.students.find_one({"github_username": {"$regex": f"^{re.escape(payload['github_username'])}$", "$options": "i"}}):
                errors.append({"row": row_number, "error": "GitHub username already exists"})
                continue
            if db.students.find_one({"email": payload["email"]}):
                errors.append({"row": row_number, "error": "Email already exists"})
                continue

            profile = github_service.get_user_profile(payload["github_username"])
            if not profile:
                errors.append({"row": row_number, "error": "GitHub user was not found"})
                continue
            username = profile.get("login") or payload["github_username"]
            document = create_student(
                name=sanitize_string(profile.get("name") or username),
                department=payload["department"],
                year=payload["year"],
                github_username=username,
                email=payload["email"],
                platform_usernames={
                    "leetcode": sanitize_string(str(row.get("leetcode_username") or "")),
                    "codechef": sanitize_string(str(row.get("codechef_username") or "")),
                    "hackerrank": sanitize_string(str(row.get("hackerrank_username") or "")),
                },
            )
            document["github_profile"] = profile
            document["sync_status"] = "syncing"
            result = db.students.insert_one(document)
            imported_ids.append(str(result.inserted_id))
            imported.append({"row": row_number, "github_username": username})

        if imported_ids:
            threading.Thread(
                target=_sync_imported_students, args=(imported_ids,), daemon=True
            ).start()
        return jsonify({
            "message": f"Imported {len(imported_ids)} student(s)",
            "imported_count": len(imported_ids),
            "failed_count": len(errors),
            "imported": imported,
            "errors": errors,
        }), 200
    except (BadZipFile, KeyError, ElementTree.ParseError, UnicodeDecodeError) as exc:
        return jsonify({"error": f"Invalid or damaged Excel file: {str(exc)}"}), 400
    except Exception as exc:
        return jsonify({"error": f"Could not read Excel file: {str(exc)}"}), 400


@students_bp.route("/<student_id>", methods=["PUT"])
@admin_required
def update_student(student_id):
    """Update a student's details."""
    oid = parse_object_id(student_id)
    if not oid:
        return jsonify({"error": "Invalid student ID"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    student = db.students.find_one({"_id": oid})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    update_fields = {}
    if "name" in data:
        update_fields["name"] = sanitize_string(data["name"])
    if "department" in data:
        update_fields["department"] = sanitize_string(data["department"])
    if "year" in data:
        update_fields["year"] = sanitize_string(str(data["year"]))
    if "email" in data:
        new_email = sanitize_string(data["email"]).lower()
        existing = db.students.find_one({"email": new_email, "_id": {"$ne": oid}})
        if existing:
            return jsonify({"error": "Email already in use"}), 409
        update_fields["email"] = new_email
    if "github_username" in data:
        new_username = sanitize_string(data["github_username"])
        existing = db.students.find_one({"github_username": {"$regex": f"^{new_username}$", "$options": "i"}, "_id": {"$ne": oid}})
        if existing:
            return jsonify({"error": "GitHub username already registered"}), 409
        update_fields["github_username"] = new_username
        update_fields["platform_usernames.github"] = new_username
    platform_fields = {
        "leetcode_username": "leetcode",
        "codechef_username": "codechef",
        "hackerrank_username": "hackerrank",
    }
    for field, platform in platform_fields.items():
        if field in data:
            username = normalize_platform_username(sanitize_string(data[field]))
            update_fields[field] = username
            update_fields[f"platform_usernames.{platform}"] = username
    if "is_active" in data:
        update_fields["is_active"] = bool(data["is_active"])

    update_fields["updated_at"] = datetime.now(timezone.utc)

    db.students.update_one({"_id": oid}, {"$set": update_fields})
    if any(field in data for field in platform_fields):
        threading.Thread(target=sync_coding_profiles, args=(student_id,), daemon=True).start()
    updated = db.students.find_one({"_id": oid})

    return jsonify({
        "message": "Student updated successfully",
        "student": serialize_student(updated),
    }), 200


@students_bp.route("/<student_id>/platforms/sync", methods=["POST"])
@jwt_required()
@rate_limit(max_requests=10, window_seconds=60)
def sync_student_platforms(student_id):
    """Refresh all configured competitive-programming profiles."""
    oid = parse_object_id(student_id)
    if not oid:
        return jsonify({"error": "Invalid student ID"}), 400
    student = db.students.find_one({"_id": oid})
    if not student:
        return jsonify({"error": "Student not found"}), 404
    current_user = db.users.find_one({"_id": ObjectId(get_jwt_identity())})
    if not current_user or (current_user.get("role") != "admin" and current_user.get("student_id") != oid):
        return jsonify({"error": "Not authorized"}), 403
    profiles = sync_coding_profiles(student_id)
    return jsonify({"message": "Platform profiles synced", "profiles": profiles}), 200


@students_bp.route("/<student_id>", methods=["DELETE"])
@admin_required
def delete_student(student_id):
    """Delete a student and their associated data."""
    oid = parse_object_id(student_id)
    if not oid:
        return jsonify({"error": "Invalid student ID"}), 400

    student = db.students.find_one({"_id": oid})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    # Some older imports stored student_id as text. Match both formats so a
    # student deletion cannot leave orphaned data in any platform collection.
    student_reference = {"$in": [oid, str(oid)]}
    db.repositories.delete_many({"student_id": student_reference})
    db.achievements.delete_many({"student_id": student_reference})
    db.notifications.delete_many({"student_id": student_reference})
    db.users.delete_many({"student_id": student_reference, "role": "student"})
    for collection_name in (
        "github_profiles", "leetcode_profiles", "codechef_profiles", "hackerrank_profiles"
    ):
        db[collection_name].delete_many({"student_id": student_reference})
    db.students.delete_one({"_id": oid})

    return jsonify({"message": "Student deleted successfully"}), 200


@students_bp.route("/departments", methods=["GET"])
@jwt_required()
def get_departments():
    """Get distinct departments."""
    departments = db.students.distinct("department")
    return jsonify({"departments": sorted(departments)}), 200


@students_bp.route("/years", methods=["GET"])
@jwt_required()
def get_years():
    """Get distinct years."""
    years = db.students.distinct("year")
    return jsonify({"years": sorted(years)}), 200
