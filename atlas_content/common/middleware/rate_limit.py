from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from math import ceil
from threading import Lock
from time import monotonic
from typing import DefaultDict

from django.conf import settings
from django.http import JsonResponse

_BUCKETS: DefaultDict[str, deque[float]] = defaultdict(deque)
_BUCKET_LOCK = Lock()


@dataclass(frozen=True, slots=True)
class RateLimitScope:
    name: str
    limit: int
    identity: str


def clear_rate_limit_buckets() -> None:
    with _BUCKET_LOCK:
        _BUCKETS.clear()


class RateLimitMiddleware:
    WINDOW_SECONDS = 60
    GLOBAL_LIMIT = 100
    UPLOAD_LIMIT = 20
    CONTENT_API_PREFIX = '/api/content/'
    UPLOAD_PATHS = (
        '/api/content/photos/upload',
        '/api/content/photos/presigned-url',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith(self.CONTENT_API_PREFIX):
            return self.get_response(request)

        retry_after = self._check_limits(request)
        if retry_after is not None:
            return JsonResponse(
                {
                    'error': {
                        'code': 'RATE_LIMITED',
                        'message': 'Too many requests',
                        'details': [],
                        'traceId': getattr(request, 'correlation_id', None),
                    }
                },
                status=429,
                headers={'Retry-After': str(retry_after)},
            )

        return self.get_response(request)

    def _check_limits(self, request) -> int | None:
        current_time = monotonic()
        scopes = [
            RateLimitScope(
                name='global',
                limit=getattr(settings, 'RATE_LIMIT_GLOBAL_PER_MINUTE', self.GLOBAL_LIMIT),
                identity=self._client_ip(request),
            )
        ]

        if self._is_upload_request(request.path):
            scopes.append(
                RateLimitScope(
                    name='upload',
                    limit=getattr(settings, 'RATE_LIMIT_UPLOADS_PER_MINUTE', self.UPLOAD_LIMIT),
                    identity=self._user_or_ip_identity(request),
                )
            )

        with _BUCKET_LOCK:
            retry_after = self._retry_after_for_scopes(scopes, current_time)
            if retry_after is not None:
                return retry_after

            for scope in scopes:
                _BUCKETS[self._bucket_key(scope)].append(current_time)

        return None

    def _retry_after_for_scopes(self, scopes: list[RateLimitScope], current_time: float) -> int | None:
        retry_after_seconds: list[int] = []
        window_seconds = getattr(settings, 'RATE_LIMIT_WINDOW_SECONDS', self.WINDOW_SECONDS)

        for scope in scopes:
            bucket = _BUCKETS[self._bucket_key(scope)]
            self._prune_bucket(bucket, current_time, window_seconds)
            if len(bucket) >= scope.limit:
                retry_after_seconds.append(max(1, ceil(window_seconds - (current_time - bucket[0]))))

        if not retry_after_seconds:
            return None

        return max(retry_after_seconds)

    @staticmethod
    def _prune_bucket(bucket: deque[float], current_time: float, window_seconds: int) -> None:
        while bucket and current_time - bucket[0] >= window_seconds:
            bucket.popleft()

    @staticmethod
    def _bucket_key(scope: RateLimitScope) -> str:
        return f'{scope.name}:{scope.identity}'

    def _is_upload_request(self, path: str) -> bool:
        return any(path.startswith(upload_path) for upload_path in self.UPLOAD_PATHS)

    @staticmethod
    def _client_ip(request) -> str:
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip() or 'unknown'
        return request.META.get('REMOTE_ADDR', 'unknown') or 'unknown'

    def _user_or_ip_identity(self, request) -> str:
        user_id = getattr(getattr(request, 'user', None), 'id', None)
        if user_id:
            return str(user_id)
        return self._client_ip(request)
