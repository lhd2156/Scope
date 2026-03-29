from __future__ import annotations

import os

os.environ.setdefault('DJANGO_SECRET_KEY', 'test-django-secret-not-for-prod')
os.environ.setdefault('CORE_JWT_SECRET', 'test-core-jwt-secret-not-for-prod')
os.environ.setdefault('FRONTEND_ORIGIN', 'https://atlas-frontend.example')
os.environ.setdefault('DEVELOPMENT_FRONTEND_ORIGIN', 'http://localhost:5173')

from .settings import *  # noqa: F401,F403
