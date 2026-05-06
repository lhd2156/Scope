from __future__ import annotations

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from photos.models import Photo
from photos.serializers import PhotoSerializer, PhotoUploadSerializer
from reviews.serializers import ReviewSerializer
from spots.serializers import SpotSerializer
from trips.serializers import (
    TripAddSpotSerializer,
    TripMemberCreateSerializer,
    TripReorderSerializer,
    TripSerializer,
)


def _image_upload(name: str, image_format: str, content_type: str) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', (2, 2), color='navy').save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


@pytest.mark.django_db
def test_spot_serializer_rejects_blank_title_and_out_of_range_latitude():
    serializer = SpotSerializer(
        data={
            'title': '   ',
            'description': 'Test',
            'latitude': 91,
            'longitude': -97.33,
            'category': 'food',
        }
    )

    assert not serializer.is_valid()
    assert 'title' in serializer.errors
    assert 'latitude' in serializer.errors


@pytest.mark.django_db
def test_trip_serializer_rejects_negative_budget_and_invalid_currency():
    serializer = TripSerializer(
        data={
            'title': 'Weekend',
            'budget': '-10.00',
            'currency': 'usd1',
            'status': 'planning',
        }
    )

    assert not serializer.is_valid()
    assert 'budget' in serializer.errors
    assert 'currency' in serializer.errors


@pytest.mark.django_db
def test_trip_serializer_rejects_end_date_before_start_date():
    serializer = TripSerializer(
        data={
            'title': 'Weekend',
            'start_date': '2026-03-30',
            'end_date': '2026-03-29',
            'status': 'planning',
        }
    )

    assert not serializer.is_valid()
    assert 'end_date' in serializer.errors


@pytest.mark.django_db
def test_trip_add_spot_and_member_serializers_validate_fields(spot):
    add_spot_serializer = TripAddSpotSerializer(
        data={
            'spot_id': str(spot.id),
            'day_number': 0,
            'sort_order': -1,
        }
    )
    member_serializer = TripMemberCreateSerializer(
        data={
            'user_id': '11111111-1111-1111-1111-111111111111',
            'role': 'admin',
        }
    )

    assert not add_spot_serializer.is_valid()
    assert 'day_number' in add_spot_serializer.errors
    assert 'sort_order' in add_spot_serializer.errors
    assert not member_serializer.is_valid()
    assert 'role' in member_serializer.errors


@pytest.mark.django_db
def test_trip_reorder_serializer_rejects_duplicate_spot_ids(spot):
    serializer = TripReorderSerializer(
        data={
            'spots': [
                {'spotId': str(spot.id), 'sortOrder': 0, 'dayNumber': 1},
                {'spotId': str(spot.id), 'sortOrder': 1, 'dayNumber': 1},
            ]
        }
    )

    assert not serializer.is_valid()
    assert 'spots' in serializer.errors


@pytest.mark.django_db
def test_photo_serializers_reject_invalid_upload_types_and_negative_sort_order(spot):
    upload_serializer = PhotoUploadSerializer(
        data={
            'spot_id': str(spot.id),
            'file': _image_upload('animated.gif', 'GIF', 'image/gif'),
            'sort_order': -1,
        }
    )
    photo = Photo(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/test.png',
        storage_url='https://example.com/photos/test.png',
        thumbnail_url='https://example.com/photos/test_thumb.png',
        caption='Original',
        sort_order=0,
    )
    update_serializer = PhotoSerializer(instance=photo, data={'sort_order': -1}, partial=True)

    assert not upload_serializer.is_valid()
    assert 'file' in upload_serializer.errors
    assert 'sort_order' in upload_serializer.errors
    assert not update_serializer.is_valid()
    assert 'sort_order' in update_serializer.errors


@pytest.mark.django_db
def test_review_serializer_rejects_out_of_range_rating():
    serializer = ReviewSerializer(data={'rating': '5.5', 'comment': 'Too high'})

    assert not serializer.is_valid()
    assert 'rating' in serializer.errors
