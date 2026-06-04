from __future__ import annotations

import os

os.environ.setdefault('DJANGO_SECRET_KEY', 'test-django-secret-not-for-prod')
os.environ.setdefault('CORE_JWT_SECRET', 'test-core-jwt-secret-not-for-prod')
os.environ.setdefault('FRONTEND_ORIGIN', 'https://scope-frontend.example')
os.environ.setdefault('DEVELOPMENT_FRONTEND_ORIGIN', 'http://localhost:5173')
# Tests run against the Django test client over plain HTTP; DEBUG=true keeps
# the production-mode SSL redirect middleware off so test requests aren't
# short-circuited to 301. Must be set BEFORE importing settings.
os.environ.setdefault('DEBUG', 'true')
os.environ.setdefault('DJANGO_DEBUG', 'true')
# Production settings refuse to boot on SQLite; the test suite opts in
# explicitly so we can keep using the fast in-repo sqlite fixture.
os.environ.setdefault('ALLOW_SQLITE_FALLBACK', 'true')

from .settings import *  # noqa: F403

# Keep the normal middleware chain enabled in tests, but avoid exhausting the
# per-process fallback bucket across the full suite. Individual rate-limit
# tests override these values with tight limits.
RATE_LIMIT_GLOBAL_PER_IP = 10_000
RATE_LIMIT_AUTH_PER_IP = 10_000
RATE_LIMIT_SEARCH_PER_IP = 10_000
RATE_LIMIT_UPLOAD_PER_USER = 10_000
RATE_LIMIT_COMMENTS_PER_USER = 10_000
OUTBOX_PUBLISH_INLINE = True
