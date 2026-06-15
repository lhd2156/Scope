"""Content service client for the Intelligence API.

In production this talks HTTP to the Django Content Engine. In tests, it falls
back to `content_fixtures.SAMPLE_SPOTS` so the existing test suite -- which
doesn't have a live Content service -- keeps passing with no changes. Outside
TESTING, a missing `CONTENT_SERVICE_URL` is a configuration error rather than a
silent sample-data fallback.

The module preserves the legacy public surface:

    from app.services.content_client import ContentServiceClient, Spot

so that callers unaware of the split keep working. Under the hood,
`ContentServiceClient()` is now a smart constructor that routes to either
`HttpContentServiceClient` or `FixtureContentServiceClient`.

Contract (any backend):
    get_all_spots() -> list[Spot]
    get_spot(spot_id: str) -> Spot | None
    search_spots(destination: str, interests: list[str]) -> list[Spot]
"""

from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from typing import Any, Protocol

from flask import current_app, has_app_context, has_request_context, request

from app.services.content_fixtures import SAMPLE_SPOTS
from app.services.geo_math import haversine_distance_km
from app.services.spot import Spot

__all__ = [
    "Spot",
    "ContentServiceClient",
    "FixtureContentServiceClient",
    "HttpContentServiceClient",
    "build_content_service_client",
]

logger = logging.getLogger(__name__)

# Default timeout for calls into Content. Rec / itinerary paths already run
# behind `run_ml_with_timeout`, so keep this tighter than the ML wall clock.
HTTP_TIMEOUT_SECONDS = 2.0
# Bound the candidate pool we fetch in a single request. The ranker happily
# scores 500 spots; going much beyond that starts to hurt TF-IDF cache locality.
DEFAULT_FETCH_LIMIT = 500


def _safe_int(value: Any, default: int = 0, minimum: int | None = 0) -> int:
    try:
        parsed = int(float(value))
    except (OverflowError, TypeError, ValueError):
        parsed = default
    return max(minimum, parsed) if minimum is not None else parsed


def _safe_float(value: Any, default: float = 0.0, minimum: float | None = None, maximum: float | None = None) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    if parsed != parsed:
        parsed = default
    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _coordinate(value: Any, minimum: float, maximum: float) -> float:
    parsed = _safe_float(value, default=float("nan"))
    if parsed != parsed or parsed < minimum or parsed > maximum:
        raise ValueError("Invalid spot coordinate")
    return parsed


def _distance_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    return haversine_distance_km(lat_a, lng_a, lat_b, lng_b)


def _search_terms(value: str | Sequence[str] | None) -> list[str]:
    if isinstance(value, str):
        raw_value = value
    elif value is None:
        raw_value = ""
    else:
        raw_value = " ".join(str(item) for item in value)
    return [term for term in re.split(r"[^a-z0-9]+", raw_value.lower()) if len(term) >= 2]


class _ContentServiceBackend(Protocol):
    def get_all_spots(self) -> list[Spot]: ...

    def get_spot(self, spot_id: str) -> Spot | None: ...

    def search_spots(self, destination: str, interests: list[str]) -> list[Spot]: ...

    def nearby_spots(self, lat: float, lng: float, radius_km: float, limit: int = 50) -> list[Spot]: ...


class FixtureContentServiceClient:
    """Reads spots from an in-memory tuple. Used by tests and as last-resort
    fallback when Content is unreachable.

    Accepts an override so tests can inject their own spot graph without
    touching the module-level `SAMPLE_SPOTS`.
    """

    def __init__(self, spots: Sequence[Spot] | None = None) -> None:
        self._spots: tuple[Spot, ...] = tuple(spots) if spots is not None else SAMPLE_SPOTS

    def get_all_spots(self) -> list[Spot]:
        return list(self._spots)

    def get_spot(self, spot_id: str) -> Spot | None:
        return next((spot for spot in self._spots if spot.spot_id == spot_id), None)

    def search_spots(self, destination: str, interests: list[str]) -> list[Spot]:
        lowered = (destination or "").lower()
        if "fort worth" in lowered:
            matched = [
                spot
                for spot in self._spots
                if not interests
                or spot.category in interests
                or any(interest in spot.description.lower() for interest in interests)
            ]
            return matched or list(self._spots)
        return list(self._spots)

    def nearby_spots(self, lat: float, lng: float, radius_km: float, limit: int = 50) -> list[Spot]:
        matches = [
            spot
            for spot in self._spots
            if _distance_km(lat, lng, spot.latitude, spot.longitude) <= radius_km
        ]
        matches.sort(key=lambda spot: _distance_km(lat, lng, spot.latitude, spot.longitude))
        return matches[: max(1, limit)]


