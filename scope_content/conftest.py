import uuid

import jwt
import pytest
from django.conf import settings
from django.core.cache import cache
from rest_framework.test import APIClient

from common.middleware.rate_limit import _FALLBACK_BUCKETS
from spots.models import Spot
from trips.models import Trip, TripMember


@pytest.fixture(autouse=True)
def clear_shared_state_between_tests():
    _FALLBACK_BUCKETS.clear()
    cache.clear()
    yield
    _FALLBACK_BUCKETS.clear()
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_header():
    user_id = str(uuid.uuid4())
    token = jwt.encode(
        {
            'sub': user_id,
            'email': 'test@example.com',
            'name': 'Tester',
            'roles': ['user'],
            'iss': settings.JWT_ISSUER,
            'aud': settings.JWT_AUDIENCE,
            'exp': 4102444800,
        },
        settings.JWT_SECRET,
        algorithm='HS256',
    )
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}, user_id


@pytest.fixture
def authenticated_client(api_client, auth_header):
    headers, _ = auth_header
    api_client.credentials(HTTP_AUTHORIZATION=headers['HTTP_AUTHORIZATION'])
    return api_client


@pytest.fixture
def spot(db, auth_header):
    _, user_id = auth_header
    return Spot.objects.create(
        user_id=user_id,
        title='Fort Worth Tacos',
        description='Great tacos',
        latitude=32.75,
        longitude=-97.33,
        city='Fort Worth',
        country='US',
        category='food',
        vibe='chill',
        rating=4.5,
    )


@pytest.fixture
def trip(db, auth_header):
    _, user_id = auth_header
    trip = Trip.objects.create(creator_id=user_id, title='Weekend', status='planning')
    TripMember.objects.create(trip=trip, user_id=user_id, role='owner')
    return trip
