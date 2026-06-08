from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from photos.models import Photo
from spots.models import Spot

pytestmark = pytest.mark.django_db


def _spot() -> Spot:
    return Spot.objects.create(
        user_id=uuid4(),
        title='Signal cleanup spot',
        latitude=32.75,
        longitude=-97.33,
        city='Fort Worth',
        country='US',
        category='food',
    )


def test_photo_and_cascaded_spot_deletion_remove_managed_assets(monkeypatch):
    delete_asset = MagicMock()
    monkeypatch.setattr('photos.signals.S3StorageService.delete_asset', delete_asset)
    spot = _spot()
    first = Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/first.png',
        storage_url='/media/photos/first.png',
        thumbnail_url='/media/photos/first_thumb.webp',
    )
    Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/second.png',
        storage_url='/media/photos/second.png',
        thumbnail_url='',
    )

    first.delete()
    spot.delete()

    assert delete_asset.call_count == 3
    delete_asset.assert_any_call('photos/first.png')
    delete_asset.assert_any_call('/media/photos/first_thumb.webp')
    delete_asset.assert_any_call('photos/second.png')


def test_storage_cleanup_failure_does_not_restore_deleted_database_row(monkeypatch):
    monkeypatch.setattr(
        'photos.signals.S3StorageService.delete_asset',
        MagicMock(side_effect=RuntimeError('storage unavailable')),
    )
    photo = Photo.objects.create(
        spot=_spot(),
        user_id=uuid4(),
        storage_key='photos/failure.png',
        storage_url='/media/photos/failure.png',
        thumbnail_url='',
    )

    photo.delete()

    assert not Photo.objects.filter(pk=photo.id).exists()
