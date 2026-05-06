# Phase 1: Elasticsearch + RabbitMQ/Celery — Codex Build Spec

> **Scope**: Add Elasticsearch full-text/geo search to Content API and RabbitMQ + Celery async task queue to Content + Intel.
> **Prerequisites**: Existing Scope stack running via `docker compose up --build -d`.
> **Do NOT modify**: Core API, Frontend, iOS, Android, Metrics, CLI, scope_media, scope_geo.

---

## Part A: Elasticsearch

### A1. Docker Compose — Add Elasticsearch service

**File**: `docker-compose.yml` (MODIFY — append before the `volumes:` block at the bottom)

Add this service definition:

```yaml
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.18.0
    container_name: scope-elasticsearch
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - xpack.security.http.ssl.enabled=false
      - ES_JAVA_OPTS=-Xms256m -Xmx256m
      - cluster.name=scope-search
    ports:
      - "${ELASTICSEARCH_PORT:-9200}:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -fsSL http://localhost:9200/_cluster/health?wait_for_status=yellow&timeout=5s || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 45s
    mem_limit: 768m
```

Add `es-data:` to the `volumes:` section at the bottom.

Add `elasticsearch` as a dependency of the `content` service:
```yaml
  content:
    depends_on:
      elasticsearch:
        condition: service_healthy
      # ... keep all existing depends_on entries
```

### A2. Environment variables

**File**: `.env.example` (MODIFY — append these lines)

```env
# ── Elasticsearch ──────────────────────────────────
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_PORT=9200
```

**File**: `.env` (MODIFY — append same lines with same defaults)

Add `ELASTICSEARCH_URL` to the `content` service environment in `docker-compose.yml`:
```yaml
      ELASTICSEARCH_URL: ${ELASTICSEARCH_URL:-http://elasticsearch:9200}
```

### A3. Python dependency

**File**: `scope_content/requirements.txt` (MODIFY — append)

```
elasticsearch[async]>=8.18.0
```

### A4. Elasticsearch client module

**File**: `scope_content/common/search.py` (NEW)

```python
"""Elasticsearch client and index management for Scope Content."""

import logging
import os

from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)

_client = None


def get_es_client() -> Elasticsearch | None:
    """Return a singleton Elasticsearch client. Returns None if not configured."""
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("ELASTICSEARCH_URL")
    if not url:
        logger.warning("ELASTICSEARCH_URL not set — search features disabled")
        return None

    _client = Elasticsearch(
        url,
        request_timeout=10,
        max_retries=3,
        retry_on_timeout=True,
    )

    # Verify connection
    try:
        info = _client.info()
        logger.info("Connected to Elasticsearch %s", info["version"]["number"])
    except Exception:
        logger.exception("Failed to connect to Elasticsearch")
        _client = None
        return None

    return _client


# ── Index Definitions ─────────────────────────────────────────────────────────

SPOT_INDEX = "scope-spots"
REVIEW_INDEX = "scope-reviews"
TRIP_INDEX = "scope-trips"

SPOT_MAPPINGS = {
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "name": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
            "description": {"type": "text", "analyzer": "standard"},
            "location": {"type": "geo_point"},
            "category": {"type": "keyword"},
            "tags": {"type": "keyword"},
            "creator_id": {"type": "keyword"},
            "avg_rating": {"type": "float"},
            "review_count": {"type": "integer"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}

REVIEW_MAPPINGS = {
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "spot_id": {"type": "keyword"},
            "user_id": {"type": "keyword"},
            "text": {"type": "text", "analyzer": "standard"},
            "rating": {"type": "integer"},
            "sentiment_score": {"type": "float"},
            "created_at": {"type": "date"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}

TRIP_MAPPINGS = {
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "name": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
            "description": {"type": "text", "analyzer": "standard"},
            "creator_id": {"type": "keyword"},
            "member_count": {"type": "integer"},
            "spot_count": {"type": "integer"},
            "created_at": {"type": "date"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}

ALL_INDEXES = [
    (SPOT_INDEX, SPOT_MAPPINGS),
    (REVIEW_INDEX, REVIEW_MAPPINGS),
    (TRIP_INDEX, TRIP_MAPPINGS),
]


def ensure_indexes():
    """Create indexes if they do not exist. Idempotent."""
    client = get_es_client()
    if client is None:
        return

    for index_name, body in ALL_INDEXES:
        if not client.indices.exists(index=index_name):
            client.indices.create(index=index_name, body=body)
            logger.info("Created index %s", index_name)
        else:
            logger.info("Index %s already exists", index_name)
```

