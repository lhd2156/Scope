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
