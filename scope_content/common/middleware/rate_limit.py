from __future__ import annotations

import logging
from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import time

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# In-memory fallback, used ONLY when the Django cache backend is unavailable
# (i.e. when Redis is down). Under normal operation all counters go through
# the shared Django cache — otherwise each gunicorn worker and replica would
# carry its own bucket, multiplying the effective limit by the number of
# processes and making rate limiting useless at scale.
_FALLBACK_BUCKETS: dict[str, deque] = defaultdict(deque)
_FALLBACK_LOCK = Lock()

# Backwards-compatible alias. Tests and ops tooling referenced `_BUCKETS`; keep
# it pointing at the fallback store so existing test fixtures that `.clear()`
# it keep working.
_BUCKETS = _FALLBACK_BUCKETS


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/api/content'):
            return self.get_response(request)

        for key, limit in self._limits_for_request(request):
            throttled_response = self._enforce_limit(request, key, limit)
            if throttled_response is not None:
                return throttled_response

        return self.get_response(request)

    @staticmethod
    def _window_seconds() -> int:
        return int(getattr(settings, 'RATE_LIMIT_WINDOW_SECONDS', 60))

    @staticmethod
    def _global_limit() -> int:
        return int(getattr(settings, 'RATE_LIMIT_GLOBAL_PER_IP', 100))

    @staticmethod
    def _upload_limit() -> int:
        return int(getattr(settings, 'RATE_LIMIT_UPLOAD_PER_USER', 20))

    def _limits_for_request(self, request) -> list[tuple[str, int]]:
        limits: list[tuple[str, int]] = []
        ip_address = self._client_ip(request)
        limits.append((f'global:{ip_address}', self._global_limit()))

        if request.path.startswith('/api/content/photos/upload'):
            upload_identity = self._upload_identity(request, ip_address)
            limits.append((f'upload:{upload_identity}', self._upload_limit()))

        return limits

    @staticmethod
    def _client_ip(request) -> str:
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'anon')

    @staticmethod
    def _upload_identity(request, ip_address: str) -> str:
        user_id = getattr(getattr(request, 'user', None), 'id', None)
        return str(user_id or ip_address)

    def _enforce_limit(self, request, key: str, limit: int):
        window_seconds = self._window_seconds()
        cache_key = f'scope:rl:{key}'

        # Fixed-window counter via the shared cache (Redis in production).
        # cache.incr is atomic against the Redis backend; the first-request
        # race on cache.add is acceptable for a rate limit (off-by-one under
        # contention is cheaper than a Lua script for our volumes).
        try:
            added = cache.add(cache_key, 1, timeout=window_seconds)
            current = 1 if added else cache.incr(cache_key)
        except Exception as exc:
            # Never fail-open silently on a cache outage; log and degrade to
            # the per-process fallback so enforcement keeps working even if
            # Redis is momentarily unreachable.
            logger.warning('rate_limit_cache_unavailable', extra={'error': str(exc), 'key': cache_key})
            return self._enforce_limit_fallback(request, key, limit, window_seconds)

        if current > limit:
            retry_after = window_seconds
            return self._build_limited_response(request, retry_after)
        return None

    def _enforce_limit_fallback(self, request, key: str, limit: int, window_seconds: int):
        now = time()
        with _FALLBACK_LOCK:
            bucket = _FALLBACK_BUCKETS[key]
            while bucket and now - bucket[0] > window_seconds:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, ceil(window_seconds - (now - bucket[0])))
                return self._build_limited_response(request, retry_after)
            bucket.append(now)
            return None

    @staticmethod
    def _build_limited_response(request, retry_after: int):
        response = JsonResponse(
            {
                'error': {
                    'code': 'RATE_LIMITED',
                    'message': 'Too many requests',
                    'details': [],
                    'traceId': getattr(request, 'correlation_id', None),
                }
            },
            status=429,
        )
        response['Retry-After'] = str(retry_after)
        return response
