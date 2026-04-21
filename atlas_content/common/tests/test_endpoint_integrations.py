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
from spots.models import Spot
from trips.models import TripSpot

pytestmark = pytest.mark.django_db


def _auth_client_for_user(user_id: str, roles: list[str] | None = None) -> APIClient:
    client = APIClient()
    token = jwt.encode(
        {
            'sub': user_id,
            'email': f'{user_id}@example.com',
            'name': 'Integration Tester',
            'roles': roles or ['user'],
            'iss': settings.JWT_ISSUER,
            'aud': settings.JWT_AUDIENCE,
            'exp': 4102444800,
        },
        settings.JWT_SECRET,
        algorithm='HS256',
    )
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


def _png_upload(name: str) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', (4, 4), color='purple').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def test_health_endpoint_returns_documented_contract(api_client):
    response = api_client.get('/api/content/health')

    assert response.status_code == 200
    assert set(response.json().keys()) == {'status', 'version', 'uptime'}
    assert response.json()['status'] == 'healthy'


def test_spot_read_endpoints_cover_detail_explore_user_and_photos(api_client, spot):
    photo = Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/test.png',
        storage_url='https://example.com/photos/test.png',
        thumbnail_url='https://example.com/photos/test_thumb.png',
        caption='Sunset tacos',
        sort_order=0,
    )

    detail_response = api_client.get(f'/api/content/spots/{spot.id}')
    explore_response = api_client.get('/api/content/spots/explore', {'category': 'food', 'city': 'Fort Worth'})
    user_response = api_client.get(f'/api/content/spots/user/{spot.user_id}')
    photos_response = api_client.get(f'/api/content/spots/{spot.id}/photos')
    missing_response = api_client.get(f'/api/content/spots/{uuid4()}')

    assert detail_response.status_code == 200
    assert detail_response.json()['id'] == str(spot.id)
    assert explore_response.status_code == 200
    assert explore_response.json()['meta']['total'] >= 1
    assert user_response.status_code == 200
    assert user_response.json()['data'][0]['id'] == str(spot.id)
    assert photos_response.status_code == 200
    assert photos_response.json()['data'][0]['id'] == str(photo.id)
    assert photos_response.json()['data'][0]['caption'] == 'Sunset tacos'
    assert missing_response.status_code == 404
    assert missing_response.json()['error']['code'] == 'NOT_FOUND'


