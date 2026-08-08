"""HackerRank public profile integration."""

import re
from html import unescape

import requests

from app.services.platform_common import HEADERS, normalize_platform_username, platform_result


def _parse_certificates(html):
    certificates = []
    for href, title, kind in re.findall(
        r'href="(/certificates/[^"]+)"[^>]*>.*?certificate_v3-heading"><span[^>]*>Certificate:\s*</span>([^<]+)</h2>.*?certificate_v3-ribbon">([^<]+)</div>',
        html or "",
        re.S | re.I,
    ):
        certificates.append({
            "title": unescape(title).strip(),
            "url": f"https://www.hackerrank.com{href}",
            "type": unescape(kind).strip().upper(),
            "verified": True,
        })
    return certificates


def _normalize_badges(badges):
    normalized = []
    for badge in badges or []:
        if not isinstance(badge, dict):
            continue
        stars = int(badge.get("stars") or 0)
        total_stars = int(badge.get("total_stars") or 5)
        normalized.append({
            "name": badge.get("badge_name") or badge.get("badge_type") or "Badge",
            "short_name": badge.get("badge_short_name"),
            "type": badge.get("badge_type") or "",
            "category": badge.get("category_name") or "",
            "url": f"https://www.hackerrank.com{badge['url']}" if badge.get("url") else None,
            "stars": stars,
            "total_stars": total_stars,
            "solved": int(badge.get("solved") or 0),
            "total_challenges": int(badge.get("total_challenges") or 0),
            "level": badge.get("level"),
            "rank": badge.get("hacker_rank"),
        })
    return normalized


from app.services.http_session import get_http_session, HEADERS


def fetch_hackerrank(username):
    username = normalize_platform_username(username)
    if not username:
        raise ValueError("HackerRank username is empty")

    session = get_http_session()
    base = f"https://www.hackerrank.com/rest/hackers/{username}"
    
    response = session.get(base, headers=HEADERS, timeout=20)
    if response.status_code == 404:
        raise ValueError("HackerRank profile is not public, has no visible activity, or the username is incorrect")
    response.raise_for_status()
    model = (response.json() or {}).get("model")
    if not model or model.get("deleted"):
        raise ValueError("HackerRank profile not found")

    badges_response = session.get(f"{base}/badges", headers=HEADERS, timeout=20)
    badges = (badges_response.json() or {}).get("models", []) if badges_response.ok else []
    badges = _normalize_badges(badges)

    certificates = []
    profile_html_response = session.get(
        f"https://www.hackerrank.com/profile/{username}",
        headers=HEADERS,
        timeout=25,
    )
    if profile_html_response.ok:
        certificates = _parse_certificates(profile_html_response.text)

    submission_calendar = {}
    history_response = session.get(f"{base}/submission_histories", headers=HEADERS, timeout=20)
    if history_response.ok:
        try:
            payload = history_response.json() or {}
            if isinstance(payload, dict):
                submission_calendar = {str(date): int(count or 0) for date, count in payload.items()}
        except (TypeError, ValueError):
            submission_calendar = {}

    recent_challenges = []
    recent_resp = session.get(f"{base}/recent_challenges?limit=20", headers=HEADERS, timeout=20)
    if recent_resp.ok:
        try:
            recent_data = (recent_resp.json() or {}).get("models", [])
            for item in recent_data:
                if isinstance(item, dict):
                    ch_title = item.get("name") or item.get("ch_slug") or "Challenge"
                    ch_slug = item.get("ch_slug") or ""
                    url_path = item.get("url") or f"/challenges/{ch_slug}/problem"
                    recent_challenges.append({
                        "title": unescape(str(ch_title)).strip(),
                        "slug": ch_slug,
                        "url": f"https://www.hackerrank.com{url_path}" if not url_path.startswith("http") else url_path,
                        "created_at": item.get("created_at") or item.get("timestamp") or "",
                        "category": item.get("category_name") or item.get("track_name") or "Problem Solving",
                    })
        except Exception:
            pass

    problem_solving_score = sum(int(badge.get("solved") or 0) * 10 + int(badge.get("stars") or 0) * 5 for badge in badges)

    metrics = {
        "problem_solving_score": problem_solving_score,
        "badges": len(badges),
        "certificates": len(certificates),
        "followers": model.get("followers_count") or 0,
        "stars": sum(int(badge.get("stars") or 0) for badge in badges),
        "solved": sum(int(badge.get("solved") or 0) for badge in badges),
        "skills": len(badges),
    }
    raw = {
        "avatar_url": model.get("avatar"),
        "name": model.get("name"),
        "country": model.get("country"),
        "school": model.get("school"),
        "company": model.get("company"),
        "badges": badges,
        "certificates": certificates,
        "submission_calendar": submission_calendar,
        "recent_challenges": recent_challenges,
    }
    return platform_result("hackerrank", username, f"https://www.hackerrank.com/profile/{username}", metrics, raw)
