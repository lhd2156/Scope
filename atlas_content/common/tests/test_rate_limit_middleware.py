from __future__ import annotations

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from common.middleware.rate_limit import _BUCKETS
from photos.services.s3_service import S3StorageService


@pytest.fixture(autouse=True)
def clear_rate_limit_buckets():
    _BUCKETS.clear()
    yield
    _BUCKETS.clear()


def _png_upload(name: str) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', (2, 2), color='teal').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


@pytest.mark.django_db
@override_settings(RATE_LIMIT_WINDOW_SECONDS=60, RATE_LIMIT_GLOBAL_PER_IP=2, RATE_LIMIT_UPLOAD_PER_USER=20)
def test_global_rate_limit_applies_across_content_endpoints(api_client):
    remote_addr = '203.0.113.10'

    first_response = api_client.get('/api/content/health', REMOTE_ADDR=remote_addr)
    second_response = api_client.get('/api/content/spots/', REMOTE_ADDR=remote_addr)
    third_response = api_client.get('/api/content/health', REMOTE_ADDR=remote_addr)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert third_response.status_code == 429
    assert third_response.json()['error']['code'] == 'RATE_LIMITED'
    assert int(third_response['Retry-After']) >= 1


@pytest.mark.django_db
@override_settings(RATE_LIMIT_WINDOW_SECONDS=60, RATE_LIMIT_GLOBAL_PER_IP=100, RATE_LIMIT_UPLOAD_PER_USER=1)
def test_upload_rate_limit_tracks_user_across_ip_addresses(authenticated_client, spot, monkeypatch):
    def fake_store(self, uploaded_file, prefix='photos'):
        return {
            'storage_key': f'{prefix}/test.png',
            'storage_url': 'https://example.com/media/photos/test.png',
            'thumbnail_url': 'https://example.com/media/photos/test_thumb.png',
        }

    monkeypatch.setattr(S3StorageService, 'store', fake_store)

    first_response = authenticated_client.post(
        '/api/content/photos/upload',
        {
            'spot_id': str(spot.id),
            'file': _png_upload('first.png'),
        },
        REMOTE_ADDR='203.0.113.10',
    )
    second_response = authenticated_client.post(
        '/api/content/photos/upload',
        {
            'spot_id': str(spot.id),
            'file': _png_upload('second.png'),
        },
        REMOTE_ADDR='198.51.100.25',
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 429
    assert second_response.json()['error']['code'] == 'RATE_LIMITED'
    assert int(second_response['Retry-After']) >= 1
