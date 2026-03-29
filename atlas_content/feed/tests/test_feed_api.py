import pytest

from spots.models import Spot
from trips.models import Trip, TripMember


@pytest.mark.django_db
def test_social_feed_requires_auth(api_client):
    response = api_client.get('/api/content/feed/')

    assert response.status_code == 401


@pytest.mark.django_db
def test_social_feed_returns_cursor_contract(authenticated_client, auth_header):
    _, user_id = auth_header
    Spot.objects.create(
        user_id=user_id,
        title='Sunset Point',
        description='Golden hour stop',
        latitude=32.75,
        longitude=-97.33,
        category='scenic',
        is_public=True,
    )
    trip = Trip.objects.create(creator_id=user_id, title='Weekend Escape', description='Two day loop', status='planning', is_public=True)
    TripMember.objects.create(trip=trip, user_id=user_id, role='owner')

    response = authenticated_client.get('/api/content/feed/')

    assert response.status_code == 200
    body = response.json()
    assert len(body['data']) == 2
    assert 'createdAt' in body['data'][0]
    assert 'item' in body['data'][0]
    assert 'nextCursor' in body['meta']
    assert 'previousCursor' in body['meta']


@pytest.mark.django_db
def test_trending_spots_honors_limit(api_client, auth_header):
    _, user_id = auth_header
    for index in range(3):
        Spot.objects.create(
            user_id=user_id,
            title=f'Spot {index}',
            latitude=32.75 + index,
            longitude=-97.33 - index,
            category='food',
            is_public=True,
        )

    response = api_client.get('/api/content/feed/trending', {'limit': 2})

    assert response.status_code == 200
    assert len(response.json()['data']) == 2
