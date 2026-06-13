import pytest
from uuid import uuid4
import jwt
from django.conf import settings
from rest_framework.test import APIClient

from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot


def _client_for_user(user_id: str) -> APIClient:
    client = APIClient()
    token = jwt.encode(
        {
            'sub': user_id,
            'email': f'{user_id}@example.com',
            'name': 'Trip Tester',
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


@pytest.mark.django_db
def test_create_trip(authenticated_client):
    response = authenticated_client.post(
        '/api/content/trips/',
        {'title': 'Road Trip', 'description': 'West loop', 'status': 'planning'},
        format='json',
    )
    assert response.status_code == 201
    assert response.json()['data']['title'] == 'Road Trip'


@pytest.mark.django_db
def test_add_member_and_spot(authenticated_client, auth_header, trip):
    _, user_id = auth_header
    spot = Spot.objects.create(user_id=user_id, title='Canyon', latitude=31.0, longitude=-97.0, category='nature')
    member_response = authenticated_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': '11111111-1111-1111-1111-111111111111', 'role': 'viewer'},
        format='json',
    )
    assert member_response.status_code == 201
    spot_response = authenticated_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(spot.id), 'day_number': 1, 'sort_order': 0},
        format='json',
    )
    assert spot_response.status_code == 201
    assert TripMember.objects.filter(trip=trip).count() == 2
    assert TripSpot.objects.filter(trip=trip).count() == 1


@pytest.mark.django_db
def test_reorder_trip_spots(authenticated_client, auth_header, trip):
    _, user_id = auth_header
    first = Spot.objects.create(user_id=user_id, title='A', latitude=31.0, longitude=-97.0, category='nature')
    second = Spot.objects.create(user_id=user_id, title='B', latitude=32.0, longitude=-98.0, category='nature')
    authenticated_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(first.id), 'day_number': 1, 'sort_order': 0},
        format='json',
    )
    authenticated_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(second.id), 'day_number': 1, 'sort_order': 1},
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
    reordered = {str(item['spot']): item for item in response.json()['data']['spots']}
    assert reordered[str(first.id)]['day_number'] == 2


