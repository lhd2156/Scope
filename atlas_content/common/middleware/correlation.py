from __future__ import annotations

import uuid

from common.logging_utils import reset_correlation_id, set_correlation_id


class CorrelationIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.correlation_id = request.headers.get('X-Correlation-Id', str(uuid.uuid4()))
        token = set_correlation_id(request.correlation_id)
        try:
            response = self.get_response(request)
        finally:
            reset_correlation_id(token)

        response['X-Correlation-Id'] = request.correlation_id
        return response
