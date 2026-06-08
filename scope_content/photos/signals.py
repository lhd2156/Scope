from __future__ import annotations

import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from photos.models import Photo
from photos.services.s3_service import S3StorageService

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Photo)
def delete_managed_photo_assets(sender, instance: Photo, **kwargs) -> None:
    storage = S3StorageService()
    try:
        storage.delete_asset(instance.storage_key)
        if instance.thumbnail_url:
            storage.delete_asset(instance.thumbnail_url)
    except Exception:
        logger.exception(
            'photo_asset_cleanup_failed',
            extra={
                'photo_id': str(instance.id),
                'storage_key': instance.storage_key,
            },
        )
