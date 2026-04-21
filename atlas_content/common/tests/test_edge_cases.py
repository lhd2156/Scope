from __future__ import annotations

from io import BytesIO
from uuid import uuid4

import jwt
import pytest
from django.conf import settings
from PIL import Image
from rest_framework.test import APIClient

from reviews.models import Review
from spots.models import Spot
from trips.models import Like, TripMember, TripSpot

pytestmark = pytest.mark.django_db


def _auth_client_for_user(user_id: str, roles: list[str] | None = None) -> APIClient:
    client = APIClient()
    token = jwt.encode(
        {
            'sub': user_id,
            'email': f'{user_id}@example.com',
            'name': 'Edge Tester',
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


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new('RGB', (4, 4), color='navy').save(buffer, format='PNG')
    return buffer.getvalue()


@pytest.mark.parametrize(
    ('path', 'payload', 'expected_fields'),
    [
        ('/api/content/spots/', {}, {'title', 'latitude', 'longitude', 'category'}),
        ('/api/content/trips/', {}, {'title'}),
        ('/api/content/photos/upload', {}, {'spot_id', 'file'}),
        ('/api/content/reviews/spot/{spot_id}', {}, {'rating'}),
    ],
)
def test_empty_input_payloads_return_validation_errors(auth_header, spot, path, payload, expected_fields):
    _, owner_user_id = auth_header
    client = _auth_client_for_user(owner_user_id)
    resolved_path = path.format(spot_id=spot.id)
    request_format = 'multipart' if 'photos/upload' in resolved_path else 'json'

    response = client.post(resolved_path, payload, format=request_format)

    assert response.status_code == 400
    assert response.json()['error']['code'] == 'VALIDATION_ERROR'
    returned_fields = {detail['field'] for detail in response.json()['error']['details']}
    assert expected_fields.issubset(returned_fields)


@pytest.mark.parametrize(
    ('method', 'path', 'payload', 'request_format'),
    [
        ('post', '/api/content/trips/', {}, 'json'),
        ('post', '/api/content/photos/upload', {}, 'multipart'),
        ('post', '/api/content/reviews/spot/{spot_id}', {'rating': '4.0'}, 'json'),
    ],
)
def test_unauthorized_requests_fail_before_payload_validation(api_client, spot, method, path, payload, request_format):
    resolved_path = path.format(spot_id=spot.id)
    response = getattr(api_client, method)(resolved_path, payload, format=request_format)

    assert response.status_code == 401
    assert response.json()['error']['code'] == 'UNAUTHORIZED'



def test_duplicate_mutations_are_idempotent_and_update_existing_records(auth_header, spot, trip):
    _, owner_user_id = auth_header
    client = _auth_client_for_user(owner_user_id)
    invited_user_id = str(uuid4())
    trip_spot = Spot.objects.create(
        user_id=owner_user_id,
        title='Edge Museum',
        latitude=32.79,
        longitude=-96.8,
        category='culture',
    )

    first_like = client.post(f'/api/content/spots/{spot.id}/like')
    second_like = client.post(f'/api/content/spots/{spot.id}/like')

    first_member = client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': invited_user_id, 'role': 'viewer'},
        format='json',
    )
    second_member = client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': invited_user_id, 'role': 'editor'},
        format='json',
    )

    first_trip_spot = client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(trip_spot.id), 'day_number': 1, 'sort_order': 0, 'notes': 'Start'},
        format='json',
    )
    second_trip_spot = client.post(
        f'/api/content/trips/{trip.id}/spots',
        {'spot_id': str(trip_spot.id), 'day_number': 2, 'sort_order': 3, 'notes': 'Updated'},
        format='json',
    )

    first_review = client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '4.5', 'comment': 'First pass'},
        format='json',
    )
    second_review = client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '4.0', 'comment': 'Updated pass'},
        format='json',
    )

    assert first_like.status_code == 201
    assert second_like.status_code == 200
    assert Like.objects.filter(spot=spot, user_id=owner_user_id).count() == 1

    assert first_member.status_code == 201
    assert second_member.status_code == 200
    assert TripMember.objects.filter(trip=trip, user_id=invited_user_id).count() == 1
    assert TripMember.objects.get(trip=trip, user_id=invited_user_id).role == 'editor'

    assert first_trip_spot.status_code == 201
    assert second_trip_spot.status_code == 200
    assert TripSpot.objects.filter(trip=trip, spot=trip_spot).count() == 1
    updated_trip_spot = TripSpot.objects.get(trip=trip, spot=trip_spot)
    assert updated_trip_spot.day_number == 2
    assert updated_trip_spot.sort_order == 3
    assert updated_trip_spot.notes == 'Updated'

    assert first_review.status_code == 201
    assert second_review.status_code == 200
    assert Review.objects.filter(spot=spot, user_id=owner_user_id).count() == 1
    updated_review = Review.objects.get(spot=spot, user_id=owner_user_id)
    assert str(updated_review.rating) == '4.0'
    assert updated_review.comment == 'Updated pass'



def test_not_found_and_malformed_cursor_edges_return_standard_error_envelope(auth_header, spot):
    _, owner_user_id = auth_header
    client = _auth_client_for_user(owner_user_id)

    missing_photo_response = client.delete(f'/api/content/photos/{uuid4()}')
    malformed_cursor_response = client.get('/api/content/feed/', {'cursor': 'not-a-timestamp'})
    empty_nearby_response = client.get('/api/content/spots/nearby')

    assert missing_photo_response.status_code == 404
    assert missing_photo_response.json()['error']['code'] == 'NOT_FOUND'

    assert malformed_cursor_response.status_code == 400
    assert malformed_cursor_response.json()['error']['code'] == 'VALIDATION_ERROR'
    assert {
        'field': 'cursor',
        'message': 'Cursor must be a valid ISO-8601 timestamp',
    } in malformed_cursor_response.json()['error']['details']

    assert empty_nearby_response.status_code == 400
    assert empty_nearby_response.json()['error']['code'] == 'VALIDATION_ERROR'
    nearby_fields = {detail['field'] for detail in empty_nearby_response.json()['error']['details']}
    assert {'lat', 'lng'}.issubset(nearby_fields)