### A5. Index documents on write

**File**: `scope_content/common/indexing.py` (NEW)

```python
"""Index Scope documents to Elasticsearch on create/update/delete."""

import logging
from typing import Any

from common.search import (
    REVIEW_INDEX,
    SPOT_INDEX,
    TRIP_INDEX,
    get_es_client,
)

logger = logging.getLogger(__name__)


def _safe_index(index: str, doc_id: str, body: dict[str, Any]) -> None:
    client = get_es_client()
    if client is None:
        return
    try:
        client.index(index=index, id=doc_id, document=body)
    except Exception:
        logger.exception("Failed to index %s/%s", index, doc_id)


def _safe_delete(index: str, doc_id: str) -> None:
    client = get_es_client()
    if client is None:
        return
    try:
        client.delete(index=index, id=doc_id, ignore=[404])
    except Exception:
        logger.exception("Failed to delete %s/%s", index, doc_id)


# ── Spots ─────────────────────────────────────────────────────────────────────

def index_spot(spot) -> None:
    """Index a Spot model instance."""
    body = {
        "id": str(spot.id),
        "name": spot.name,
        "description": getattr(spot, "description", "") or "",
        "category": getattr(spot, "category", "") or "",
        "tags": getattr(spot, "tags", []) or [],
        "creator_id": str(spot.creator_id) if spot.creator_id else None,
        "avg_rating": float(spot.avg_rating) if hasattr(spot, "avg_rating") and spot.avg_rating else 0.0,
        "review_count": int(spot.review_count) if hasattr(spot, "review_count") and spot.review_count else 0,
        "created_at": spot.created_at.isoformat() if hasattr(spot, "created_at") and spot.created_at else None,
        "updated_at": spot.updated_at.isoformat() if hasattr(spot, "updated_at") and spot.updated_at else None,
    }
    # Add geo_point if latitude/longitude exist
    lat = getattr(spot, "latitude", None)
    lon = getattr(spot, "longitude", None)
    if lat is not None and lon is not None:
        body["location"] = {"lat": float(lat), "lon": float(lon)}
    _safe_index(SPOT_INDEX, str(spot.id), body)


def delete_spot(spot_id: str) -> None:
    _safe_delete(SPOT_INDEX, spot_id)


# ── Reviews ───────────────────────────────────────────────────────────────────

def index_review(review) -> None:
    """Index a Review model instance."""
    body = {
        "id": str(review.id),
        "spot_id": str(review.spot_id) if review.spot_id else None,
        "user_id": str(review.user_id) if review.user_id else None,
        "text": getattr(review, "text", "") or "",
        "rating": int(review.rating) if hasattr(review, "rating") and review.rating else 0,
        "sentiment_score": float(review.sentiment_score) if hasattr(review, "sentiment_score") and review.sentiment_score is not None else None,
        "created_at": review.created_at.isoformat() if hasattr(review, "created_at") and review.created_at else None,
    }
    _safe_index(REVIEW_INDEX, str(review.id), body)


def delete_review(review_id: str) -> None:
    _safe_delete(REVIEW_INDEX, review_id)


# ── Trips ─────────────────────────────────────────────────────────────────────

def index_trip(trip) -> None:
    """Index a Trip model instance."""
    body = {
        "id": str(trip.id),
        "name": trip.name,
        "description": getattr(trip, "description", "") or "",
        "creator_id": str(trip.creator_id) if trip.creator_id else None,
        "member_count": int(trip.member_count) if hasattr(trip, "member_count") and trip.member_count else 0,
        "spot_count": int(trip.spot_count) if hasattr(trip, "spot_count") and trip.spot_count else 0,
        "created_at": trip.created_at.isoformat() if hasattr(trip, "created_at") and trip.created_at else None,
    }
    _safe_index(TRIP_INDEX, str(trip.id), body)


def delete_trip(trip_id: str) -> None:
    _safe_delete(TRIP_INDEX, trip_id)
```

