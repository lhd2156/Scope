import pytest

from photos.models import Photo


@pytest.mark.django_db
def test_spot_photos_use_photo_contract(authenticated_client, auth_header, spot):
    _, user_id = auth_header
    Photo.objects.create(
        spot=spot,
        user_id=user_id,
        storage_key='photos/test.jpg',
        storage_url='https://example.com/photos/test.jpg',
        thumbnail_url='https://example.com/photos/test-thumb.jpg',
        caption='Trailhead view',
        sort_order=0,
    )

    response = authenticated_client.get(f'/api/content/spots/{spot.id}/photos')

    assert response.status_code == 200
    photo = response.json()['data'][0]
    assert photo['spotId'] == str(spot.id)
    assert photo['s3Url'] == 'https://example.com/photos/test.jpg'
    assert photo['thumbnailUrl'] == 'https://example.com/photos/test-thumb.jpg'
    assert photo['sortOrder'] == 0
    assert 'createdAt' in photo


@pytest.mark.django_db
def test_presigned_url_requires_auth(api_client):
    response = api_client.get('/api/content/photos/presigned-url')

    assert response.status_code == 401
