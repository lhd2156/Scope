from datetime import datetime, timezone
from django.conf import settings
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response
from photos.services.s3_service import S3StorageService
@api_view(['GET'])
def health_view(request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()
    uptime = int((datetime.now(timezone.utc) - settings.SERVICE_STARTED_AT).total_seconds())
    return Response({'status': 'healthy', 'version': '1.0.0', 'uptime': uptime, 'checks': {'database': 'ok', 'storage': S3StorageService().health_status()}})
