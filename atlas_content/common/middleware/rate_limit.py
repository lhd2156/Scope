from __future__ import annotations

from collections import defaultdict, deque
from math import ceil
from time import time

from django.conf import settings
from django.http import JsonResponse

_BUCKETS = defaultdict(deque)


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
        now = time()
        window_seconds = self._window_seconds()
        bucket = _BUCKETS[key]

        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, ceil(window_seconds - (now - bucket[0])))
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

        bucket.append(now)
        return None
