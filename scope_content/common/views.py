from __future__ import annotations

import ipaddress
import logging
import os
from datetime import datetime, timezone

from django.conf import settings
from django.db import connection
from django.http import HttpResponse, HttpResponseForbidden
from prometheus_client import CONTENT_TYPE_LATEST
from rest_framework.decorators import api_view
from rest_framework.response import Response

from common.telemetry import record_service_health, render_metrics
from photos.services.s3_service import S3StorageService


def _metrics_allowlist() -> list:
    raw = os.getenv('METRICS_ALLOWED_CIDRS', '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8,::1/128')
    networks = []
    for item in raw.replace(';', ',').split(','):
        entry = item.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            continue
    return networks


def _client_ip(request) -> str:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '') or ''

logger = logging.getLogger(__name__)


def _health_payload(status: str) -> dict[str, int | str]:
    uptime = int((datetime.now(timezone.utc) - settings.SERVICE_STARTED_AT).total_seconds())
    return {'status': status, 'version': settings.SERVICE_VERSION, 'uptime': uptime}


@api_view(['GET'])
def health_view(request):
    try:
        connection.ensure_connection()

        # Validate storage connectivity as part of the health check, while
        # keeping the response contract aligned with scope_architecture.tex.
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
    remote = _client_ip(request)
    try:
        caller = ipaddress.ip_address(remote)
    except ValueError:
        return HttpResponseForbidden('metrics access denied')
    if not any(caller in network for network in _metrics_allowlist()):
        return HttpResponseForbidden('metrics access denied')
    payload = render_metrics()
    return HttpResponse(payload, content_type=CONTENT_TYPE_LATEST)
