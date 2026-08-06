"""Reports routes."""

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required
from app.utils.decorators import admin_required, rate_limit
from app.services.report_service import (
    generate_student_report,
    generate_leaderboard_report,
    generate_department_report,
    generate_platform_report,
    export_csv,
    export_excel,
    export_json,
)

reports_bp = Blueprint("reports", __name__)

PLATFORM_COLUMNS = {
    "github": [("name", "Student"), ("department", "Department"), ("year", "Year"), ("username", "Username"), ("repositories", "Repositories"), ("commits", "Commits"), ("contributions", "Contributions"), ("streak", "Streak"), ("status", "Status")],
    "leetcode": [("name", "Student"), ("department", "Department"), ("year", "Year"), ("username", "Username"), ("solved", "Solved"), ("easy", "Easy"), ("medium", "Medium"), ("hard", "Hard"), ("acceptance_rate", "Acceptance %"), ("current_streak", "Current Streak"), ("longest_streak", "Max Streak"), ("status", "Status")],
    "codechef": [("name", "Student"), ("department", "Department"), ("year", "Year"), ("username", "Username"), ("rating", "Rating"), ("stars", "Stars"), ("problems_solved", "Problems Solved"), ("global_rank", "Global Rank"), ("country_rank", "Country Rank"), ("status", "Status")],
    "hackerrank": [("name", "Student"), ("department", "Department"), ("year", "Year"), ("username", "Username"), ("badges", "Badges"), ("certificates", "Certificates"), ("followers", "Followers"), ("status", "Status")],
}


@reports_bp.route("/platform/<platform>", methods=["GET"])
@admin_required
@rate_limit()
def platform_report(platform):
    if platform not in PLATFORM_COLUMNS:
        return jsonify({"error": "Unsupported platform"}), 400
    data = generate_platform_report(platform, request.args.get("department"), request.args.get("year"))
    if request.args.get("format", "json") == "xlsx":
        return Response(export_excel(data, PLATFORM_COLUMNS[platform], platform.title()), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment;filename={platform}_report.xlsx"})
    return jsonify({"platform": platform, "report": data}), 200


@reports_bp.route("/students", methods=["GET"])
@admin_required
@rate_limit()
def student_report():
    """Generate student report."""
    department = request.args.get("department")
    year = request.args.get("year")
    export_format = request.args.get("format", "json")

    data = generate_student_report(department=department, year=year)

    if export_format == "xlsx":
        return Response(export_excel(data, [("name", "Name"), ("department", "Department"), ("github_score", "Score"), ("total_repos", "Repos"), ("total_commits", "Commits")], "Students"), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment;filename=students_report.xlsx"})

    if export_format == "csv":
        csv_data = export_csv(data)
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=students_report.csv"},
        )

    return jsonify({"report": data}), 200


@reports_bp.route("/leaderboard", methods=["GET"])
@admin_required
@rate_limit()
def leaderboard_report():
    """Generate leaderboard report."""
    sort_by = request.args.get("sort_by", "github_score")
    limit = int(request.args.get("limit", 50))
    export_format = request.args.get("format", "json")

    data = generate_leaderboard_report(sort_by=sort_by, limit=limit)

    if export_format == "xlsx":
        return Response(export_excel(data, [("rank", "Rank"), ("name", "Name"), ("department", "Department"), ("github_score", "Score"), ("total_repos", "Repos"), ("total_commits", "Commits"), ("most_used_language", "Language")], "Leaderboard"), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment;filename=leaderboard_report.xlsx"})

    if export_format == "csv":
        csv_data = export_csv(data)
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=leaderboard_report.csv"},
        )

    return jsonify({"report": data}), 200


@reports_bp.route("/departments", methods=["GET"])
@admin_required
@rate_limit()
def department_report():
    """Generate department analytics report."""
    export_format = request.args.get("format", "json")

    data = generate_department_report()

    if export_format == "xlsx":
        return Response(export_excel(data, [("department", "Department"), ("student_count", "Students"), ("avg_score", "Avg Score"), ("total_repos", "Total Repos"), ("total_commits", "Total Commits")], "Departments"), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment;filename=departments_report.xlsx"})

    if export_format == "csv":
        csv_data = export_csv(data)
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=department_report.csv"},
        )

    return jsonify({"report": data}), 200
