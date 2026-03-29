from datetime import datetime, timezone

from django.conf import settings
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response

from photos.services.s3_service import S3StorageService


@api_view(['GET'])
def health_view(request):
    connection.ensure_connection()

    # Validate storage connectivity as part of the health check, but keep the
    # response contract aligned with atlas_architecture.tex Section 17/18.
    S3StorageService().health_status()

    uptime = int((datetime.now(timezone.utc) - settings.SERVICE_STARTED_AT).total_seconds())
    return Response({'status': 'healthy', 'version': settings.SERVICE_VERSION, 'uptime': uptime})
