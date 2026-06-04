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

from photos.models import Photo
from photos.services.s3_service import S3StorageService
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot


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
def test_private_spot_detail_is_invisible_to_anonymous_visitors():
    owner_id = str(uuid4())
    spot = Spot.objects.create(
        user_id=owner_id,
        title='Hidden Favorite',
        latitude=0,
        longitude=0,
        category='food',
        is_public=False,
    )

    response = APIClient().get(f'/api/content/spots/{spot.id}')

    assert response.status_code == 404


@pytest.mark.django_db
def test_private_and_public_spot_visibility_on_map_backing_lists():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    owner_client = _client_for(owner_id)
    outsider_client = _client_for(outsider_id)
    anonymous_client = APIClient()

    private_response = owner_client.post(
        '/api/content/spots/',
        {
            'title': 'Owner Only Pin',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'category': 'food',
            'is_public': False,
        },
        format='json',
    )
    public_spot = Spot.objects.create(
        user_id=owner_id,
        title='Shared Pin',
        latitude=32.756,
        longitude=-97.331,
        category='scenic',
        is_public=True,
        verification_status=Spot.VERIFICATION_VERIFIED,
        safety_status=Spot.SAFETY_CLEAN,
    )

    assert private_response.status_code == 201
    assert public_spot.is_public is True

    owner_list_titles = {spot['title'] for spot in owner_client.get('/api/content/spots/').json()['data']}
    outsider_list_titles = {spot['title'] for spot in outsider_client.get('/api/content/spots/').json()['data']}
    anonymous_list_titles = {spot['title'] for spot in anonymous_client.get('/api/content/spots/').json()['data']}

    assert {'Owner Only Pin', 'Shared Pin'}.issubset(owner_list_titles)
    assert 'Shared Pin' in outsider_list_titles
    assert 'Owner Only Pin' not in outsider_list_titles
    assert 'Shared Pin' in anonymous_list_titles
    assert 'Owner Only Pin' not in anonymous_list_titles

    nearby_params = {'lat': 32.7555, 'lng': -97.3308, 'radius': 3}
    owner_nearby_titles = {spot['title'] for spot in owner_client.get('/api/content/spots/nearby', nearby_params).json()['data']}
    outsider_nearby_titles = {spot['title'] for spot in outsider_client.get('/api/content/spots/nearby', nearby_params).json()['data']}
    anonymous_nearby_titles = {spot['title'] for spot in anonymous_client.get('/api/content/spots/nearby', nearby_params).json()['data']}

    assert {'Owner Only Pin', 'Shared Pin'}.issubset(owner_nearby_titles)
    assert 'Owner Only Pin' not in outsider_nearby_titles
    assert 'Owner Only Pin' not in anonymous_nearby_titles


@pytest.mark.django_db
def test_spot_visibility_toggle_persists_and_changes_access():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    owner_client = _client_for(owner_id)
    outsider_client = _client_for(outsider_id)
    spot = Spot.objects.create(
        user_id=owner_id,
        title='Toggle Pin',
        latitude=32.7555,
        longitude=-97.3308,
        category='food',
        is_public=True,
        verification_status=Spot.VERIFICATION_VERIFIED,
        safety_status=Spot.SAFETY_CLEAN,
    )

    private_update = owner_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Toggle Pin',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'category': 'food',
            'is_public': False,
        },
        format='json',
    )

    assert private_update.status_code == 200
    assert private_update.json()['is_public'] is False
    assert owner_client.get(f'/api/content/spots/{spot.id}').json()['is_public'] is False
    assert outsider_client.get(f'/api/content/spots/{spot.id}').status_code == 404

    public_update = owner_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Toggle Pin',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'category': 'food',
            'is_public': True,
        },
        format='json',
    )

    assert public_update.status_code == 200
    assert public_update.json()['is_public'] is True
    assert outsider_client.get(f'/api/content/spots/{spot.id}').status_code == 200


@pytest.mark.django_db
def test_private_spot_children_and_mutations_are_invisible_to_outsiders():
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
    Photo.objects.create(
        spot=spot,
        user_id=owner_id,
        storage_key='photos/hidden.png',
        storage_url='https://example.com/hidden.png',
        caption='Secret angle',
    )

    outsider_client = _client_for(outsider_id)

    assert outsider_client.get(f'/api/content/spots/{spot.id}/photos').status_code == 404
    assert APIClient().get(f'/api/content/spots/{spot.id}/photos').status_code == 404
    assert outsider_client.post(f'/api/content/spots/{spot.id}/like').status_code == 404


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
def test_private_spot_cannot_be_attached_to_another_users_trip():
    owner_id = str(uuid4())
    attacker_id = str(uuid4())
    hidden_spot = Spot.objects.create(
        user_id=owner_id,
        title='Hidden Dinner',
        latitude=32.75,
        longitude=-97.33,
        category='food',
        is_public=False,
    )
    trip = Trip.objects.create(creator_id=attacker_id, title='Attacker Plan', status='planning', is_public=False)
    TripMember.objects.create(trip=trip, user_id=attacker_id, role='owner')

    response = _client_for(attacker_id).post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(hidden_spot.id), 'day_number': 1, 'sort_order': 0},
        format='json',
    )

    assert response.status_code == 400
    assert not TripSpot.objects.filter(trip=trip, spot=hidden_spot).exists()


@pytest.mark.django_db
def test_public_trip_members_are_not_visible_to_non_members():
    owner_id = str(uuid4())
    outsider_id = str(uuid4())
    trip = Trip.objects.create(creator_id=owner_id, title='Public Weekend', status='planning', is_public=True)
    TripMember.objects.create(trip=trip, user_id=owner_id, role='owner')

    response = _client_for(outsider_id).get(f'/api/content/trips/{trip.id}/members')

    assert response.status_code == 403


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
