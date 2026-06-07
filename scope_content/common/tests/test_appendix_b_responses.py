from __future__ import annotations

import pytest
from django.test import override_settings

from photos.models import Photo

pytestmark = pytest.mark.django_db


def test_post_spots_response_matches_appendix_b_exact_shape(authenticated_client):
    response = authenticated_client.post(
        '/api/content/spots/',
        {
            'title': 'Best Tacos in Fort Worth',
            'description': 'Incredible street tacos...',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'chill',
            'rating': 4.5,
            'visitedAt': '2026-03-20',
            'isPublic': False,
        },
        format='json',
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body.keys()) == {'data'}

    spot = body['data']
    assert set(spot.keys()) == {
        'id',
        'title',
        'latitude',
        'longitude',
        'category',
        'pillars',
        'rating',
        'isPublic',
        'verificationStatus',
        'safetyStatus',
        'createdAt',
    }
    assert spot['title'] == 'Best Tacos in Fort Worth'
    assert spot['latitude'] == 32.7555
    assert spot['longitude'] == -97.3308
    assert spot['category'] == 'food'
    assert spot['rating'] == 4.5
    assert spot['isPublic'] is False
    assert spot['verificationStatus'] == 'unverified'
    assert spot['safetyStatus'] == 'clean'
    assert spot['createdAt'].endswith('Z')


def test_get_spots_response_matches_appendix_b_exact_shape(api_client, spot):
    Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/test.png',
        storage_url='https://example.com/photos/test.png',
        thumbnail_url='https://example.com/photos/test_thumb.png',
        caption='Sunset tacos',
        sort_order=0,
    )

    response = api_client.get('/api/content/spots/')

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {'data', 'meta'}
    assert len(body['data']) == 1

    spot_item = body['data'][0]
    assert set(spot_item.keys()) == {
        'id',
        'title',
        'latitude',
        'longitude',
        'address',
        'city',
        'country',
        'category',
        'pillars',
        'vibe',
        'rating',
        'photoUrl',
        'isPublic',
        'verificationStatus',
        'safetyStatus',
        'createdAt',
    }
    assert spot_item['id'] == str(spot.id)
    assert spot_item['title'] == 'Fort Worth Tacos'
    assert spot_item['latitude'] == 32.75
    assert spot_item['longitude'] == -97.33
    assert spot_item['address'] == spot.address
    assert spot_item['city'] == spot.city
    assert spot_item['country'] == spot.country
    assert spot_item['category'] == 'food'
    assert spot_item['vibe'] == spot.vibe
    assert spot_item['rating'] == 4.5
    assert spot_item['photoUrl'] == 'https://example.com/photos/test_thumb.png'
    assert spot_item['isPublic'] is True
    assert spot_item['verificationStatus'] == 'unverified'
    assert spot_item['safetyStatus'] == 'clean'
    assert spot_item['createdAt'].endswith('Z')

    assert body['meta'] == {
        'page': 1,
        'pageSize': 20,
        'total': 1,
        'totalPages': 1,
    }


@override_settings(
    AWS_STORAGE_BUCKET_NAME='scope-bucket',
    AWS_ACCESS_KEY_ID='test-key',
    AWS_SECRET_ACCESS_KEY='test-secret',
    AWS_REGION='us-east-1',
)
def test_get_spots_proxies_private_s3_photos_through_content_api(api_client, spot, monkeypatch):
    photo = Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/private.png',
        storage_url='https://scope-bucket.s3.us-east-1.amazonaws.com/photos/private.png',
        thumbnail_url='https://scope-bucket.s3.us-east-1.amazonaws.com/photos/private_thumb.png',
        caption='Private bucket photo',
        sort_order=0,
    )
    monkeypatch.setattr('photos.delivery.S3StorageService', lambda: object())

    response = api_client.get('/api/content/spots/')

    assert response.status_code == 200
    assert response.json()['data'][0]['photoUrl'] == (
        f'http://testserver/api/content/photos/{photo.id}/content?variant=thumbnail'
    )


@override_settings(AWS_STORAGE_BUCKET_NAME='', AWS_ACCESS_KEY_ID='', AWS_SECRET_ACCESS_KEY='')
def test_public_photo_content_streams_managed_bytes(api_client, spot, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    storage_path = tmp_path / 'photos' / 'streamed.png'
    storage_path.parent.mkdir(parents=True)
    storage_path.write_bytes(b'\x89PNG\r\n\x1a\nscope')
    photo = Photo.objects.create(
        spot=spot,
        user_id=spot.user_id,
        storage_key='photos/streamed.png',
        storage_url='/media/photos/streamed.png',
        thumbnail_url='',
        caption='Streamed photo',
        sort_order=0,
    )

    response = api_client.get(f'/api/content/photos/{photo.id}/content')

    assert response.status_code == 200
    assert response.content == b'\x89PNG\r\n\x1a\nscope'
    assert response['Content-Type'] == 'image/png'
