from __future__ import annotations

import uuid

import pytest

from photos.models import Photo
from spots.models import Spot

pytestmark = pytest.mark.django_db


def _spot(owner_id: uuid.UUID | str, *, title: str) -> Spot:
    return Spot.objects.create(
        user_id=owner_id,
        title=title,
        description='Private note',
        latitude=32.75,
        longitude=-97.33,
        category='scenic',
        is_public=False,
    )


def test_photo_update_cannot_retarget_photo_to_another_spot(authenticated_client, auth_header):
    _, owner_id = auth_header
    original_spot = _spot(owner_id, title='Original spot')
    other_spot = _spot(uuid.uuid4(), title='Other private spot')
    photo = Photo.objects.create(
        spot=original_spot,
        user_id=owner_id,
        storage_key='photos/original.png',
        storage_url='https://example.com/photos/original.png',
        thumbnail_url='https://example.com/photos/original-thumb.png',
        caption='Original caption',
        sort_order=0,
    )

    response = authenticated_client.put(
        f'/api/content/photos/{photo.id}',
        {'spot': str(other_spot.id), 'caption': 'Updated caption'},
        format='json',
    )

    assert response.status_code == 200
    photo.refresh_from_db()
    assert photo.spot_id == original_spot.id
    assert photo.caption == 'Updated caption'
    assert response.json()['data']['spot'] == str(original_spot.id)
