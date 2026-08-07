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


import time


def _sync_imported_students(student_ids):
    for student_id in student_ids:
        sync_student_safely(student_id)
        sync_coding_profiles(student_id)
        time.sleep(0.5)


def _excel_column_index(reference):
    letters = re.match(r"[A-Z]+", reference or "A")
    index = 0
    for letter in (letters.group(0) if letters else "A"):
        index = index * 26 + ord(letter) - 64
    return index - 1


def _read_xlsx_rows(upload):
    """Read cell values from the first worksheet."""
    if hasattr(upload, "read"):
        content = upload.read()
        file_bytes = BytesIO(content)
    else:
        file_bytes = upload

    try:
        import openpyxl
        wb = openpyxl.load_workbook(file_bytes, data_only=True)
        sheet = wb.active
        rows = []
        for row in sheet.iter_rows(values_only=True):
            rows.append(tuple(row))
        return rows
    except ImportError:
        pass
    except Exception:
        file_bytes.seek(0)

    with ZipFile(file_bytes) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("{*}si"):
                shared.append("".join(node.text or "" for node in item.findall(".//{*}t")))
        sheet_files = [
            name for name in archive.namelist()
            if name.startswith("xl/worksheets/sheet") or name.startswith("xl/worksheets/Sheet")
        ]
        if not sheet_files:
            sheet_files = [name for name in archive.namelist() if "worksheets/" in name]
        if not sheet_files:
            raise KeyError("No worksheet XML found in Excel file archive")

        root = ElementTree.fromstring(archive.read(sheet_files[0]))
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
                        idx = int(value)
                        value = shared[idx] if idx < len(shared) else None
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
    """Return platform metrics instantly from database."""
    if platform not in {"github", "leetcode", "codechef", "hackerrank"}:
        return jsonify({"error": "Unsupported platform"}), 400

    cleanup_orphaned_platform_profiles()
    students = list(db.students.find({"is_active": True}).limit(200))

    if platform in {"leetcode", "codechef", "hackerrank"} and request.args.get("live") == "1":
        import threading
        from app.services.sync_service import sync_all_students_for_platform
        threading.Thread(target=sync_all_students_for_platform, args=(platform,), daemon=True).start()

    return jsonify({
        "platform": platform,
        "students": [serialize_student_summary(item) for item in students],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }), 200


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
    """Add a new student with platform usernames."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    is_valid, errors = validate_student_input(data)
    if not is_valid:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    github_username = normalize_github_username(data.get("github_username", ""))
    leetcode_username = normalize_platform_username(sanitize_string(data.get("leetcode_username", "")))
    codechef_username = normalize_platform_username(sanitize_string(data.get("codechef_username", "")))
    hackerrank_username = normalize_platform_username(sanitize_string(data.get("hackerrank_username", "")))
    email = sanitize_string(data.get("email", "")).lower()
    provided_name = sanitize_string(data.get("name", ""))

    if db.students.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    profile = {}
    if github_username:
        if db.students.find_one({"github_username": {"$regex": f"^{re.escape(github_username)}$", "$options": "i"}}):
            return jsonify({"error": "GitHub username already registered"}), 409
        fetched = github_service.get_user_profile(github_username)
        if fetched:
            profile = fetched
            github_username = profile.get("login") or github_username

    student_name = (
        provided_name
        or profile.get("name")
        or github_username
        or leetcode_username
        or codechef_username
        or hackerrank_username
        or email.split("@")[0]
    )

    student_doc = create_student(
        name=sanitize_string(student_name),
        department=sanitize_string(data["department"]),
        year=sanitize_string(str(data["year"])),
        github_username=github_username,
        email=email,
        platform_usernames={
            "leetcode": leetcode_username,
            "codechef": codechef_username,
            "hackerrank": hackerrank_username,
        },
    )

    result = db.students.insert_one(student_doc)
    student_doc["_id"] = result.inserted_id

    if profile:
        db.students.update_one(
            {"_id": result.inserted_id},
            {"$set": {"github_profile": profile, "sync_status": "syncing"}},
        )
        student_doc["github_profile"] = profile
        student_doc["sync_status"] = "syncing"

    if github_username:
        threading.Thread(
            target=sync_student_safely, args=(str(result.inserted_id),), daemon=True
        ).start()

    threading.Thread(
        target=sync_coding_profiles, args=(str(result.inserted_id),), daemon=True
    ).start()

    return jsonify({
        "message": "Student added; platform data fetch started",
        "student": serialize_student(student_doc),
    }), 201


@students_bp.route("/import-template", methods=["GET"])
@admin_required
def download_import_template():
    """Download an Excel-compatible CSV template for bulk imports."""
    output = BytesIO(
        b"github_username,leetcode_username,codechef_username,hackerrank_username,email,department,year,name\r\n"
        b"octocat,leetcode_user,codechef_user,hackerrank_user,student@example.edu,CSE,4,Jane Doe\r\n"
    )
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="Placement_Tracker_student_import.csv",
        mimetype="text/csv",
    )


ALIASES = {
    "github_username": ["github_username", "github", "github_user", "github_id"],
    "leetcode_username": ["leetcode_username", "leetcode", "leetcode_user", "leetcode_id"],
    "codechef_username": ["codechef_username", "codechef", "codechef_user", "codechef_id", "gfg_user"],
    "hackerrank_username": ["hackerrank_username", "hackerrank", "hackerrank_user", "hackerrank_id"],
    "email": ["email", "email_address", "student_email"],
    "department": ["department", "dept", "branch"],
    "year": ["year", "batch", "year_of_study"],
    "name": ["name", "student_name", "full_name"],
}


def _extract_field(row, aliases):
    for alias in aliases:
        if alias in row and row[alias] is not None:
            val = str(row[alias]).strip()
            if val:
                return val
    return ""


@students_bp.route("/import", methods=["POST"])
@admin_required
@rate_limit(max_requests=10, window_seconds=60)
def import_students():
    """Validate and import students from an Excel/CSV workbook."""
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

        has_email = any(alias in headers for alias in ALIASES["email"])
        has_dept = any(alias in headers for alias in ALIASES["department"])
        has_year = any(alias in headers for alias in ALIASES["year"])
        has_any_platform = any(
            alias in headers
            for p in ["github_username", "leetcode_username", "codechef_username", "hackerrank_username"]
            for alias in ALIASES[p]
        )

        if not (has_email and has_dept and has_year and has_any_platform):
            missing = []
            if not has_email: missing.append("email")
            if not has_dept: missing.append("department")
            if not has_year: missing.append("year")
            if not has_any_platform: missing.append("at least one platform username column")
            return jsonify({"error": f"Missing required columns: {', '.join(missing)}"}), 400

        parsed_rows = []
        errors = []
        emails_to_check = set()
        githubs_to_check = set()

        for row_number, values in enumerate(rows, start=2):
            if not any(value is not None and str(value).strip() for value in values):
                continue
            if row_number > 501:
                errors.append({"row": row_number, "error": "Import is limited to 500 students"})
                break

            row = dict(zip(headers, values))
            github_username = normalize_github_username(_extract_field(row, ALIASES["github_username"]))
            leetcode_username = normalize_platform_username(_extract_field(row, ALIASES["leetcode_username"]))
            codechef_username = normalize_platform_username(_extract_field(row, ALIASES["codechef_username"]))
            hackerrank_username = normalize_platform_username(_extract_field(row, ALIASES["hackerrank_username"]))
            email = sanitize_string(_extract_field(row, ALIASES["email"])).lower()
            department = sanitize_string(_extract_field(row, ALIASES["department"]))
            year = sanitize_string(_extract_field(row, ALIASES["year"])).replace(".0", "")
            provided_name = sanitize_string(_extract_field(row, ALIASES["name"]))

            payload = {
                "github_username": github_username,
                "leetcode_username": leetcode_username,
                "codechef_username": codechef_username,
                "hackerrank_username": hackerrank_username,
                "email": email,
                "department": department,
                "year": year,
            }
            valid, validation_errors = validate_student_input(payload)
            if not valid:
                errors.append({"row": row_number, "error": "; ".join(validation_errors)})
                continue

            parsed_rows.append({
                "row_number": row_number,
                "provided_name": provided_name,
                "department": department,
                "year": year,
                "email": email,
                "github_username": github_username,
                "leetcode_username": leetcode_username,
                "codechef_username": codechef_username,
                "hackerrank_username": hackerrank_username,
            })
            if email:
                emails_to_check.add(email)
            if github_username:
                githubs_to_check.add(github_username)

        # Batch query existing records in single DB roundtrip
        existing_by_email = {}
        existing_by_github = {}

        if emails_to_check:
            for s in db.students.find({"email": {"$in": list(emails_to_check)}}):
                existing_by_email[s["email"]] = s

        if githubs_to_check:
            for s in db.students.find({"github_username": {"$in": list(githubs_to_check)}}):
                existing_by_github[s["github_username"].lower()] = s

        from pymongo import InsertOne, UpdateOne

        bulk_ops = []
        imported_ids = []
        imported_summary = []
        created_count = 0
        updated_count = 0
        skipped_count = 0

        for item in parsed_rows:
            email = item["email"]
            gh = item["github_username"]
            row_number = item["row_number"]

            existing = existing_by_email.get(email) or (existing_by_github.get(gh.lower()) if gh else None)

            if existing:
                update_fields = {}
                platform_usernames = dict(existing.get("platform_usernames", {}))

                if gh and not existing.get("github_username"):
                    update_fields["github_username"] = gh
                    platform_usernames["github"] = gh
                if item["leetcode_username"] and item["leetcode_username"] != existing.get("leetcode_username"):
                    update_fields["leetcode_username"] = item["leetcode_username"]
                    platform_usernames["leetcode"] = item["leetcode_username"]
                if item["codechef_username"] and item["codechef_username"] != existing.get("codechef_username"):
                    update_fields["codechef_username"] = item["codechef_username"]
                    platform_usernames["codechef"] = item["codechef_username"]
                if item["hackerrank_username"] and item["hackerrank_username"] != existing.get("hackerrank_username"):
                    update_fields["hackerrank_username"] = item["hackerrank_username"]
                    platform_usernames["hackerrank"] = item["hackerrank_username"]
                if item["department"] and item["department"] != existing.get("department"):
                    update_fields["department"] = item["department"]
                if item["year"] and item["year"] != existing.get("year"):
                    update_fields["year"] = item["year"]

                if update_fields:
                    update_fields["platform_usernames"] = platform_usernames
                    update_fields["updated_at"] = datetime.now(timezone.utc)
                    bulk_ops.append(UpdateOne({"_id": existing["_id"]}, {"$set": update_fields}))
                    imported_ids.append(str(existing["_id"]))
                    updated_count += 1
                    imported_summary.append({"row": row_number, "email": email, "action": "updated"})
                else:
                    skipped_count += 1
                    imported_summary.append({"row": row_number, "email": email, "action": "already_up_to_date"})
            else:
                student_name = (
                    item["provided_name"]
                    or item["github_username"]
                    or item["leetcode_username"]
                    or item["codechef_username"]
                    or item["hackerrank_username"]
                    or email.split("@")[0]
                )

                doc = create_student(
                    name=student_name,
                    department=item["department"],
                    year=item["year"],
                    github_username=item["github_username"],
                    email=email,
                    platform_usernames={
                        "leetcode": item["leetcode_username"],
                        "codechef": item["codechef_username"],
                        "hackerrank": item["hackerrank_username"],
                    },
                )
                doc["_id"] = ObjectId()
                bulk_ops.append(InsertOne(doc))
                imported_ids.append(str(doc["_id"]))
                created_count += 1
                imported_summary.append({"row": row_number, "email": email, "action": "created"})

        if bulk_ops:
            db.students.bulk_write(bulk_ops, ordered=False)

        if imported_ids:
            threading.Thread(
                target=_sync_imported_students, args=(imported_ids,), daemon=True
            ).start()

        return jsonify({
            "message": f"Import completed: {created_count} imported, {updated_count} updated, {skipped_count} skipped, {len(errors)} failed",
            "imported_count": created_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "failed_count": len(errors),
            "imported": imported_summary,
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
