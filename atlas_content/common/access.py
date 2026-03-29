from __future__ import annotations

from spots.models import Spot
from trips.models import Trip, TripMember


def is_authenticated(user) -> bool:
    return bool(getattr(user, 'is_authenticated', False))


def is_admin(user) -> bool:
    return bool(getattr(user, 'is_admin', False))


def can_view_spot(user, spot: Spot) -> bool:
    return bool(spot.is_public or str(spot.user_id) == str(getattr(user, 'id', '')) or is_admin(user))


def has_trip_membership(user, trip: Trip) -> bool:
    if not is_authenticated(user):
        return False
    return TripMember.objects.filter(trip=trip, user_id=user.id).exists()


def can_manage_trip(user, trip: Trip) -> bool:
    if not is_authenticated(user):
        return False
    if str(trip.creator_id) == str(user.id) or is_admin(user):
        return True
    return TripMember.objects.filter(trip=trip, user_id=user.id, role__in=['owner', 'editor']).exists()


def can_view_trip(user, trip: Trip) -> bool:
    return bool(trip.is_public or can_manage_trip(user, trip) or has_trip_membership(user, trip))
