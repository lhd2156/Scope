from __future__ import annotations

from datetime import date

import jwt
import pytest
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from photos.models import Photo
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache_between_tests():
    cache.clear()
    yield
    cache.clear()



def _auth_client_for_user(user_id: str) -> APIClient:
    client = APIClient()
    token = jwt.encode(
        {
            'sub': user_id,
            'email': f'{user_id}@example.com',
            'name': 'Cache Tester',
            'roles': ['user'],
            'iss': settings.JWT_ISSUER,
            'aud': settings.JWT_AUDIENCE,
            'exp': 4102444800,
        },
        settings.JWT_SECRET,
        algorithm='HS256',
    )
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client



def _public_spot(*, user_id: str, title: str, latitude: float, longitude: float) -> Spot:
    return Spot.objects.create(
        user_id=user_id,
        title=title,
        description=f'{title} description',
        latitude=latitude,
        longitude=longitude,
        city='Fort Worth',
        country='US',
        category='food',
        vibe='chill',
        is_public=True,
    )



def _create_photo(spot: Spot, suffix: str) -> None:
    Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key=f'photos/{suffix}.png',
        storage_url=f'https://example.com/photos/{suffix}.png',
        thumbnail_url=f'https://example.com/photos/{suffix}_thumb.png',
        caption=f'Photo {suffix}',
        sort_order=0,
    )



def test_explore_spots_response_is_cached_and_invalidated_after_like(auth_header, api_client):
    _, owner_user_id = auth_header
    actor_client = _auth_client_for_user(owner_user_id)
    spots = []
    for index in range(3):
        spot = _public_spot(
            user_id=owner_user_id,
            title=f'Cached Spot {index}',
            latitude=32.75 + index * 0.01,
            longitude=-97.33 - index * 0.01,
        )
        _create_photo(spot, f'cached-{index}')
        spots.append(spot)

    with CaptureQueriesContext(connection) as first_queries:
        first_response = api_client.get('/api/content/spots/explore')
    with CaptureQueriesContext(connection) as second_queries:
        second_response = api_client.get('/api/content/spots/explore')

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(second_queries) < len(first_queries)

    like_response = actor_client.post(f'/api/content/spots/{spots[0].id}/like')
    refreshed_response = api_client.get('/api/content/spots/explore')
    refreshed_spots = {item['id']: item for item in refreshed_response.json()['data']}

    assert like_response.status_code == 201
    assert refreshed_spots[str(spots[0].id)]['likes_count'] == 1



def test_spot_detail_response_is_cached_and_invalidated_after_update(authenticated_client, api_client, spot):
    _create_photo(spot, 'detail-cache')

    with CaptureQueriesContext(connection) as first_queries:
        first_response = api_client.get(f'/api/content/spots/{spot.id}')
    with CaptureQueriesContext(connection) as second_queries:
        second_response = api_client.get(f'/api/content/spots/{spot.id}')

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(second_queries) < len(first_queries)

    update_response = authenticated_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Cache Fix',
            'description': 'Updated description',
            'latitude': 32.75,
            'longitude': -97.33,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'chill',
            'rating': '4.0',
            'is_public': True,
        },
        format='json',
    )
    refreshed_response = api_client.get(f'/api/content/spots/{spot.id}')

    assert update_response.status_code == 200
    assert refreshed_response.status_code == 200
    assert refreshed_response.json()['title'] == 'Cache Fix'



def test_social_feed_response_is_cached_and_invalidated_after_trip_create(auth_header):
    _, owner_user_id = auth_header
    client = _auth_client_for_user(owner_user_id)

    spot = _public_spot(
        user_id=owner_user_id,
        title='Feed Cached Spot',
        latitude=32.81,
        longitude=-97.31,
    )
    _create_photo(spot, 'feed-cached')

    existing_trip = Trip.objects.create(
        creator_id=owner_user_id,
        title='Existing Feed Trip',
        description='Existing trip',
        start_date=date(2026, 3, 29),
        end_date=date(2026, 3, 30),
        is_public=True,
    )
    TripMember.objects.create(trip=existing_trip, user_id=owner_user_id, role='owner')
    TripSpot.objects.create(trip=existing_trip, spot=spot, day_number=1, sort_order=0)

    with CaptureQueriesContext(connection) as first_queries:
        first_response = client.get('/api/content/feed/')
    with CaptureQueriesContext(connection) as second_queries:
        second_response = client.get('/api/content/feed/')

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(second_queries) < len(first_queries)

    create_response = client.post(
        '/api/content/trips/',
        {
            'title': 'New Cached Trip',
            'description': 'Fresh route',
            'start_date': '2026-04-01',
            'end_date': '2026-04-02',
            'currency': 'USD',
            'status': 'planning',
            'is_public': True,
        },
        format='json',
    )
    refreshed_response = client.get('/api/content/feed/')
    trip_titles = {
        entry['title']
        for entry in refreshed_response.json()['data']
        if entry['type'] == 'trip'
    }

    assert create_response.status_code == 201
    assert any('New Cached Trip' in title for title in trip_titles)



def test_trending_spots_response_is_cached_and_invalidated_after_like(auth_header):
    _, owner_user_id = auth_header
    client = _auth_client_for_user(owner_user_id)
    spot = _public_spot(
        user_id=owner_user_id,
        title='Trending Cached Spot',
        latitude=32.9,
        longitude=-97.2,
    )
    _create_photo(spot, 'trending-cached')

    with CaptureQueriesContext(connection) as first_queries:
        first_response = client.get('/api/content/feed/trending')
    with CaptureQueriesContext(connection) as second_queries:
        second_response = client.get('/api/content/feed/trending')

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(second_queries) < len(first_queries)

    like_response = client.post(f'/api/content/spots/{spot.id}/like')
    refreshed_response = client.get('/api/content/feed/trending')
    refreshed_spots = {item['id']: item for item in refreshed_response.json()['data']}

    assert like_response.status_code == 201
    assert refreshed_spots[str(spot.id)]['likes_count'] == 1
