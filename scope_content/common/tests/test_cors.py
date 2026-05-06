from __future__ import annotations

import pytest
from django.test import override_settings

PRODUCTION_FRONTEND_ORIGIN = 'https://scope-frontend.example'
LOCALHOST_FRONTEND_ORIGIN = 'http://localhost:5173'
CORS_METHODS = ['DELETE', 'GET', 'OPTIONS', 'POST', 'PUT']
CORS_HEADERS = ['authorization', 'content-type']


def _preflight(client, path: str, origin: str):
    return client.options(
        path,
        HTTP_ORIGIN=origin,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type',
    )


@pytest.mark.django_db
@override_settings(
    DEBUG=False,
    CORS_ALLOWED_ORIGINS=[PRODUCTION_FRONTEND_ORIGIN],
    CORS_ALLOW_CREDENTIALS=True,
    CORS_ALLOW_METHODS=CORS_METHODS,
    CORS_ALLOW_HEADERS=CORS_HEADERS,
)
def test_production_preflight_allows_configured_frontend_origin(api_client):
    response = _preflight(api_client, '/api/content/trips/', PRODUCTION_FRONTEND_ORIGIN)

    assert response.status_code in (200, 204)
    assert response.headers['Access-Control-Allow-Origin'] == PRODUCTION_FRONTEND_ORIGIN
    assert response.headers['Access-Control-Allow-Credentials'] == 'true'
    assert 'authorization' in response.headers['Access-Control-Allow-Headers'].lower()
    assert 'content-type' in response.headers['Access-Control-Allow-Headers'].lower()
    assert 'GET' in response.headers['Access-Control-Allow-Methods']


@pytest.mark.django_db
@override_settings(
    DEBUG=False,
    CORS_ALLOWED_ORIGINS=[PRODUCTION_FRONTEND_ORIGIN],
    CORS_ALLOW_CREDENTIALS=True,
    CORS_ALLOW_METHODS=CORS_METHODS,
    CORS_ALLOW_HEADERS=CORS_HEADERS,
)
def test_production_preflight_rejects_localhost_origin(api_client):
    response = _preflight(api_client, '/api/content/trips/', LOCALHOST_FRONTEND_ORIGIN)

    assert response.status_code in (200, 204)
    assert 'Access-Control-Allow-Origin' not in response.headers


@pytest.mark.django_db
@override_settings(
    DEBUG=True,
    CORS_ALLOWED_ORIGINS=[PRODUCTION_FRONTEND_ORIGIN, LOCALHOST_FRONTEND_ORIGIN],
    CORS_ALLOW_CREDENTIALS=True,
    CORS_ALLOW_METHODS=CORS_METHODS,
    CORS_ALLOW_HEADERS=CORS_HEADERS,
)
def test_development_preflight_allows_localhost_origin(api_client):
    response = _preflight(api_client, '/api/content/trips/', LOCALHOST_FRONTEND_ORIGIN)

    assert response.status_code in (200, 204)
    assert response.headers['Access-Control-Allow-Origin'] == LOCALHOST_FRONTEND_ORIGIN
    assert response.headers['Access-Control-Allow-Credentials'] == 'true'


@pytest.mark.django_db
@override_settings(
    DEBUG=False,
    CORS_ALLOWED_ORIGINS=[PRODUCTION_FRONTEND_ORIGIN],
    CORS_ALLOW_CREDENTIALS=True,
    CORS_ALLOW_METHODS=CORS_METHODS,
    CORS_ALLOW_HEADERS=CORS_HEADERS,
)
def test_unauthorized_response_keeps_cors_headers_for_allowed_origin(api_client):
    response = api_client.get('/api/content/trips/', HTTP_ORIGIN=PRODUCTION_FRONTEND_ORIGIN)

    assert response.status_code == 401
    assert response.json()['error']['code'] == 'UNAUTHORIZED'
    assert response.headers['Access-Control-Allow-Origin'] == PRODUCTION_FRONTEND_ORIGIN
    assert response.headers['Access-Control-Allow-Credentials'] == 'true'
