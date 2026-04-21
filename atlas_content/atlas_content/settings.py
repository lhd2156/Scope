from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DEVELOPMENT_FRONTEND_ORIGIN = 'http://localhost:5173'


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        cleaned_key = key.strip()
        cleaned_value = value.strip().strip('"').strip("'")
        os.environ.setdefault(cleaned_key, cleaned_value)



def _required_env(name: str) -> str:
    value = os.getenv(name)
    if value:
        return value
    raise ImproperlyConfigured(
        f'{name} must be set via environment variables or atlas_content/.env before starting the Content Engine.'
    )


def _normalize_origin(origin: str | None) -> str | None:
    if origin is None:
        return None
    cleaned = origin.strip().rstrip('/')
    return cleaned or None


def _build_content_security_policy() -> str:
    connect_sources = ["'self'"]
    if FRONTEND_ORIGIN:
        connect_sources.append(FRONTEND_ORIGIN)
    if DEBUG and DEVELOPMENT_FRONTEND_ORIGIN:
        connect_sources.append(DEVELOPMENT_FRONTEND_ORIGIN)

    directives = {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'form-action': ["'self'"],
        'connect-src': list(dict.fromkeys(connect_sources)),
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'script-src': ["'self'", "'unsafe-inline'"],
    }
    return '; '.join(f"{directive} {' '.join(sources)}" for directive, sources in directives.items())


_load_env_file(BASE_DIR / '.env')

SECRET_KEY = _required_env('DJANGO_SECRET_KEY')
DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'
ALLOWED_HOSTS = [host for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host]
FRONTEND_ORIGIN = _normalize_origin(os.getenv('FRONTEND_ORIGIN') or os.getenv('CORE_FRONTEND_ORIGIN'))
DEVELOPMENT_FRONTEND_ORIGIN = _normalize_origin(
    os.getenv('DEVELOPMENT_FRONTEND_ORIGIN', DEFAULT_DEVELOPMENT_FRONTEND_ORIGIN)
)
CORS_ALLOWED_ORIGINS = []
if FRONTEND_ORIGIN:
    CORS_ALLOWED_ORIGINS.append(FRONTEND_ORIGIN)
if DEBUG and DEVELOPMENT_FRONTEND_ORIGIN:
    CORS_ALLOWED_ORIGINS.append(DEVELOPMENT_FRONTEND_ORIGIN)
if not DEBUG and not FRONTEND_ORIGIN:
    raise ImproperlyConfigured('FRONTEND_ORIGIN or CORE_FRONTEND_ORIGIN must be set when DEBUG=false for atlas_content CORS.')
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(CORS_ALLOWED_ORIGINS))
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = ['authorization', 'content-type']
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'POST', 'PUT']
CORS_URLS_REGEX = r'^/api/content/.*$'
CONTENT_SECURITY_POLICY = _build_content_security_policy()

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'common',
    'spots',
    'trips',
    'photos',
    'reviews',
    'feed',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'common.middleware.security_headers.ContentSecurityPolicyMiddleware',
    'common.middleware.correlation.CorrelationIdMiddleware',
    'common.middleware.request_logging.RequestLoggingMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'common.middleware.jwt_auth.JWTAuthenticationMiddleware',
    'common.middleware.rate_limit.RateLimitMiddleware',
]

ROOT_URLCONF = 'atlas_content.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ]
        },
    }
]

WSGI_APPLICATION = 'atlas_content.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

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
    'DEFAULT_AUTHENTICATION_CLASSES': ['common.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.StandardPageNumberPagination',
    'PAGE_SIZE': int(os.getenv('PAGINATION_PAGE_SIZE', '20')),
    'EXCEPTION_HANDLER': 'common.exceptions.custom_exception_handler',
}

JWT_SECRET = _required_env('CORE_JWT_SECRET')
JWT_ISSUER = os.getenv('CORE_JWT_ISSUER', 'atlas-core')
JWT_AUDIENCE = os.getenv('CORE_JWT_AUDIENCE', 'atlas-frontend')
SERVICE_VERSION = os.getenv('CONTENT_SERVICE_VERSION', '1.0.0')
SERVICE_STARTED_AT = datetime.now(timezone.utc)

MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', str(10 * 1024 * 1024)))
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}

AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_S3_BUCKET', '')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
KAFKA_ENABLED = os.getenv('KAFKA_ENABLED', 'false').lower() == 'true'

RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '60'))
RATE_LIMIT_GLOBAL_PER_IP = int(os.getenv('RATE_LIMIT_GLOBAL_PER_IP', '100'))
RATE_LIMIT_UPLOAD_PER_USER = int(os.getenv('RATE_LIMIT_UPLOAD_PER_USER', '20'))

CACHES = {
    'default': {
        'BACKEND': os.getenv('DJANGO_CACHE_BACKEND', 'django.core.cache.backends.locmem.LocMemCache'),
        'LOCATION': os.getenv('DJANGO_CACHE_LOCATION', 'atlas-content-cache'),
    }
}
CACHE_SPOTS_TIMEOUT_SECONDS = int(os.getenv('CACHE_SPOTS_TIMEOUT_SECONDS', '60'))
CACHE_FEED_TIMEOUT_SECONDS = int(os.getenv('CACHE_FEED_TIMEOUT_SECONDS', '30'))

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'atlas_context': {
            '()': 'common.logging_utils.AtlasContextFilter',
        }
    },
    'formatters': {
        'json': {
            '()': 'common.logging_utils.AtlasJsonFormatter',
            'fmt': '%(message)s',
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'filters': ['atlas_context'],
            'formatter': 'json',
        }
    },
    'root': {
        'handlers': ['console'],
        'level': os.getenv('LOG_LEVEL', 'INFO'),
    },
}
