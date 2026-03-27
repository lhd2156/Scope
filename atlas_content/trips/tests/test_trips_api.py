from spots.models import Spot
from trips.models import TripMember, TripSpot

def test_create_trip(api_client, auth_header):
    headers, _ = auth_header
    response = api_client.post('/api/content/trips/', {'title': 'Road Trip', 'description': 'West loop', 'status': 'planning'}, format='json', **headers)
    assert response.status_code == 201
    assert response.json()['data']['title'] == 'Road Trip'

def test_add_member_and_spot(api_client, auth_header, trip):
    headers, user_id = auth_header
    spot = Spot.objects.create(user_id=user_id, title='Canyon', latitude=31.0, longitude=-97.0, category='nature')
    member_response = api_client.post(f'/api/content/trips/{trip.id}/members', {'user_id': '11111111-1111-1111-1111-111111111111', 'role': 'viewer'}, format='json', **headers)
    assert member_response.status_code == 201
    spot_response = api_client.post(f'/api/content/trips/{trip.id}/spots', {'spot_id': str(spot.id), 'day_number': 1, 'sort_order': 0}, format='json', **headers)
    assert spot_response.status_code == 201
    assert TripMember.objects.filter(trip=trip).count() == 2
    assert TripSpot.objects.filter(trip=trip).count() == 1

def test_reorder_trip_spots(api_client, auth_header, trip):
    headers, user_id = auth_header
    first = Spot.objects.create(user_id=user_id, title='A', latitude=31.0, longitude=-97.0, category='nature')
    second = Spot.objects.create(user_id=user_id, title='B', latitude=32.0, longitude=-98.0, category='nature')
    api_client.post(f'/api/content/trips/{trip.id}/spots', {'spot_id': str(first.id), 'day_number': 1, 'sort_order': 0}, format='json', **headers)
    api_client.post(f'/api/content/trips/{trip.id}/spots', {'spot_id': str(second.id), 'day_number': 1, 'sort_order': 1}, format='json', **headers)
    response = api_client.put(f'/api/content/trips/{trip.id}/spots/reorder', {'spots': [{'spotId': str(first.id), 'sortOrder': 2, 'dayNumber': 2}, {'spotId': str(second.id), 'sortOrder': 1, 'dayNumber': 2}]}, format='json', **headers)
    assert response.status_code == 200
    reordered = {str(item['spot']): item for item in response.json()['data']['spots']}
    assert reordered[str(first.id)]['day_number'] == 2
