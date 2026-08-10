"""CodeChef public profile integration."""

import json
import re
from datetime import datetime, timedelta, timezone
from html import unescape

import requests

from app.services.platform_common import HEADERS, normalize_platform_username, platform_result


def parse_int(value):
    try:
        return int(str(value or "").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _normalize_date(value):
    """Normalize CodeChef dates like 2024-8-6 to YYYY-MM-DD."""
    try:
        parts = [int(part) for part in str(value).strip().split("-")]
        if len(parts) != 3:
            return None
        return f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
    except (ValueError, TypeError):
        return None


def _parse_json_array_after(html, marker):
    match = re.search(rf"(?:var\s+)?{re.escape(marker)}\s*=\s*\[", html)
    if not match:
        return []
    start = match.end() - 1
    depth = 0
    end = None
    for index, char in enumerate(html[start:], start):
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        return []
    try:
        return json.loads(html[start:end])
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _parse_submission_calendar(html):
    calendar = {}
    for item in _parse_json_array_after(html, "userDailySubmissionsStats"):
        if not isinstance(item, dict):
            continue
        date = _normalize_date(item.get("date"))
        if not date:
            continue
        calendar[date] = parse_int(item.get("value"))
    return calendar


def _streak_metrics(calendar):
    active_dates = {
        datetime.strptime(date, "%Y-%m-%d").date()
        for date, count in calendar.items()
        if int(count or 0) > 0
    }
    cursor = datetime.now(timezone.utc).date()
    if cursor not in active_dates:
        cursor -= timedelta(days=1)
    current_streak = 0
    while cursor in active_dates:
        current_streak += 1
        cursor -= timedelta(days=1)

    longest_streak = 0
    streak = 0
    if active_dates:
        day = min(active_dates)
        end = max(active_dates)
        while day <= end:
            if day in active_dates:
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 0
            day += timedelta(days=1)

    return {
        "active_days": len(active_dates),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "yearly_submissions": sum(int(count or 0) for count in calendar.values()),
    }


def _absolute_url(path):
    if not path:
        return None
    path = path.strip("'\"")
    if path.startswith("http"):
        return path
    return f"https://www.codechef.com{path if path.startswith('/') else '/' + path}"


def _parse_path_cards(section_html):
    cards = []
    for href, card in re.findall(
        r"<a href=([^\s>]+)>\s*<div class='learning__card'>(.*?</div>)\s*</div>\s*</a>",
        section_html,
        re.S,
    ):
        img = re.search(r"src='([^']+)'", card)
        progress = re.search(r"tooltiptext[^>]*>\s*(\d+)%", card) or re.search(r">(\d+)%<", card)
        width = re.search(r"width:\s*'?(\d+(?:\.\d+)?)%", card)
        name = re.search(r"class='card__title'[^>]*>(.*?)<", card, re.S)
        if not name:
            name = re.search(r"class='card__content'[^>]*>.*?<[^>]+>([^<]+)", card, re.S)
        texts = [unescape(text).strip() for text in re.findall(r">([^<>]+)<", card) if text.strip() and "%" not in text]
        progress_value = parse_int(progress.group(1)) if progress else (int(float(width.group(1))) if width else 0)
        cards.append({
            "title": unescape(name.group(1)).strip() if name else (texts[0] if texts else "Path"),
            "url": _absolute_url(href),
            "icon": img.group(1) if img else None,
            "progress": progress_value,
        })
    return cards


def _parse_problems_section(html):
    match = re.search(
        r'<section class="rating-data-section problems-solved">(.*?)</section><!--\.problems-solved-->',
        html,
        re.S,
    )
    section = match.group(1) if match else ""
    result = {
        "learning_paths": [],
        "practice_paths": [],
        "college_paths": [],
        "contests": [],
        "total_problems_solved": 0,
    }
    if not section:
        return result

    total = re.search(r"Total Problems Solved:\s*([0-9,]+)", section)
    if total:
        result["total_problems_solved"] = parse_int(total.group(1))

    parts = re.split(r"<h3>", section)
    for part in parts[1:]:
        title_match = re.match(r"([^<]+)</h3>(.*)", part, re.S)
        if not title_match:
            continue
        heading = title_match.group(1).strip()
        body = title_match.group(2)
        cards = _parse_path_cards(body)
        key = None
        lower = heading.lower()
        if lower.startswith("learning paths"):
            key = "learning_paths"
        elif lower.startswith("practice paths"):
            key = "practice_paths"
        elif lower.startswith("college paths"):
            key = "college_paths"
        elif lower.startswith("contests"):
            key = "contests"
        if key:
            result[key] = cards
    return result


def _strip_html(value):
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _parse_recent_activity(username, limit=20):
    try:
        session = get_http_session()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
        }
        response = session.get(
            f"https://www.codechef.com/recent/user?page=0&user_handle={username}",
            headers=headers,
            timeout=15,
        )
        if not response.ok:
            return []
        content = (response.json() or {}).get("content") or ""
    except Exception:
        return []

    activities = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", content, re.S)[1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 4:
            continue
        time_text = re.search(r"tooltiptext'>([^<]+)", cells[0]) or re.search(r"title='([^']+)'", cells[0])
        problem = re.search(r"href='(/problems/[^']+)'[^>]*>([^<]+)", cells[1]) or re.search(
            r'href="(/problems/[^"]+)"[^>]*>([^<]+)', cells[1]
        )
        status_match = re.search(r"title='(accepted|[^']*)'\s*style='display:\s*flex", cells[2], re.I)
        score_match = re.search(r"\((\d+)\)", cells[2])
        solution = re.search(r"href='(/viewsolution/[^']+)'", cells[4] if len(cells) > 4 else "", re.I) or re.search(
            r'href="(/viewsolution/[^"]+)"', cells[4] if len(cells) > 4 else "", re.I
        )
        status = (status_match.group(1) if status_match else "").strip() or "unknown"
        if status.lower() == "accepted":
            result = f"Accepted ({score_match.group(1)})" if score_match else "Accepted"
        elif score_match:
            result = f"{status.title()} ({score_match.group(1)})"
        else:
            result = status.title() if status != "unknown" else (_strip_html(cells[2]) or "—")

        activities.append({
            "time": time_text.group(1).strip() if time_text else _strip_html(cells[0]),
            "problem": unescape(problem.group(2)).strip() if problem else _strip_html(cells[1]),
            "problem_url": _absolute_url(problem.group(1)) if problem else None,
            "result": result,
            "status": status.lower(),
            "score": parse_int(score_match.group(1)) if score_match else None,
            "language": _strip_html(cells[3]),
            "solution_url": _absolute_url(solution.group(1)) if solution else None,
        })
        if len(activities) >= limit:
            break
    return activities


