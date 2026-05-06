"""Cross-app IDOR / authorization probes.

These tests codify the Scope authorization contract so a future refactor that
accidentally drops a check is caught at CI time rather than in production.

Each case follows the same shape:
  1. User A owns a private resource.
  2. User B (an outsider) attempts to read, mutate, or attach children.
  3. We assert B is blocked — preferably with 404 so the resource's very
     existence is not leaked through a 403/404 differential.
"""

from __future__ import annotations

from io import BytesIO
from uuid import uuid4

import jwt
import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from photos.services.s3_service import S3StorageService
from spots.models import Spot
from trips.models import Trip, TripMember


def _token_for(user_id: str) -> str:
    return jwt.encode(
        {
            'sub': user_id,
            'email': f'{user_id}@example.com',
            'name': 'Tester',
            'roles': ['user'],
            'iss': settings.JWT_ISSUER,
            'aud': settings.JWT_AUDIENCE,
            'exp': 4102444800,
        },
        settings.JWT_SECRET,
        algorithm='HS256',
    )


def _client_for(user_id: str) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(user_id)}')
    return client


def _png_upload(name: str) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', (2, 2), color='teal').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


@pytest.mark.django_db
def test_private_spot_detail_is_invisible_to_outsiders():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    spot = Spot.objects.create(
        user_id=owner_id,
        title='Hidden Favorite',
        latitude=0,
        longitude=0,
        category='food',
        is_public=False,
    )

    response = _client_for(outsider_id).get(f'/api/content/spots/{spot.id}')

    # 404 (not 403) to avoid leaking spot existence to the attacker.
    assert response.status_code == 404


@pytest.mark.django_db
def test_private_trip_detail_is_invisible_to_outsiders():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    trip = Trip.objects.create(creator_id=owner_id, title='Secret Weekend', status='planning', is_public=False)
    TripMember.objects.create(trip=trip, user_id=owner_id, role='owner')

    response = _client_for(outsider_id).get(f'/api/content/trips/{trip.id}')

    assert response.status_code == 404


@pytest.mark.django_db
def test_outsiders_cannot_delete_private_trips():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    trip = Trip.objects.create(creator_id=owner_id, title='Secret Weekend', status='planning', is_public=False)
    TripMember.objects.create(trip=trip, user_id=owner_id, role='owner')

    response = _client_for(outsider_id).delete(f'/api/content/trips/{trip.id}')

    assert response.status_code == 404


@pytest.mark.django_db
def test_photo_upload_rejects_cross_user_spot_attachment(monkeypatch):
    """An attacker cannot drop photos into another user's private spot."""
    owner_id = str(uuid4())
    attacker_id = str(uuid4())
    spot = Spot.objects.create(
        user_id=owner_id,
        title='Hidden Favorite',
        latitude=0,
        longitude=0,
        category='food',
        is_public=False,
    )
    monkeypatch.setattr(
        S3StorageService,
        'store',
        lambda self, uploaded_file, prefix='photos': {
            'storage_key': f'{prefix}/x.png',
            'storage_url': 'https://example.com/x.png',
            'thumbnail_url': 'https://example.com/x_thumb.png',
        },
    )

    response = _client_for(attacker_id).post(
        '/api/content/photos/upload',
        {'spot_id': str(spot.id), 'file': _png_upload('x.png')},
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_private_spot_reviews_are_invisible_to_outsiders():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    spot = Spot.objects.create(
        user_id=owner_id,
        title='Hidden Favorite',
        latitude=0,
        longitude=0,
        category='food',
        is_public=False,
    )

    response = _client_for(outsider_id).get(f'/api/content/reviews/spot/{spot.id}')

    assert response.status_code == 404