### A6. Search API views

**File**: `scope_content/common/views_search.py` (NEW)

```python
"""Search API views powered by Elasticsearch."""

import logging

from django.http import JsonResponse
from django.views import View

from common.search import (
    REVIEW_INDEX,
    SPOT_INDEX,
    TRIP_INDEX,
    get_es_client,
)

logger = logging.getLogger(__name__)


class SearchView(View):
    """Full-text search across spots, reviews, and trips.

    GET /api/content/search?q=<query>&type=spots|reviews|trips&limit=20&offset=0
    """

    def get(self, request):
        q = request.GET.get("q", "").strip()
        doc_type = request.GET.get("type", "spots")
        limit = min(int(request.GET.get("limit", 20)), 100)
        offset = int(request.GET.get("offset", 0))

        if not q:
            return JsonResponse({"error": "Query parameter 'q' is required"}, status=400)

        index_map = {"spots": SPOT_INDEX, "reviews": REVIEW_INDEX, "trips": TRIP_INDEX}
        index = index_map.get(doc_type)
        if index is None:
            return JsonResponse({"error": f"Invalid type: {doc_type}. Use spots, reviews, or trips."}, status=400)

        client = get_es_client()
        if client is None:
            return JsonResponse({"error": "Search service unavailable"}, status=503)

        # Build multi_match query
        body = {
            "query": {
                "multi_match": {
                    "query": q,
                    "fields": self._fields_for(doc_type),
                    "fuzziness": "AUTO",
                    "type": "best_fields",
                }
            },
            "from": offset,
            "size": limit,
            "highlight": {
                "fields": {"name": {}, "text": {}, "description": {}},
                "pre_tags": ["<em>"],
                "post_tags": ["</em>"],
            },
        }

        try:
            result = client.search(index=index, body=body)
        except Exception:
            logger.exception("Elasticsearch query failed")
            return JsonResponse({"error": "Search query failed"}, status=500)

        hits = []
        for hit in result["hits"]["hits"]:
            entry = hit["_source"]
            entry["_score"] = hit["_score"]
            entry["_highlights"] = hit.get("highlight", {})
            hits.append(entry)

        return JsonResponse({
            "query": q,
            "type": doc_type,
            "total": result["hits"]["total"]["value"],
            "offset": offset,
            "limit": limit,
            "results": hits,
        })

    @staticmethod
    def _fields_for(doc_type: str) -> list[str]:
        if doc_type == "spots":
            return ["name^3", "description", "tags^2", "category^2"]
        elif doc_type == "reviews":
            return ["text"]
        elif doc_type == "trips":
            return ["name^3", "description"]
        return ["name", "description", "text"]


class GeoSearchView(View):
    """Geo-radius search for spots.

    GET /api/content/search/nearby?lat=40.7128&lon=-74.0060&radius=10km&limit=20
    """

    def get(self, request):
        try:
            lat = float(request.GET.get("lat", 0))
            lon = float(request.GET.get("lon", 0))
        except (TypeError, ValueError):
            return JsonResponse({"error": "lat and lon must be valid numbers"}, status=400)

        radius = request.GET.get("radius", "10km")
        limit = min(int(request.GET.get("limit", 20)), 100)

        client = get_es_client()
        if client is None:
            return JsonResponse({"error": "Search service unavailable"}, status=503)

        body = {
            "query": {
                "bool": {
                    "filter": {
                        "geo_distance": {
                            "distance": radius,
                            "location": {"lat": lat, "lon": lon},
                        }
                    }
                }
            },
            "sort": [
                {
                    "_geo_distance": {
                        "location": {"lat": lat, "lon": lon},
                        "order": "asc",
                        "unit": "km",
                    }
                }
            ],
            "size": limit,
        }

        try:
            result = client.search(index=SPOT_INDEX, body=body)
        except Exception:
            logger.exception("Geo search failed")
            return JsonResponse({"error": "Geo search failed"}, status=500)

        hits = []
        for hit in result["hits"]["hits"]:
            entry = hit["_source"]
            entry["_distance_km"] = hit["sort"][0] if hit.get("sort") else None
            hits.append(entry)

        return JsonResponse({
            "center": {"lat": lat, "lon": lon},
            "radius": radius,
            "total": result["hits"]["total"]["value"],
            "results": hits,
        })
```

