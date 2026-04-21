from __future__ import annotations

import pytest

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
            'isPublic': True,
        },
        format='json',
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body.keys()) == {'data'}

    spot = body['data']
    assert set(spot.keys()) == {'id', 'title', 'latitude', 'longitude', 'category', 'rating', 'createdAt'}
    assert spot['title'] == 'Best Tacos in Fort Worth'
    assert spot['latitude'] == 32.7555
    assert spot['longitude'] == -97.3308
    assert spot['category'] == 'food'
    assert spot['rating'] == 4.5
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
    assert set(spot_item.keys()) == {'id', 'title', 'latitude', 'longitude', 'category', 'rating', 'photoUrl', 'createdAt'}
    assert spot_item['id'] == str(spot.id)
    assert spot_item['title'] == 'Fort Worth Tacos'
    assert spot_item['latitude'] == 32.75
    assert spot_item['longitude'] == -97.33
    assert spot_item['category'] == 'food'
    assert spot_item['rating'] == 4.5
    assert spot_item['photoUrl'] == 'https://example.com/photos/test_thumb.png'
    assert spot_item['createdAt'].endswith('Z')

    assert body['meta'] == {
        'page': 1,
        'pageSize': 20,
        'total': 1,
        'totalPages': 1,
    }