import time
from app.services.http_session import get_http_session


def fetch_codechef(username):
    username = normalize_platform_username(username)
    if not username:
        raise ValueError("CodeChef username is empty")

    url = f"https://www.codechef.com/users/{username}"
    session = get_http_session()

    response = None
    for attempt in range(2):
        try:
            response = session.get(url, headers=HEADERS, timeout=8)
            if response.status_code == 404:
                raise ValueError("CodeChef profile not found")
            if response.status_code == 429:
                break
            response.raise_for_status()
            break
        except ValueError:
            raise
        except Exception as err:
            if attempt == 1:
                raise err

    if not response or not response.ok:
        raise ValueError("Could not connect to CodeChef profile page")

    html = response.text

    def search(patterns, default=0):
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return parse_int(match.group(1))
        return default

    rating = search([
        r'"starRating"\s*[:=]\s*"?([0-9,]+)"?',
        r'"rating"\s*[:=]\s*"?([0-9,]+)"?',
        r'([0-9,]+)\s*Rating',
        r'Rating[^\d]*([0-9,]+)',
    ])
    highest_rating = search([
        r'Highest Rating[^\d]*([0-9,]+)',
        r'\(Highest Rating\s*([0-9,]+)\)',
        r'"highestRating"\s*[:=]\s*"?([0-9,]+)"?',
    ], default=rating)
    stars = search([
        r'"stars"\s*[:=]\s*"?([0-9,]+)"?',
        r'([0-9,]+)\s*star[s]?',
        r'([0-9,]+)\s*★',
    ])
    problems_solved = search([
        r'Total Problems Solved\s*[:\-]?\s*([0-9,]+)',
        r'Problems Solved\s*[:\-]?\s*([0-9,]+)',
    ])
    global_rank = search([
        r'Global Rank\s*[:\-]?\s*([0-9,]+)',
        r'"global_rank"\s*[:=]\s*"?([0-9,]+)"?',
    ])
    country_rank = search([
        r'Country Rank\s*[:\-]?\s*([0-9,]+)',
        r'"country_rank"\s*[:=]\s*"?([0-9,]+)"?',
    ])

    submission_calendar = _parse_submission_calendar(html)
    streak = _streak_metrics(submission_calendar)
    paths = _parse_problems_section(html)
    if paths["total_problems_solved"]:
        problems_solved = paths["total_problems_solved"]
    recent_activity = _parse_recent_activity(username)

    metrics = {
        "rating": rating,
        "highest_rating": max(highest_rating, rating),
        "stars": stars,
        "problems_solved": problems_solved,
        "global_rank": global_rank,
        "country_rank": country_rank,
        "learning_paths": len(paths["learning_paths"]),
        "practice_paths": len(paths["practice_paths"]),
        "contests": len(paths["contests"]),
        **streak,
    }

    avatar_match = re.search(r'<img[^>]*class=["\'][^"\']*user-profile-img[^"\']*["\'][^>]*src=["\']([^"\']+)["\']', html, re.I) or \
                   re.search(r'<img[^>]*src=["\']([^"\']*(?:user-default|codechef\.com/sites/all/themes|cdn\.codechef\.com)[^"\']*)["\']', html, re.I) or \
                   re.search(r'"avatar"\s*[:=]\s*"([^"]+)"', html, re.I)
    avatar_url = avatar_match.group(1) if avatar_match else "https://cdn.codechef.com/sites/all/themes/abstrack/images/user-default-160.png"

    if not any(value for key, value in metrics.items() if key not in streak and key not in {"learning_paths", "practice_paths", "contests"}) and username.lower() not in html.lower():
        raise ValueError("CodeChef profile data unavailable")

    return platform_result(
        "codechef",
        username,
        url,
        metrics,
        raw={
            "avatar_url": avatar_url,
            "submission_calendar": submission_calendar,
            "learning_paths": paths["learning_paths"],
            "practice_paths": paths["practice_paths"],
            "college_paths": paths["college_paths"],
            "contests": paths["contests"],
            "recent_activity": recent_activity,
        },
        avatar_url=avatar_url,
    )
