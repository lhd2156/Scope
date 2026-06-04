"""Celery tasks for Scope Content."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import jwt
import requests
from celery import shared_task
from django.conf import settings

from common.indexing import index_review, index_spot, index_trip
from common.search import ensure_indexes

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def reindex_spot_task(self, spot_id: str) -> dict:
    """Async reindex a spot to Elasticsearch."""
    try:
        from spots.models import Spot

        spot = Spot.objects.get(id=spot_id)
        index_spot(spot)
        return {'status': 'indexed', 'spot_id': spot_id}
    except Exception as exc:
        logger.exception('Failed to reindex spot %s', spot_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def analyze_review_sentiment_task(self, review_id: str) -> dict:
    """Send review to Intel API for sentiment analysis."""
    try:
        from reviews.models import Review

        review = Review.objects.get(id=review_id)
        response = requests.post(
            f'{_intel_url()}/api/intel/sentiment',
            json={'text': getattr(review, 'text', getattr(review, 'comment', '')), 'review_id': str(review.id)},
            headers=_intel_auth_headers(),
            timeout=30,
        )
        if response.ok:
            data = response.json()
            if hasattr(review, 'sentiment_score'):
                review.sentiment_score = data.get('score')
                review.save(update_fields=['sentiment_score'])
            index_review(review)
            return {'status': 'analyzed', 'review_id': review_id, 'score': data.get('score')}
        return {'status': 'failed', 'review_id': review_id}
    except Exception as exc:
        logger.exception('Sentiment analysis failed for review %s', review_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def classify_photo_task(self, photo_id: str) -> dict:
    """Send photo to Intel API for auto-tagging."""
    try:
        from photos.models import Photo

        photo = Photo.objects.get(id=photo_id)
        response = requests.post(
            f'{_intel_url()}/api/intel/classify-image',
            json={'photo_id': str(photo.id), 'url': getattr(photo, 'url', getattr(photo, 'storage_url', ''))},
            headers=_intel_auth_headers(),
            timeout=60,
        )
        if response.ok:
            data = response.json()
            if hasattr(photo, 'auto_tags'):
                photo.auto_tags = data.get('tags', [])
                photo.save(update_fields=['auto_tags'])
            return {'status': 'classified', 'photo_id': photo_id, 'tags': data.get('tags')}
        return {'status': 'failed', 'photo_id': photo_id}
    except Exception as exc:
        logger.exception('Photo classification failed for %s', photo_id)
        raise self.retry(exc=exc)


@shared_task
def bulk_reindex_task(doc_type: str) -> dict:
    """Bulk reindex all documents of a given type."""
    ensure_indexes()

    if doc_type == 'spots':
        from spots.models import Spot

        count = 0
        for spot in Spot.objects.all().iterator():
            index_spot(spot)
            count += 1
        return {'type': 'spots', 'indexed': count}

    if doc_type == 'reviews':
        from reviews.models import Review

        count = 0
        for review in Review.objects.all().iterator():
            index_review(review)
            count += 1
        return {'type': 'reviews', 'indexed': count}

    if doc_type == 'trips':
        from trips.models import Trip

        count = 0
        for trip in Trip.objects.all().iterator():
            index_trip(trip)
            count += 1
        return {'type': 'trips', 'indexed': count}

    return {'error': f'Unknown doc_type: {doc_type}'}


def _intel_url() -> str:
    return os.environ.get('CONTENT_SERVICE_URL', 'http://intel:5000').rsplit('/api', 1)[0]


def _intel_auth_headers() -> dict[str, str]:
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            'sub': os.environ.get('CONTENT_INTEL_SERVICE_SUBJECT', 'scope-content-worker'),
            'roles': ['service'],
            'iss': settings.JWT_ISSUER,
            'aud': settings.JWT_AUDIENCE,
            'iat': now,
            'exp': now + timedelta(minutes=5),
        },
        settings.JWT_SECRET,
        algorithm='HS256',
    )
    return {'Authorization': f'Bearer {token}'}