@pytest.mark.django_db
def test_reorder_trip_spots_rejects_unknown_spot(authenticated_client, trip):
    response = authenticated_client.put(
        f'/api/content/trips/{trip.id}/spots/reorder',
        {'spots': [{'spotId': str(uuid4()), 'sortOrder': 0, 'dayNumber': 1}]},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_trip_detail_etag_returns_304_until_payload_changes(authenticated_client, trip):
    first_response = authenticated_client.get(f'/api/content/trips/{trip.id}')

    assert first_response.status_code == 200
    assert first_response['ETag']
    assert 'private' in first_response['Cache-Control']
    assert 'no-cache' in first_response['Cache-Control']
    assert 'Authorization' in first_response['Vary']

    not_modified_response = authenticated_client.get(
        f'/api/content/trips/{trip.id}',
        HTTP_IF_NONE_MATCH=first_response['ETag'],
    )

    assert not_modified_response.status_code == 304
    assert not_modified_response.content == b''
    assert not_modified_response['ETag'] == first_response['ETag']

    update_response = authenticated_client.put(
        f'/api/content/trips/{trip.id}',
        {
            'title': 'Updated Weekend',
            'description': 'Two day escape',
            'status': 'planning',
            'currency': 'USD',
            'is_public': False,
        },
        format='json',
    )
    refreshed_response = authenticated_client.get(
        f'/api/content/trips/{trip.id}',
        HTTP_IF_NONE_MATCH=first_response['ETag'],
    )

    assert update_response.status_code == 200
    assert refreshed_response.status_code == 200
    assert refreshed_response['ETag'] != first_response['ETag']
    assert refreshed_response.json()['title'] == 'Updated Weekend'


@pytest.mark.django_db
def test_planner_payload_visibility_share_and_delete_cleanup(authenticated_client, auth_header):
    _, owner_user_id = auth_header
    invited_user_id = str(uuid4())
    anonymous_client = APIClient()

    create_response = authenticated_client.post(
        '/api/content/trips/',
        {
            'title': 'German fuel loop',
            'destination': 'Berlin to Hamburg',
            'description': 'Planner draft',
            'isPublic': False,
            'startDate': '2026-06-01',
            'endDate': '2026-06-03',
            'spots': [
                {
                    'spotId': 'planner-start',
                    'title': 'Berlin start',
                    'latitude': 52.52,
                    'longitude': 13.405,
                    'category': 'scenic',
                    'dayNumber': 1,
                }
            ],
            'members': [{'id': invited_user_id, 'status': 'viewer'}],
        },
        format='json',
    )

    assert create_response.status_code == 201
    trip_data = create_response.json()['data']
    trip_id = trip_data['id']
    generated_spot_id = trip_data['spots'][0]['spot']
    assert trip_data['destination'] == 'Berlin to Hamburg'
    assert trip_data['is_public'] is False
    assert trip_data['start_date'] == '2026-06-01'
    assert trip_data['spots'][0]['title'] == 'Berlin start'
    assert {member['user_id'] for member in trip_data['members']} >= {owner_user_id, invited_user_id}
    assert anonymous_client.get(f'/api/content/trips/{trip_id}').status_code == 404

    share_response = authenticated_client.post(f'/api/content/trips/{trip_id}/share')
    assert share_response.status_code == 200
    share_path = share_response.json()['data']['path']
    shared_response = anonymous_client.get(f"/api/content/trips/share/{share_path.rsplit('/', 1)[-1]}")
    assert shared_response.status_code == 200
    assert shared_response.json()['data']['id'] == trip_id
    assert shared_response.json()['data']['members'] == []

    public_response = authenticated_client.put(
        f'/api/content/trips/{trip_id}',
        {
            'title': 'German fuel loop',
            'destination': 'Berlin to Hamburg',
            'isPublic': True,
            'startDate': '2026-06-01',
            'endDate': '2026-06-03',
            'spots': trip_data['spots'],
        },
        format='json',
    )
    assert public_response.status_code == 200
    anonymous_public_detail = anonymous_client.get(f'/api/content/trips/{trip_id}')
    assert anonymous_public_detail.status_code == 200
    assert anonymous_public_detail.json()['members'] == []

    delete_response = authenticated_client.delete(f'/api/content/trips/{trip_id}')
    assert delete_response.status_code == 204
    assert not Trip.objects.filter(id=trip_id).exists()
    assert not TripSpot.objects.filter(trip_id=trip_id).exists()
    assert not TripMember.objects.filter(trip_id=trip_id).exists()
    assert not Spot.objects.filter(id=generated_spot_id).exists()


@pytest.mark.django_db
def test_trip_member_permissions_are_enforced(auth_header):
    _, owner_user_id = auth_header
    editor_user_id = str(uuid4())
    viewer_user_id = str(uuid4())

    trip = Trip.objects.create(creator_id=owner_user_id, title='Crew trip', status='planning', is_public=False)
    TripMember.objects.create(trip=trip, user_id=owner_user_id, role='owner')
    TripMember.objects.create(trip=trip, user_id=editor_user_id, role='editor')
    TripMember.objects.create(trip=trip, user_id=viewer_user_id, role='viewer')

    owner_client = _client_for_user(owner_user_id)
    editor_client = _client_for_user(editor_user_id)
    viewer_client = _client_for_user(viewer_user_id)

    editor_update = editor_client.put(
        f'/api/content/trips/{trip.id}',
        {'title': 'Editor changed title', 'status': 'planning', 'is_public': False},
        format='json',
    )
    viewer_update = viewer_client.put(
        f'/api/content/trips/{trip.id}',
        {'title': 'Viewer changed title', 'status': 'planning', 'is_public': False},
        format='json',
    )
    editor_member_change = editor_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': viewer_user_id, 'role': 'editor'},
        format='json',
    )
    viewer_members = viewer_client.get(f'/api/content/trips/{trip.id}/members')
    owner_member_change = owner_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': viewer_user_id, 'role': 'editor'},
        format='json',
    )
    editor_delete = editor_client.delete(f'/api/content/trips/{trip.id}')

    assert editor_update.status_code == 200
    assert viewer_update.status_code == 403
    assert editor_member_change.status_code == 403
    assert viewer_members.status_code == 200
    assert owner_member_change.status_code == 200
    assert TripMember.objects.get(trip=trip, user_id=viewer_user_id).role == 'editor'
    assert editor_delete.status_code == 403


