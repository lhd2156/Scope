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


def index_spot(spot) -> None:
    """Index a Spot model instance."""
    stats = spot.reviews.aggregate(avg_rating=Avg('rating'), review_count=Count('id'))
    body = {
        'id': str(spot.id),
        'name': getattr(spot, 'name', getattr(spot, 'title', '')),
        'description': getattr(spot, 'description', '') or '',
        'category': getattr(spot, 'category', '') or '',
        'tags': [tag for tag in [getattr(spot, 'vibe', ''), getattr(spot, 'city', '')] if tag],
        'creator_id': str(getattr(spot, 'creator_id', getattr(spot, 'user_id', ''))) or None,
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
    body = {
        'id': str(review.id),
        'spot_id': str(review.spot_id) if review.spot_id else None,
        'user_id': str(review.user_id) if review.user_id else None,
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
    body = {
        'id': str(trip.id),
        'name': getattr(trip, 'name', getattr(trip, 'title', '')),
        'description': getattr(trip, 'description', '') or '',
        'creator_id': str(trip.creator_id) if trip.creator_id else None,
        'member_count': int(getattr(trip, 'member_count', None) or trip.members.count()),
        'spot_count': int(getattr(trip, 'spot_count', None) or trip.trip_spots.count()),
        'created_at': trip.created_at.isoformat() if getattr(trip, 'created_at', None) else None,
    }
    _safe_index(TRIP_INDEX, str(trip.id), body)


def delete_trip(trip_id: str) -> None:
    _safe_delete(TRIP_INDEX, trip_id)
