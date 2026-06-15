from __future__ import annotations

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes

from common.cache_utils import FEED_CACHE_NAMESPACE, cached_api_response
from common.pagination import FeedCursorPagination
from common.permissions import IsAuthenticatedJWT
from common.user_profiles import (
    anonymous_user_profile,
    default_user_profile,
    normalize_user_key,
    resolve_user_profiles,
)
from common.responses import data_response
from feed.services.feed_aggregator import FeedAggregator
from spots.serializers import SpotSerializer
from trips.serializers import TripSerializer

def _collect_feed_user_ids(entries) -> set[object]:
    user_ids = set()
    for entry in entries:
        if entry.type == 'spot':
            user_ids.add(entry.item.user_id)
        elif entry.type == 'trip':
            user_ids.add(entry.item.creator_id)
        elif entry.type == 'review':
            if not getattr(entry.item, 'is_anonymous', False):
                user_ids.add(entry.item.user_id)
    return user_ids


def _actor_for(actor_profiles: dict[str, dict], user_id) -> dict:
    return actor_profiles.get(normalize_user_key(user_id), default_user_profile(user_id))


def _anonymous_actor_profile() -> dict:
    return anonymous_user_profile()


def _isoformat(value) -> str:
    return value.isoformat().replace('+00:00', 'Z')


def _serialize_spot_feed_entry(entry, actor_profiles: dict[str, dict], request=None) -> dict:
    spot = entry.item
    spot_data = SpotSerializer(spot, context={'request': request}).data
    actor = _actor_for(actor_profiles, spot.user_id)
    return {
        'id': f'spot-{spot.id}',
        'type': 'spot',
        'actor': actor,
        'title': f'{actor["displayName"]} pinned {spot.title}',
        'excerpt': spot.description or f'{spot.category.title()} spot in {spot.city or "the Scope map"}',
        'createdAt': _isoformat(entry.created_at),
        'imageUrl': spot_data.get('photo_url'),
        'targetId': str(spot.id),
    }


def _serialize_trip_feed_entry(entry, actor_profiles: dict[str, dict]) -> dict:
    trip = entry.item
    trip_data = TripSerializer(trip).data
    actor = _actor_for(actor_profiles, trip.creator_id)
    return {
        'id': f'trip-{trip.id}',
        'type': 'trip',
        'actor': actor,
        'title': f'{actor["displayName"]} planned {trip.title}',
        'excerpt': trip.description or f'{trip.destination or "Scope"} route with saved stops and timing.',
        'createdAt': _isoformat(entry.created_at),
        'imageUrl': trip_data.get('cover_photo_url'),
        'targetId': str(trip.id),
    }


def _serialize_review_feed_entry(entry, actor_profiles: dict[str, dict], request=None) -> dict:
    review = entry.item
    spot = review.spot
    spot_data = SpotSerializer(spot, context={'request': request}).data
    actor = _anonymous_actor_profile() if getattr(review, 'is_anonymous', False) else _actor_for(actor_profiles, review.user_id)
    rating = str(review.rating).rstrip('0').rstrip('.')
    return {
        'id': f'review-{review.id}',
        'type': 'review',
        'actor': actor,
        'title': f'{actor["displayName"]} reviewed {spot.title}',
        'excerpt': f'{rating}/5: {review.comment}' if review.comment else f'{rating}/5 rating for {spot.title}',
        'createdAt': _isoformat(entry.created_at),
        'imageUrl': spot_data.get('photo_url'),
        'targetId': str(spot.id),
    }


def _serialize_feed_entry(entry, actor_profiles: dict[str, dict], request=None) -> dict:
    if entry.type == 'trip':
        return _serialize_trip_feed_entry(entry, actor_profiles)
    if entry.type == 'review':
        return _serialize_review_feed_entry(entry, actor_profiles, request)
    return _serialize_spot_feed_entry(entry, actor_profiles, request)


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def social_feed(request):
    def build_response():
        paginator = FeedCursorPagination()
        cursor = paginator.parse_cursor(request)
        page = FeedAggregator().social_feed_page(
            cursor=cursor,
            user_id=getattr(getattr(request, 'user', None), 'id', None),
            page_size=paginator.page_size,
        )
        paginator.set_page_state(page.entries, page.has_more)
        actor_profiles = resolve_user_profiles(_collect_feed_user_ids(page.entries), request=request)
        serialized_page = [_serialize_feed_entry(entry, actor_profiles, request) for entry in page.entries]
        return paginator.get_paginated_response(serialized_page)

    return cached_api_response(
        request,
        FEED_CACHE_NAMESPACE,
        settings.CACHE_FEED_TIMEOUT_SECONDS,
        build_response,
        extra='feed-social',
    )


@api_view(['GET'])
def trending_spots(request):
    def build_response():
        spots = FeedAggregator().trending_spots_queryset()[:20]
        return data_response(SpotSerializer(spots, many=True, context={'request': request}).data)

    return cached_api_response(
        request,
        FEED_CACHE_NAMESPACE,
        settings.CACHE_FEED_TIMEOUT_SECONDS,
        build_response,
        extra='feed-trending',
    )
