from __future__ import annotations

import os
import uuid
from pathlib import Path

import boto3
from django.conf import settings

from photos.services.image_processor import generate_thumbnail


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
        extension = Path(uploaded_file.name).suffix or '.jpg'
        key = f'{prefix}/{uuid.uuid4()}{extension}'
        if self.enabled and self.client:
            self.client.upload_fileobj(
                uploaded_file.file,
                settings.AWS_STORAGE_BUCKET_NAME,
                key,
                ExtraArgs={'ContentType': uploaded_file.content_type},
            )
            url = f'https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}'
            return {'storage_key': key, 'storage_url': url, 'thumbnail_url': url}
        media_dir = Path(settings.MEDIA_ROOT) / prefix
        media_dir.mkdir(parents=True, exist_ok=True)
        local_path = media_dir / f'{uuid.uuid4()}{extension}'
        thumb_path = media_dir / f'{local_path.stem}_thumb{extension}'
        with local_path.open('wb') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
        generate_thumbnail(local_path, thumb_path)
        relative = local_path.relative_to(settings.MEDIA_ROOT).as_posix()
        thumb_relative = thumb_path.relative_to(settings.MEDIA_ROOT).as_posix()
        return {'storage_key': relative, 'storage_url': f'{settings.MEDIA_URL}{relative}', 'thumbnail_url': f'{settings.MEDIA_URL}{thumb_relative}'}

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
