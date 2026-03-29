import pytest

from spots.models import Spot


@pytest.mark.django_db
def test_create_spot(authenticated_client):
    response = authenticated_client.post(
        '/api/content/spots/',
        {
            'title': 'Best Tacos in Fort Worth',
            'description': 'Incredible street tacos',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'chill',
            'rating': '4.5',
            'visited_at': '2026-03-20',
            'is_public': True,
        },
        format='json',
    )
    assert response.status_code == 201
    assert response.json()['data']['title'] == 'Best Tacos in Fort Worth'
    assert Spot.objects.count() == 1


@pytest.mark.django_db
def test_list_spots(api_client, spot):
    response = api_client.get('/api/content/spots/')
    assert response.status_code == 200
    body = response.json()
    assert body['meta']['total'] == 1
    assert body['data'][0]['title'] == 'Fort Worth Tacos'


@pytest.mark.django_db
def test_nearby_spots(api_client, spot):
    response = api_client.get('/api/content/spots/nearby', {'lat': 32.75, 'lng': -97.33, 'radius': 3})
    assert response.status_code == 200
    assert response.json()['meta']['total'] == 1


@pytest.mark.django_db
def test_spot_detail_etag_returns_304_until_payload_changes(api_client, authenticated_client, spot):
    first_response = api_client.get(f'/api/content/spots/{spot.id}')

    assert first_response.status_code == 200
    assert first_response['ETag']
    assert 'private' in first_response['Cache-Control']
    assert 'no-cache' in first_response['Cache-Control']
    assert 'Authorization' in first_response['Vary']

    not_modified_response = api_client.get(
        f'/api/content/spots/{spot.id}',
        HTTP_IF_NONE_MATCH=first_response['ETag'],
    )

    assert not_modified_response.status_code == 304
    assert not_modified_response.content == b''
    assert not_modified_response['ETag'] == first_response['ETag']

    update_response = authenticated_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Updated Fort Worth Tacos',
            'description': 'Even better tacos',
            'latitude': 32.75,
            'longitude': -97.33,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'chill',
            'rating': '4.7',
            'is_public': True,
        },
        format='json',
    )
    refreshed_response = api_client.get(
        f'/api/content/spots/{spot.id}',
        HTTP_IF_NONE_MATCH=first_response['ETag'],
    )

    assert update_response.status_code == 200
    assert refreshed_response.status_code == 200
    assert refreshed_response['ETag'] != first_response['ETag']
    assert refreshed_response.json()['title'] == 'Updated Fort Worth Tacos'
