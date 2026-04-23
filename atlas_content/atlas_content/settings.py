from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

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

    script_sources = ["'self'"]
    style_sources = ["'self'", 'https://fonts.googleapis.com']
    if DEBUG:
        script_sources.append("'unsafe-inline'")
        style_sources.append("'unsafe-inline'")

    directives = {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'form-action': ["'self'"],
        'connect-src': list(dict.fromkeys(connect_sources)),
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'style-src': list(dict.fromkeys(style_sources)),
        'script-src': list(dict.fromkeys(script_sources)),
        'upgrade-insecure-requests': [],
    }
    parts = []
    for directive, sources in directives.items():
        parts.append(f"{directive} {' '.join(sources)}".strip())
    return '; '.join(parts)


_load_env_file(BASE_DIR / '.env')

SECRET_KEY = _required_env('DJANGO_SECRET_KEY')
DEBUG = os.getenv('DEBUG', os.getenv('DJANGO_DEBUG', 'false')).lower() == 'true'
ALLOWED_HOSTS = [host for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host]
_INSECURE_KEY_PREFIX = 'django-' + 'insecure'
if not DEBUG and SECRET_KEY.startswith(_INSECURE_KEY_PREFIX):
    raise ImproperlyConfigured(
        'Refusing to start with a placeholder DJANGO_SECRET_KEY while DEBUG=false. '
        'Generate one with `python -c "import secrets; print(secrets.token_urlsafe(64))"`.'
    )
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

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'true').lower() == 'true'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SAMESITE = 'Lax'

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
    'interactions',
]

