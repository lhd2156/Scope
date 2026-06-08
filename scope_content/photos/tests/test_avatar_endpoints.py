from __future__ import annotations

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

pytestmark = pytest.mark.django_db


def _png_upload(name: str = 'avatar.png') -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', (3, 3), color='green').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def test_avatar_upload_is_persisted_and_publicly_readable(
    authenticated_client,
    api_client,
    auth_header,
    settings,
    tmp_path,
):
    _, user_id = auth_header
    settings.AWS_STORAGE_BUCKET_NAME = ''
    settings.AWS_ACCESS_KEY_ID = ''
    settings.AWS_SECRET_ACCESS_KEY = ''
    settings.AWS_USE_IAM_ROLE = False
    settings.MEDIA_ROOT = tmp_path / 'media'

    response = authenticated_client.post(
        '/api/content/photos/avatar-upload',
        {'file': _png_upload()},
        format='multipart',
    )

    assert response.status_code == 201, response.json()
    payload = response.json()['data']
    assert payload['storageKey'].startswith(f"avatars/{user_id.replace('-', '')}/")
    assert payload['fileUrl'].startswith('/api/content/photos/avatar/content?key=')

    readback = api_client.get(payload['fileUrl'])
    assert readback.status_code == 200
    assert readback['Content-Type'] == 'image/png'
    assert readback['X-Content-Type-Options'] == 'nosniff'
    assert readback.content.startswith(b'\x89PNG\r\n\x1a\n')


def test_avatar_upload_rejects_invalid_files_and_unsafe_read_keys(authenticated_client, api_client):
    invalid_upload = authenticated_client.post(
        '/api/content/photos/avatar-upload',
        {'file': SimpleUploadedFile('avatar.txt', b'<script>alert(1)</script>', content_type='image/png')},
        format='multipart',
    )
    unsafe_read = api_client.get('/api/content/photos/avatar/content?key=../secrets.txt')

    assert invalid_upload.status_code == 400
    assert invalid_upload.json()['error']['code'] == 'VALIDATION_ERROR'
    assert unsafe_read.status_code == 404
