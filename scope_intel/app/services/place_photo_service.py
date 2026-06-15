from __future__ import annotations

from typing import Any

import requests
from flask import current_app

from app.services.geo_math import haversine_distance_km
from app.services.google_places_usage_guard import GooglePlacesUsageGuard
from app.services.provider_payload import (
    normalize_provider_text,
    safe_provider_coordinate,
)


GOOGLE_PLACE_PHOTO_MAX_RESULTS = 3
GOOGLE_PLACE_PHOTO_SEARCH_RADIUS_METERS = 1200
GOOGLE_PLACE_PHOTO_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.photos",
    ]
)


class PlacePhotoService:
    def __init__(self) -> None:
        self._usage_guard = GooglePlacesUsageGuard()

    def get_featured_photo(
        self,
        *,
        query: str,
        lat: float,
        lng: float,
        address: str | None = None,
        max_width_px: int = 640,
    ) -> dict[str, Any]:
        normalized_query, normalized_address, max_width_px = self._normalize_request(
            query=query,
            address=address,
            max_width_px=max_width_px,
        )
        api_key = self._api_key()

        unavailable_response = self._unavailable_response(
            normalized_query=normalized_query,
            api_key=api_key,
        )
        if unavailable_response is not None:
            return unavailable_response

        base_url = self._base_url()
        photo, photo_name, candidate_error = self._find_photo_candidate(
            base_url=base_url,
            api_key=api_key,
            query=normalized_query,
            address=normalized_address,
            lat=lat,
            lng=lng,
        )
        if candidate_error is not None:
            return candidate_error

        photo_url, photo_error = self._resolve_photo_url(
            base_url=base_url,
            api_key=api_key,
            photo_name=photo_name,
            max_width_px=max_width_px,
        )
        if photo_error is not None:
            return photo_error

        return self._photo_response(photo_url, photo)

    @classmethod
    def _normalize_request(
        cls, *, query: str, address: str | None, max_width_px: int
    ) -> tuple[str, str, int]:
        return (
            cls._normalize_text(query, 160),
            cls._normalize_text(address, 220),
            cls._normalize_max_width_px(max_width_px),
        )

    def _unavailable_response(
        self, *, normalized_query: str, api_key: str
    ) -> dict[str, Any] | None:
        if not normalized_query:
            return self._missing_query_response(api_key)

        if not api_key:
            return self._missing_api_key_response()

        return None

    def _find_photo_candidate(
        self,
        *,
        base_url: str,
        api_key: str,
        query: str,
        address: str,
        lat: float,
        lng: float,
    ) -> tuple[dict[str, Any] | None, str, dict[str, Any] | None]:
        capped_response = self._consume_or_cap(
            sku="places_text_search_pro",
            cap_config_key="GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP",
            fallback_cap=5000,
            label="Text Search Pro",
        )
        if capped_response is not None:
            return None, "", capped_response

        search_body, search_error = self._search_places(
            base_url=base_url,
            api_key=api_key,
            query=query,
            address=address,
            lat=lat,
            lng=lng,
        )
        if search_error is not None:
            return None, "", search_error

        _, photo, photo_name = self._select_photo_from_search(
            search_body,
            lat=lat,
            lng=lng,
        )
        if not photo_name:
            return photo, photo_name, self._empty_response(
                configured=True,
                coverage="Google Places did not return a photo for this place.",
            )

        return photo, photo_name, None

    def _resolve_photo_url(
        self,
        *,
        base_url: str,
        api_key: str,
        photo_name: str,
        max_width_px: int,
    ) -> tuple[str, dict[str, Any] | None]:
        capped_response = self._consume_or_cap(
            sku="places_place_details_photos",
            cap_config_key="GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP",
            fallback_cap=1000,
            label="Place Details Photos",
        )
        if capped_response is not None:
            return "", capped_response

        photo_body, photo_error = self._fetch_photo_media(
            base_url=base_url,
            api_key=api_key,
            photo_name=photo_name,
            max_width_px=max_width_px,
        )
        if photo_error is not None:
            return "", photo_error

        photo_url = self._normalize_text(photo_body.get("photoUri"), 2048)
        if not photo_url:
            return "", self._empty_response(
                configured=True,
                coverage="Google Places did not return a usable photo URL.",
            )

        return photo_url, None

    def _missing_query_response(self, api_key: str) -> dict[str, Any]:
        return self._empty_response(
            configured=bool(api_key),
            coverage="A place name is required before loading a photo.",
        )

    def _missing_api_key_response(self) -> dict[str, Any]:
        return self._empty_response(
            configured=False,
            coverage="Set GOOGLE_PLACES_API_KEY to show Google Places photos for clicked map places.",
        )

    def _select_photo_from_search(self, search_body: Any, *, lat: float, lng: float) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str]:
        place = self._select_photo_place(
            search_body.get("places", []) if isinstance(search_body, dict) else [],
            origin_lat=lat,
            origin_lng=lng,
        )
        photo = self._first_photo(place) if place else None
        photo_name = self._normalize_text(photo.get("name") if photo else None, 512)
        return place, photo, photo_name

    def _photo_response(self, photo_url: str, photo: dict[str, Any] | None) -> dict[str, Any]:
        attribution = self._first_photo_attribution(photo)
        return {
            "configured": True,
            "coverage": "Google Places photo coverage for the clicked place when a place photo is available.",
            "photoUrl": photo_url,
            "photoAttribution": attribution.get("displayName"),
            "photoAttributionUrl": attribution.get("uri"),
            "source": "Google Places",
            "license": "Google Maps Platform",
        }

    @staticmethod
    def _api_key() -> str:
        return (current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()

    @staticmethod
    def _base_url() -> str:
        return str(
            current_app.config.get("GOOGLE_PLACES_BASE_URL")
            or "https://places.googleapis.com/v1"
        ).rstrip("/")

    @staticmethod
    def _normalize_max_width_px(max_width_px: int) -> int:
        return min(max(int(max_width_px), 128), 1600)

    def _consume_or_cap(
        self, *, sku: str, cap_config_key: str, fallback_cap: int, label: str
    ) -> dict[str, Any] | None:
        usage = self._usage_guard.consume(
            sku,
            self._monthly_cap(cap_config_key, fallback_cap),
        )
        if not usage["allowed"]:
            return self._cap_response(label, usage)

        return None

    def _search_places(
        self,
        *,
        base_url: str,
        api_key: str,
        query: str,
        address: str,
        lat: float,
        lng: float,
    ) -> tuple[Any, dict[str, Any] | None]:
        try:
            search_response = requests.post(
                f"{base_url}/places:searchText",
                headers=self._search_headers(api_key),
                json=self._search_payload(
                    query=query, address=address, lat=lat, lng=lng
                ),
                timeout=5,
            )
            search_response.raise_for_status()
            return search_response.json(), None
        except requests.RequestException as exc:
            return None, self._empty_response(
                configured=True,
                coverage=self._google_error_message(exc, "photo search"),
            )
        except ValueError:
            return None, self._empty_response(
                configured=True,
                coverage="Google Places returned an unreadable photo search response.",
            )

    @staticmethod
    def _search_headers(api_key: str) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": GOOGLE_PLACE_PHOTO_FIELD_MASK,
        }

    def _search_payload(
        self, *, query: str, address: str, lat: float, lng: float
    ) -> dict[str, Any]:
        return {
            "textQuery": self._build_text_query(query, address),
            "maxResultCount": GOOGLE_PLACE_PHOTO_MAX_RESULTS,
            "locationBias": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng,
                    },
                    "radius": GOOGLE_PLACE_PHOTO_SEARCH_RADIUS_METERS,
                },
            },
        }

    def _fetch_photo_media(
        self,
        *,
        base_url: str,
        api_key: str,
        photo_name: str,
        max_width_px: int,
    ) -> tuple[Any, dict[str, Any] | None]:
        try:
            photo_response = requests.get(
                f"{base_url}/{photo_name}/media",
                params={
                    "key": api_key,
                    "maxWidthPx": max_width_px,
                    "skipHttpRedirect": "true",
                },
                timeout=5,
            )
            photo_response.raise_for_status()
            return photo_response.json(), None
        except requests.RequestException as exc:
            return None, self._empty_response(
                configured=True, coverage=self._google_error_message(exc, "photo media")
            )
        except ValueError:
            return None, self._empty_response(
                configured=True,
                coverage="Google Places returned an unreadable photo media response.",
            )

    @staticmethod
    def _empty_response(*, configured: bool, coverage: str) -> dict[str, Any]:
        return {
            "configured": configured,
            "coverage": coverage,
            "photoUrl": None,
            "source": "Google Places",
            "license": "Google Maps Platform",
        }

    @classmethod
    def _cap_response(cls, label: str, usage: dict[str, Any]) -> dict[str, Any]:
        return cls._empty_response(
            configured=True,
            coverage=(
                f"Google Places {label} monthly free usage cap reached "
                f"({usage['cap']}/month). Photo lookup stopped before pay-as-you-go usage."
            ),
        )

    @staticmethod
    def _monthly_cap(config_key: str, fallback: int) -> int:
        value = current_app.config.get(config_key)
        if value is None:
            return fallback

        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback

    @staticmethod
    def _normalize_text(value: Any, max_length: int) -> str:
        return normalize_provider_text(value, max_length)

    @staticmethod
    def _build_text_query(query: str, address: str) -> str:
        return " ".join([query, address]).strip()[:260]

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        return safe_provider_coordinate(value)

    @staticmethod
    def _distance_km(
        origin_lat: float, origin_lng: float, lat: float | None, lng: float | None
    ) -> float:
        if lat is None or lng is None:
            return float("inf")

        return haversine_distance_km(origin_lat, origin_lng, lat, lng)

    @classmethod
    def _place_distance_km(
        cls, place: dict[str, Any], *, origin_lat: float, origin_lng: float
    ) -> float:
        location = (
            place.get("location") if isinstance(place.get("location"), dict) else {}
        )
        return cls._distance_km(
            origin_lat,
            origin_lng,
            cls._safe_float(location.get("latitude")),
            cls._safe_float(location.get("longitude")),
        )

    @classmethod
    def _select_photo_place(
        cls, places: Any, *, origin_lat: float, origin_lng: float
    ) -> dict[str, Any] | None:
        if not isinstance(places, list):
            return None

        photo_places = [
            place
            for place in places
            if isinstance(place, dict) and cls._first_photo(place) is not None
        ]
        photo_places.sort(
            key=lambda place: cls._place_distance_km(
                place, origin_lat=origin_lat, origin_lng=origin_lng
            )
        )
        return photo_places[0] if photo_places else None

    @staticmethod
    def _first_photo(place: dict[str, Any] | None) -> dict[str, Any] | None:
        photos = place.get("photos") if isinstance(place, dict) else None
        if not isinstance(photos, list):
            return None

        for photo in photos:
            if isinstance(photo, dict) and photo.get("name"):
                return photo

        return None

    @classmethod
    def _first_photo_attribution(
        cls, photo: dict[str, Any] | None
    ) -> dict[str, str | None]:
        attributions = (
            photo.get("authorAttributions") if isinstance(photo, dict) else None
        )
        if not isinstance(attributions, list):
            return {"displayName": None, "uri": None}

        for attribution in attributions:
            if not isinstance(attribution, dict):
                continue

            display_name = cls._normalize_text(attribution.get("displayName"), 120)
            uri = cls._normalize_text(attribution.get("uri"), 2048)
            if display_name or uri:
                return {
                    "displayName": display_name or None,
                    "uri": uri or None,
                }

        return {"displayName": None, "uri": None}

    @staticmethod
    def _google_error_message(exc: requests.RequestException, operation: str) -> str:
        response = getattr(exc, "response", None)
        if response is not None:
            return (
                f"Google Places {operation} failed with status {response.status_code}."
            )

        return f"Google Places {operation} is temporarily unavailable."
