from __future__ import annotations

from uuid import UUID

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes

from common.cache_utils import FEED_CACHE_NAMESPACE, cached_api_response
from common.pagination import FeedCursorPagination
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from feed.services.feed_aggregator import FeedAggregator
from spots.serializers import SpotSerializer
from trips.serializers import TripSerializer

SHOWCASE_USER_PROFILES = {
    '11111111111111111111111111111111': {
        'username': 'alex.morgan',
        'email': '',
        'displayName': 'Alex Morgan',
        'avatarUrl': 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for food-first city routes, late dinners, and walkable culture loops.',
        'homeBase': 'Fort Worth, TX',
        'interests': ['food', 'culture', 'nightlife'],
    },
    '22222222222222222222222222222222': {
        'username': 'maya.chen',
        'email': '',
        'displayName': 'Maya Chen',
        'avatarUrl': 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for gardens, museums, and design-forward weekend pacing.',
        'homeBase': 'Dallas, TX',
        'interests': ['scenic', 'culture', 'shopping'],
    },
    '33333333333333333333333333333333': {
        'username': 'elijah.brooks',
        'email': '',
        'displayName': 'Elijah Brooks',
        'avatarUrl': 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for outdoor resets, strong coffee, and high-energy city walks.',
        'homeBase': 'Austin, TX',
        'interests': ['adventure', 'food', 'nature'],
    },
    '44444444444444444444444444444441': {
        'username': 'sofia.ramirez',
        'email': '',
        'displayName': 'Sofia Ramirez',
        'avatarUrl': 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for market mornings, heritage districts, and food-led itineraries.',
        'homeBase': 'San Antonio, TX',
        'interests': ['food', 'culture', 'shopping'],
    },
    '55555555555555555555555555555551': {
        'username': 'jordan.reed',
        'email': '',
        'displayName': 'Jordan Reed',
        'avatarUrl': 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for scenic overlooks, rail stations, and daylight-efficient routes.',
        'homeBase': 'Denver, CO',
        'interests': ['scenic', 'nature', 'adventure'],
    },
    '66666666666666666666666666666661': {
        'username': 'aisha.bello',
        'email': '',
        'displayName': 'Aisha Bello',
        'avatarUrl': 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for waterfront walks, art districts, and polished group dinners.',
        'homeBase': 'Houston, TX',
        'interests': ['culture', 'food', 'scenic'],
    },
    '77777777777777777777777777777771': {
        'username': 'theo.alvarez',
        'email': '',
        'displayName': 'Theo Alvarez',
        'avatarUrl': 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for markets, architecture, and late-night city energy.',
        'homeBase': 'Barcelona, ES',
        'interests': ['culture', 'shopping', 'nightlife'],
    },
    '88888888888888888888888888888881': {
        'username': 'priya.nair',
        'email': '',
        'displayName': 'Priya Nair',
        'avatarUrl': 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for gardens, skyline walks, and compact international stopovers.',
        'homeBase': 'Singapore',
        'interests': ['scenic', 'culture', 'food'],
    },
}


def _normalize_user_key(value) -> str:
    try:
        return UUID(str(value)).hex
    except (TypeError, ValueError, AttributeError):
        try:
            return UUID(hex=str(value)).hex
        except (TypeError, ValueError, AttributeError):
            return str(value or '').replace('-', '').lower()


def _default_actor_profile(user_id) -> dict:
    key = _normalize_user_key(user_id)
    showcase_profile = SHOWCASE_USER_PROFILES.get(key, {})
    username = showcase_profile.get('username') or f'traveler-{key[:8] or "scope"}'
    display_name = showcase_profile.get('displayName') or f'Traveler {key[:8] or "Scope"}'
    return {
        'id': str(user_id),
        'username': username,
        'email': showcase_profile.get('email', ''),
        'displayName': display_name,
        'avatarUrl': showcase_profile.get('avatarUrl', ''),
        'bio': showcase_profile.get('bio', ''),
        'homeBase': showcase_profile.get('homeBase', ''),
        'interests': showcase_profile.get('interests', []),
        'showActivityStatus': True,
        'stats': {'spots': 18, 'trips': 5, 'friends': 96},
    }


def _collect_feed_user_ids(entries) -> set[object]:
    user_ids = set()
    for entry in entries:
        if entry.type == 'spot':
            user_ids.add(entry.item.user_id)
        elif entry.type == 'trip':
            user_ids.add(entry.item.creator_id)
        elif entry.type == 'review':
            user_ids.add(entry.item.user_id)
    return user_ids


def _resolve_user_profiles(user_ids: set[object]) -> dict[str, dict]:
    return {_normalize_user_key(user_id): _default_actor_profile(user_id) for user_id in user_ids}


def _actor_for(actor_profiles: dict[str, dict], user_id) -> dict:
    return actor_profiles.get(_normalize_user_key(user_id), _default_actor_profile(user_id))


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
    actor = _actor_for(actor_profiles, review.user_id)
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
        actor_profiles = _resolve_user_profiles(_collect_feed_user_ids(page.entries))
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
