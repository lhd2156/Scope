import json
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from spots.models import Spot
from trips.models import Like


def make_png_upload(name='cover.png'):
    buffer = BytesIO()
    Image.new('RGB', (1, 1), color=(255, 255, 255)).save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


@pytest.mark.django_db
def test_private_legacy_create_spot(authenticated_client):
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
            'pillars': ['hidden-gem'],
            'vibe': 'chill',
            'rating': '4.5',
            'visited_at': '2026-03-20',
            'is_public': False,
        },
        format='json',
    )
    assert response.status_code == 201, response.json()
    assert response.json()['data']['title'] == 'Best Tacos in Fort Worth'
    assert response.json()['data']['isPublic'] is False
    assert Spot.objects.count() == 1


@pytest.mark.django_db
def test_private_legacy_create_entertainment_spot(authenticated_client):
    response = authenticated_client.post(
        '/api/content/spots/',
        {
            'title': 'Route Bowling Lanes',
            'description': 'Bowling stop for a family route',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'category': 'entertainment',
            'pillars': ['group-friendly'],
            'rating': '4.5',
            'visited_at': '2026-03-20',
            'is_public': False,
        },
        format='json',
    )

    assert response.status_code == 201, response.json()
    assert response.json()['data']['category'] == 'entertainment'
    assert Spot.objects.count() == 1


@pytest.mark.django_db
def test_public_legacy_create_requires_compose(authenticated_client):
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
            'pillars': ['hidden-gem'],
            'rating': '4.5',
            'visited_at': '2026-03-20',
            'is_public': True,
        },
        format='json',
    )

    assert response.status_code == 400
    assert Spot.objects.count() == 0


@pytest.mark.django_db
def test_compose_public_spot_requires_verified_place_and_photo(authenticated_client, monkeypatch):
    verification_payloads = []

    def fake_verify_spot_place(payload, authorization=''):
        verification_payloads.append(payload)
        return {
            'verified': True,
            'source': 'mapbox',
            'providerPlaceId': 'mapbox.place.1',
            'providerPlaceName': 'Best Tacos Taqueria',
            'providerPlaceAddress': '123 Main St, Fort Worth, TX 76102',
            'city': 'Provider Borough',
            'country': 'Provider Country',
            'postalCode': '99999',
            'distanceMeters': 24.0,
            'precision': 'poi',
            'candidates': [],
        }

    monkeypatch.setattr(
        'spots.views.verify_spot_place',
        fake_verify_spot_place,
    )

    class FakeStorage:
        def store(self, file):
            return {
                'storage_key': 'spots/test/photo.png',
                'storage_url': 'https://cdn.example/photo.png',
                'thumbnail_url': 'https://cdn.example/photo-thumb.png',
            }

    monkeypatch.setattr('spots.views.S3StorageService', lambda: FakeStorage())
    photo = make_png_upload()
    response = authenticated_client.post(
        '/api/content/spots/compose',
        {
            'spot': json.dumps(
                {
                    'title': 'Best Tacoz',
                    'description': 'Incredible street tacos',
                    'latitude': 32.7555,
                    'longitude': -97.3308,
                    'address': '123 Main St',
                    'city': 'Fort Worth',
                    'country': 'US',
                    'postalCode': '76102',
                    'category': 'food',
                    'pillars': ['hidden-gem', 'photo-worthy'],
                    'vibe': 'chill',
                    'rating': '4.5',
                    'visitedAt': '2026-03-20',
                    'providerPlaceId': 'mapbox.place.1',
                    'providerPlaceName': 'Best Tacos Taqueria',
                    'providerPlaceAddress': '123 Main St, Fort Worth, TX 76102',
                    'isPublic': True,
                }
            ),
            'photos': [photo],
            'captions': ['cover'],
        },
        format='multipart',
    )

    assert response.status_code == 201, response.json()
    body = response.json()['data']
    assert body['title'] == 'Best Tacoz'
    assert body['providerPlaceName'] == 'Best Tacos Taqueria'
    assert body['address'] == '123 Main St, Fort Worth, TX 76102'
    assert body['city'] == 'Fort Worth'
    assert body['country'] == 'US'
    assert body['postalCode'] == '76102'
    assert body['verificationStatus'] == 'verified'
    assert body['safetyStatus'] == 'clean'
    assert body['photos'][0]['storageUrl'] == 'https://cdn.example/photo.png'
    assert verification_payloads[0]['title'] == 'Best Tacos Taqueria'
    assert verification_payloads[0]['address'] == '123 Main St, Fort Worth, TX 76102'
    assert verification_payloads[0]['providerPlaceId'] == 'mapbox.place.1'


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
def test_saved_spots_returns_liked_places(authenticated_client, spot, auth_header):
    _, user_id = auth_header
    Like.objects.create(spot=spot, user_id=user_id)

    response = authenticated_client.get('/api/content/spots/saved')

    assert response.status_code == 200
    body = response.json()
    assert body['meta']['total'] == 1
    assert body['data'][0]['id'] == str(spot.id)
    assert body['data'][0]['liked'] is True


@pytest.mark.django_db
def test_spot_detail_includes_viewer_liked_state(authenticated_client, spot, auth_header):
    _, user_id = auth_header
    Like.objects.create(spot=spot, user_id=user_id)

    response = authenticated_client.get(f'/api/content/spots/{spot.id}')

    assert response.status_code == 200
    body = response.json()
    assert body['liked'] is True
    assert body['likes_count'] == 1


@pytest.mark.django_db
def test_like_endpoint_returns_refreshed_spot_detail(authenticated_client, spot):
    response = authenticated_client.post(f'/api/content/spots/{spot.id}/like')

    assert response.status_code == 201
    body = response.json()['data']
    assert body['id'] == str(spot.id)
    assert body['liked'] is True
    assert body['likes_count'] == 1


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
