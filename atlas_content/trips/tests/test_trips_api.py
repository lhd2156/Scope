import pytest

from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot


@pytest.mark.django_db
def test_create_trip_uses_architecture_contract(authenticated_client):
    response = authenticated_client.post(
        '/api/content/trips/',
        {
            'title': 'Road Trip',
            'description': 'West loop',
            'startDate': '2026-04-01',
            'endDate': '2026-04-03',
            'status': 'planning',
            'isPublic': False,
        },
        format='json',
    )

    assert response.status_code == 201
    body = response.json()['data']
    assert body['title'] == 'Road Trip'
    assert body['isPublic'] is False
    assert body['startDate'] == '2026-04-01'
    assert 'createdAt' in body


@pytest.mark.django_db
def test_list_trips_requires_auth(api_client):
    response = api_client.get('/api/content/trips/')

    assert response.status_code == 401


@pytest.mark.django_db
def test_public_trips_endpoint_lists_public_trips(api_client, auth_header):
    _, user_id = auth_header
    Trip.objects.create(creator_id=user_id, title='Public Weekend', status='planning', is_public=True)

    response = api_client.get('/api/content/trips/public')

    assert response.status_code == 200
    assert response.json()['meta']['total'] == 1
    assert response.json()['data'][0]['title'] == 'Public Weekend'


@pytest.mark.django_db
def test_private_trip_detail_is_hidden_from_anonymous(api_client, auth_header):
    _, user_id = auth_header
    private_trip = Trip.objects.create(creator_id=user_id, title='Hidden Route', status='planning', is_public=False)
    TripMember.objects.create(trip=private_trip, user_id=user_id, role='owner')

    response = api_client.get(f'/api/content/trips/{private_trip.id}')

    assert response.status_code == 404


@pytest.mark.django_db
def test_add_member_and_spot_uses_camel_case_contract(authenticated_client, auth_header, trip):
    _, user_id = auth_header
    spot = Spot.objects.create(user_id=user_id, title='Canyon', latitude=31.0, longitude=-97.0, category='nature')

    member_response = authenticated_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'userId': '11111111-1111-1111-1111-111111111111', 'role': 'viewer'},
        format='json',
    )
    spot_response = authenticated_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spotId': str(spot.id), 'dayNumber': 1, 'sortOrder': 0},
        format='json',
    )

    assert member_response.status_code == 201
    assert spot_response.status_code == 201
    assert TripMember.objects.filter(trip=trip).count() == 2
    assert TripSpot.objects.filter(trip=trip).count() == 1
    assert member_response.json()['data']['userId'] == '11111111-1111-1111-1111-111111111111'
    added_spot = spot_response.json()['data']['spots'][0]
    assert added_spot['spotId'] == str(spot.id)
    assert added_spot['dayNumber'] == 1
    assert added_spot['sortOrder'] == 0


@pytest.mark.django_db
def test_reorder_trip_spots(authenticated_client, auth_header, trip):
    _, user_id = auth_header
    first = Spot.objects.create(user_id=user_id, title='A', latitude=31.0, longitude=-97.0, category='nature')
    second = Spot.objects.create(user_id=user_id, title='B', latitude=32.0, longitude=-98.0, category='nature')
    authenticated_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spotId': str(first.id), 'dayNumber': 1, 'sortOrder': 0},
        format='json',
    )
    authenticated_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spotId': str(second.id), 'dayNumber': 1, 'sortOrder': 1},
        format='json',
    )

    response = authenticated_client.put(
        f'/api/content/trips/{trip.id}/spots/reorder',
        {
            'spots': [
                {'spotId': str(first.id), 'sortOrder': 2, 'dayNumber': 2},
                {'spotId': str(second.id), 'sortOrder': 1, 'dayNumber': 2},
            ]
        },
        format='json',
    )

    assert response.status_code == 200
    reordered = {item['spotId']: item for item in response.json()['data']['spots']}
    assert reordered[str(first.id)]['dayNumber'] == 2
    assert reordered[str(first.id)]['sortOrder'] == 2
