import pytest

from spots.models import Spot


@pytest.mark.django_db
def test_create_spot_uses_architecture_contract(authenticated_client):
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
            'rating': 4.5,
            'visitedAt': '2026-03-20',
            'isPublic': True,
        },
        format='json',
    )

    assert response.status_code == 201
    body = response.json()['data']
    assert body['title'] == 'Best Tacos in Fort Worth'
    assert body['isPublic'] is True
    assert body['visitedAt'] == '2026-03-20'
    assert 'createdAt' in body
    assert 'photoUrl' in body
    assert Spot.objects.count() == 1


@pytest.mark.django_db
def test_list_spots_returns_camel_case_fields(api_client, spot):
    response = api_client.get('/api/content/spots/')

    assert response.status_code == 200
    body = response.json()
    assert body['meta']['total'] == 1
    assert body['data'][0]['title'] == 'Fort Worth Tacos'
    assert 'createdAt' in body['data'][0]
    assert 'photoUrl' in body['data'][0]


@pytest.mark.django_db
def test_nearby_spots(api_client, spot):
    response = api_client.get('/api/content/spots/nearby', {'lat': 32.75, 'lng': -97.33, 'radius': 3})

    assert response.status_code == 200
    assert response.json()['meta']['total'] == 1


@pytest.mark.django_db
def test_private_spot_detail_is_hidden_from_anonymous(api_client, auth_header):
    _, user_id = auth_header
    private_spot = Spot.objects.create(
        user_id=user_id,
        title='Secret Campsite',
        latitude=32.75,
        longitude=-97.33,
        category='nature',
        is_public=False,
    )

    response = api_client.get(f'/api/content/spots/{private_spot.id}')

    assert response.status_code == 404


@pytest.mark.django_db
def test_owner_user_spots_includes_private_entries(authenticated_client, auth_header):
    _, user_id = auth_header
    Spot.objects.create(
        user_id=user_id,
        title='Secret Campsite',
        latitude=32.75,
        longitude=-97.33,
        category='nature',
        is_public=False,
    )

    response = authenticated_client.get(f'/api/content/spots/user/{user_id}')

    assert response.status_code == 200
    assert response.json()['meta']['total'] == 1
    assert response.json()['data'][0]['isPublic'] is False
