from __future__ import annotations

import os

os.environ.setdefault('DJANGO_SECRET_KEY', 'test-django-secret-not-for-prod')
os.environ.setdefault('CORE_JWT_SECRET', 'test-core-jwt-secret-not-for-prod')

from .settings import *  # noqa: F401,F403
