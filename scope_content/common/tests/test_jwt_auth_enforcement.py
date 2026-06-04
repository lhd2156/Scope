from __future__ import annotations

from io import BytesIO
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from photos.models import Photo
from reviews.models import Review


@pytest.fixture
def photo(spot):
    return Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/test.png',
        storage_url='https://example.com/photos/test.png',
        thumbnail_url='https://example.com/photos/test_thumb.png',
        caption='Test photo',
        sort_order=0,
    )


@pytest.fixture
def review(spot):
    return Review.objects.create(spot=spot, user_id=spot.user_id, rating='4.0', comment='Great spot')


def _image_upload(name: str) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new('RGB', (2, 2), color='orange').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


PROTECTED_CASES = [
    ('post', lambda ctx: '/api/content/spots/', lambda ctx: {'title': 'New Spot', 'latitude': 32.75, 'longitude': -97.33, 'category': 'food'}, 'json'),
    ('put', lambda ctx: f"/api/content/spots/{ctx['spot'].id}", lambda ctx: {'title': 'Updated Spot', 'latitude': 32.75, 'longitude': -97.33, 'category': 'food'}, 'json'),
    ('delete', lambda ctx: f"/api/content/spots/{ctx['spot'].id}", lambda ctx: None, None),
    ('post', lambda ctx: f"/api/content/spots/{ctx['spot'].id}/like", lambda ctx: None, None),
    ('delete', lambda ctx: f"/api/content/spots/{ctx['spot'].id}/like", lambda ctx: None, None),
    ('get', lambda ctx: '/api/content/trips/', lambda ctx: None, None),
    ('post', lambda ctx: '/api/content/trips/', lambda ctx: {'title': 'Weekend Trip', 'status': 'planning'}, 'json'),
    ('put', lambda ctx: f"/api/content/trips/{ctx['trip'].id}", lambda ctx: {'title': 'Updated Trip', 'status': 'planning'}, 'json'),
    ('delete', lambda ctx: f"/api/content/trips/{ctx['trip'].id}", lambda ctx: None, None),
    ('post', lambda ctx: f"/api/content/trips/{ctx['trip'].id}/spots", lambda ctx: {'spot_id': str(ctx['spot'].id), 'day_number': 1, 'sort_order': 0}, 'json'),
    ('delete', lambda ctx: f"/api/content/trips/{ctx['trip'].id}/spots/{ctx['spot'].id}", lambda ctx: None, None),
    ('put', lambda ctx: f"/api/content/trips/{ctx['trip'].id}/spots/reorder", lambda ctx: {'spots': [{'spotId': str(ctx['spot'].id), 'sortOrder': 0, 'dayNumber': 1}]}, 'json'),
    ('get', lambda ctx: f"/api/content/trips/{ctx['trip'].id}/members", lambda ctx: None, None),
    ('post', lambda ctx: f"/api/content/trips/{ctx['trip'].id}/members", lambda ctx: {'user_id': str(uuid4()), 'role': 'viewer'}, 'json'),
    ('delete', lambda ctx: f"/api/content/trips/{ctx['trip'].id}/members/{uuid4()}", lambda ctx: None, None),
    ('post', lambda ctx: '/api/content/photos/upload', lambda ctx: {'spot_id': str(ctx['spot'].id), 'file': _image_upload('upload.png')}, None),
    ('get', lambda ctx: '/api/content/photos/presigned-url', lambda ctx: None, None),
    ('put', lambda ctx: f"/api/content/photos/{ctx['photo'].id}", lambda ctx: {'caption': 'Updated caption'}, 'json'),
    ('delete', lambda ctx: f"/api/content/photos/{ctx['photo'].id}", lambda ctx: None, None),
    ('post', lambda ctx: f"/api/content/reviews/spot/{ctx['spot'].id}", lambda ctx: {'rating': '4.5', 'comment': 'Nice'}, 'json'),
    ('put', lambda ctx: f"/api/content/reviews/{ctx['review'].id}", lambda ctx: {'comment': 'Updated'}, 'json'),
    ('delete', lambda ctx: f"/api/content/reviews/{ctx['review'].id}", lambda ctx: None, None),
    ('get', lambda ctx: '/api/content/feed/', lambda ctx: None, None),
    ('post', lambda ctx: '/api/content/interactions/', lambda ctx: {'spotId': str(ctx['spot'].id), 'interactionType': 'view', 'context': {'surface': 'test'}}, 'json'),
]

PUBLIC_CASES = [
    ('get', '/api/content/spots/'),
    ('get', '/api/content/spots/explore'),
    ('get', '/api/content/trips/public'),
    ('get', '/api/content/reviews/spot/{spot_id}'),
    ('get', '/api/content/feed/trending'),
]


@pytest.mark.django_db
@pytest.mark.parametrize(('method', 'url_factory', 'data_factory', 'format_name'), PROTECTED_CASES)
def test_protected_content_endpoints_require_authentication(api_client, spot, trip, photo, review, method, url_factory, data_factory, format_name):
    context = {'spot': spot, 'trip': trip, 'photo': photo, 'review': review}
    request_callable = getattr(api_client, method)
    response = request_callable(url_factory(context), data=data_factory(context), format=format_name)

    assert response.status_code == 401
    assert response.json()['error']['code'] == 'UNAUTHORIZED'


@pytest.mark.django_db
@pytest.mark.parametrize('method,path', PUBLIC_CASES)
def test_public_content_endpoints_remain_accessible(api_client, spot, method, path):
    resolved_path = path.format(spot_id=spot.id)
    response = getattr(api_client, method)(resolved_path)

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize('path', ['/api/content/spots/', '/api/content/trips/', '/api/content/feed/'])
def test_invalid_bearer_token_is_rejected(api_client, path):
    api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid.jwt.value')

    if path == '/api/content/spots/':
        response = api_client.post(path, {'title': 'X', 'latitude': 32.75, 'longitude': -97.33, 'category': 'food'}, format='json')
    else:
        response = api_client.get(path)

    assert response.status_code == 401
    assert response.json()['error']['code'] == 'UNAUTHORIZED'
