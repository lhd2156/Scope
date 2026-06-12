from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from django.test import override_settings

from photos.services import s3_service
from photos.services.image_processor import PreparedImageUpload
from photos.services.s3_service import S3StorageService, _BytesIOWithName, _split_key_for_thumb

pytestmark = pytest.mark.django_db


def _payload() -> PreparedImageUpload:
    return PreparedImageUpload(
        original_bytes=b"original",
        original_extension=".png",
        original_content_type="image/png",
        thumbnail_bytes=b"thumb",
        thumbnail_extension=".webp",
        thumbnail_content_type="image/webp",
        detected_format="png",
    )


@override_settings(AWS_STORAGE_BUCKET_NAME="", AWS_ACCESS_KEY_ID="", AWS_SECRET_ACCESS_KEY="", MEDIA_URL="/media/")
def test_local_store_store_original_fetch_and_thumbnail_generation(monkeypatch, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    monkeypatch.setattr(s3_service, "process_uploaded_image", lambda uploaded_file: _payload())
    monkeypatch.setattr(s3_service.uuid, "uuid4", lambda: "fixed-id")
    service = S3StorageService()

    stored = service.store(SimpleNamespace(name="upload.png"), prefix="photos")

    assert stored == {
        "storage_key": "photos/fixed-id.png",
        "storage_url": "/media/photos/fixed-id.png",
        "thumbnail_url": "/media/photos/fixed-id_thumb.webp",
    }
    assert (Path(settings.MEDIA_ROOT) / "photos/fixed-id.png").read_bytes() == b"original"
    assert (Path(settings.MEDIA_ROOT) / "photos/fixed-id_thumb.webp").read_bytes() == b"thumb"

    original = service.store_original(SimpleNamespace(name="upload.png"), prefix="photos")
    assert original["storage_key"] == "photos/fixed-id.png"
    assert original["detected_format"] == "png"
    assert service.fetch_original_bytes("photos/fixed-id.png") == b"original"

    monkeypatch.setattr(service, "fetch_original_bytes", lambda key: b"original")
    thumb_url = service.generate_thumbnail_for_storage_key("photos/fixed-id.png")
    assert thumb_url == "/media/photos/fixed-id_thumb.webp"
    assert (Path(settings.MEDIA_ROOT) / "photos/fixed-id_thumb.webp").read_bytes() == b"thumb"


@override_settings(
    AWS_STORAGE_BUCKET_NAME="scope-bucket",
    AWS_ACCESS_KEY_ID="key",
    AWS_SECRET_ACCESS_KEY="secret",
    AWS_REGION="us-west-2",
)
def test_s3_store_upload_fetch_thumbnail_and_presign(monkeypatch):
    monkeypatch.setattr(s3_service, "process_uploaded_image", lambda uploaded_file: _payload())
    monkeypatch.setattr(s3_service.uuid, "uuid4", lambda: "fixed-id")
    uploads = []
    downloads = []

    class FakeClient:
        def upload_fileobj(self, fileobj, bucket, key, ExtraArgs):
            uploads.append((fileobj.read(), bucket, key, ExtraArgs))

        def download_fileobj(self, bucket, key, fileobj):
            downloads.append((bucket, key))
            fileobj.write(b"downloaded")

        def generate_presigned_url(self, operation, Params, ExpiresIn):
            return f"https://signed.example/{Params['Key']}?expires={ExpiresIn}"

    monkeypatch.setattr(s3_service.boto3, "client", lambda *args, **kwargs: FakeClient())
    service = S3StorageService()

    stored = service.store(SimpleNamespace(name="upload.png"))
    original = service.store_original(SimpleNamespace(name="upload.png"))
    thumb_url = service.store_thumbnail_bytes("photos/fixed-id_thumb.webp", _payload())

    assert stored["storage_url"] == "https://scope-bucket.s3.us-west-2.amazonaws.com/photos/fixed-id.png"
    assert stored["thumbnail_url"].endswith("photos/fixed-id_thumb.webp")
    assert original["storage_key"] == "photos/fixed-id.png"
    assert thumb_url == "https://scope-bucket.s3.us-west-2.amazonaws.com/photos/fixed-id_thumb.webp"
    assert len(uploads) == 4
    assert service.fetch_original_bytes("photos/fixed-id.png") == b"downloaded"
    assert downloads == [("scope-bucket", "photos/fixed-id.png")]
    assert service.presigned_upload_url("photos/new.png") == "https://signed.example/photos/new.png?expires=3600"
    assert service.presigned_read_url(stored["storage_url"], expires_in=900) == (
        "https://signed.example/photos/fixed-id.png?expires=900"
    )
    assert service.storage_key_from_url(stored["storage_url"]) == "photos/fixed-id.png"


@override_settings(
    AWS_STORAGE_BUCKET_NAME="scope-bucket",
    AWS_ACCESS_KEY_ID="legacy-access-key",
    AWS_SECRET_ACCESS_KEY="legacy-secret-key",
    AWS_USE_IAM_ROLE=True,
    AWS_STORAGE_ENABLED=True,
    AWS_REGION="us-east-1",
)
def test_s3_service_prefers_instance_profile_credentials(monkeypatch):
    captured_kwargs = {}

    class FakeClient:
        def generate_presigned_url(self, operation, Params, ExpiresIn):
            return f"https://signed.example/{operation}/{Params['Bucket']}/{Params['Key']}"

    def fake_client(*args, **kwargs):
        captured_kwargs.update(kwargs)
        return FakeClient()

    monkeypatch.setattr(s3_service.boto3, "client", fake_client)
    service = S3StorageService()

    assert service.enabled is True
    assert service.presigned_upload_url("photos/iam-role.png") == "https://signed.example/put_object/scope-bucket/photos/iam-role.png"
    assert captured_kwargs == {"region_name": "us-east-1"}


@override_settings(AWS_STORAGE_BUCKET_NAME="", AWS_ACCESS_KEY_ID="", AWS_SECRET_ACCESS_KEY="")
def test_local_presign_and_helpers(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    service = S3StorageService()

    assert service.presigned_upload_url("photos/new.png") is None
    assert _split_key_for_thumb("photos/a.jpg") == ("photos/a", ".jpg")
    assert _split_key_for_thumb("photos/a.unknown") == ("photos/a.unknown", "")

    wrapped = _BytesIOWithName(b"abc", "photos/a.png")
    assert wrapped.read() == b"abc"
    assert wrapped.name == "photos/a.png"
    assert wrapped.content_type is None


@override_settings(
    AWS_STORAGE_BUCKET_NAME="",
    AWS_ACCESS_KEY_ID="",
    AWS_SECRET_ACCESS_KEY="",
    MEDIA_URL="/media/",
)
def test_delete_asset_removes_only_managed_local_files(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    managed_file = Path(settings.MEDIA_ROOT) / "photos/delete-me.png"
    managed_file.parent.mkdir(parents=True)
    managed_file.write_bytes(b"image")
    service = S3StorageService()

    service.delete_asset("/media/photos/delete-me.png")
    service.delete_asset("https://external.example/not-managed.png")
    service.delete_asset(None)

    assert not managed_file.exists()
    with pytest.raises(ValueError, match="outside the managed media directory"):
        service.delete_asset("../outside.png")

    avatar_file = Path(settings.MEDIA_ROOT) / "avatars/user-1/avatar.png"
    avatar_file.parent.mkdir(parents=True)
    avatar_file.write_bytes(b"image")
    service.delete_prefix("avatars/user-1")
    assert not avatar_file.exists()
    with pytest.raises(ValueError, match="inside the managed media directory"):
        service.delete_prefix("../outside")


@override_settings(
    AWS_STORAGE_BUCKET_NAME="scope-bucket",
    AWS_ACCESS_KEY_ID="key",
    AWS_SECRET_ACCESS_KEY="secret",
    AWS_REGION="us-west-2",
)
def test_delete_asset_removes_managed_s3_objects(monkeypatch):
    deleted = []

    class FakeClient:
        def delete_object(self, **kwargs):
            deleted.append(kwargs)

    monkeypatch.setattr(s3_service.boto3, "client", lambda *args, **kwargs: FakeClient())
    service = S3StorageService()

    service.delete_asset("https://scope-bucket.s3.us-west-2.amazonaws.com/photos/delete-me.png")
    service.delete_asset("photos/delete-by-key.png")
    service.delete_asset("https://external.example/not-managed.png")

    assert deleted == [
        {"Bucket": "scope-bucket", "Key": "photos/delete-me.png"},
        {"Bucket": "scope-bucket", "Key": "photos/delete-by-key.png"},
    ]
