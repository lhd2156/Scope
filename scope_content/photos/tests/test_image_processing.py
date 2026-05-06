from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from uuid import UUID

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from photos.services.image_processor import PreparedImageUpload, process_uploaded_image
from photos.services.s3_service import S3StorageService


def _image_upload(name: str, image_format: str, content_type: str, size: tuple[int, int] = (2, 2)) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', size, color='red').save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def test_process_uploaded_image_uses_native_bindings_when_available(monkeypatch) -> None:
    upload = _image_upload('native.png', 'PNG', 'image/png')
    calls: dict[str, object] = {}

    def detect_format(payload: bytes) -> str:
        calls['detect_payload'] = payload
        return 'png'

    def generate_thumbnail_pixels(
        pixels: bytes,
        *,
        width: int,
        height: int,
        channels: int,
        max_width: int,
        max_height: int,
        output_channels: int = 0,
    ):
        calls['thumbnail_args'] = {
            'width': width,
            'height': height,
            'channels': channels,
            'max_width': max_width,
            'max_height': max_height,
            'output_channels': output_channels,
            'pixel_length': len(pixels),
        }
        return SimpleNamespace(width=1, height=1, channels=3, pixels=bytes([10, 20, 30]))

    def encode_blurhash_pixels(*args, **kwargs) -> str:
        calls['blurhash_kwargs'] = kwargs
        return 'L00000'

    fake_bindings = SimpleNamespace(
        detect_format=detect_format,
        strip_exif=lambda payload: payload,
        generate_thumbnail_pixels=generate_thumbnail_pixels,
        encode_blurhash_pixels=encode_blurhash_pixels,
    )
    monkeypatch.setattr('photos.services.image_processor._native_bindings', lambda: fake_bindings)

    result = process_uploaded_image(upload, size=(1, 1))

    assert result.detected_format == 'png'
    assert result.blurhash == 'L00000'
    assert result.original_bytes == upload.read()
    assert result.original_extension == '.png'
    assert result.original_content_type == 'image/png'
    assert result.thumbnail_extension == '.png'
    assert result.thumbnail_content_type == 'image/png'
    assert calls['thumbnail_args'] == {
        'width': 2,
        'height': 2,
        'channels': 3,
        'max_width': 1,
        'max_height': 1,
        'output_channels': 0,
        'pixel_length': 12,
    }

    with Image.open(BytesIO(result.thumbnail_bytes)) as thumbnail:
        assert thumbnail.size == (1, 1)


def test_process_uploaded_image_falls_back_to_pillow_without_native_bindings(monkeypatch) -> None:
    upload = _image_upload('fallback.png', 'PNG', 'image/png')
    monkeypatch.setattr('photos.services.image_processor._native_bindings', lambda: None)

    result = process_uploaded_image(upload, size=(1, 1))

    assert result.detected_format == 'png'
    assert result.blurhash is None
    assert result.original_extension == '.png'
    assert result.thumbnail_extension == '.png'

    with Image.open(BytesIO(result.thumbnail_bytes)) as thumbnail:
        assert thumbnail.size == (1, 1)


@override_settings(AWS_STORAGE_BUCKET_NAME='', AWS_ACCESS_KEY_ID='', AWS_SECRET_ACCESS_KEY='')
def test_local_store_writes_processed_original_and_thumbnail(settings, tmp_path, monkeypatch) -> None:
    settings.MEDIA_ROOT = tmp_path / 'media'
    settings.MEDIA_URL = '/media/'
    monkeypatch.setattr('photos.services.s3_service.uuid.uuid4', lambda: UUID('12345678-1234-5678-1234-567812345678'))
    monkeypatch.setattr(
        'photos.services.s3_service.process_uploaded_image',
        lambda uploaded_file: PreparedImageUpload(
            original_bytes=b'processed-original',
            original_extension='.jpg',
            original_content_type='image/jpeg',
            thumbnail_bytes=b'processed-thumbnail',
            thumbnail_extension='.png',
            thumbnail_content_type='image/png',
            detected_format='jpeg',
            blurhash='L00000',
        ),
    )

    stored = S3StorageService().store(SimpleUploadedFile('photo.jpg', b'raw', content_type='image/jpeg'))

    assert stored == {
        'storage_key': 'photos/12345678-1234-5678-1234-567812345678.jpg',
        'storage_url': '/media/photos/12345678-1234-5678-1234-567812345678.jpg',
        'thumbnail_url': '/media/photos/12345678-1234-5678-1234-567812345678_thumb.png',
    }
    assert (settings.MEDIA_ROOT / 'photos' / '12345678-1234-5678-1234-567812345678.jpg').read_bytes() == b'processed-original'
    assert (settings.MEDIA_ROOT / 'photos' / '12345678-1234-5678-1234-567812345678_thumb.png').read_bytes() == b'processed-thumbnail'


@override_settings(
    AWS_STORAGE_BUCKET_NAME='scope-bucket',
    AWS_ACCESS_KEY_ID='key',
    AWS_SECRET_ACCESS_KEY='secret',
    AWS_REGION='us-east-1',
)
def test_s3_store_uploads_processed_original_and_thumbnail(monkeypatch) -> None:
    uploads: list[dict[str, object]] = []

    class FakeClient:
        def upload_fileobj(self, fileobj, bucket, key, ExtraArgs):
            uploads.append(
                {
                    'bucket': bucket,
                    'key': key,
                    'body': fileobj.read(),
                    'content_type': ExtraArgs['ContentType'],
                }
            )

    monkeypatch.setattr('photos.services.s3_service.boto3.client', lambda *args, **kwargs: FakeClient())
    monkeypatch.setattr('photos.services.s3_service.uuid.uuid4', lambda: UUID('87654321-4321-8765-4321-876543218765'))
    monkeypatch.setattr(
        'photos.services.s3_service.process_uploaded_image',
        lambda uploaded_file: PreparedImageUpload(
            original_bytes=b'processed-original',
            original_extension='.webp',
            original_content_type='image/webp',
            thumbnail_bytes=b'processed-thumbnail',
            thumbnail_extension='.png',
            thumbnail_content_type='image/png',
            detected_format='webp',
            blurhash='L00000',
        ),
    )

    stored = S3StorageService().store(SimpleUploadedFile('photo.webp', b'raw', content_type='image/webp'))

    assert stored == {
        'storage_key': 'photos/87654321-4321-8765-4321-876543218765.webp',
        'storage_url': 'https://scope-bucket.s3.us-east-1.amazonaws.com/photos/87654321-4321-8765-4321-876543218765.webp',
        'thumbnail_url': 'https://scope-bucket.s3.us-east-1.amazonaws.com/photos/87654321-4321-8765-4321-876543218765_thumb.png',
    }
    assert uploads == [
        {
            'bucket': 'scope-bucket',
            'key': 'photos/87654321-4321-8765-4321-876543218765.webp',
            'body': b'processed-original',
            'content_type': 'image/webp',
        },
        {
            'bucket': 'scope-bucket',
            'key': 'photos/87654321-4321-8765-4321-876543218765_thumb.png',
            'body': b'processed-thumbnail',
            'content_type': 'image/png',
        },
    ]
