from __future__ import annotations

import uuid

import pytest

from spots.models import Spot
from spots.serializers import NearbyQuerySerializer

pytestmark = pytest.mark.django_db


def test_nearby_filter_uses_bounding_box_but_keeps_exact_distance_check():
    nearby_spot = Spot.objects.create(
        user_id=uuid.uuid4(),
        title='Nearby tacos',
        latitude=32.75,
        longitude=-97.33,
        category='food',
    )
    Spot.objects.create(
        user_id=uuid.uuid4(),
        title='Too far away',
        latitude=33.25,
        longitude=-97.33,
        category='food',
    )

    serializer = NearbyQuerySerializer(data={'lat': 32.75, 'lng': -97.33, 'radius': 5})
    assert serializer.is_valid(), serializer.errors

    queryset = serializer.filter_queryset(Spot.objects.all())

    assert list(queryset.values_list('id', flat=True)) == [nearby_spot.id]


def test_nearby_filter_handles_antimeridian_wrapping():
    east_spot = Spot.objects.create(
        user_id=uuid.uuid4(),
        title='East of the dateline',
        latitude=0.0,
        longitude=179.9,
        category='scenic',
    )
    west_spot = Spot.objects.create(
        user_id=uuid.uuid4(),
        title='West of the dateline',
        latitude=0.0,
        longitude=-179.9,
        category='scenic',
    )

    serializer = NearbyQuerySerializer(data={'lat': 0.0, 'lng': 179.95, 'radius': 20})
    assert serializer.is_valid(), serializer.errors

    queryset = serializer.filter_queryset(Spot.objects.all()).order_by('longitude')

    assert list(queryset.values_list('id', flat=True)) == [west_spot.id, east_spot.id]
