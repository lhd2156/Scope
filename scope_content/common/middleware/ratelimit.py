"""Redis-based sliding window rate limiting middleware for Django."""

from __future__ import annotations

from collections import defaultdict, deque
from ipaddress import ip_address, ip_network
from math import ceil
from threading import Lock
import logging
import os
import time
import uuid

from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)

_FALLBACK_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_FALLBACK_LOCK = Lock()

_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = window
    if oldest[2] then
        retry_after = math.max(1, math.ceil(tonumber(oldest[2]) + window - now))
    end
    redis.call('EXPIRE', key, window)
    return {0, count, retry_after}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, window)
return {1, count + 1, 0}
"""


class RateLimitMiddleware:
    """Sliding window rate limiter using Redis.

    Limits are configurable through Django settings for tests and ops:
    global per-IP, stricter search/auth limits, and upload per authenticated
    user. Redis is the primary store; a per-process fallback keeps enforcement
    active if Redis is temporarily unavailable.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._redis = None
        self._redis_unavailable = False

    def _get_redis(self):
        if self._redis_unavailable:
            return None

        if self._redis is None:
            url = self._redis_url()
            if not url:
                self._redis_unavailable = True
                return None

            try:
                import redis as redis_lib

                self._redis = redis_lib.from_url(url)
            except Exception:
                self._redis_unavailable = True
                logger.warning("Redis unavailable for rate limiting", exc_info=True)
                return None
        return self._redis

    @staticmethod
    def _redis_url() -> str | None:
        url = os.environ.get("RATE_LIMIT_REDIS_URL") or os.environ.get("DJANGO_CACHE_LOCATION")
        if url:
            return url

        configured_cache = getattr(settings, "CACHES", {}).get("default", {})
        backend = configured_cache.get("BACKEND", "")
        location = configured_cache.get("LOCATION")
        if isinstance(location, str) and ("redis" in backend.lower() or location.startswith(("redis://", "rediss://", "unix://"))):
            return location
        return None

    def __call__(self, request):
        if not request.path.startswith("/api/content"):
            return self.get_response(request)

        headers: dict[str, str] = {}
        client = self._get_redis()

        for key, limit, window in self._rules_for_request(request):
            limited_response, rule_headers = self._enforce_rule(client, key, limit, window, request)
            if limited_response is not None:
                return limited_response
            headers = rule_headers

        response = self.get_response(request)
        for header, value in headers.items():
            response[header] = value
        return response

    def _rules_for_request(self, request) -> list[tuple[str, int, int]]:
        ip = self._get_client_ip(request)
        window = int(getattr(settings, "RATE_LIMIT_WINDOW_SECONDS", 60))
        rules = [(f"rl:global:{ip}", int(getattr(settings, "RATE_LIMIT_GLOBAL_PER_IP", 100)), window)]

        if "/auth/" in request.path:
            rules.append((f"rl:auth:{ip}", int(getattr(settings, "RATE_LIMIT_AUTH_PER_IP", 10)), window))
        elif "/search" in request.path:
            rules.append((f"rl:search:{ip}", int(getattr(settings, "RATE_LIMIT_SEARCH_PER_IP", 30)), window))

        if request.path in {"/api/content/photos/upload", "/api/content/photos/avatar-upload"}:
            rules.append((f"rl:upload:{self._upload_identity(request, ip)}", int(getattr(settings, "RATE_LIMIT_UPLOAD_PER_USER", 20)), window))
        if request.path.startswith("/api/content/comments") and request.method in {"POST", "PUT", "DELETE"}:
            rules.append((f"rl:comments:{self._upload_identity(request, ip)}", int(getattr(settings, "RATE_LIMIT_COMMENTS_PER_USER", 30)), window))

        return rules

    def _enforce_rule(self, client, key: str, limit: int, window: int, request):
        if client is None:
            return self._enforce_fallback(key, limit, window, request)

        now = time.time()
        member = f"{now}:{uuid.uuid4()}"

        try:
            allowed, request_count, retry_after = client.eval(
                _SLIDING_WINDOW_SCRIPT,
                1,
                key,
                now,
                window,
                limit,
                member,
            )
        except Exception:
            logger.warning("Redis rate limit operation failed", exc_info=True)
            return self._enforce_fallback(key, limit, window, request)

        request_count = int(request_count)
        if not int(allowed):
            return self._limited_response(request, int(retry_after)), {}

        return None, {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(max(0, limit - request_count)),
        }

    def _enforce_fallback(self, key: str, limit: int, window: int, request):
        now = time.time()
        with _FALLBACK_LOCK:
            bucket = _FALLBACK_BUCKETS[key]
            while bucket and now - bucket[0] > window:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, ceil(window - (now - bucket[0])))
                return self._limited_response(request, retry_after), {}
            request_count = len(bucket)
            bucket.append(now)

        return None, {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(max(0, limit - request_count - 1)),
        }

    @staticmethod
    def _limited_response(request, retry_after: int):
        return JsonResponse(
            {
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests",
                    "details": [],
                    "traceId": getattr(request, "correlation_id", None),
                }
            },
            status=429,
            headers={"Retry-After": str(retry_after)},
        )

    @staticmethod
    def _trusted_proxy_networks():
        raw_value = getattr(settings, "TRUSTED_PROXY_CIDRS", []) or os.environ.get("TRUSTED_PROXY_CIDRS", "")
        if isinstance(raw_value, str):
            raw_items = [item.strip() for item in raw_value.replace(";", ",").split(",")]
        else:
            raw_items = [str(item).strip() for item in raw_value]

        networks = []
        for raw_item in raw_items:
            if not raw_item:
                continue
            try:
                networks.append(ip_network(raw_item, strict=False))
            except ValueError:
                logger.warning("Ignoring invalid trusted proxy CIDR", extra={"cidr": raw_item})
        return networks

    @classmethod
    def _remote_addr_is_trusted_proxy(cls, remote_addr: str) -> bool:
        try:
            remote_ip = ip_address(remote_addr)
        except ValueError:
            return False

        return any(remote_ip in network for network in cls._trusted_proxy_networks())

    @classmethod
    def _get_client_ip(cls, request):
        remote_addr = request.META.get("REMOTE_ADDR", "unknown")
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff and cls._remote_addr_is_trusted_proxy(remote_addr):
            candidate = xff.split(",")[0].strip()
            try:
                ip_address(candidate)
                return candidate
            except ValueError:
                pass
        return remote_addr

    @staticmethod
    def _upload_identity(request, ip_address: str) -> str:
        user_id = getattr(getattr(request, "user", None), "id", None)
        return str(user_id or ip_address)
