from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings
from django.urls import reverse

from photos.services.s3_service import S3StorageService


def photo_delivery_url(
    *,
    photo_id,
    source_url: str | None,
    is_public: bool,
    request=None,
    variant: str = 'original',
) -> str | None:
    if not source_url:
        return None

    hostname = (urlsplit(source_url).hostname or '').lower()
    bucket = settings.AWS_STORAGE_BUCKET_NAME.lower()
    managed_hosts = {
        f'{bucket}.s3.{settings.AWS_REGION}.amazonaws.com',
        f'{bucket}.s3.amazonaws.com',
    } if bucket else set()
    if hostname not in managed_hosts:
        return source_url

    storage = S3StorageService()
    if not is_public:
        return storage.presigned_read_url(source_url) or source_url

    path = reverse('photo-content', kwargs={'pk': photo_id})
    if variant == 'thumbnail':
        path = f'{path}?variant=thumbnail'
    return request.build_absolute_uri(path) if request is not None else path
