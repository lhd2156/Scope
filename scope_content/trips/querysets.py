from __future__ import annotations

from django.db.models import Prefetch, QuerySet

from trips.models import Trip, TripMember, TripSpot

TRIP_SPOT_PREFETCH = Prefetch(
    'trip_spots',
    queryset=TripSpot.objects.select_related('spot').only(
        'id',
        'trip_id',
        'spot_id',
        'day_number',
        'sort_order',
        'notes',
        'spot__id',
        'spot__title',
    ),
)
TRIP_MEMBER_PREFETCH = Prefetch(
    'members',
    queryset=TripMember.objects.only('id', 'trip_id', 'user_id', 'role', 'joined_at').order_by('joined_at'),
)


def with_trip_relations(queryset: QuerySet[Trip]) -> QuerySet[Trip]:
    return queryset.prefetch_related(TRIP_SPOT_PREFETCH, TRIP_MEMBER_PREFETCH)