### A7. URL routing

Find the Content API's root URL configuration (likely `scope_content/scope_content/urls.py`) and add:

```python
from common.views_search import SearchView, GeoSearchView

# Add to urlpatterns:
path("api/content/search", SearchView.as_view(), name="search"),
path("api/content/search/nearby", GeoSearchView.as_view(), name="geo-search"),
```

### A8. Index initialization on startup

In the Content API's Django `AppConfig.ready()` method (likely in `scope_content/scope_content/apps.py` or `common/apps.py`), add:

```python
from common.search import ensure_indexes
ensure_indexes()
```

### A9. Hook indexing into existing views

Find the existing **Spot create/update** views in `scope_content/spots/views.py`. After a spot is successfully saved, add:

```python
from common.indexing import index_spot, delete_spot

# After spot.save() in create/update:
index_spot(spot)

# After spot.delete() in delete:
delete_spot(str(spot.id))
```

Repeat for **Reviews** (`scope_content/reviews/views.py`):
```python
from common.indexing import index_review, delete_review
```

Repeat for **Trips** (`scope_content/trips/views.py`):
```python
from common.indexing import index_trip, delete_trip
```

### A10. Management command — Bulk reindex

**File**: `scope_content/common/management/commands/reindex_elasticsearch.py` (NEW)

```python
"""Django management command to bulk-reindex all data to Elasticsearch."""

from django.core.management.base import BaseCommand

from common.indexing import index_spot, index_review, index_trip
from common.search import ensure_indexes


class Command(BaseCommand):
    help = "Reindex all spots, reviews, and trips to Elasticsearch"

    def handle(self, *args, **options):
        ensure_indexes()

        # Import models — adjust paths to match actual model locations
        from spots.models import Spot
        from reviews.models import Review
        from trips.models import Trip

        spots = Spot.objects.all()
        self.stdout.write(f"Indexing {spots.count()} spots...")
        for spot in spots.iterator():
            index_spot(spot)

        reviews = Review.objects.all()
        self.stdout.write(f"Indexing {reviews.count()} reviews...")
        for review in reviews.iterator():
            index_review(review)

        trips = Trip.objects.all()
        self.stdout.write(f"Indexing {trips.count()} trips...")
        for trip in trips.iterator():
            index_trip(trip)

        self.stdout.write(self.style.SUCCESS("Reindex complete."))
```

Make sure the management command directory exists:
```
scope_content/common/management/__init__.py          (empty)
scope_content/common/management/commands/__init__.py (empty)
scope_content/common/management/commands/reindex_elasticsearch.py
```

### A11. Tests

**File**: `scope_content/common/tests/test_search.py` (NEW)

