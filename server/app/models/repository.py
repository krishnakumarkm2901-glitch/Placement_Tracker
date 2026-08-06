"""Repository document schema and helpers."""

from datetime import datetime, timezone


def create_repository(student_id, repo_data):
    """Create a repository document from GitHub API data."""
    return {
        "student_id": student_id,
        "github_id": repo_data.get("id"),
        "name": repo_data.get("name") or "",
        "full_name": repo_data.get("full_name") or "",
        "description": repo_data.get("description") or "",
        "language": repo_data.get("language") or "",
        "languages": {},
        "stars": repo_data.get("stargazers_count", 0),
        "forks": repo_data.get("forks_count", 0),
        "watchers": repo_data.get("watchers_count", 0),
        "size": repo_data.get("size", 0),
        "topics": repo_data.get("topics") or [],
        "license": (
            repo_data.get("license", {}).get("spdx_id", "")
            if repo_data.get("license")
            else ""
        ),
        "visibility": "private" if repo_data.get("private") else "public",
        "default_branch": repo_data.get("default_branch") or "main",
        "open_issues": repo_data.get("open_issues_count", 0),
        "archived": repo_data.get("archived", False),
        "fork": repo_data.get("fork", False),
        "html_url": repo_data.get("html_url") or "",
        "commit_count": 0,
        "quality_score": 0,
        "quality_details": {},
        "created_at_github": repo_data.get("created_at", ""),
        "updated_at_github": repo_data.get("updated_at", ""),
        "pushed_at": repo_data.get("pushed_at", ""),
        "synced_at": datetime.now(timezone.utc),
    }


def calculate_repo_quality(repo):
    """Calculate repository quality score (0-100)."""
    score = 0
    details = {}

    # README (20 points) - checked via has_readme field
    has_readme = repo.get("quality_details", {}).get("has_readme", False)
    details["readme"] = 20 if has_readme else 0
    score += details["readme"]

    # Description (15 points)
    has_desc = bool((repo.get("description") or "").strip())
    details["description"] = 15 if has_desc else 0
    score += details["description"]

    # License (15 points)
    has_license = bool(repo.get("license", ""))
    details["license"] = 15 if has_license else 0
    score += details["license"]

    # Topics (10 points)
    topic_count = len(repo.get("topics") or [])
    details["topics"] = min(topic_count * 2, 10)
    score += details["topics"]

    # Stars (10 points)
    stars = repo.get("stars", 0)
    details["stars"] = min(stars * 2, 10)
    score += details["stars"]

    # Forks (10 points)
    forks = repo.get("forks", 0)
    details["forks"] = min(forks * 2, 10)
    score += details["forks"]

    # Size (10 points — not empty)
    size = repo.get("size", 0)
    details["size"] = 10 if size > 10 else (5 if size > 0 else 0)
    score += details["size"]

    # Activity (10 points — recently pushed)
    details["activity"] = 10 if repo.get("pushed_at") else 0
    score += details["activity"]

    return score, details


def get_quality_suggestions(repo):
    """Generate improvement suggestions for a repository."""
    suggestions = []
    if not repo.get("description"):
        suggestions.append("Add a description to help others understand your project.")
    if not repo.get("license"):
        suggestions.append("Add a license to define usage terms.")
    if len(repo.get("topics", [])) < 3:
        suggestions.append("Add at least 3 topics for better discoverability.")
    if not repo.get("quality_details", {}).get("has_readme"):
        suggestions.append("Create a comprehensive README.md file.")
    if repo.get("open_issues", 0) > 10:
        suggestions.append("Consider addressing open issues to maintain project health.")
    return suggestions


def serialize_repository(repo):
    """Serialize repository for JSON response."""
    if not repo:
        return None
    return {
        "id": str(repo["_id"]),
        "student_id": str(repo.get("student_id", "")),
        "name": repo.get("name", ""),
        "full_name": repo.get("full_name", ""),
        "description": repo.get("description", ""),
        "language": repo.get("language", ""),
        "languages": repo.get("languages", {}),
        "stars": repo.get("stars", 0),
        "forks": repo.get("forks", 0),
        "watchers": repo.get("watchers", 0),
        "size": repo.get("size", 0),
        "topics": repo.get("topics", []),
        "license": repo.get("license", ""),
        "visibility": repo.get("visibility", "public"),
        "default_branch": repo.get("default_branch", "main"),
        "open_issues": repo.get("open_issues", 0),
        "archived": repo.get("archived", False),
        "fork": repo.get("fork", False),
        "html_url": repo.get("html_url", ""),
        "commit_count": repo.get("commit_count", 0),
        "quality_score": repo.get("quality_score", 0),
        "quality_details": repo.get("quality_details", {}),
        "created_at_github": repo.get("created_at_github", ""),
        "updated_at_github": repo.get("updated_at_github", ""),
        "pushed_at": repo.get("pushed_at", ""),
    }
