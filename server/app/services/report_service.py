"""Report service — generate exportable reports."""

import csv
import io
import json
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile
from app.extensions import db
from app.models.student import serialize_student_summary


def generate_student_report(student_id=None, department=None, year=None):
    """Generate a student report dataset."""
    query = {}
    if student_id:
        from bson import ObjectId
        query["_id"] = ObjectId(student_id)
    if department:
        query["department"] = department
    if year:
        query["year"] = year

    report = [serialize_student_summary(s) for s in db.students.find(query)]
    return sorted(report, key=lambda item: item.get("github_score", 0), reverse=True)


def generate_platform_report(platform, department=None, year=None):
    """Generate a normalized report for one coding platform."""
    query = {"is_active": True}
    if department:
        query["department"] = department
    if year:
        query["year"] = year
    report = []
    for student in db.students.find(query):
        summary = serialize_student_summary(student)
        username = summary.get("github_username", "") if platform == "github" else (summary.get("platform_usernames") or {}).get(platform, "")
        if not username:
            continue
        if platform == "github":
            metrics = {
                "repositories": summary.get("total_repos", 0),
                "commits": summary.get("total_commits", 0),
                "contributions": summary.get("total_contributions", 0),
                "streak": summary.get("current_streak", 0),
            }
            status = summary.get("sync_status", "pending")
        else:
            profile = (summary.get("platform_profiles") or {}).get(platform, {}) or {}
            metrics = profile.get("metrics", {}) or {}
            status = profile.get("status", "pending")
        report.append({
            "name": summary.get("name", ""), "department": summary.get("department", ""),
            "year": summary.get("year", ""), "username": username, "status": status, **metrics,
        })
    primary = {"github": "contributions", "leetcode": "solved", "codechef": "problems_solved", "hackerrank": "badges"}[platform]
    return sorted(report, key=lambda item: item.get(primary, 0) or 0, reverse=True)


def export_csv(data, fields=None):
    """Export data as CSV string."""
    if not data:
        return ""

    output = io.StringIO()
    fields = fields or list(data[0].keys())
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()


def export_json(data):
    """Export data as JSON string."""
    return json.dumps(data, indent=2, default=str)


def export_excel(data, columns, sheet_name="Report"):
    """Create a dependency-free XLSX workbook for the selected report columns."""
    rows = [[label for _, label in columns]]
    rows.extend([[item.get(key, "") for key, _ in columns] for item in data])

    def cell_xml(value, row_number, column_number, header=False):
        number = column_number
        letters = ""
        while number:
            number, remainder = divmod(number - 1, 26)
            letters = chr(65 + remainder) + letters
        reference = f"{letters}{row_number}"
        style = ' s="1"' if header else ""
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return f'<c r="{reference}"{style}><v>{value}</v></c>'
        text = escape(str(value or ""))
        return f'<c r="{reference}" t="inlineStr"{style}><is><t>{text}</t></is></c>'

    sheet_rows = []
    for row_number, row in enumerate(rows, 1):
        cells = "".join(
            cell_xml(value, row_number, column_number, row_number == 1)
            for column_number, value in enumerate(row, 1)
        )
        sheet_rows.append(f'<row r="{row_number}">{cells}</row>')

    safe_sheet_name = escape(sheet_name[:31])
    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
        'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        f'<autoFilter ref="A1:{chr(64 + len(columns))}{max(len(rows), 1)}"/>'
        '</worksheet>'
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{safe_sheet_name}" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font/><font><b/></font></fonts><fills count="2"><fill><patternFill '
        'patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/>'
        '<bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0"/>'
        '<xf fontId="1" fillId="1" applyFont="1" applyFill="1"/></cellXfs></styleSheet>'
    )

    output = io.BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as workbook:
        workbook.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>')
        workbook.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        workbook.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        workbook.writestr("xl/workbook.xml", workbook_xml)
        workbook.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        workbook.writestr("xl/styles.xml", styles_xml)
    return output.getvalue()


def generate_leaderboard_report(sort_by="github_score", limit=50):
    """Generate leaderboard report."""
    students = list(db.students.find({"is_active": True}))
    summaries = [serialize_student_summary(student) for student in students]
    summary_sort_fields = {
        "github_score": "github_score",
        "analytics.total_commits": "total_commits",
        "analytics.total_repos": "total_repos",
    }
    summaries.sort(key=lambda item: item.get(summary_sort_fields.get(sort_by, "github_score"), 0), reverse=True)
    report = []
    for i, s in enumerate(summaries[:limit], 1):
        report.append({
            "rank": i,
            "name": s.get("name", ""),
            "department": s.get("department", ""),
            "year": s.get("year", ""),
            "github_username": s.get("github_username", ""),
            "github_score": s.get("github_score", 0),
            "total_repos": s.get("total_repos", 0),
            "total_commits": s.get("total_commits", 0),
            "most_used_language": s.get("most_used_language", ""),
        })
    return report


def generate_department_report():
    """Generate department-wise analytics report."""
    pipeline = [
        {
            "$group": {
                "_id": "$department",
                "student_count": {"$sum": 1},
                "avg_score": {"$avg": "$github_score"},
                "total_repos": {"$sum": "$analytics.total_repos"},
                "total_commits": {"$sum": "$analytics.total_commits"},
                "total_contributions": {"$sum": "$analytics.total_contributions"},
                "avg_streak": {"$avg": "$analytics.current_streak"},
            }
        },
        {"$sort": {"avg_score": -1}},
    ]
    return [
        {
            "department": r["_id"],
            "student_count": r["student_count"],
            "avg_score": round(r["avg_score"] or 0, 1),
            "total_repos": r["total_repos"],
            "total_commits": r["total_commits"],
            "total_contributions": r["total_contributions"],
            "avg_streak": round(r["avg_streak"] or 0, 1),
        }
        for r in db.students.aggregate(pipeline)
    ]
