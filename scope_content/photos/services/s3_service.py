from __future__ import annotations

import os
import uuid
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlsplit

import boto3
from django.conf import settings

from photos.services.image_processor import (
    FORMAT_EXTENSIONS,
    PreparedImageUpload,
    process_uploaded_image,
)


class S3StorageService:
    def __init__(self):
        credential_pair_available = bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)
        self.enabled = bool(settings.AWS_STORAGE_BUCKET_NAME and (credential_pair_available or settings.AWS_USE_IAM_ROLE))
        self.client = None
        if self.enabled:
            client_options = {'region_name': settings.AWS_REGION}
            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                client_options.update(
                    {
                        'aws_access_key_id': settings.AWS_ACCESS_KEY_ID,
                        'aws_secret_access_key': settings.AWS_SECRET_ACCESS_KEY,
                    }
                )
            self.client = boto3.client('s3', **client_options)

    def store(self, uploaded_file, prefix='photos'):
        """Legacy sync path: processes the upload and uploads BOTH original and
        thumbnail inside one call. Kept for backward compatibility and for the
        PHOTO_UPLOAD_ASYNC_THUMBNAILS=false code path. New async path uses
        `store_original` + `generate_thumbnail_for_storage_key` split.
        """
        processed = process_uploaded_image(uploaded_file)
        asset_id = uuid.uuid4()
        key = f'{prefix}/{asset_id}{processed.original_extension}'
        thumb_key = f'{prefix}/{asset_id}_thumb{processed.thumbnail_extension}'

        if self.enabled and self.client:
            self._upload_bytes(processed.original_bytes, key, processed.original_content_type)
            self._upload_bytes(processed.thumbnail_bytes, thumb_key, processed.thumbnail_content_type)
            base_url = f'https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com'
            return {
                'storage_key': key,
                'storage_url': f'{base_url}/{key}',
                'thumbnail_url': f'{base_url}/{thumb_key}',
            }

        media_dir = Path(settings.MEDIA_ROOT) / prefix
        media_dir.mkdir(parents=True, exist_ok=True)
        local_path = media_dir / f'{asset_id}{processed.original_extension}'
        thumb_path = media_dir / f'{asset_id}_thumb{processed.thumbnail_extension}'
        local_path.write_bytes(processed.original_bytes)
        thumb_path.write_bytes(processed.thumbnail_bytes)
        relative = local_path.relative_to(settings.MEDIA_ROOT).as_posix()
        thumb_relative = thumb_path.relative_to(settings.MEDIA_ROOT).as_posix()
        return {
            'storage_key': relative,
            'storage_url': f'{settings.MEDIA_URL}{relative}',
            'thumbnail_url': f'{settings.MEDIA_URL}{thumb_relative}',
        }

    def store_original(self, uploaded_file, prefix='photos') -> dict:
        """Async fast path — upload ONLY the original, skip thumbnail generation.

        Returns enough metadata for the thumbnail worker to produce and place a
        matching `_thumb` asset later: the storage key (deterministic for thumb
        derivation), the public URL, and the source format hint so the worker
        doesn't have to re-sniff.
        """
        processed = process_uploaded_image(uploaded_file)
        asset_id = uuid.uuid4()
        key = f'{prefix}/{asset_id}{processed.original_extension}'

        if self.enabled and self.client:
            self._upload_bytes(processed.original_bytes, key, processed.original_content_type)
            base_url = f'https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com'
            return {
                'storage_key': key,
                'storage_url': f'{base_url}/{key}',
                'original_content_type': processed.original_content_type,
                'detected_format': processed.detected_format,
            }

        media_dir = Path(settings.MEDIA_ROOT) / prefix
        media_dir.mkdir(parents=True, exist_ok=True)
        local_path = media_dir / f'{asset_id}{processed.original_extension}'
        local_path.write_bytes(processed.original_bytes)
        relative = local_path.relative_to(settings.MEDIA_ROOT).as_posix()
        return {
            'storage_key': relative,
            'storage_url': f'{settings.MEDIA_URL}{relative}',
            'original_content_type': processed.original_content_type,
            'detected_format': processed.detected_format,
        }

    def fetch_original_bytes(self, storage_key: str) -> bytes:
        """Reads the original bytes back from remote or local storage. Used by
        the thumbnail worker to regenerate a thumb from a previously stored
        original. Kept separate from the upload path so it can be swapped for a
        streaming implementation if we ever store multi-hundred-MB assets.
        """
        if self.enabled and self.client:
            buf = BytesIO()
            self.client.download_fileobj(settings.AWS_STORAGE_BUCKET_NAME, storage_key, buf)
            return buf.getvalue()

        local_path = Path(settings.MEDIA_ROOT) / storage_key
        return local_path.read_bytes()

    def generate_thumbnail_for_storage_key(self, storage_key: str) -> str:
        """Pull the original back from storage, run the Pillow/native pipeline,
        and upload a sibling `_thumb.<ext>` asset. Returns the public thumb URL.

        Called by the thumbnail worker service (scope_thumbnail_worker mgmt
        command). Safe to retry: overwrites any existing thumb at the target
        key, and Pillow output for a given input is deterministic within a
        format family.
        """
        raw = self.fetch_original_bytes(storage_key)
        payload = process_uploaded_image(_BytesIOWithName(raw, storage_key))
        base_key, _ = _split_key_for_thumb(storage_key)
        thumb_key = f'{base_key}_thumb{payload.thumbnail_extension}'
        return self.store_thumbnail_bytes(thumb_key, payload)

    def store_thumbnail_bytes(self, thumb_key: str, payload: PreparedImageUpload) -> str:
        """Write already-generated thumbnail bytes to the target storage key
        and return the URL. Split out so callers that have the bytes already
        (e.g. if we move Pillow into the web worker via a thread pool) don't
        need to round-trip through storage.
        """
        if self.enabled and self.client:
            self._upload_bytes(payload.thumbnail_bytes, thumb_key, payload.thumbnail_content_type)
            base_url = f'https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com'
            return f'{base_url}/{thumb_key}'

        thumb_path = Path(settings.MEDIA_ROOT) / thumb_key
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        thumb_path.write_bytes(payload.thumbnail_bytes)
        return f'{settings.MEDIA_URL}{thumb_key}'

    def _upload_bytes(self, body: bytes, key: str, content_type: str) -> None:
        self.client.upload_fileobj(
            BytesIO(body),
            settings.AWS_STORAGE_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': content_type},
        )

    def presigned_upload_url(self, key: str):
        if not self.enabled or not self.client:
            return None
        return self.client.generate_presigned_url(
            'put_object',
            Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
            ExpiresIn=3600,
        )

    def is_managed_url(self, url: str | None) -> bool:
        if not self.enabled or not url:
            return False
        parsed = urlsplit(url)
        hostname = (parsed.hostname or '').lower()
        bucket = settings.AWS_STORAGE_BUCKET_NAME.lower()
        return hostname == f'{bucket}.s3.{settings.AWS_REGION}.amazonaws.com' or hostname == f'{bucket}.s3.amazonaws.com'

    def storage_key_from_url(self, url: str | None) -> str | None:
        if not self.is_managed_url(url):
            return None
        return unquote(urlsplit(url).path.lstrip('/')) or None

    def presigned_read_url(self, url_or_key: str, expires_in: int = 3600) -> str | None:
        if not self.enabled or not self.client:
            return None
        key = self.storage_key_from_url(url_or_key) or url_or_key.strip().lstrip('/')
        if not key:
            return None
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
            ExpiresIn=expires_in,
        )

    def health_status(self):
        if self.enabled and self.client:
            self.client.head_bucket(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
            return 's3'

        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)
        if not os.access(media_root, os.W_OK):
            raise OSError(f'Media root is not writable: {media_root}')
        return 'local'


class _BytesIOWithName(BytesIO):
    """BytesIO with a `.name` attribute so `process_uploaded_image` can use it
    for extension/content-type resolution the same way it does with a Django
    `UploadedFile`. Avoids a second codepath for worker-side reprocessing.
    """

    def __init__(self, data: bytes, name: str) -> None:
        super().__init__(data)
        self.name = name
        self.content_type = None


def _split_key_for_thumb(storage_key: str) -> tuple[str, str]:
    for ext in FORMAT_EXTENSIONS.values():
        if storage_key.lower().endswith(ext):
            return storage_key[: -len(ext)], ext
    return storage_key, ''
