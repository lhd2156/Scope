from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any
from urllib.parse import quote

import requests
from flask import current_app

from app.services.geo_math import haversine_distance_meters
from app.services.google_places_usage_guard import GooglePlacesUsageGuard
from app.services.provider_payload import normalize_provider_text, safe_provider_coordinate


GOOGLE_PLACE_VERIFY_MAX_RESULTS = 5
GOOGLE_PLACE_VERIFY_SEARCH_RADIUS_METERS = 1200
GOOGLE_PLACE_VERIFY_MAX_DISTANCE_METERS = 200
GOOGLE_PLACE_VERIFY_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.types",
        "places.businessStatus",
        "places.addressComponents",
    ]
)


class PlaceVerificationService:
    def __init__(self) -> None:
        self._usage_guard = GooglePlacesUsageGuard()

    def verify(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = self._normalize_text(payload.get("title"), 160)
        address = self._normalize_text(payload.get("address"), 240)
        city = self._normalize_text(payload.get("city"), 120)
        country = self._normalize_text(payload.get("country"), 80)
        postal_code = self._normalize_text(payload.get("postalCode") or payload.get("postal_code"), 32)
        provider_place_id = self._normalize_text(payload.get("providerPlaceId") or payload.get("provider_place_id"), 255)
        lat = self._safe_float(payload.get("latitude"))
        lng = self._safe_float(payload.get("longitude"))

        if not title or lat is None or lng is None:
            return self._failure("A place name and valid pin coordinates are required.")

        query = self._build_text_query(title, address, city, country, postal_code)
        candidates = self._search_google(query, lat, lng)
        if candidates is None:
            candidates = self._search_mapbox(query, lat, lng)
        if candidates is None:
            return self._failure("No provider-backed place verification source is configured.")
        if not candidates:
            return self._failure("No provider-backed place matched that pin.", candidates=[])

        ranked_candidates = sorted(candidates, key=lambda candidate: candidate["distanceMeters"])
        for candidate in ranked_candidates:
            if self._candidate_verifies(
                candidate,
                title=title,
                address=address,
                provider_place_id=provider_place_id,
            ):
                return {
                    "verified": True,
                    "source": candidate["source"],
                    "providerPlaceId": candidate["providerPlaceId"],
                    "providerPlaceName": candidate["providerPlaceName"],
                    "providerPlaceAddress": candidate["providerPlaceAddress"],
                    "city": candidate.get("city", ""),
                    "country": candidate.get("country", ""),
                    "postalCode": candidate.get("postalCode", ""),
                    "latitude": candidate["latitude"],
                    "longitude": candidate["longitude"],
                    "distanceMeters": candidate["distanceMeters"],
                    "precision": candidate["precision"],
                    "reason": "",
                    "candidates": self._public_candidates(ranked_candidates),
                }

        nearest = ranked_candidates[0]
        if nearest["distanceMeters"] > GOOGLE_PLACE_VERIFY_MAX_DISTANCE_METERS:
            reason = "The nearest provider-backed place is too far from the pin."
        elif nearest["precision"] not in {"poi", "address"}:
            reason = "Choose a specific POI or street address, not a city or broad area."
        else:
            reason = "The provider-backed place does not match the submitted name or address closely enough."

        return self._failure(reason, candidates=self._public_candidates(ranked_candidates))

    def _search_google(self, query: str, lat: float, lng: float) -> list[dict[str, Any]] | None:
        api_key = self._google_api_key()
        if not api_key:
            return None

        if not self._consume_google_text_search():
            return []

        base_url = self._google_base_url()
        try:
            response = requests.post(
                f"{base_url}/places:searchText",
                headers=self._google_search_headers(api_key),
                json=self._google_search_payload(query, lat, lng),
                timeout=5,
            )
            response.raise_for_status()
            body = response.json()
        except (requests.RequestException, ValueError):
            return []

        places = body.get("places")
        if not isinstance(places, list):
            return []

        candidates = []
        for place in places:
            if not isinstance(place, dict):
                continue
            candidate = self._google_place_candidate(place, origin_lat=lat, origin_lng=lng)
            if candidate is not None:
                candidates.append(candidate)
        return candidates

    @staticmethod
    def _google_api_key() -> str:
        return (current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()

    @staticmethod
    def _google_base_url() -> str:
        return str(current_app.config.get("GOOGLE_PLACES_BASE_URL") or "https://places.googleapis.com/v1").rstrip("/")

    def _consume_google_text_search(self) -> bool:
        usage = self._usage_guard.consume(
            "places_text_search_pro",
            self._monthly_cap("GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP", 5000),
        )
        return bool(usage["allowed"])

    @staticmethod
    def _google_search_headers(api_key: str) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": GOOGLE_PLACE_VERIFY_FIELD_MASK,
        }

    @staticmethod
    def _google_search_payload(query: str, lat: float, lng: float) -> dict[str, Any]:
        return {
            "textQuery": query,
            "maxResultCount": GOOGLE_PLACE_VERIFY_MAX_RESULTS,
            "locationBias": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": GOOGLE_PLACE_VERIFY_SEARCH_RADIUS_METERS,
                },
            },
        }

    def _google_place_candidate(self, place: dict[str, Any], *, origin_lat: float, origin_lng: float) -> dict[str, Any] | None:
        location = place.get("location") if isinstance(place.get("location"), dict) else {}
        candidate_lat = self._safe_float(location.get("latitude"))
        candidate_lng = self._safe_float(location.get("longitude"))
        if candidate_lat is None or candidate_lng is None:
            return None

        name = self._normalize_text((place.get("displayName") or {}).get("text") if isinstance(place.get("displayName"), dict) else "", 255)
        address = self._normalize_text(place.get("formattedAddress"), 500)
        address_components = place.get("addressComponents") if isinstance(place.get("addressComponents"), list) else []
        return {
            "source": "google_places",
            "providerPlaceId": self._normalize_text(place.get("id"), 255),
            "providerPlaceName": name,
            "providerPlaceAddress": address,
            "city": self._google_component(address_components, {"locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2"}),
            "country": self._google_component(address_components, {"country"}, prefer_short=True),
            "postalCode": self._google_component(address_components, {"postal_code"}),
            "latitude": candidate_lat,
            "longitude": candidate_lng,
            "distanceMeters": round(self._distance_meters(origin_lat, origin_lng, candidate_lat, candidate_lng), 1),
            "precision": self._google_precision(place),
        }

    def _search_mapbox(self, query: str, lat: float, lng: float) -> list[dict[str, Any]] | None:
        access_token = (current_app.config.get("MAPBOX_ACCESS_TOKEN") or "").strip()
        if not access_token:
            return None

        try:
            response = requests.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{quote(query)}.json",
                params={
                    "access_token": access_token,
                    "limit": GOOGLE_PLACE_VERIFY_MAX_RESULTS,
                    "types": "poi,address",
                    "proximity": f"{lng},{lat}",
                },
                timeout=5,
            )
            response.raise_for_status()
            body = response.json()
        except (requests.RequestException, ValueError):
            return []

        features = body.get("features")
        if not isinstance(features, list):
            return []

        candidates = []
        for feature in features:
            if not isinstance(feature, dict):
                continue
            center = feature.get("center") if isinstance(feature.get("center"), list) else []
            candidate_lng = self._safe_float(center[0] if len(center) > 0 else None)
            candidate_lat = self._safe_float(center[1] if len(center) > 1 else None)
            if candidate_lat is None or candidate_lng is None:
                continue
            precision = self._normalize_text((feature.get("place_type") or [""])[0] if isinstance(feature.get("place_type"), list) else "", 40)
            context = feature.get("context") if isinstance(feature.get("context"), list) else []
            place_name = self._normalize_text(feature.get("place_name"), 500)
            candidates.append(
                {
                    "source": "mapbox",
                    "providerPlaceId": self._normalize_text(feature.get("id"), 255),
                    "providerPlaceName": self._normalize_text(feature.get("text"), 255),
                    "providerPlaceAddress": place_name,
                    "city": self._mapbox_city_from_place_name(place_name)
                    or self._mapbox_context_value(context, ("place",))
                    or self._mapbox_context_value(context, ("locality",))
                    or self._mapbox_context_value(context, ("neighborhood",)),
                    "country": self._mapbox_context_short_code(context, ("country",)) or self._mapbox_context_value(context, ("country",)),
                    "postalCode": self._mapbox_context_value(context, ("postcode",)),
                    "latitude": candidate_lat,
                    "longitude": candidate_lng,
                    "distanceMeters": round(self._distance_meters(lat, lng, candidate_lat, candidate_lng), 1),
                    "precision": "poi" if precision == "poi" else "address" if precision == "address" else precision,
                }
            )
        return candidates

    @staticmethod
    def _candidate_verifies(candidate: dict[str, Any], *, title: str, address: str, provider_place_id: str) -> bool:
        if candidate["distanceMeters"] > GOOGLE_PLACE_VERIFY_MAX_DISTANCE_METERS:
            return False
        if candidate["precision"] not in {"poi", "address"}:
            return False
        if provider_place_id and provider_place_id == candidate.get("providerPlaceId"):
            return True

        candidate_tokens = PlaceVerificationService._tokens(
            " ".join([candidate.get("providerPlaceName", ""), candidate.get("providerPlaceAddress", "")])
        )
        title_tokens = PlaceVerificationService._tokens(title)
        address_tokens = PlaceVerificationService._tokens(address)

        name_match = bool(title_tokens and PlaceVerificationService._token_overlap_count(title_tokens, candidate_tokens) >= 1)
        address_match_count = PlaceVerificationService._token_overlap_count(address_tokens, candidate_tokens)
        address_match = address_match_count >= min(2, max(1, len(address_tokens)))
        close_pin = candidate["distanceMeters"] <= 75

        if candidate["precision"] == "address" and address_match:
            return True
        return (name_match and (address_match or close_pin)) or (address_match and close_pin)

    @staticmethod
    def _public_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "source": candidate["source"],
                "providerPlaceId": candidate["providerPlaceId"],
                "providerPlaceName": candidate["providerPlaceName"],
                "providerPlaceAddress": candidate["providerPlaceAddress"],
                "city": candidate.get("city", ""),
                "country": candidate.get("country", ""),
                "postalCode": candidate.get("postalCode", ""),
                "distanceMeters": candidate["distanceMeters"],
                "precision": candidate["precision"],
            }
            for candidate in candidates[:5]
        ]

    @staticmethod
    def _failure(reason: str, candidates: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return {
            "verified": False,
            "source": "",
            "providerPlaceId": "",
            "providerPlaceName": "",
            "providerPlaceAddress": "",
            "city": "",
            "country": "",
            "postalCode": "",
            "distanceMeters": None,
            "precision": "",
            "reason": reason,
            "candidates": candidates or [],
        }

    @staticmethod
    def _normalize_text(value: Any, max_length: int) -> str:
        return normalize_provider_text(value, max_length)

    @staticmethod
    def _build_text_query(title: str, address: str, city: str, country: str, postal_code: str = "") -> str:
        return " ".join([title, address, city, country, postal_code]).strip()[:320]

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        return safe_provider_coordinate(value)

    @staticmethod
    def _distance_meters(origin_lat: float, origin_lng: float, lat: float, lng: float) -> float:
        return haversine_distance_meters(origin_lat, origin_lng, lat, lng)

    @staticmethod
    def _google_precision(place: dict[str, Any]) -> str:
        primary_type = PlaceVerificationService._normalize_text(place.get("primaryType"), 80)
        raw_types = place.get("types") if isinstance(place.get("types"), list) else []
        types = {PlaceVerificationService._normalize_text(value, 80) for value in raw_types}
        if primary_type:
            types.add(primary_type)
        if {"street_address", "premise", "subpremise"}.intersection(types):
            return "address"
        if {"locality", "postal_town", "administrative_area_level_1", "country"}.intersection(types):
            return "city"
        if {"point_of_interest", "establishment", "tourist_attraction", "restaurant", "cafe", "bar", "park", "store"}.intersection(types):
            return "poi"
        return "poi" if types else ""

    @staticmethod
    def _tokens(value: str) -> set[str]:
        stop_words = {"the", "and", "for", "with", "near", "street", "road", "avenue", "drive", "suite", "unit"}
        return {
            token
            for token in "".join(character.lower() if character.isalnum() else " " for character in value).split()
            if len(token) > 2 and token not in stop_words
        }

    @staticmethod
    def _token_overlap_count(submitted_tokens: set[str], candidate_tokens: set[str]) -> int:
        matched_candidates: set[str] = set()
        count = 0
        for submitted_token in submitted_tokens:
            for candidate_token in candidate_tokens:
                if candidate_token in matched_candidates:
                    continue
                if submitted_token == candidate_token or SequenceMatcher(None, submitted_token, candidate_token).ratio() >= 0.8:
                    matched_candidates.add(candidate_token)
                    count += 1
                    break
        return count

    @staticmethod
    def _google_component(components: list[dict[str, Any]], wanted_types: set[str], prefer_short: bool = False) -> str:
        for component in components:
            if not isinstance(component, dict):
                continue
            component_types = component.get("types") if isinstance(component.get("types"), list) else []
            if not wanted_types.intersection({str(value) for value in component_types}):
                continue
            primary_key = "shortText" if prefer_short else "longText"
            fallback_key = "longText" if prefer_short else "shortText"
            return PlaceVerificationService._normalize_text(component.get(primary_key) or component.get(fallback_key), 120)
        return ""

    @staticmethod
    def _mapbox_context_value(context: list[dict], prefixes: tuple[str, ...]) -> str:
        for item in context:
            identifier = str(item.get("id") or "")
            if any(identifier.startswith(f"{prefix}.") for prefix in prefixes):
                return PlaceVerificationService._normalize_text(item.get("text"), 120)
        return ""

    @staticmethod
    def _mapbox_context_short_code(context: list[dict], prefixes: tuple[str, ...]) -> str:
        for item in context:
            identifier = str(item.get("id") or "")
            if any(identifier.startswith(f"{prefix}.") for prefix in prefixes):
                return PlaceVerificationService._normalize_text(item.get("short_code"), 24).upper()
        return ""

    @staticmethod
    def _mapbox_city_from_place_name(place_name: str) -> str:
        parts = [PlaceVerificationService._normalize_text(part, 120) for part in place_name.split(",")]
        parts = [part for part in parts if part]
        if len(parts) < 3:
            return ""

        # Address results are usually "street, city, region postal, country".
        first_part = parts[0]
        if any(character.isdigit() for character in first_part) or any(
            token in first_part.lower().split()
            for token in {"street", "st", "avenue", "ave", "road", "rd", "drive", "dr", "boulevard", "blvd", "lane", "ln"}
        ):
            return parts[1]
        return ""

    @staticmethod
    def _monthly_cap(config_key: str, fallback: int) -> int:
        value = current_app.config.get(config_key)
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback
