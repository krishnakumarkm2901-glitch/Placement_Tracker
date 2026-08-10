"""Simple in-memory TTL cache for API responses.

Provides a lightweight caching layer that avoids repeated database queries
for frequently-accessed, read-heavy endpoints (public dashboards, platform
lists, leaderboards).  Each cache entry expires after a configurable TTL.
"""

import time
import threading
import hashlib
import json
from functools import wraps
from flask import request, jsonify

_cache = {}
_lock = threading.Lock()


def _make_key(prefix, *args, **kwargs):
    """Generate a deterministic cache key from prefix + request context."""
    parts = [prefix]
    if args:
        parts.extend(str(a) for a in args)
    if kwargs:
        parts.append(json.dumps(kwargs, sort_keys=True, default=str))
    raw = ":".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()


def cache_get(key):
    """Return cached value if it exists and hasn't expired, else None."""
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        if time.time() > entry["expires"]:
            del _cache[key]
            return None
        return entry["value"]


def cache_set(key, value, ttl=60):
    """Store a value in cache with the given TTL (seconds)."""
    with _lock:
        _cache[key] = {"value": value, "expires": time.time() + ttl}


def cache_invalidate(prefix=None):
    """Invalidate cache entries.  If prefix is given, only matching keys."""
    with _lock:
        if prefix is None:
            _cache.clear()
        else:
            keys_to_delete = [k for k in _cache if k.startswith(prefix)]
            for k in keys_to_delete:
                del _cache[k]


def cached_response(ttl=60, prefix=None):
    """Decorator that caches the full JSON response of a Flask route.

    Uses the request path + query string as the cache key so that
    different filter/pagination combos are cached independently.
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            cache_prefix = prefix or fn.__name__
            # Build key from route path + query string
            cache_key = f"{cache_prefix}:{request.full_path}"
            cached = cache_get(cache_key)
            if cached is not None:
                return cached

            result = fn(*args, **kwargs)
            # Cache the response tuple (body, status_code)
            cache_set(cache_key, result, ttl)
            return result

        return wrapper

    return decorator
