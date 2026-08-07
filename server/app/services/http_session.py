"""HTTP Session Singleton with Connection Pooling, Automatic Retries, and Per-Domain Request Pacing."""

import time
import threading
from urllib.parse import urlparse
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

_session = None
_domain_locks = {}
_last_request_times = {}
_global_lock = threading.Lock()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

DOMAIN_DELAYS = {
    "www.codechef.com": 0.01,
    "codechef.com": 0.01,
    "leetcode.com": 0.01,
    "hackerrank.com": 0.01,
}


class PacedSession(requests.Session):
    """Thread-safe requests.Session subclass enforcing minimum delays between requests to rate-sensitive domains."""

    def request(self, method, url, *args, **kwargs):
        domain = urlparse(url).netloc.lower()
        delay = DOMAIN_DELAYS.get(domain, 0)
        if delay > 0:
            with _global_lock:
                if domain not in _domain_locks:
                    _domain_locks[domain] = threading.Lock()
                domain_lock = _domain_locks[domain]

            with domain_lock:
                now = time.time()
                last_time = _last_request_times.get(domain, 0)
                elapsed = now - last_time
                if elapsed < delay:
                    time.sleep(delay - elapsed)
                response = super().request(method, url, *args, **kwargs)
                _last_request_times[domain] = time.time()
                return response

        return super().request(method, url, *args, **kwargs)


def get_http_session():
    """Return a shared PacedSession instance configured with connection pooling, retries, and domain pacing."""
    global _session
    if _session is None:
        _session = PacedSession()
        retry_strategy = Retry(
            total=4,
            backoff_factor=2,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(
            pool_connections=20,
            pool_maxsize=50,
            max_retries=retry_strategy,
        )
        _session.mount("http://", adapter)
        _session.mount("https://", adapter)
        _session.headers.update(HEADERS)
    return _session
