"""Input validation helpers."""

import re


def validate_email(email):
    """Validate email format."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_github_username(username):
    """Validate GitHub username format."""
    pattern = r"^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$"
    return bool(re.match(pattern, username))


def normalize_github_username(value):
    """Extract a username from plain text, @username, or a GitHub URL."""
    if not isinstance(value, str):
        return ""
    value = value.strip().rstrip("/")
    value = re.sub(r"^https?://(?:www\.)?github\.com/", "", value, flags=re.IGNORECASE)
    value = value.split("/", 1)[0]
    return value.lstrip("@").strip()


def validate_student_input(data):
    """Validate fields supplied when adding a GitHub student."""
    errors = []

    if not data.get("department", "").strip():
        errors.append("Department is required.")

    if not data.get("year"):
        errors.append("Year is required.")

    github_username = normalize_github_username(data.get("github_username", ""))
    if not github_username:
        errors.append("GitHub username is required.")
    elif not validate_github_username(github_username):
        errors.append("Invalid GitHub username format.")

    if not data.get("email", "").strip():
        errors.append("Email is required.")
    elif not validate_email(data["email"]):
        errors.append("Invalid email format.")

    return len(errors) == 0, errors


def sanitize_string(value):
    """Sanitize string input to prevent injection."""
    if not isinstance(value, str):
        return ""
    # Remove MongoDB operators
    value = value.replace("$", "").replace("{", "").replace("}", "")
    return value.strip()