def test_spot_write_endpoints_handle_happy_and_error_paths(authenticated_client, auth_header, api_client, spot):
    _, owner_user_id = auth_header
    outsider_client = _auth_client_for_user(str(uuid4()))

    like_response = authenticated_client.post(f'/api/content/spots/{spot.id}/like')
    unlike_response = authenticated_client.delete(f'/api/content/spots/{spot.id}/like')
    update_response = authenticated_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Updated Tacos',
            'description': 'Still great',
            'latitude': 32.75,
            'longitude': -97.33,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'lively',
            'rating': '4.0',
            'is_public': True,
        },
        format='json',
    )
    forbidden_update = outsider_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Hijacked',
            'description': 'Nope',
            'latitude': 32.75,
            'longitude': -97.33,
            'category': 'food',
            'is_public': True,
        },
        format='json',
    )
    invalid_nearby = api_client.get('/api/content/spots/nearby', {'lat': 999, 'lng': -97.33, 'radius': 3})
    missing_like = authenticated_client.post(f'/api/content/spots/{uuid4()}/like')
    delete_response = _auth_client_for_user(owner_user_id).delete(f'/api/content/spots/{spot.id}')

    assert like_response.status_code == 201
    assert like_response.json()['data']['liked'] is True
    assert unlike_response.status_code == 200
    assert unlike_response.json()['data']['liked'] is False
    assert update_response.status_code == 200
    assert update_response.json()['title'] == 'Updated Tacos'
    assert forbidden_update.status_code == 403
    assert forbidden_update.json()['error']['code'] == 'FORBIDDEN'
    assert forbidden_update.json()['error']['message'] == 'Insufficient permissions'
    assert invalid_nearby.status_code == 400
    assert invalid_nearby.json()['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'lat', 'message': 'Latitude out of range'} in invalid_nearby.json()['error']['details']
    assert missing_like.status_code == 404
    assert missing_like.json()['error']['code'] == 'NOT_FOUND'
    assert delete_response.status_code == 204
    assert not Spot.objects.filter(id=spot.id).exists()


def test_trip_read_endpoints_cover_list_public_and_detail(authenticated_client, auth_header, api_client, trip):
    _, owner_user_id = auth_header
    trip_spot = Spot.objects.create(user_id=owner_user_id, title='River Walk', latitude=29.42, longitude=-98.49, category='scenic')
    TripSpot.objects.create(trip=trip, spot=trip_spot, day_number=1, sort_order=0)

    list_response = authenticated_client.get('/api/content/trips/')
    public_response = api_client.get('/api/content/trips/public')
    detail_response = authenticated_client.get(f'/api/content/trips/{trip.id}')
    missing_response = authenticated_client.get(f'/api/content/trips/{uuid4()}')

    assert list_response.status_code == 200
    assert list_response.json()['meta']['total'] >= 1
    assert public_response.status_code == 200
    assert public_response.json()['meta']['total'] >= 1
    assert detail_response.status_code == 200
    assert detail_response.json()['id'] == str(trip.id)
    assert detail_response.json()['spots'][0]['spot'] == str(trip_spot.id)
    assert missing_response.status_code == 404
    assert missing_response.json()['error']['code'] == 'NOT_FOUND'


def test_trip_member_and_trip_mutation_endpoints_cover_happy_and_forbidden_paths(auth_header, trip):
    _, owner_user_id = auth_header
    owner_client = _auth_client_for_user(owner_user_id)
    outsider_client = _auth_client_for_user(str(uuid4()))
    invited_user_id = str(uuid4())

    update_response = owner_client.put(
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
    add_member_response = owner_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': invited_user_id, 'role': 'viewer'},
        format='json',
    )
    list_members_response = owner_client.get(f'/api/content/trips/{trip.id}/members')
    forbidden_members_response = outsider_client.get(f'/api/content/trips/{trip.id}/members')
    remove_member_response = owner_client.delete(f'/api/content/trips/{trip.id}/members/{invited_user_id}')
    forbidden_delete_response = outsider_client.delete(f'/api/content/trips/{trip.id}')
    delete_response = owner_client.delete(f'/api/content/trips/{trip.id}')

    assert update_response.status_code == 200
    assert update_response.json()['title'] == 'Updated Weekend'
    assert add_member_response.status_code == 201
    assert add_member_response.json()['data']['user_id'] == invited_user_id
    assert list_members_response.status_code == 200
    assert len(list_members_response.json()['data']) == 2
    assert forbidden_members_response.status_code == 403
    assert forbidden_members_response.json()['error']['code'] == 'FORBIDDEN'
    assert forbidden_members_response.json()['error']['message'] == 'Insufficient permissions'
    assert remove_member_response.status_code == 200
    assert remove_member_response.json()['data']['removed'] is True
    assert forbidden_delete_response.status_code == 403
    assert forbidden_delete_response.json()['error']['code'] == 'FORBIDDEN'
    assert forbidden_delete_response.json()['error']['message'] == 'Insufficient permissions'
    assert delete_response.status_code == 204


def test_trip_spot_mutation_endpoints_cover_happy_and_validation_paths(auth_header, trip):
    _, owner_user_id = auth_header
    owner_client = _auth_client_for_user(owner_user_id)
    outsider_client = _auth_client_for_user(str(uuid4()))
    first_spot = Spot.objects.create(user_id=owner_user_id, title='Coffee', latitude=32.78, longitude=-96.8, category='food')
    second_spot = Spot.objects.create(user_id=owner_user_id, title='Museum', latitude=32.79, longitude=-96.79, category='culture')

    add_first_response = owner_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(first_spot.id), 'day_number': 1, 'sort_order': 0},
        format='json',
    )
    add_second_response = owner_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(second_spot.id), 'day_number': 1, 'sort_order': 1},
        format='json',
    )
    invalid_add_response = owner_client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(uuid4()), 'day_number': 1, 'sort_order': 0},
        format='json',
    )
    reorder_response = owner_client.put(
        f'/api/content/trips/{trip.id}/spots/reorder',
        {
            'spots': [
                {'spotId': str(first_spot.id), 'sortOrder': 2, 'dayNumber': 2},
                {'spotId': str(second_spot.id), 'sortOrder': 1, 'dayNumber': 2},
            ]
        },
        format='json',
    )
    invalid_reorder_response = owner_client.put(
        f'/api/content/trips/{trip.id}/spots/reorder',
        {
            'spots': [
                {'spotId': str(first_spot.id), 'sortOrder': 0, 'dayNumber': 1},
                {'spotId': str(first_spot.id), 'sortOrder': 1, 'dayNumber': 1},
            ]
        },
        format='json',
    )
    forbidden_remove_response = outsider_client.delete(f'/api/content/trips/{trip.id}/spots/{first_spot.id}')
    remove_response = owner_client.delete(f'/api/content/trips/{trip.id}/spots/{first_spot.id}')

    assert add_first_response.status_code == 201
    assert add_second_response.status_code == 201
    assert invalid_add_response.status_code == 400
    assert invalid_add_response.json()['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'spot_id', 'message': 'Spot does not exist'} in invalid_add_response.json()['error']['details']
    assert reorder_response.status_code == 200
    reordered = {item['spot']: item for item in reorder_response.json()['data']['spots']}
    assert reordered[str(first_spot.id)]['day_number'] == 2
    assert invalid_reorder_response.status_code == 400
    assert invalid_reorder_response.json()['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'spots', 'message': 'Duplicate spotId entries are not allowed'} in invalid_reorder_response.json()['error']['details']
    assert forbidden_remove_response.status_code == 403
    assert forbidden_remove_response.json()['error']['code'] == 'FORBIDDEN'
    assert forbidden_remove_response.json()['error']['message'] == 'Insufficient permissions'
    assert remove_response.status_code == 200
    assert remove_response.json()['data']['removed'] is True


def test_photo_endpoints_cover_upload_presigned_update_delete_and_errors(auth_header, spot, monkeypatch):
    _, owner_user_id = auth_header
    owner_client = _auth_client_for_user(owner_user_id)
    outsider_client = _auth_client_for_user(str(uuid4()))

    monkeypatch.setattr(
        'photos.views.S3StorageService.store',
        lambda self, uploaded_file, prefix='photos': {
            'storage_key': f'{prefix}/integration.png',
            'storage_url': 'https://example.com/photos/integration.png',
            'thumbnail_url': 'https://example.com/photos/integration_thumb.png',
        },
    )
    monkeypatch.setattr(
        'photos.views.S3StorageService.presigned_upload_url',
        lambda self, key: f'https://example.com/presigned/{key}',
    )

    presigned_response = owner_client.get('/api/content/photos/presigned-url')
    upload_response = owner_client.post(
        '/api/content/photos/upload',
        {'spot_id': str(spot.id), 'file': _png_upload('integration.png'), 'caption': '  Great shot  '},
        format='multipart',
    )
    invalid_upload_response = owner_client.post(
        '/api/content/photos/upload',
        {'spot_id': str(spot.id), 'file': SimpleUploadedFile('bad.txt', b'hello', content_type='text/plain')},
        format='multipart',
    )

    photo_id = upload_response.json()['data']['id']
    update_response = owner_client.put(
        f'/api/content/photos/{photo_id}',
        {'caption': '  Updated caption  '},
        format='json',
    )
    forbidden_update_response = outsider_client.put(
        f'/api/content/photos/{photo_id}',
        {'caption': 'Nope'},
        format='json',
    )
    delete_response = owner_client.delete(f'/api/content/photos/{photo_id}')
    missing_response = owner_client.put(f'/api/content/photos/{uuid4()}', {'caption': 'Missing'}, format='json')

    assert presigned_response.status_code == 200
    assert presigned_response.json()['data']['enabled'] is True
    assert presigned_response.json()['data']['url'].startswith('https://example.com/presigned/')
    assert upload_response.status_code == 201
    assert upload_response.json()['data']['caption'] == 'Great shot'
    assert invalid_upload_response.status_code == 400
    assert invalid_upload_response.json()['error']['code'] == 'VALIDATION_ERROR'
    assert invalid_upload_response.json()['error']['details'][0]['field'] == 'file'
    assert update_response.status_code == 200
    assert update_response.json()['data']['caption'] == 'Updated caption'
    assert forbidden_update_response.status_code == 403
    assert forbidden_update_response.json()['error']['code'] == 'FORBIDDEN'
    assert forbidden_update_response.json()['error']['message'] == 'Insufficient permissions'
    assert delete_response.status_code == 200
    assert delete_response.json()['data']['deleted'] is True
    assert missing_response.status_code == 404
    assert missing_response.json()['error']['code'] == 'NOT_FOUND'


def test_review_endpoints_cover_create_list_update_delete_and_errors(auth_header, spot):
    _, owner_user_id = auth_header
    owner_client = _auth_client_for_user(owner_user_id)
    outsider_client = _auth_client_for_user(str(uuid4()))

    create_response = owner_client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '4.5', 'comment': '  Great visit  '},
        format='json',
    )
    update_via_create_response = owner_client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '4.0', 'comment': '  Updated review  '},
        format='json',
    )
    list_response = owner_client.get(f'/api/content/reviews/spot/{spot.id}')
    review_id = create_response.json()['data']['id']
    detail_update_response = owner_client.put(
        f'/api/content/reviews/{review_id}',
        {'comment': '  Edited comment  '},
        format='json',
    )
    forbidden_update_response = outsider_client.put(
        f'/api/content/reviews/{review_id}',
        {'comment': 'Hijack'},
        format='json',
    )
    invalid_create_response = outsider_client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '6.0', 'comment': 'Too high'},
        format='json',
    )
    delete_response = owner_client.delete(f'/api/content/reviews/{review_id}')
    missing_response = owner_client.put(f'/api/content/reviews/{uuid4()}', {'comment': 'Missing'}, format='json')

    assert create_response.status_code == 201
    assert create_response.json()['data']['comment'] == 'Great visit'
    assert update_via_create_response.status_code == 200
    assert update_via_create_response.json()['data']['rating'] == '4.0'
    assert list_response.status_code == 200
    assert len(list_response.json()['data']) == 1
    assert detail_update_response.status_code == 200
    assert detail_update_response.json()['data']['comment'] == 'Edited comment'
    assert forbidden_update_response.status_code == 403
    assert forbidden_update_response.json()['error']['code'] == 'FORBIDDEN'
    assert forbidden_update_response.json()['error']['message'] == 'Insufficient permissions'
    assert invalid_create_response.status_code == 400
    assert invalid_create_response.json()['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'rating', 'message': 'Ensure this value is less than or equal to 5.0.'} in invalid_create_response.json()['error']['details']
    assert delete_response.status_code == 200
    assert delete_response.json()['data']['deleted'] is True
    assert missing_response.status_code == 404
    assert missing_response.json()['error']['code'] == 'NOT_FOUND'


def test_feed_endpoints_cover_social_and_trending_happy_paths(authenticated_client, auth_header, spot, trip):
    _, owner_user_id = auth_header
    second_spot = Spot.objects.create(
        user_id=owner_user_id,
        title='Skyline View',
        latitude=32.78,
        longitude=-96.8,
        city='Dallas',
        country='US',
        category='scenic',
        vibe='calm',
        is_public=True,
    )
    TripSpot.objects.create(trip=trip, spot=second_spot, day_number=1, sort_order=0)

    social_response = authenticated_client.get('/api/content/feed/')
    trending_response = authenticated_client.get('/api/content/feed/trending')

    assert social_response.status_code == 200
    assert len(social_response.json()['data']) >= 2
    assert {item['type'] for item in social_response.json()['data']} >= {'spot', 'trip'}
    assert 'nextCursor' in social_response.json()['meta']
    assert trending_response.status_code == 200
    assert len(trending_response.json()['data']) >= 1
    assert {item['id'] for item in trending_response.json()['data']} >= {str(spot.id), str(second_spot.id)}
