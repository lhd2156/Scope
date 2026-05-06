from __future__ import annotations

from pathlib import Path

import pytest
from django.test import override_settings

from photos.services.s3_service import S3StorageService

pytestmark = pytest.mark.django_db


@override_settings(
    AWS_STORAGE_BUCKET_NAME='scope-bucket',
    AWS_ACCESS_KEY_ID='key',
    AWS_SECRET_ACCESS_KEY='secret',
    AWS_REGION='us-east-1',
)
def test_s3_health_status_checks_bucket_head(monkeypatch):
    service = S3StorageService()
    calls: list[str] = []

    class FakeClient:
        def head_bucket(self, *, Bucket):
            calls.append(Bucket)

    service.client = FakeClient()

    result = service.health_status()

    assert result == 's3'
    assert calls == ['scope-bucket']


@override_settings(
    AWS_S3_BUCKET='',
    AWS_ACCESS_KEY_ID='',
    AWS_SECRET_ACCESS_KEY='',
)
def test_local_storage_health_status_creates_media_directory(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / 'media-root'
    service = S3StorageService()

    result = service.health_status()

    assert result == 'local'
    assert Path(settings.MEDIA_ROOT).is_dir()