def _map_content_row(row: dict[str, Any]) -> Spot:
    """Map a Content API spot row onto the Intel `Spot` dataclass.

    Content stores ground-truth creator fields. Intel needs a few derived
    fields (popularity, estimated_cost, is_outdoor) that Content doesn't
    expose directly:
      - popularity = min(100, likes_count * 5 + photos_count)
      - estimated_cost defaults by category (Content doesn't track cost)
      - is_outdoor derived from category

    These are starter heuristics; once `intel.SpotFeatures` is actually read
    back in the ranker, popularity/cost can come from there.
    """

    spot_id = _content_row_spot_id(row)
    category = _content_row_category(row)
    likes_count = _safe_int(row.get("likesCount") or row.get("likes_count") or 0)
    photos_count = _safe_int(row.get("photosCount") or row.get("photos_count") or 0)
    average_rating = row.get("averageRating") or row.get("average_rating")
    rating_value = row.get("rating") if row.get("rating") is not None else average_rating
    rating = _safe_float(rating_value, default=0.0, minimum=0.0, maximum=5.0)

    popularity = float(min(100, likes_count * 5 + photos_count))
    estimated_cost = _DEFAULT_COST_BY_CATEGORY.get(category, 20.0)
    is_outdoor = category in _OUTDOOR_CATEGORIES

    return Spot(
        spot_id=spot_id,
        title=str(row.get("title") or ""),
        description=_content_row_description(row),
        category=category,
        vibe=str(row.get("vibe") or ""),
        rating=rating,
        popularity=popularity,
        estimated_cost=estimated_cost,
        latitude=_coordinate(row.get("latitude"), -90.0, 90.0),
        longitude=_coordinate(row.get("longitude"), -180.0, 180.0),
        is_outdoor=is_outdoor,
        photos_count=photos_count,
        liked_by_users=_content_row_likers(row),
    )


def _content_row_spot_id(row: dict[str, Any]) -> str:
    spot_id = str(row.get("id") or row.get("spotId") or row.get("spot_id") or "").strip()
    if not spot_id:
        raise ValueError("Content spot row is missing an id")
    return spot_id


def _content_row_category(row: dict[str, Any]) -> str:
    return str(row.get("category") or "other").strip().lower() or "other"


def _content_row_likers(row: dict[str, Any]) -> tuple[str, ...]:
    likers = row.get("likedByUsers") or row.get("liked_by_users") or ()
    return tuple(str(user_id) for user_id in likers) if isinstance(likers, (list, tuple)) else ()


def _content_row_description(row: dict[str, Any]) -> str:
    search_context = " ".join(str(row.get(key) or "") for key in _CONTENT_ROW_SEARCH_CONTEXT_KEYS)
    return " ".join(
        part.strip()
        for part in (str(row.get("description") or ""), search_context)
        if part and part.strip()
    )


_CONTENT_ROW_SEARCH_CONTEXT_KEYS = (
    "address",
    "city",
    "state",
    "stateCode",
    "adminArea",
    "region",
    "country",
    "providerPlaceId",
    "provider_place_id",
    "providerPlaceName",
    "provider_place_name",
    "providerPlaceAddress",
    "provider_place_address",
    "verificationSource",
    "verification_source",
    "safetyReason",
    "safety_reason",
)


_DEFAULT_COST_BY_CATEGORY: dict[str, float] = {
    "food": 25.0,
    "nightlife": 40.0,
    "culture": 20.0,
    "shopping": 35.0,
    "entertainment": 45.0,
    "adventure": 30.0,
    "nature": 5.0,
    "outdoors": 5.0,
    "scenic": 0.0,
    "other": 20.0,
}
_OUTDOOR_CATEGORIES = {"nature", "outdoors", "scenic", "adventure"}