MIDDLEWARE = [
    # SecurityMiddleware first so HSTS / SSL redirect bail out before any
    # downstream middleware spends time on requests we'll reject anyway.
    'django.middleware.security.SecurityMiddleware',
    # WhiteNoise serves compressed, far-future-cached static files directly
    # from gunicorn. Skipped when WHITENOISE_ENABLED=false (e.g. when nginx
    # or a CDN is configured to serve statics in front of us).
    *(['whitenoise.middleware.WhiteNoiseMiddleware'] if os.getenv('WHITENOISE_ENABLED', 'true').lower() == 'true' else []),
    # GZipMiddleware: compresses response bodies >200 bytes for clients that
    # accept it. Placed high so it wraps CORS / security / app responses but
    # below SecurityMiddleware so redirects still short-circuit. Note: not
    # vulnerable to BREACH in our context because no secrets appear in response
    # bodies and CSRF tokens aren't echoed back.
    'django.middleware.gzip.GZipMiddleware',
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

# Database configuration.
#
# For horizontal scale, the Content service cannot stay on a local SQLite file:
# each container would get its own copy of the DB, and concurrent writers would
# serialize on a single file lock. We parse DJANGO_DATABASE_URL (or DATABASE_URL)
# and point at a shared RDBMS (SQL Server in production; sqlite only when no
# URL is provided, for local development or tests).
def _parse_database_url(url: str) -> dict | None:
    if not url:
        return None
    parsed = urlparse(url)
    scheme = (parsed.scheme or '').lower()
    if scheme in ('sqlite', 'sqlite3'):
        name = parsed.path.lstrip('/') or ':memory:'
        return {'ENGINE': 'django.db.backends.sqlite3', 'NAME': name}
    engines = {
        'mssql': 'mssql',
        'sqlserver': 'mssql',
        'postgres': 'django.db.backends.postgresql',
        'postgresql': 'django.db.backends.postgresql',
        'mysql': 'django.db.backends.mysql',
    }
    engine = engines.get(scheme)
    if engine is None:
        raise ImproperlyConfigured(f'Unsupported DATABASE_URL scheme: {scheme!r}')
    config: dict = {
        'ENGINE': engine,
        'NAME': parsed.path.lstrip('/') or '',
        'HOST': parsed.hostname or '',
        'PORT': str(parsed.port) if parsed.port else '',
        'USER': unquote(parsed.username) if parsed.username else '',
        'PASSWORD': unquote(parsed.password) if parsed.password else '',
        # Reuse pooled connections between requests instead of reconnecting on
        # every call. 300s is the sweet spot for SQL Server workloads: long
        # enough to amortize TLS + auth handshake across hundreds of requests,
        # short enough that a failed backend is recycled well within a
        # scheduler interval. CONN_HEALTH_CHECKS re-pings stale connections so
        # a fail-over doesn't return cached dead sockets to the app.
        'CONN_MAX_AGE': int(os.getenv('DJANGO_DB_CONN_MAX_AGE', '300')),
        'CONN_HEALTH_CHECKS': True,
        'ATOMIC_REQUESTS': False,
    }
    if engine == 'mssql':
        config['OPTIONS'] = {
            'driver': os.getenv('DJANGO_MSSQL_DRIVER', 'ODBC Driver 18 for SQL Server'),
            'extra_params': os.getenv(
                'DJANGO_MSSQL_EXTRA_PARAMS',
                'Encrypt=yes;TrustServerCertificate=yes',
            ),
        }
    return config


_database_url = os.getenv('DJANGO_DATABASE_URL') or os.getenv('DATABASE_URL')
_database_config = _parse_database_url(_database_url) if _database_url else None

if _database_config is not None:
    DATABASES = {'default': _database_config}
else:
    # Allow sqlite fallback only in DEBUG or when tests explicitly opt in.
    # Production never reaches this branch: CI/compose always sets
    # DJANGO_DATABASE_URL, and failing here prevents a misconfigured deploy
    # from silently serving a local file database that can't be shared across
    # replicas.
    _allow_sqlite_fallback = DEBUG or os.getenv('ALLOW_SQLITE_FALLBACK', '').lower() == 'true'
    if not _allow_sqlite_fallback:
        raise ImproperlyConfigured(
            'DJANGO_DATABASE_URL must be set when DEBUG=false. SQLite is not '
            'horizontally scalable and must not be used in production. Set '
            'ALLOW_SQLITE_FALLBACK=true to override (test suites only).'
        )
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

# Compressed manifest storage: WhiteNoise writes Brotli + Gzip variants of
# every static asset at collectstatic time and serves them directly with
# hash-stamped filenames + far-future cache headers. This eliminates a whole
# class of static-asset round-trips from the request budget when nginx isn't
# fronting statics.
if os.getenv('WHITENOISE_ENABLED', 'true').lower() == 'true':
    STORAGES = {
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
        'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
    }
    WHITENOISE_MAX_AGE = int(os.getenv('WHITENOISE_MAX_AGE', '31536000'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# DRF renderer list: JSON-only in production skips the browsable HTML renderer
# (the main source of per-request template overhead on hot endpoints) and
# removes an entire attack surface. BrowsableAPIRenderer only loads for devs.
_default_renderers = ['rest_framework.renderers.JSONRenderer']
if DEBUG:
    _default_renderers.append('rest_framework.renderers.BrowsableAPIRenderer')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['common.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.StandardPageNumberPagination',
    'PAGE_SIZE': int(os.getenv('PAGINATION_PAGE_SIZE', '20')),
    'EXCEPTION_HANDLER': 'common.exceptions.custom_exception_handler',
    'DEFAULT_RENDERER_CLASSES': _default_renderers,
    # Parser allowlist: we only accept JSON + multipart (photo uploads). Trimming
    # the default list removes FormParser / FileUploadParser overhead and closes
    # accidental content-type acceptance.
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    # Compact JSON in production: drops indent and strips whitespace, cutting
    # response bytes ~5–10% on list payloads before GZip even runs.
    'UNICODE_JSON': True,
    'COMPACT_JSON': True,
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

# Cache backend.
#
# LocMemCache is per-process and per-container, so every gunicorn worker and
# every replica keeps its own copy; cache invalidation then only clears one
# shard and stale data flaps back in on the next request. For any multi-worker
# or multi-replica deployment, point DJANGO_CACHE_LOCATION at a shared Redis
# (e.g. redis://redis:6379/1). Django's built-in RedisCache backend is used so
# we don't need an extra dependency.
_cache_backend = os.getenv('DJANGO_CACHE_BACKEND', 'django.core.cache.backends.locmem.LocMemCache')
_cache_location = os.getenv('DJANGO_CACHE_LOCATION', 'atlas-content-cache')
_cache_default = {
    'BACKEND': _cache_backend,
    'LOCATION': _cache_location,
    'TIMEOUT': int(os.getenv('DJANGO_CACHE_TIMEOUT', '60')),
    'KEY_PREFIX': os.getenv('DJANGO_CACHE_KEY_PREFIX', 'atlas-content'),
}
# Redis cache tuning: Django's native RedisCache maintains one connection per
# call by default — fine at low traffic, terrible under burst. We attach a
# bounded connection pool with a socket timeout so a stalled Redis replica can
# never hang a gunicorn worker past the configured SLA.
if 'redis' in _cache_backend.lower():
    # Django's native RedisCache forwards OPTIONS kwargs straight to the pool
    # class constructor (see django.core.cache.backends.redis). BlockingConnectionPool
    # accepts max_connections + timeout and forwards the rest (socket_*, db,
    # retry_on_timeout, health_check_interval) as connection_kwargs.
    _cache_default['OPTIONS'] = {
        'db': int(os.getenv('DJANGO_CACHE_REDIS_DB', '1')),
        'pool_class': 'redis.BlockingConnectionPool',
        'max_connections': int(os.getenv('DJANGO_CACHE_REDIS_MAX_CONNECTIONS', '64')),
        'timeout': float(os.getenv('DJANGO_CACHE_REDIS_POOL_TIMEOUT', '5')),
        'socket_timeout': float(os.getenv('DJANGO_CACHE_REDIS_SOCKET_TIMEOUT', '2')),
        'socket_connect_timeout': float(os.getenv('DJANGO_CACHE_REDIS_CONNECT_TIMEOUT', '1')),
        'retry_on_timeout': True,
        'health_check_interval': int(os.getenv('DJANGO_CACHE_REDIS_HEALTH_INTERVAL', '30')),
    }
CACHES = {'default': _cache_default}
CACHE_SPOTS_TIMEOUT_SECONDS = int(os.getenv('CACHE_SPOTS_TIMEOUT_SECONDS', '60'))
CACHE_FEED_TIMEOUT_SECONDS = int(os.getenv('CACHE_FEED_TIMEOUT_SECONDS', '30'))

# Session storage.
#
# The default `django.contrib.sessions.backends.db` backend issues a SELECT
# (and frequently an UPDATE) against `django_session` on every authenticated
# request — fine at small scale, a real contention hot spot at large scale.
# When a distributed cache is available we use `cached_db`: reads hit Redis,
# writes go to both Redis and the DB so sessions survive a cache flush.
_session_engine_default = (
    'django.contrib.sessions.backends.cached_db'
    if 'redis' in _cache_backend.lower()
    else 'django.contrib.sessions.backends.db'
)
SESSION_ENGINE = os.getenv('DJANGO_SESSION_ENGINE', _session_engine_default)
SESSION_CACHE_ALIAS = 'default'

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