```python
"""Tests for Elasticsearch search integration."""

import pytest
from unittest.mock import patch, MagicMock
from django.test import RequestFactory

from common.views_search import SearchView, GeoSearchView


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def mock_es():
    with patch("common.views_search.get_es_client") as mock:
        client = MagicMock()
        mock.return_value = client
        yield client


class TestSearchView:
    def test_missing_query_returns_400(self, rf):
        request = rf.get("/api/content/search")
        response = SearchView.as_view()(request)
        assert response.status_code == 400

    def test_invalid_type_returns_400(self, rf):
        request = rf.get("/api/content/search?q=test&type=invalid")
        response = SearchView.as_view()(request)
        assert response.status_code == 400

    def test_successful_search(self, rf, mock_es):
        mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [
                    {
                        "_source": {"id": "1", "name": "Test Spot"},
                        "_score": 1.5,
                        "highlight": {"name": ["<em>Test</em> Spot"]},
                    }
                ],
            }
        }
        request = rf.get("/api/content/search?q=test&type=spots")
        response = SearchView.as_view()(request)
        assert response.status_code == 200

    def test_es_unavailable_returns_503(self, rf):
        with patch("common.views_search.get_es_client", return_value=None):
            request = rf.get("/api/content/search?q=test")
            response = SearchView.as_view()(request)
            assert response.status_code == 503


class TestGeoSearchView:
    def test_invalid_coordinates_returns_400(self, rf):
        request = rf.get("/api/content/search/nearby?lat=abc&lon=xyz")
        response = GeoSearchView.as_view()(request)
        assert response.status_code == 400

    def test_successful_geo_search(self, rf, mock_es):
        mock_es.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [
                    {
                        "_source": {"id": "1", "name": "Nearby Spot", "location": {"lat": 40.71, "lon": -74.01}},
                        "sort": [0.5],
                    }
                ],
            }
        }
        request = rf.get("/api/content/search/nearby?lat=40.7128&lon=-74.006&radius=5km")
        response = GeoSearchView.as_view()(request)
        assert response.status_code == 200
```

---

## Part B: RabbitMQ + Celery

### B1. Docker Compose — Add RabbitMQ service

**File**: `docker-compose.yml` (MODIFY — append before `volumes:`)

```yaml
  rabbitmq:
    image: rabbitmq:4.1-management-alpine
    container_name: scope-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-scope}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:-scope_dev}
      RABBITMQ_DEFAULT_VHOST: ${RABBITMQ_VHOST:-scope}
    ports:
      - "${RABBITMQ_PORT:-5672}:5672"
      - "${RABBITMQ_MGMT_PORT:-15672}:15672"
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_running"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s
    mem_limit: 384m
```

Add `rabbitmq-data:` to the `volumes:` section.

Add `rabbitmq` as a dependency of `content` and `intel` services.

### B2. Environment variables

**File**: `.env.example` (MODIFY — append):

```env
# ── RabbitMQ ───────────────────────────────────────
RABBITMQ_USER=scope
RABBITMQ_PASS=scope_dev
RABBITMQ_VHOST=scope
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672
CELERY_BROKER_URL=amqp://scope:scope_dev@rabbitmq:5672/scope
CELERY_RESULT_BACKEND=redis://redis:6379/2
```

Add to `content` and `intel` service environments in `docker-compose.yml`:
```yaml
      CELERY_BROKER_URL: ${CELERY_BROKER_URL:-amqp://scope:scope_dev@rabbitmq:5672/scope}
      CELERY_RESULT_BACKEND: ${CELERY_RESULT_BACKEND:-redis://redis:6379/2}
```

### B3. Python dependencies

**File**: `scope_content/requirements.txt` (MODIFY — append):
```
celery[rabbitmq]>=5.5.0
```

**File**: `scope_intel/requirements.txt` (MODIFY — append):
```
celery[rabbitmq]>=5.5.0
```

### B4. Celery app — Content

**File**: `scope_content/scope_content/celery.py` (NEW)

```python
"""Celery application for Scope Content async tasks."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "scope_content.settings")

app = Celery("scope_content")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

**File**: `scope_content/scope_content/__init__.py` (MODIFY — add at top):

```python
from scope_content.celery import app as celery_app

__all__ = ("celery_app",)
```

Add to Django settings (`scope_content/scope_content/settings.py`):

```python
# ── Celery ─────────────────────────────────────────
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_REJECT_ON_WORKER_LOST = True

