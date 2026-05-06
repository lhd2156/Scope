"""Elasticsearch client and index management for Scope Content."""

from __future__ import annotations

import logging
import os

from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)

_client: Elasticsearch | None = None


def get_es_client() -> Elasticsearch | None:
    """Return a singleton Elasticsearch client, or None when search is disabled."""
    global _client
    if _client is not None:
        return _client

    url = os.environ.get('ELASTICSEARCH_URL')
    if not url:
        logger.warning('ELASTICSEARCH_URL not set; search features disabled')
        return None

    _client = Elasticsearch(
        url,
        request_timeout=10,
        max_retries=3,
        retry_on_timeout=True,
    )

    try:
        info = _client.info()
        logger.info('Connected to Elasticsearch %s', info['version']['number'])
    except Exception:
        logger.exception('Failed to connect to Elasticsearch')
        _client = None
        return None

    return _client


SPOT_INDEX = 'scope-spots'
REVIEW_INDEX = 'scope-reviews'
TRIP_INDEX = 'scope-trips'

SPOT_MAPPINGS = {
    'mappings': {
        'properties': {
            'id': {'type': 'keyword'},
            'name': {'type': 'text', 'analyzer': 'standard', 'fields': {'keyword': {'type': 'keyword'}}},
            'description': {'type': 'text', 'analyzer': 'standard'},
            'location': {'type': 'geo_point'},
            'category': {'type': 'keyword'},
            'tags': {'type': 'keyword'},
            'creator_id': {'type': 'keyword'},
            'avg_rating': {'type': 'float'},
            'review_count': {'type': 'integer'},
            'created_at': {'type': 'date'},
            'updated_at': {'type': 'date'},
        }
    },
    'settings': {
        'number_of_shards': 1,
        'number_of_replicas': 0,
    },
}

REVIEW_MAPPINGS = {
    'mappings': {
        'properties': {
            'id': {'type': 'keyword'},
            'spot_id': {'type': 'keyword'},
            'user_id': {'type': 'keyword'},
            'text': {'type': 'text', 'analyzer': 'standard'},
            'rating': {'type': 'integer'},
            'sentiment_score': {'type': 'float'},
            'created_at': {'type': 'date'},
        }
    },
    'settings': {
        'number_of_shards': 1,
        'number_of_replicas': 0,
    },
}

TRIP_MAPPINGS = {
    'mappings': {
        'properties': {
            'id': {'type': 'keyword'},
            'name': {'type': 'text', 'analyzer': 'standard', 'fields': {'keyword': {'type': 'keyword'}}},
            'description': {'type': 'text', 'analyzer': 'standard'},
            'creator_id': {'type': 'keyword'},
            'member_count': {'type': 'integer'},
            'spot_count': {'type': 'integer'},
            'created_at': {'type': 'date'},
        }
    },
    'settings': {
        'number_of_shards': 1,
        'number_of_replicas': 0,
    },
}

ALL_INDEXES = [
    (SPOT_INDEX, SPOT_MAPPINGS),
    (REVIEW_INDEX, REVIEW_MAPPINGS),
    (TRIP_INDEX, TRIP_MAPPINGS),
]


def ensure_indexes() -> None:
    """Create indexes if they do not exist. Idempotent."""
    client = get_es_client()
    if client is None:
        return

    for index_name, body in ALL_INDEXES:
        if not client.indices.exists(index=index_name):
            client.indices.create(index=index_name, body=body)
            logger.info('Created index %s', index_name)
        else:
            logger.info('Index %s already exists', index_name)
