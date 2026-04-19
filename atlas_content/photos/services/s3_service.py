from __future__ import annotations

import os
import uuid
from io import BytesIO
from pathlib import Path

import boto3
from django.conf import settings

from photos.services.image_processor import process_uploaded_image


class S3StorageService:
    def __init__(self):
        self.enabled = bool(settings.AWS_STORAGE_BUCKET_NAME and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)
        self.client = None
        if self.enabled:
            self.client = boto3.client(
                's3',
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )

    def store(self, uploaded_file, prefix='photos'):
        processed = process_uploaded_image(uploaded_file)
        asset_id = uuid.uuid4()
        key = f'{prefix}/{asset_id}{processed.original_extension}'
        thumb_key = f'{prefix}/{asset_id}_thumb{processed.thumbnail_extension}'

        if self.enabled and self.client:
            self.client.upload_fileobj(
                BytesIO(processed.original_bytes),
                settings.AWS_STORAGE_BUCKET_NAME,
                key,
                ExtraArgs={'ContentType': processed.original_content_type},
            )
            self.client.upload_fileobj(
                BytesIO(processed.thumbnail_bytes),
                settings.AWS_STORAGE_BUCKET_NAME,
                thumb_key,
                ExtraArgs={'ContentType': processed.thumbnail_content_type},
            )
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

    def presigned_upload_url(self, key: str):
        if not self.enabled or not self.client:
            return None
        return self.client.generate_presigned_url(
            'put_object',
            Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
            ExpiresIn=3600,
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