class HttpContentServiceClient:
    """Production client: hits `GET /api/content/spots` on the Content service.

    Uses a per-instance `requests.Session` for connection pooling. Callers that
    expect in-request freshness (e.g., `get_spot(id)`) hit the service directly;
    the broader `get_all_spots()` is cached briefly in-process (60s) because
    the ranker is called many times per user session.
    """

    def __init__(
        self,
        base_url: str,
        service_token_header: dict[str, str] | None = None,
        session: Any | None = None,
        timeout: float = HTTP_TIMEOUT_SECONDS,
        fetch_limit: int = DEFAULT_FETCH_LIMIT,
        pool_connections: int = 16,
        pool_maxsize: int = 64,
        max_retries: int = 2,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._fetch_limit = fetch_limit
        self._service_token_header = dict(service_token_header or {})
        if session is not None:
            self._session = session
        else:
            # Local imports so that test environments without `requests`
            # installed can still import this module for type checks.
            import requests
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry

            self._session = requests.Session()
            # Connection pool sized for a gthread gunicorn worker: one TCP
            # conn per active thread, with room to burst. pool_connections
            # is the number of distinct host pools; pool_maxsize is per-pool
            # concurrent connections. Retries cover transient 5xx and
            # connection drops with jittered exponential backoff.
            retry = Retry(
                total=max_retries,
                connect=max_retries,
                read=max_retries,
                status=max_retries,
                backoff_factor=0.2,
                status_forcelist=(500, 502, 503, 504),
                allowed_methods=frozenset(["GET", "HEAD"]),
                raise_on_status=False,
            )
            adapter = HTTPAdapter(
                pool_connections=pool_connections,
                pool_maxsize=pool_maxsize,
                max_retries=retry,
                pool_block=False,
            )
            self._session.mount("http://", adapter)
            self._session.mount("https://", adapter)
        self._all_spots_cache: tuple[float, list[Spot]] | None = None
        self._all_spots_cache_ttl = 60.0

    def get_all_spots(self) -> list[Spot]:
        import time

        now = time.monotonic()
        if self._all_spots_cache is not None:
            cached_at, cached_value = self._all_spots_cache
            if now - cached_at < self._all_spots_cache_ttl:
                return list(cached_value)

        spots = self._fetch_spots(params={"pageSize": self._fetch_limit, "page": 1})
        self._all_spots_cache = (now, spots)
        return list(spots)

    def get_spot(self, spot_id: str) -> Spot | None:
        if not spot_id:
            return None
        url = f"{self._base_url}/spots/{spot_id}"
        try:
            response = self._session.get(url, headers=self._headers(), timeout=self._timeout)
        except Exception:
            logger.warning("content_client_get_spot_failed", extra={"spot_id": spot_id})
            return None
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            logger.warning(
                "content_client_get_spot_error",
                extra={"spot_id": spot_id, "status_code": response.status_code},
            )
            return None
        try:
            payload = response.json()
        except ValueError:
            logger.warning("content_client_get_spot_invalid_json", extra={"spot_id": spot_id})
            return None
        row = payload.get("data") if isinstance(payload, dict) else payload
        if row is None:
            return None
        if isinstance(row, list):
            row = row[0] if row else None
        if row is None:
            return None
        try:
            return _map_content_row(row)
        except ValueError:
            logger.warning("content_client_get_spot_invalid_row", extra={"spot_id": spot_id})
            return None

    def search_spots(self, destination: str, interests: list[str]) -> list[Spot]:
        # Content does not have a destination-query endpoint; we approximate
        # with a broad verified/public pool plus client-side text scoring over
        # title, city, country, category, vibe, provider identity, and context.
        # A future endpoint can replace this with geocode -> nearby lookup.
        params: dict[str, Any] = {"pageSize": self._fetch_limit}
        spots = self._fetch_spots(params=params)
        destination_terms = _search_terms(destination)
        interest_terms = _search_terms(interests)
        if not destination_terms and not interest_terms:
            return spots

        def haystack(spot: Spot) -> str:
            return f"{spot.title} {spot.description} {spot.category} {spot.vibe}".lower()

        def destination_match_strength(spot: Spot) -> int:
            text = haystack(spot)
            if not destination_terms:
                return 1
            matched = sum(1 for term in destination_terms if term in text)
            if matched == len(destination_terms):
                return 2
            return 1 if matched else 0

        def interest_matches(spot: Spot) -> bool:
            if not interest_terms:
                return True
            text = haystack(spot)
            return spot.category in interest_terms or any(term in text for term in interest_terms)

        def score(spot: Spot) -> float:
            text = haystack(spot)
            destination_score = sum(4 for term in destination_terms if term in text)
            interest_score = sum(2 for term in interest_terms if term in text)
            category_bonus = 3 if spot.category in interest_terms else 0
            return destination_score + interest_score + category_bonus + (spot.rating / 10) + (spot.popularity / 100)

        destination_matches = [spot for spot in spots if destination_match_strength(spot) == 2]
        if not destination_matches:
            destination_matches = [spot for spot in spots if destination_match_strength(spot) == 1]
        if not destination_matches:
            destination_matches = spots

        interest_filtered = [spot for spot in destination_matches if interest_matches(spot)]
        candidates = interest_filtered or destination_matches
        return sorted(candidates, key=score, reverse=True)

    def nearby_spots(self, lat: float, lng: float, radius_km: float, limit: int = 50) -> list[Spot]:
        spots = self._fetch_spots(
            params={
                "lat": lat,
                "lng": lng,
                "radius": radius_km,
                "pageSize": min(max(int(limit), 1), self._fetch_limit),
                "page": 1,
            },
            path="/spots/nearby",
        )
        spots.sort(key=lambda spot: _distance_km(lat, lng, spot.latitude, spot.longitude))
        return spots[: max(1, limit)]

    def _fetch_spots(self, params: dict[str, Any], path: str = "/spots/") -> list[Spot]:
        url = f"{self._base_url}{path}"
        try:
            response = self._session.get(
                url,
                params=params,
                headers=self._headers(),
                timeout=self._timeout,
            )
        except Exception:
            logger.warning("content_client_fetch_failed", extra={"url": url})
            return []
        if response.status_code >= 400:
            logger.warning(
                "content_client_fetch_error",
                extra={"status_code": response.status_code, "url": url},
            )
            return []
        try:
            payload = response.json()
        except ValueError:
            logger.warning("content_client_fetch_invalid_json", extra={"url": url})
            return []
        # DRF pagination wraps results in {"data": [...], "meta": {...}} via
        # AppendixB response shape. We also tolerate bare lists for robustness.
        rows: list[dict[str, Any]]
        if isinstance(payload, dict):
            rows = payload.get("data") or payload.get("results") or []
        elif isinstance(payload, list):
            rows = payload
        else:
            rows = []
        spots: list[Spot] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            try:
                spots.append(_map_content_row(row))
            except ValueError:
                logger.warning(
                    "content_client_fetch_skipping_invalid_row",
                    extra={"url": url, "spot_id": row.get("id") or row.get("spotId") or row.get("spot_id")},
                )
        return spots

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Accept": "application/json"}
        headers.update(self._service_token_header)
        if has_request_context():
            authorization = request.headers.get("Authorization", "")
            if authorization:
                headers["Authorization"] = authorization
        return headers


_CONTENT_CLIENT_EXTENSION_KEY = "scope_intel_content_client"


def build_content_service_client() -> _ContentServiceBackend:
    """Pick the right backend for the current Flask app context.

    Rules:
      - If there is no app context (e.g., module import before `create_app`),
        return a fixture client so module-level singletons keep working.
      - If `TESTING` is set, return fixtures.
      - If `CONTENT_SERVICE_URL` is empty outside tests, fail fast.
      - Otherwise, return an HTTP client pointed at `CONTENT_SERVICE_URL`.

    The HTTP client is cached on `current_app.extensions` so every request in
    a gunicorn worker reuses the same `requests.Session` (and thus the same
    connection pool + the 60s `get_all_spots` cache). Without this cache, the
    default `ContentServiceClient()` constructor used by the blueprint-level
    singleton re-instantiates the client (and its pool) on every call.
    """

    if not has_app_context():
        return FixtureContentServiceClient()

    config = current_app.config
    if config.get("TESTING"):
        return FixtureContentServiceClient()

    base_url = config.get("CONTENT_SERVICE_URL")
    if not base_url:
        raise RuntimeError("CONTENT_SERVICE_URL must be configured for scope-intel outside tests")

    extensions = current_app.extensions
    cached = extensions.get(_CONTENT_CLIENT_EXTENSION_KEY)
    if cached is not None and getattr(cached, "_base_url", None) == base_url.rstrip("/"):
        return cached

    client = HttpContentServiceClient(base_url=base_url)
    extensions[_CONTENT_CLIENT_EXTENSION_KEY] = client
    return client


class ContentServiceClient:
    """Legacy public surface.

    `ContentServiceClient()` instantiated at module-import time delegates to
    a lazily-resolved backend so blueprint-level singletons remain valid across
    both production (HTTP) and test (fixture) configurations.

    Callers that need to inject a backend explicitly should use
    `FixtureContentServiceClient` or `HttpContentServiceClient` directly.
    """

    def __init__(self, backend: _ContentServiceBackend | None = None) -> None:
        self._explicit_backend = backend

    def _backend(self) -> _ContentServiceBackend:
        if self._explicit_backend is not None:
            return self._explicit_backend
        return build_content_service_client()

    def get_all_spots(self) -> list[Spot]:
        return self._backend().get_all_spots()

    def get_spot(self, spot_id: str) -> Spot | None:
        return self._backend().get_spot(spot_id)

    def search_spots(self, destination: str, interests: list[str]) -> list[Spot]:
        return self._backend().search_spots(destination, interests)
