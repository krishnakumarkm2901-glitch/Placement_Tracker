"""GitHub API integration service — REST + GraphQL."""

import requests
import time
import re
from html.parser import HTMLParser
from datetime import datetime, timezone, timedelta
from app.config import Config


from app.services.http_session import get_http_session


class GitHubService:
    """Handles all GitHub API interactions."""

    def __init__(self):
        self.rest_url = Config.GITHUB_API_URL
        self.graphql_url = Config.GITHUB_GRAPHQL_URL
        self.token = Config.GITHUB_TOKEN
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    # ── REST API ────────────────────────────────────────────────────

    def _get(self, url, params=None):
        """Make a GET request with error handling."""
        try:
            session = get_http_session()
            resp = session.get(url, headers=self.headers, params=params, timeout=30)
            if resp.status_code == 404:
                return None
            if resp.status_code == 403:
                # Rate limit hit
                reset = resp.headers.get("X-RateLimit-Reset")
                return {"error": "rate_limited", "reset": reset}
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    def get_user_profile(self, username):
        """Fetch GitHub user profile."""
        data = self._get(f"{self.rest_url}/users/{username}")
        if not data or isinstance(data, dict) and data.get("error"):
            return self.get_public_user_profile(username)

        return {
            "login": data.get("login", ""),
            "name": data.get("name", ""),
            "avatar_url": data.get("avatar_url", ""),
            "bio": data.get("bio", ""),
            "company": data.get("company", ""),
            "location": data.get("location", ""),
            "blog": data.get("blog", ""),
            "twitter_username": data.get("twitter_username", ""),
            "public_repos": data.get("public_repos", 0),
            "public_gists": data.get("public_gists", 0),
            "followers": data.get("followers", 0),
            "following": data.get("following", 0),
            "html_url": data.get("html_url", ""),
            "created_at": data.get("created_at", ""),
            "updated_at": data.get("updated_at", ""),
        }

    def get_public_user_profile(self, username):
        """Resolve basic public profile data from github.com as an API fallback."""
        try:
            response = requests.get(
                f"https://github.com/{username}",
                headers={"User-Agent": self.headers["User-Agent"]},
                timeout=30,
            )
            if response.status_code == 404:
                return None
            if response.status_code != 200:
                return None
            parser = _GitHubProfileParser()
            parser.feed(response.text)
            if not parser.login:
                parser.login = username
            title_name = parser.title.split("(", 1)[0].strip() if parser.title else ""
            public_repos = self.get_public_user_repos(parser.login)
            return {
                "login": parser.login,
                "name": parser.name or title_name or parser.login,
                "avatar_url": parser.avatar_url,
                "bio": parser.bio,
                "company": parser.company,
                "location": parser.location,
                "blog": parser.blog,
                "twitter_username": "",
                "public_repos": len(public_repos),
                "public_gists": 0,
                "followers": 0,
                "following": 0,
                "html_url": f"https://github.com/{parser.login}",
                "created_at": "",
                "updated_at": "",
                "public_fallback": True,
            }
        except requests.exceptions.RequestException:
            return None

    def get_user_repos(self, username, page=1, per_page=100):
        """Fetch all public repositories for a user."""
        all_repos = []
        while True:
            data = self._get(
                f"{self.rest_url}/users/{username}/repos",
                params={
                    "page": page,
                    "per_page": per_page,
                    "sort": "updated",
                    "type": "owner",
                },
            )
            if isinstance(data, dict) and data.get("error"):
                return self.get_public_user_repos(username)
            if not data:
                break
            all_repos.extend(data)
            if len(data) < per_page:
                break
            page += 1
            time.sleep(0.5)  # Rate limit courtesy
        return all_repos

    def get_public_user_repos(self, username):
        """Read public repositories from github.com when REST is rate-limited."""
        try:
            response = requests.get(
                f"https://github.com/{username}",
                params={"tab": "repositories", "sort": "updated"},
                headers={"User-Agent": self.headers["User-Agent"]},
                timeout=30,
            )
            if response.status_code != 200:
                return []
            parser = _GitHubRepositoriesParser(username)
            parser.feed(response.text)
            return parser.repositories
        except requests.exceptions.RequestException:
            return []

    def get_repo_languages(self, owner, repo):
        """Fetch language breakdown for a repository."""
        data = self._get(f"{self.rest_url}/repos/{owner}/{repo}/languages")
        if not data or isinstance(data, dict) and data.get("error"):
            return {}
        return data

    def get_repo_readme(self, owner, repo, default_branch="main"):
        """Check if repository has a README."""
        return self.get_repo_readme_details(owner, repo, default_branch)["has_readme"]

    def get_repo_readme_details(self, owner, repo, default_branch="main"):
        """Return README presence and whether all rubric sections exist."""
        content = ""
        # raw.githubusercontent.com is public and does not consume the small
        # unauthenticated REST API quota used for profiles and commit counts.
        for filename in ("README.md", "readme.md", "README.MD", "README"):
            try:
                response = requests.get(
                    f"https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}/{filename}",
                    headers={"User-Agent": self.headers["User-Agent"]},
                    timeout=15,
                )
                if response.status_code == 200:
                    content = response.text.lower()
                    break
            except requests.exceptions.RequestException:
                break
        if not content:
            return {"has_readme": False, "detailed_readme": False}
        required_sections = all(word in content for word in ("installation", "features", "usage"))
        return {
            "has_readme": True,
            "detailed_readme": bool(required_sections),
        }

    def get_repo_commits_count(self, owner, repo, author=None):
        """Get the exact commit count on a repository's default branch.

        Supplying an author restricts the count to that GitHub account. Using
        one item per page exposes the total through GitHub's Link header
        without downloading every commit payload.
        """
        try:
            params = {"per_page": 1}
            if author:
                params["author"] = author
            resp = requests.get(
                f"{self.rest_url}/repos/{owner}/{repo}/commits",
                headers=self.headers,
                params=params,
                timeout=30,
            )
            if resp.status_code != 200:
                return None
            # Parse Link header for last page number
            link = resp.headers.get("Link", "")
            if 'rel="last"' in link:
                import re
                match = re.search(r'[?&]page=(\d+)[^>]*>; rel="last"', link)
                if match:
                    return int(match.group(1))
            return len(resp.json())
        except Exception:
            return None

    def get_user_commits_count(self, username):
        """Get the total number of public commits authored by a user.

        GitHub's commit search provides the total in one request, avoiding a
        separate rate-limited commits request for every repository.
        """
        data = self._get(
            f"{self.rest_url}/search/commits",
            params={"q": f"author:{username}", "per_page": 1},
        )
        if not data or not isinstance(data, dict) or data.get("error"):
            return None
        total = data.get("total_count")
        return total if isinstance(total, int) else None

    def get_user_events(self, username, pages=3):
        """Fetch recent user events (contributions)."""
        all_events = []
        for page in range(1, pages + 1):
            data = self._get(
                f"{self.rest_url}/users/{username}/events/public",
                params={"page": page, "per_page": 100},
            )
            if not data or isinstance(data, dict) and data.get("error"):
                break
            all_events.extend(data)
            time.sleep(0.3)
        return all_events

    # ── GraphQL API ─────────────────────────────────────────────────

    def _graphql(self, query, variables=None):
        """Make a GraphQL request."""
        if not self.token:
            return None
        try:
            resp = requests.post(
                self.graphql_url,
                json={"query": query, "variables": variables or {}},
                headers={
                    "Authorization": f"bearer {self.token}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
            resp.raise_for_status()
            result = resp.json()
            if "errors" in result:
                return None
            return result.get("data")
        except Exception:
            return None

    def get_contribution_data(self, username):
        """Fetch contribution calendar via GraphQL."""
        query = """
        query($username: String!) {
            user(login: $username) {
                contributionsCollection {
                    totalCommitContributions
                    totalIssueContributions
                    totalPullRequestContributions
                    totalPullRequestReviewContributions
                    totalRepositoryContributions
                    contributionCalendar {
                        totalContributions
                        weeks {
                            contributionDays {
                                date
                                contributionCount
                                weekday
                            }
                        }
                    }
                }
            }
        }
        """
        data = self._graphql(query, {"username": username})
        if not data or not data.get("user"):
            return self.get_public_contribution_data(username)

        cc = data["user"]["contributionsCollection"]
        calendar = cc.get("contributionCalendar", {})
        weeks = calendar.get("weeks", [])

        # Flatten contribution days
        contribution_days = []
        for week in weeks:
            for day in week.get("contributionDays", []):
                contribution_days.append({
                    "date": day["date"],
                    "count": day["contributionCount"],
                })

        return {
            "commit_count_exact": True,
            "total_commits": cc.get("totalCommitContributions", 0),
            "total_issues": cc.get("totalIssueContributions", 0),
            "total_prs": cc.get("totalPullRequestContributions", 0),
            "total_pr_reviews": cc.get("totalPullRequestReviewContributions", 0),
            "total_repo_contributions": cc.get("totalRepositoryContributions", 0),
            "total_contributions": calendar.get("totalContributions", 0),
            "contribution_days": contribution_days,
        }

    def get_public_contribution_data(self, username):
        """Fetch the public one-year contribution calendar without a token.

        GitHub exposes the same calendar used on public profile pages as an
        HTML fragment. This fallback keeps the heatmap useful when GraphQL is
        unavailable or no GITHUB_TOKEN has been configured.
        """
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=364)
        try:
            response = requests.get(
                f"https://github.com/users/{username}/contributions",
                headers={"User-Agent": self.headers["User-Agent"]},
                params={"from": start.isoformat(), "to": today.isoformat()},
                timeout=30,
            )
            if response.status_code != 200:
                return None

            parser = _ContributionCalendarParser()
            parser.feed(response.text)
            days = parser.contribution_days()
            if not days:
                return None
            return {
                "commit_count_exact": False,
                "total_commits": 0,
                "total_issues": 0,
                "total_prs": 0,
                "total_pr_reviews": 0,
                "total_repo_contributions": 0,
                "total_contributions": sum(day["count"] for day in days),
                "contribution_days": days,
            }
        except requests.exceptions.RequestException:
            return None

    def get_pr_data(self, username):
        """Fetch pull request stats via GraphQL."""
        query = """
        query($username: String!) {
            user(login: $username) {
                pullRequests(first: 1, states: [OPEN]) { totalCount }
                mergedPRs: pullRequests(first: 1, states: [MERGED]) { totalCount }
                closedPRs: pullRequests(first: 1, states: [CLOSED]) { totalCount }
            }
        }
        """
        data = self._graphql(query, {"username": username})
        if not data or not data.get("user"):
            search = self._get(
                f"{self.rest_url}/search/issues",
                params={"q": f"author:{username} type:pr", "per_page": 1},
            )
            total = search.get("total_count", 0) if isinstance(search, dict) and not search.get("error") else 0
            return {"open": 0, "merged": 0, "closed": 0, "total": total}

        user = data["user"]
        open_prs = user.get("pullRequests", {}).get("totalCount", 0)
        merged = user.get("mergedPRs", {}).get("totalCount", 0)
        closed = user.get("closedPRs", {}).get("totalCount", 0)
        return {
            "open": open_prs,
            "merged": merged,
            "closed": closed,
            "total": open_prs + merged + closed,
        }

    def get_issue_data(self, username):
        """Fetch issue stats via GraphQL."""
        query = """
        query($username: String!) {
            user(login: $username) {
                openIssues: issues(first: 1, states: [OPEN]) { totalCount }
                closedIssues: issues(first: 1, states: [CLOSED]) { totalCount }
            }
        }
        """
        data = self._graphql(query, {"username": username})
        if not data or not data.get("user"):
            return {"open": 0, "closed": 0, "total": 0}

        user = data["user"]
        open_issues = user.get("openIssues", {}).get("totalCount", 0)
        closed_issues = user.get("closedIssues", {}).get("totalCount", 0)
        return {
            "open": open_issues,
            "closed": closed_issues,
            "total": open_issues + closed_issues,
        }

    # ── Streak Calculation ──────────────────────────────────────────

    def calculate_streak(self, contribution_days):
        """Calculate current and longest streak from contribution days."""
        if not contribution_days:
            return 0, 0

        # Sort by date descending
        sorted_days = sorted(contribution_days, key=lambda d: d["date"], reverse=True)

        # Recent coding streak: consecutive contribution days ending on the
        # user's latest active day. This remains visible after a rest day and
        # continues when the next commit appears on GitHub.
        active_dates = {
            datetime.strptime(day["date"], "%Y-%m-%d").date()
            for day in contribution_days
            if day.get("count", 0) > 0
        }
        current_streak = 0
        if active_dates:
            cursor = max(active_dates)
            while cursor in active_dates:
                current_streak += 1
                cursor -= timedelta(days=1)

        # Longest streak
        sorted_asc = sorted(contribution_days, key=lambda d: d["date"])
        longest_streak = 0
        temp_streak = 0
        for day in sorted_asc:
            if day["count"] > 0:
                temp_streak += 1
                longest_streak = max(longest_streak, temp_streak)
            else:
                temp_streak = 0

        return current_streak, longest_streak


# Module-level singleton
github_service = GitHubService()


class _ContributionCalendarParser(HTMLParser):
    """Extract dates and tooltip counts from GitHub's calendar fragment."""

    def __init__(self):
        super().__init__()
        self.dates_by_id = {}
        self.counts_by_id = {}
        self._tooltip_id = None
        self._tooltip_text = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "td" and attributes.get("data-date"):
            cell_id = attributes.get("id") or attributes["data-date"]
            self.dates_by_id[cell_id] = attributes["data-date"]
            # Some GitHub variants include the count directly.
            if attributes.get("data-count", "").isdigit():
                self.counts_by_id[cell_id] = int(attributes["data-count"])
        elif tag in ("tool-tip", "span") and attributes.get("for") in self.dates_by_id:
            self._tooltip_id = attributes["for"]
            self._tooltip_text = []

    def handle_data(self, data):
        if self._tooltip_id:
            self._tooltip_text.append(data)

    def handle_endtag(self, tag):
        if self._tooltip_id and tag in ("tool-tip", "span"):
            text = " ".join(self._tooltip_text)
            match = re.search(r"([\d,]+)\s+contributions?", text, re.IGNORECASE)
            self.counts_by_id[self._tooltip_id] = (
                int(match.group(1).replace(",", "")) if match else 0
            )
            self._tooltip_id = None
            self._tooltip_text = []

    def contribution_days(self):
        return sorted(
            [
                {"date": date, "count": self.counts_by_id.get(cell_id, 0)}
                for cell_id, date in self.dates_by_id.items()
            ],
            key=lambda day: day["date"],
        )


class _GitHubProfileParser(HTMLParser):
    """Read public identity fields from a GitHub profile HTML page."""

    def __init__(self):
        super().__init__()
        self.login = ""
        self.title = ""
        self.avatar_url = ""
        self.name = ""
        self.bio = ""
        self.company = ""
        self.location = ""
        self.blog = ""
        self._capture = None
        self._capture_tag = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            content = attributes.get("content", "")
            if key == "og:title":
                self.title = content.replace(" · GitHub", "")
            elif key == "og:image":
                self.avatar_url = content
            elif key == "profile:username":
                self.login = content
            return

        itemprop = attributes.get("itemprop")
        if itemprop == "url" and tag == "a" and attributes.get("href"):
            self.blog = attributes["href"]
            return
        class_name = attributes.get("class", "")
        target = None
        if itemprop == "name":
            target = "name"
        elif itemprop == "worksFor":
            target = "company"
        elif itemprop == "homeLocation":
            target = "location"
        elif itemprop == "description" or "user-profile-bio" in class_name:
            target = "bio"
        if target and not self._capture:
            self._capture = target
            self._capture_tag = tag
            self._text = []

    def handle_data(self, data):
        if self._capture:
            self._text.append(data)

    def handle_endtag(self, tag):
        if self._capture and tag == self._capture_tag:
            value = " ".join(" ".join(self._text).split())
            if value and not getattr(self, self._capture):
                setattr(self, self._capture, value)
            self._capture = None
            self._capture_tag = None
            self._text = []


class _GitHubRepositoriesParser(HTMLParser):
    """Read repository cards from a user's public repositories page."""

    def __init__(self, username):
        super().__init__()
        self.username = username
        self.repositories = []
        self.current = None
        self._capture = None
        self._capture_tag = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        itemprop = attributes.get("itemprop", "")
        if tag == "li" and itemprop == "owns":
            self.current = {
                "id": None,
                "name": "",
                "full_name": "",
                "description": "",
                "language": "",
                "stargazers_count": 0,
                "forks_count": 0,
                "watchers_count": 0,
                "size": 0,
                "topics": [],
                "license": None,
                "private": False,
                "default_branch": "main",
                "open_issues_count": 0,
                "archived": False,
                "fork": "fork" in attributes.get("class", "").split(),
                "html_url": "",
                "created_at": "",
                "updated_at": "",
                "pushed_at": "",
            }
            return
        if not self.current:
            return
        if tag == "a" and "codeRepository" in itemprop:
            href = attributes.get("href", "")
            self.current["html_url"] = f"https://github.com{href}"
            self._start_capture("name", tag)
        elif itemprop == "description":
            self._start_capture("description", tag)
        elif itemprop == "programmingLanguage":
            self._start_capture("language", tag)
        elif tag == "relative-time":
            updated = attributes.get("datetime", "")
            self.current["updated_at"] = updated
            self.current["pushed_at"] = updated
        elif tag == "a":
            href = attributes.get("href", "")
            if href.endswith("/stargazers"):
                self._start_capture("stargazers_count", tag)
            elif href.endswith("/forks") or href.endswith("/network/members"):
                self._start_capture("forks_count", tag)

    def _start_capture(self, field, tag):
        if not self._capture:
            self._capture = field
            self._capture_tag = tag
            self._text = []

    def handle_data(self, data):
        if self._capture:
            self._text.append(data)

    def handle_endtag(self, tag):
        if self.current and self._capture and tag == self._capture_tag:
            value = " ".join(" ".join(self._text).split())
            if self._capture in {"stargazers_count", "forks_count"}:
                match = re.search(r"[\d,.]+", value)
                value = int(match.group(0).replace(",", "")) if match else 0
            self.current[self._capture] = value
            if self._capture == "name":
                self.current["full_name"] = f"{self.username}/{value}"
            self._capture = None
            self._capture_tag = None
            self._text = []
        if tag == "li" and self.current:
            if self.current["name"]:
                self.repositories.append(self.current)
            self.current = None
