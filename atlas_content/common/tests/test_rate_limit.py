import uuid

import jwt
import pytest
from django.conf import settings
from rest_framework.test import APIClient

from common.middleware.rate_limit import clear_rate_limit_buckets


@pytest.fixture(autouse=True)
def reset_rate_limit_state(settings):
    settings.RATE_LIMIT_WINDOW_SECONDS = 60
    settings.RATE_LIMIT_GLOBAL_PER_MINUTE = 100
    settings.RATE_LIMIT_UPLOADS_PER_MINUTE = 20
    clear_rate_limit_buckets()
    yield
    clear_rate_limit_buckets()


@pytest.fixture
def make_authenticated_client():
    def _make_client(user_id: str | None = None):
        resolved_user_id = user_id or str(uuid.uuid4())
        token = jwt.encode(
            {
                'sub': resolved_user_id,
                'email': 'rate-limit@example.com',
                'name': 'Rate Limit Tester',
                'roles': ['user'],
                'iss': settings.JWT_ISSUER,
                'aud': settings.JWT_AUDIENCE,
                'exp': 4102444800,
            },
            settings.JWT_SECRET,
            algorithm='HS256',
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    return _make_client


@pytest.mark.django_db
def test_global_rate_limit_uses_client_ip(api_client, spot, settings):
    settings.RATE_LIMIT_GLOBAL_PER_MINUTE = 2

    first_response = api_client.get('/api/content/spots/', REMOTE_ADDR='203.0.113.10')
    second_response = api_client.get('/api/content/spots/', REMOTE_ADDR='203.0.113.10')
    third_response = api_client.get('/api/content/spots/', REMOTE_ADDR='203.0.113.10')
    alternate_ip_response = api_client.get('/api/content/spots/', REMOTE_ADDR='203.0.113.11')

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert third_response.status_code == 429
    assert third_response.json()['error']['code'] == 'RATE_LIMITED'
    assert third_response.headers['Retry-After'] == '60'
    assert alternate_ip_response.status_code == 200


@pytest.mark.django_db
def test_upload_rate_limit_uses_authenticated_user(make_authenticated_client, settings):
    settings.RATE_LIMIT_GLOBAL_PER_MINUTE = 10
    settings.RATE_LIMIT_UPLOADS_PER_MINUTE = 1

    first_user_client = make_authenticated_client('00000000-0000-0000-0000-000000000001')
    second_user_client = make_authenticated_client('00000000-0000-0000-0000-000000000002')

    first_response = first_user_client.get('/api/content/photos/presigned-url', REMOTE_ADDR='203.0.113.20')
    throttled_response = first_user_client.get('/api/content/photos/presigned-url', REMOTE_ADDR='203.0.113.20')
    second_user_response = second_user_client.get('/api/content/photos/presigned-url', REMOTE_ADDR='203.0.113.20')

    assert first_response.status_code == 200
    assert throttled_response.status_code == 429
    assert throttled_response.json()['error']['message'] == 'Too many requests'
    assert second_user_response.status_code == 200
