from pathlib import Path

root = Path(r'C:\Users\dongu\atlas\atlas_content')

def w(rel: str, content: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

w('manage.py', '''#!/usr/bin/env python
import os
import sys


def main() -> None:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'atlas_content.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
''')

w('atlas_content/__init__.py', '')
w('atlas_content/asgi.py', '''import os
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'atlas_content.settings')
application = get_asgi_application()
''')
w('atlas_content/wsgi.py', '''import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'atlas_content.settings')
application = get_wsgi_application()
''')

w('atlas_content/settings.py', '''from __future__ import annotations
import os
from datetime import datetime, timezone
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'atlas-content-dev-secret')
DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'
ALLOWED_HOSTS = [host for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host]
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions',
    'django.contrib.messages', 'django.contrib.staticfiles', 'rest_framework',
    'common', 'spots', 'trips', 'photos', 'reviews', 'feed'
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware', 'common.middleware.correlation.CorrelationIdMiddleware',
    'common.middleware.jwt_auth.JWTAuthenticationMiddleware', 'common.middleware.rate_limit.RateLimitMiddleware'
]
ROOT_URLCONF = 'atlas_content.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'atlas_content.wsgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.StandardPageNumberPagination',
    'PAGE_SIZE': int(os.getenv('PAGINATION_PAGE_SIZE', '20')),
    'EXCEPTION_HANDLER': 'common.exceptions.custom_exception_handler',
}
JWT_SECRET = os.getenv('CORE_JWT_SECRET', 'super-secret-256-bit-key-change-in-prod')
JWT_ISSUER = os.getenv('CORE_JWT_ISSUER', 'atlas-core')
JWT_AUDIENCE = os.getenv('CORE_JWT_AUDIENCE', 'atlas-frontend')
SERVICE_STARTED_AT = datetime.now(timezone.utc)
MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', str(10 * 1024 * 1024)))
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_S3_BUCKET', '')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
KAFKA_ENABLED = os.getenv('KAFKA_ENABLED', 'false').lower() == 'true'
LOGGING = {'version': 1, 'disable_existing_loggers': False, 'formatters': {'json': {'()': 'pythonjsonlogger.jsonlogger.JsonFormatter', 'fmt': '%(asctime)s %(levelname)s %(name)s %(message)s %(correlation_id)s'}}, 'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'json'}}, 'root': {'handlers': ['console'], 'level': os.getenv('LOG_LEVEL', 'INFO')}}
''')

w('atlas_content/urls.py', '''from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from common.views import health_view
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/content/health', health_view, name='content-health'),
    path('api/content/spots/', include('spots.urls')),
    path('api/content/trips/', include('trips.urls')),
    path('api/content/photos/', include('photos.urls')),
    path('api/content/reviews/', include('reviews.urls')),
    path('api/content/feed/', include('feed.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
''')

w('common/__init__.py', '')
w('common/apps.py', "from django.apps import AppConfig\n\nclass CommonConfig(AppConfig):\n    default_auto_field = 'django.db.models.BigAutoField'\n    name = 'common'\n")
w('common/models.py', '')
w('common/pagination.py', '''from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response
class StandardPageNumberPagination(PageNumberPagination):
    page_size_query_param = 'pageSize'
    max_page_size = 100
    def get_paginated_response(self, data):
        return Response({'data': data, 'meta': {'page': self.page.number, 'pageSize': self.get_page_size(self.request), 'total': self.page.paginator.count, 'totalPages': self.page.paginator.num_pages}})
class FeedCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'
    cursor_query_param = 'cursor'
    def get_paginated_response(self, data):
        return Response({'data': data, 'meta': {'nextCursor': self.get_next_link(), 'previousCursor': self.get_previous_link()}})
''')
w('common/exceptions.py', '''from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework.exceptions import ValidationError, PermissionDenied, NotAuthenticated, NotFound
from rest_framework.response import Response

def _format_error(code: str, message: str, details=None, trace_id=None):
    return {'error': {'code': code, 'message': message, 'details': details or [], 'traceId': trace_id}}

def custom_exception_handler(exc, context):
    request = context.get('request')
    trace_id = getattr(request, 'correlation_id', None)
    if isinstance(exc, (Http404, NotFound)):
        return Response(_format_error('NOT_FOUND', 'Resource does not exist', trace_id=trace_id), status=404)
    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        return Response(_format_error('FORBIDDEN', 'Insufficient permissions', trace_id=trace_id), status=403)
    if isinstance(exc, NotAuthenticated):
        return Response(_format_error('UNAUTHORIZED', 'Missing or expired token', trace_id=trace_id), status=401)
    if isinstance(exc, ValidationError):
        details = []
        if isinstance(exc.detail, dict):
            for field, messages in exc.detail.items():
                if not isinstance(messages, list):
                    messages = [messages]
                for message in messages:
                    details.append({'field': field, 'message': str(message)})
        return Response(_format_error('VALIDATION_ERROR', 'Invalid input data', details=details, trace_id=trace_id), status=400)
    return Response(_format_error('INTERNAL_ERROR', 'Unexpected server error', trace_id=trace_id), status=500)
''')
w('common/responses.py', "from rest_framework.response import Response\n\ndef data_response(data, status_code=200, meta=None):\n    payload = {'data': data}\n    if meta is not None:\n        payload['meta'] = meta\n    return Response(payload, status=status_code)\n")
w('common/permissions.py', '''from rest_framework.permissions import BasePermission
class IsAuthenticatedJWT(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request, 'user', None) and request.user.is_authenticated)
''')
w('common/auth.py', '''from dataclasses import dataclass
@dataclass
class TokenUser:
    id: str
    email: str | None = None
    name: str | None = None
    roles: list[str] | None = None
    is_authenticated: bool = True
    @property
    def is_admin(self) -> bool:
        return 'admin' in (self.roles or [])
    @property
    def is_anonymous(self) -> bool:
        return False
''')

w('common/middleware/__init__.py', '')
w('common/middleware/correlation.py', '''import uuid
class CorrelationIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        request.correlation_id = request.headers.get('X-Correlation-Id', str(uuid.uuid4()))
        response = self.get_response(request)
        response['X-Correlation-Id'] = request.correlation_id
        return response
''')
w('common/middleware/jwt_auth.py', '''import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from common.auth import TokenUser
class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        request.user = AnonymousUser()
        header = request.headers.get('Authorization', '')
        if header.startswith('Bearer '):
            token = header.removeprefix('Bearer ').strip()
            try:
                payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'], issuer=settings.JWT_ISSUER, audience=settings.JWT_AUDIENCE)
                request.user = TokenUser(id=payload['sub'], email=payload.get('email'), name=payload.get('name'), roles=payload.get('roles', []))
            except jwt.PyJWTError:
                request.jwt_invalid = True
        return self.get_response(request)
''')
w('common/middleware/rate_limit.py', '''from collections import defaultdict, deque
from time import time
from rest_framework.response import Response
_BUCKETS = defaultdict(deque)
class RateLimitMiddleware:
    WINDOW_SECONDS = 60
    GLOBAL_LIMIT = 100
    UPLOAD_LIMIT = 20
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        identity = str(getattr(getattr(request, 'user', None), 'id', request.META.get('REMOTE_ADDR', 'anon')))
        limit = self.UPLOAD_LIMIT if request.path.startswith('/api/content/photos/upload') else self.GLOBAL_LIMIT
        segment = request.path.split('/')[3] if request.path.startswith('/api/') and len(request.path.split('/')) > 3 else request.path
        key = f'{identity}:{segment}'
        now = time()
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] > self.WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= limit:
            return Response({'error': {'code': 'RATE_LIMITED', 'message': 'Too many requests', 'details': [], 'traceId': getattr(request, 'correlation_id', None)}}, status=429, headers={'Retry-After': str(self.WINDOW_SECONDS)})
        bucket.append(now)
        return self.get_response(request)
''')
w('common/kafka_producer.py', '''import json
import logging
import uuid
from datetime import datetime, timezone
from django.conf import settings
from kafka import KafkaProducer
logger = logging.getLogger(__name__)
class AtlasKafkaProducer:
    def __init__(self):
        self._producer = None
        if settings.KAFKA_ENABLED:
            self._producer = KafkaProducer(bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','), value_serializer=lambda value: json.dumps(value).encode('utf-8'))
    def publish(self, topic: str, data: dict):
        event = {'eventId': str(uuid.uuid4()), 'eventType': topic, 'timestamp': datetime.now(timezone.utc).isoformat(), 'service': 'content', 'data': data}
        logger.info('kafka_event_produced', extra={'topic': topic})
        if self._producer:
            self._producer.send(topic, event)
''')
w('common/kafka_consumer.py', '''import json
import logging
from django.conf import settings
from kafka import KafkaConsumer
logger = logging.getLogger(__name__)
class AtlasKafkaConsumer:
    topics = ['friend.accepted', 'user.updated']
    def __init__(self):
        self.consumer = None
        if settings.KAFKA_ENABLED:
            self.consumer = KafkaConsumer(*self.topics, bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','), value_deserializer=lambda value: json.loads(value.decode('utf-8')), auto_offset_reset='earliest', group_id='atlas-content')
    def poll_once(self):
        if not self.consumer:
            return []
        records = self.consumer.poll(timeout_ms=1000)
        logger.info('kafka_event_consumed', extra={'records': len(records)})
        return records
''')
w('common/views.py', '''from datetime import datetime, timezone
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
''')
