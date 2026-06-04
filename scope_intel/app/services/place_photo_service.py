from __future__ import annotations

from typing import Any

import requests
from flask import current_app

from app.services.geo_math import haversine_distance_km
from app.services.google_places_usage_guard import GooglePlacesUsageGuard
from app.services.provider_payload import normalize_provider_text, safe_provider_coordinate


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
        normalized_query = self._normalize_text(query, 160)
        normalized_address = self._normalize_text(address, 220)
        max_width_px = min(max(int(max_width_px), 128), 1600)
        api_key = (current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()

        if not normalized_query:
            return self._empty_response(configured=bool(api_key), coverage="A place name is required before loading a photo.")

        if not api_key:
            return self._empty_response(
                configured=False,
                coverage="Set GOOGLE_PLACES_API_KEY to show Google Places photos for clicked map places.",
            )

        base_url = str(current_app.config.get("GOOGLE_PLACES_BASE_URL") or "https://places.googleapis.com/v1").rstrip("/")
        search_usage = self._usage_guard.consume(
            "places_text_search_pro",
            self._monthly_cap("GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP", 5000),
        )
        if not search_usage["allowed"]:
            return self._cap_response("Text Search Pro", search_usage)

        try:
            search_response = requests.post(
                f"{base_url}/places:searchText",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": GOOGLE_PLACE_PHOTO_FIELD_MASK,
                },
                json={
                    "textQuery": self._build_text_query(normalized_query, normalized_address),
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
                },
                timeout=5,
            )
            search_response.raise_for_status()
            search_body = search_response.json()
        except requests.RequestException as exc:
            return self._empty_response(configured=True, coverage=self._google_error_message(exc, "photo search"))
        except ValueError:
            return self._empty_response(configured=True, coverage="Google Places returned an unreadable photo search response.")

        place = self._select_photo_place(search_body.get("places", []), origin_lat=lat, origin_lng=lng)
        photo = self._first_photo(place) if place else None
        photo_name = self._normalize_text(photo.get("name") if photo else None, 512)
        if not photo_name:
            return self._empty_response(configured=True, coverage="Google Places did not return a photo for this place.")

        photo_usage = self._usage_guard.consume(
            "places_place_details_photos",
            self._monthly_cap("GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP", 1000),
        )
        if not photo_usage["allowed"]:
            return self._cap_response("Place Details Photos", photo_usage)

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
            photo_body = photo_response.json()
        except requests.RequestException as exc:
            return self._empty_response(configured=True, coverage=self._google_error_message(exc, "photo media"))
        except ValueError:
            return self._empty_response(configured=True, coverage="Google Places returned an unreadable photo media response.")

        photo_url = self._normalize_text(photo_body.get("photoUri"), 2048)
        if not photo_url:
            return self._empty_response(configured=True, coverage="Google Places did not return a usable photo URL.")

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
    def _distance_km(origin_lat: float, origin_lng: float, lat: float | None, lng: float | None) -> float:
        if lat is None or lng is None:
            return float("inf")

        return haversine_distance_km(origin_lat, origin_lng, lat, lng)

    @classmethod
    def _place_distance_km(cls, place: dict[str, Any], *, origin_lat: float, origin_lng: float) -> float:
        location = place.get("location") if isinstance(place.get("location"), dict) else {}
        return cls._distance_km(
            origin_lat,
            origin_lng,
            cls._safe_float(location.get("latitude")),
            cls._safe_float(location.get("longitude")),
        )

    @classmethod
    def _select_photo_place(cls, places: Any, *, origin_lat: float, origin_lng: float) -> dict[str, Any] | None:
        if not isinstance(places, list):
            return None

        photo_places = [
            place
            for place in places
            if isinstance(place, dict) and cls._first_photo(place) is not None
        ]
        photo_places.sort(key=lambda place: cls._place_distance_km(place, origin_lat=origin_lat, origin_lng=origin_lng))
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
    def _first_photo_attribution(cls, photo: dict[str, Any] | None) -> dict[str, str | None]:
        attributions = photo.get("authorAttributions") if isinstance(photo, dict) else None
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
            return f"Google Places {operation} failed with status {response.status_code}."

        return f"Google Places {operation} is temporarily unavailable."
