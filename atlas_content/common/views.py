from __future__ import annotations

import logging
from datetime import datetime, timezone

from django.conf import settings
from django.db import connection
from django.http import HttpResponse
from prometheus_client import CONTENT_TYPE_LATEST
from rest_framework.decorators import api_view
from rest_framework.response import Response

from photos.services.s3_service import S3StorageService
from common.telemetry import record_service_health, render_metrics

logger = logging.getLogger(__name__)


def _health_payload(status: str) -> dict[str, int | str]:
    uptime = int((datetime.now(timezone.utc) - settings.SERVICE_STARTED_AT).total_seconds())
    return {'status': status, 'version': settings.SERVICE_VERSION, 'uptime': uptime}


@api_view(['GET'])
def health_view(request):
    try:
        connection.ensure_connection()

        # Validate storage connectivity as part of the health check, while
        # keeping the response contract aligned with atlas_architecture.tex.
        S3StorageService().health_status()
    except Exception:
        record_service_health('content', False)
        logger.exception(
            'health_check_failed',
            extra={
                'correlation_id': getattr(request, 'correlation_id', None),
                'method': request.method,
                'path': request.path,
                'status_code': 503,
            },
        )
        return Response(_health_payload('unhealthy'), status=503)

    record_service_health('content', True)
    return Response(_health_payload('healthy'))


@api_view(['GET'])
def metrics_view(request):
    payload = render_metrics()
    return HttpResponse(payload, content_type=CONTENT_TYPE_LATEST)