# Dead letter queue for failed tasks
CELERY_TASK_QUEUE_MAX_PRIORITY = 10
CELERY_TASK_DEFAULT_PRIORITY = 5
```

### B5. Content async tasks

**File**: `scope_content/common/tasks.py` (NEW)

```python
"""Celery tasks for Scope Content."""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def reindex_spot_task(self, spot_id: str) -> dict:
    """Async reindex a spot to Elasticsearch."""
    try:
        from spots.models import Spot
        from common.indexing import index_spot

        spot = Spot.objects.get(id=spot_id)
        index_spot(spot)
        return {"status": "indexed", "spot_id": spot_id}
    except Exception as exc:
        logger.exception("Failed to reindex spot %s", spot_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def analyze_review_sentiment_task(self, review_id: str) -> dict:
    """Send review to Intel API for sentiment analysis."""
    try:
        import requests
        from reviews.models import Review

        review = Review.objects.get(id=review_id)
        # Call Intel API for sentiment
        response = requests.post(
            f"{_intel_url()}/api/intel/sentiment",
            json={"text": review.text, "review_id": str(review.id)},
            timeout=30,
        )
        if response.ok:
            data = response.json()
            review.sentiment_score = data.get("score")
            review.save(update_fields=["sentiment_score"])
            # Reindex with sentiment
            from common.indexing import index_review
            index_review(review)
            return {"status": "analyzed", "review_id": review_id, "score": data.get("score")}
        return {"status": "failed", "review_id": review_id}
    except Exception as exc:
        logger.exception("Sentiment analysis failed for review %s", review_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def classify_photo_task(self, photo_id: str) -> dict:
    """Send photo to Intel API for auto-tagging."""
    try:
        import requests
        from photos.models import Photo

        photo = Photo.objects.get(id=photo_id)
        # Call Intel API for classification
        response = requests.post(
            f"{_intel_url()}/api/intel/classify-image",
            json={"photo_id": str(photo.id), "url": photo.url},
            timeout=60,
        )
        if response.ok:
            data = response.json()
            photo.auto_tags = data.get("tags", [])
            photo.save(update_fields=["auto_tags"])
            return {"status": "classified", "photo_id": photo_id, "tags": data.get("tags")}
        return {"status": "failed", "photo_id": photo_id}
    except Exception as exc:
        logger.exception("Photo classification failed for %s", photo_id)
        raise self.retry(exc=exc)


@shared_task
def bulk_reindex_task(doc_type: str) -> dict:
    """Bulk reindex all documents of a given type."""
    from common.search import ensure_indexes
    ensure_indexes()

    if doc_type == "spots":
        from spots.models import Spot
        from common.indexing import index_spot
        count = 0
        for spot in Spot.objects.all().iterator():
            index_spot(spot)
            count += 1
        return {"type": "spots", "indexed": count}

    elif doc_type == "reviews":
        from reviews.models import Review
        from common.indexing import index_review
        count = 0
        for review in Review.objects.all().iterator():
            index_review(review)
            count += 1
        return {"type": "reviews", "indexed": count}

    elif doc_type == "trips":
        from trips.models import Trip
        from common.indexing import index_trip
        count = 0
        for trip in Trip.objects.all().iterator():
            index_trip(trip)
            count += 1
        return {"type": "trips", "indexed": count}

    return {"error": f"Unknown doc_type: {doc_type}"}


def _intel_url() -> str:
    import os
    return os.environ.get("CONTENT_SERVICE_URL", "http://intel:5000").rsplit("/api", 1)[0]
```

### B6. Celery worker in Docker Compose

**File**: `docker-compose.yml` (MODIFY — add new service)

```yaml
  content-celery:
    build:
      context: ./scope_content
    restart: unless-stopped
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
      content:
        condition: service_healthy
    environment:
      DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY:?DJANGO_SECRET_KEY is required}
      DJANGO_DEBUG: ${DJANGO_DEBUG:-false}
      CELERY_BROKER_URL: ${CELERY_BROKER_URL:-amqp://scope:scope_dev@rabbitmq:5672/scope}
      CELERY_RESULT_BACKEND: ${CELERY_RESULT_BACKEND:-redis://redis:6379/2}
      ELASTICSEARCH_URL: ${ELASTICSEARCH_URL:-http://elasticsearch:9200}
      DJANGO_DATABASE_URL: ${DJANGO_DATABASE_URL:-}
      CORE_JWT_SECRET: ${CORE_JWT_SECRET:?CORE_JWT_SECRET is required}
      RUN_MIGRATIONS_ON_STARTUP: "false"
    command: ["celery", "-A", "scope_content", "worker", "--loglevel=info", "--concurrency=4", "-Q", "default,sentiment,classification,reindex"]
    healthcheck:
      test: ["CMD-SHELL", "celery -A scope_content inspect ping --timeout 5 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 15s
    mem_limit: 384m
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

### B7. Tests

**File**: `scope_content/common/tests/test_tasks.py` (NEW)

```python
"""Tests for Celery tasks."""

import pytest
from unittest.mock import patch, MagicMock


class TestReindexSpotTask:
    @patch("common.tasks.index_spot")
    @patch("spots.models.Spot.objects")
    def test_reindex_spot_success(self, mock_objects, mock_index):
        from common.tasks import reindex_spot_task

        mock_spot = MagicMock(id="spot-1")
        mock_objects.get.return_value = mock_spot

        result = reindex_spot_task("spot-1")
        assert result["status"] == "indexed"
        mock_index.assert_called_once_with(mock_spot)


class TestBulkReindexTask:
    @patch("common.tasks.index_spot")
    @patch("spots.models.Spot.objects")
    @patch("common.tasks.ensure_indexes")
    def test_bulk_reindex_spots(self, mock_ensure, mock_objects, mock_index):
        from common.tasks import bulk_reindex_task

        mock_objects.all.return_value.iterator.return_value = [MagicMock(), MagicMock()]
        result = bulk_reindex_task("spots")
        assert result["indexed"] == 2
```

---

## Validation Checklist

After building, run these commands to verify:

```powershell
# 1. Start everything
docker compose up --build -d

# 2. Verify Elasticsearch is running
curl http://localhost:9200/_cluster/health

# 3. Verify RabbitMQ management UI
# Open http://localhost:15672 (scope / scope_dev)

# 4. Verify indexes were created
curl http://localhost:9200/_cat/indices

# 5. Run Content tests
cd scope_content; python -m pytest common/tests/test_search.py -v
cd scope_content; python -m pytest common/tests/test_tasks.py -v

# 6. Test search endpoint
curl "http://localhost/api/content/search?q=test&type=spots"

# 7. Test geo search endpoint
curl "http://localhost/api/content/search/nearby?lat=40.7128&lon=-74.006&radius=10km"

# 8. Verify Celery worker is connected
docker compose exec content-celery celery -A scope_content inspect ping

# 9. Run bulk reindex
docker compose exec content python manage.py reindex_elasticsearch
```

---

## Files Created / Modified Summary

| Action | File |
|---|---|
| MODIFY | `docker-compose.yml` (add elasticsearch, rabbitmq, content-celery services + volumes) |
| MODIFY | `.env.example` (add ES + RabbitMQ vars) |
| MODIFY | `.env` (add ES + RabbitMQ vars) |
| MODIFY | `scope_content/requirements.txt` (add elasticsearch, celery) |
| MODIFY | `scope_content/scope_content/settings.py` (add Celery config) |
| MODIFY | `scope_content/scope_content/__init__.py` (import celery app) |
| MODIFY | `scope_content/scope_content/urls.py` (add search routes) |
| MODIFY | `scope_content/spots/views.py` (add indexing hooks) |
| MODIFY | `scope_content/reviews/views.py` (add indexing hooks) |
| MODIFY | `scope_content/trips/views.py` (add indexing hooks) |
| NEW | `scope_content/common/search.py` |
| NEW | `scope_content/common/indexing.py` |
| NEW | `scope_content/common/views_search.py` |
| NEW | `scope_content/common/tasks.py` |
| NEW | `scope_content/scope_content/celery.py` |
| NEW | `scope_content/common/management/commands/reindex_elasticsearch.py` |
| NEW | `scope_content/common/management/__init__.py` |
| NEW | `scope_content/common/management/commands/__init__.py` |
| NEW | `scope_content/common/tests/test_search.py` |
| NEW | `scope_content/common/tests/test_tasks.py` |
