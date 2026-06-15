"""Index Scope documents to Elasticsearch on create, update, and delete."""

from __future__ import annotations

import logging
from typing import Any

from django.db.models import Avg, Count

from common.search import REVIEW_INDEX, SPOT_INDEX, TRIP_INDEX, get_es_client

logger = logging.getLogger(__name__)


def _safe_index(index: str, doc_id: str, body: dict[str, Any]) -> None:
    client = get_es_client()
    if client is None:
        return
    try:
        client.index(index=index, id=doc_id, document=body)
    except Exception:
        logger.exception('Failed to index %s/%s', index, doc_id)


def _safe_delete(index: str, doc_id: str) -> None:
    client = get_es_client()
    if client is None:
        return
    try:
        client.options(ignore_status=[404]).delete(index=index, id=doc_id)
    except Exception:
        logger.exception('Failed to delete %s/%s', index, doc_id)


def _spot_photo_url(spot) -> str | None:
    photos = getattr(spot, 'photos', None)
    if photos is None:
        return None

    try:
        first_photo = photos.order_by('sort_order', '-created_at', 'id').first()
    except AttributeError:
        try:
            first_photo = next(iter(photos), None)
        except TypeError:
            return None

    if first_photo is None:
        return None

    return (
        getattr(first_photo, 'thumbnail_url', '') or
        getattr(first_photo, 'storage_url', '') or
        None
    )


def index_spot(spot) -> None:
    """Index a Spot model instance."""
    if not getattr(spot, 'is_public', False):
        _safe_delete(SPOT_INDEX, str(spot.id))
        return

    stats = spot.reviews.aggregate(avg_rating=Avg('rating'), review_count=Count('id'))
    pillars = getattr(spot, 'pillars', None) or []
    body = {
        'id': str(spot.id),
        'name': getattr(spot, 'name', getattr(spot, 'title', '')),
        'description': getattr(spot, 'description', '') or '',
        'category': getattr(spot, 'category', '') or '',
        'tags': [
            tag for tag in [
                getattr(spot, 'vibe', ''),
                getattr(spot, 'city', ''),
                getattr(spot, 'country', ''),
                getattr(spot, 'provider_place_name', ''),
                getattr(spot, 'provider_place_address', ''),
                *pillars,
            ] if tag
        ],
        'city': getattr(spot, 'city', '') or '',
        'country': getattr(spot, 'country', '') or '',
        'vibe': getattr(spot, 'vibe', '') or '',
        'photo_url': _spot_photo_url(spot),
        'pillars': pillars,
        'verification_status': getattr(spot, 'verification_status', ''),
        'safety_status': getattr(spot, 'safety_status', ''),
        'creator_id': str(getattr(spot, 'creator_id', getattr(spot, 'user_id', ''))) or None,
        'is_public': True,
        'avg_rating': float(stats['avg_rating'] or getattr(spot, 'rating', 0) or 0),
        'review_count': int(stats['review_count'] or 0),
        'created_at': spot.created_at.isoformat() if getattr(spot, 'created_at', None) else None,
        'updated_at': spot.updated_at.isoformat() if getattr(spot, 'updated_at', None) else None,
    }
    lat = getattr(spot, 'latitude', None)
    lon = getattr(spot, 'longitude', None)
    if lat is not None and lon is not None:
        body['location'] = {'lat': float(lat), 'lon': float(lon)}
    _safe_index(SPOT_INDEX, str(spot.id), body)


def delete_spot(spot_id: str) -> None:
    _safe_delete(SPOT_INDEX, spot_id)


def index_review(review) -> None:
    """Index a Review model instance."""
    spot = getattr(review, 'spot', None)
    if spot is not None and not getattr(spot, 'is_public', False):
        _safe_delete(REVIEW_INDEX, str(review.id))
        return

    body = {
        'id': str(review.id),
        'spot_id': str(review.spot_id) if review.spot_id else None,
        'spot_is_public': bool(getattr(spot, 'is_public', False)) if spot is not None else False,
        'spot_owner_id': str(getattr(spot, 'user_id', '')) if spot is not None else None,
        'user_id': None if getattr(review, 'is_anonymous', False) else str(review.user_id) if review.user_id else None,
        'is_anonymous': bool(getattr(review, 'is_anonymous', False)),
        'text': getattr(review, 'text', getattr(review, 'comment', '')) or '',
        'rating': int(float(review.rating)) if getattr(review, 'rating', None) else 0,
        'sentiment_score': (
            float(review.sentiment_score)
            if getattr(review, 'sentiment_score', None) is not None
            else None
        ),
        'created_at': review.created_at.isoformat() if getattr(review, 'created_at', None) else None,
    }
    _safe_index(REVIEW_INDEX, str(review.id), body)


def delete_review(review_id: str) -> None:
    _safe_delete(REVIEW_INDEX, review_id)


def index_trip(trip) -> None:
    """Index a Trip model instance."""
    if hasattr(trip, 'is_public') and not getattr(trip, 'is_public', False):
        _safe_delete(TRIP_INDEX, str(trip.id))
        return

    body = {
        'id': str(trip.id),
        'name': getattr(trip, 'name', getattr(trip, 'title', '')),
        'description': getattr(trip, 'description', '') or '',
        'creator_id': str(trip.creator_id) if trip.creator_id else None,
        'is_public': bool(getattr(trip, 'is_public', True)),
        'member_count': int(getattr(trip, 'member_count', None) or trip.members.count()),
        'spot_count': int(getattr(trip, 'spot_count', None) or trip.trip_spots.count()),
        'created_at': trip.created_at.isoformat() if getattr(trip, 'created_at', None) else None,
    }
    _safe_index(TRIP_INDEX, str(trip.id), body)


def delete_trip(trip_id: str) -> None:
    _safe_delete(TRIP_INDEX, trip_id)