@pytest.mark.django_db
def test_public_trips_can_filter_by_profile_member_before_pagination(auth_header):
    _, owner_user_id = auth_header
    profile_user_id = str(uuid4())
    other_user_id = str(uuid4())
    profile_trip = Trip.objects.create(
        creator_id=owner_user_id,
        title='Profile public route',
        status='planning',
        is_public=True,
    )
    TripMember.objects.create(trip=profile_trip, user_id=profile_user_id, role='viewer')
    Trip.objects.create(
        creator_id=other_user_id,
        title='Other public route',
        status='planning',
        is_public=True,
    )
    Trip.objects.create(
        creator_id=profile_user_id,
        title='Private profile route',
        status='planning',
        is_public=False,
    )

    response = APIClient().get(
        '/api/content/trips/public',
        {'page': 1, 'pageSize': 1, 'userId': profile_user_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload['meta']['total'] == 1
    assert [trip['id'] for trip in payload['data']] == [str(profile_trip.id)]
    assert payload['data'][0]['members'] == []


@pytest.mark.django_db
def test_public_trip_responses_do_not_expose_member_roster_to_non_members(auth_header):
    _, owner_user_id = auth_header
    member_user_id = str(uuid4())
    trip = Trip.objects.create(
        creator_id=owner_user_id,
        title='Public social graph',
        status='planning',
        is_public=True,
    )
    TripMember.objects.create(trip=trip, user_id=owner_user_id, role='owner')
    TripMember.objects.create(trip=trip, user_id=member_user_id, role='viewer')
    anonymous_client = APIClient()

    detail_response = anonymous_client.get(f'/api/content/trips/{trip.id}')
    list_response = anonymous_client.get('/api/content/trips/public')

    assert detail_response.status_code == 200
    assert detail_response.json()['members'] == []
    assert list_response.status_code == 200
    public_trip = next(item for item in list_response.json()['data'] if item['id'] == str(trip.id))
    assert public_trip['members'] == []


@pytest.mark.django_db
def test_public_trips_rejects_invalid_profile_user_id():
    response = APIClient().get('/api/content/trips/public', {'userId': 'not-a-uuid'})

    assert response.status_code == 400
    assert response.json()['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'userId', 'message': 'Must be a valid UUID.'} in response.json()['error']['details']


@pytest.mark.django_db
def test_creator_membership_cannot_be_downgraded_or_removed(auth_header):
    _, owner_user_id = auth_header
    trip = Trip.objects.create(creator_id=owner_user_id, title='Owner invariant', status='planning', is_public=False)
    TripMember.objects.create(trip=trip, user_id=owner_user_id, role='owner')
    owner_client = _client_for_user(owner_user_id)

    downgrade_response = owner_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': owner_user_id, 'role': 'viewer'},
        format='json',
    )
    remove_response = owner_client.delete(f'/api/content/trips/{trip.id}/members/{owner_user_id}')

    assert downgrade_response.status_code == 400
    assert remove_response.status_code == 200
    assert remove_response.json()['data']['removed'] is False
    assert TripMember.objects.get(trip=trip, user_id=owner_user_id).role == 'owner'


@pytest.mark.django_db
def test_trip_mutation_permission_denials_and_existing_share_token(auth_header):
    _, owner_user_id = auth_header
    viewer_user_id = str(uuid4())
    trip = Trip.objects.create(creator_id=owner_user_id, title='Guarded trip', status='planning', is_public=False)
    TripMember.objects.create(trip=trip, user_id=owner_user_id, role='owner')
    TripMember.objects.create(trip=trip, user_id=viewer_user_id, role='viewer')
    spot = Spot.objects.create(user_id=owner_user_id, title='Stop', latitude=1, longitude=2, is_public=True)
    TripSpot.objects.create(trip=trip, spot=spot, sort_order=0)

    viewer_client = _client_for_user(viewer_user_id)
    owner_client = _client_for_user(owner_user_id)

    add_response = viewer_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(spot.id)},
        format='json',
    )
    reorder_response = viewer_client.put(
        f'/api/content/trips/{trip.id}/spots/reorder',
        {'spots': [{'spotId': str(spot.id), 'sortOrder': 1}]},
        format='json',
    )
    remove_member_response = viewer_client.delete(f'/api/content/trips/{trip.id}/members/{owner_user_id}')
    share_denied_response = viewer_client.post(f'/api/content/trips/{trip.id}/share')
    first_share_response = owner_client.post(f'/api/content/trips/{trip.id}/share')
    second_share_response = owner_client.post(f'/api/content/trips/{trip.id}/share')

    assert add_response.status_code == 403
    assert reorder_response.status_code == 403
    assert remove_member_response.status_code == 403
    assert share_denied_response.status_code == 403
    assert first_share_response.status_code == 200
    assert second_share_response.status_code == 200
    assert second_share_response.json()['data']['token'] == first_share_response.json()['data']['token']
