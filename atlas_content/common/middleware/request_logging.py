from __future__ import annotations

import logging
from time import perf_counter

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = perf_counter()
        try:
            response = self.get_response(request)
        except Exception:
            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            logger.exception(
                'request_failed',
                extra={
                    'correlation_id': getattr(request, 'correlation_id', None),
                    'method': request.method,
                    'path': request.path,
                    'status_code': 500,
                    'duration_ms': duration_ms,
                    'content_type': request.META.get('CONTENT_TYPE'),
                    'content_length': request.META.get('CONTENT_LENGTH'),
                },
            )
            raise

        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        logger.info(
            'request_completed',
            extra={
                'correlation_id': getattr(request, 'correlation_id', None),
                'method': request.method,
                'path': request.path,
                'status_code': response.status_code,
                'duration_ms': duration_ms,
                'content_type': request.META.get('CONTENT_TYPE'),
                'content_length': request.META.get('CONTENT_LENGTH'),
            },
        )
        return response
