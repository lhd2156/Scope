from __future__ import annotations

import re
import uuid

from common.logging_utils import reset_correlation_id, set_correlation_id

# Only accept correlation ids that look like real ids: hex, UUID, KSUID style.
# An attacker can't inject newlines or log-forging payloads by setting
# X-Correlation-Id to a crafted value.
_SAFE_ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,128}$')


def _sanitize(candidate: str | None) -> str:
    if candidate and _SAFE_ID_PATTERN.match(candidate):
        return candidate
    return uuid.uuid4().hex


class CorrelationIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.correlation_id = _sanitize(request.headers.get('X-Correlation-Id'))
        token = set_correlation_id(request.correlation_id)
        try:
            response = self.get_response(request)
        finally:
            reset_correlation_id(token)

        response['X-Correlation-Id'] = request.correlation_id
        return response
