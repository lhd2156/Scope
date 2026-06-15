from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any

import requests
from flask import current_app

from app.services.content_client import ContentServiceClient
from app.services.geo_math import haversine_distance_km
from app.services.google_places_usage_guard import GooglePlacesUsageGuard
from app.services.provider_payload import normalize_provider_text
from app.services.spot import Spot
from app.services.travel_nearby_scoring import score_travel_suggestion


GOOGLE_PLACES_MAX_RESULT_COUNT = 20
GOOGLE_PLACE_PHOTO_MAX_WIDTH_PX = 480
GOOGLE_FIELD_MASK_BASIC = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.types",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.businessStatus",
        "places.currentOpeningHours",
        "places.websiteUri",
        "places.photos",
    ]
)
GOOGLE_FIELD_MASK_FUEL = f"{GOOGLE_FIELD_MASK_BASIC},places.fuelOptions"

TRAVEL_CATEGORY_CONFIG: dict[str, dict[str, Any]] = {
    "recommended": {
        "label": "Recommended",
        "google_types": ["tourist_attraction", "restaurant", "cafe", "park", "museum", "hotel", "campground", "amusement_park", "bowling_alley", "movie_theater", "bar", "night_club"],
        "scope_categories": {"food", "nature", "scenic", "culture", "adventure", "shopping", "entertainment", "nightlife"},
    },
    "fuel": {
        "label": "Fuel/EV",
        "google_types": ["gas_station", "electric_vehicle_charging_station"],
        "scope_categories": set(),
    },
    "food": {
        "label": "Food",
        "google_types": ["restaurant", "cafe", "bakery"],
        "scope_categories": {"food", "nightlife"},
    },
    "stay": {
        "label": "Stay",
        "google_types": ["hotel", "motel", "hostel", "campground", "rv_park"],
        "scope_categories": set(),
    },
    "essentials": {
        "label": "Essentials",
        "google_types": ["rest_stop", "convenience_store", "supermarket", "pharmacy", "parking", "car_repair"],
        "scope_categories": {"other"},
    },
    "scenic": {
        "label": "Scenic",
        "google_types": ["tourist_attraction", "museum", "park", "art_gallery"],
        "scope_categories": {"nature", "scenic", "culture", "adventure"},
    },
    "outdoors": {
        "label": "Outdoors",
        "google_types": ["park", "campground", "tourist_attraction"],
        "scope_categories": {"nature", "scenic", "adventure"},
    },
    "shopping": {
        "label": "Shopping",
        "google_types": ["shopping_mall", "store", "clothing_store", "book_store"],
        "scope_categories": {"shopping", "food", "culture"},
    },
    "entertainment": {
        "label": "Entertainment",
        "google_types": ["amusement_park", "bowling_alley", "movie_theater", "tourist_attraction"],
        "scope_categories": {"entertainment", "nightlife", "adventure", "culture"},
    },
    "nightlife": {
        "label": "Nightlife",
        "google_types": ["bar", "night_club", "restaurant", "performing_arts_theater"],
        "scope_categories": {"nightlife", "entertainment", "food", "culture"},
    },
}

GOOGLE_TYPE_TO_CATEGORY = {
    "gas_station": "fuel",
    "electric_vehicle_charging_station": "fuel",
    "restaurant": "food",
    "cafe": "food",
    "bakery": "food",
    "bar": "nightlife",
    "night_club": "nightlife",
    "performing_arts_theater": "entertainment",
    "hotel": "stay",
    "motel": "stay",
    "hostel": "stay",
    "campground": "stay",
    "rv_park": "stay",
    "rest_stop": "essentials",
    "convenience_store": "essentials",
    "supermarket": "essentials",
    "pharmacy": "essentials",
    "parking": "essentials",
    "car_repair": "essentials",
    "hospital": "essentials",
    "amusement_park": "entertainment",
    "bowling_alley": "entertainment",
    "movie_theater": "entertainment",
    "tourist_attraction": "scenic",
    "museum": "culture",
    "park": "nature",
    "art_gallery": "culture",
    "shopping_mall": "shopping",
    "store": "shopping",
    "clothing_store": "shopping",
    "book_store": "shopping",
}

GOOGLE_FUEL_TYPE_ALIASES = {
    "REGULAR_UNLEADED": "regular",
    "MIDGRADE": "midgrade",
    "PREMIUM": "premium",
    "DIESEL": "diesel",
    "DIESEL_PLUS": "diesel",
    "SP91": "regular",
    "SP91_E10": "regular",
    "SP92": "regular",
    "SP95": "premium",
    "SP95_E10": "premium",
    "SP98": "premium",
}

SUPPORTED_FUEL_TYPES = {"all", "regular", "midgrade", "premium", "diesel", "ev"}


@dataclass
class CachedTravelNearbyResult:
    expires_at: float
    payload: dict[str, Any]


class TravelNearbyService:
    def __init__(self, content_client: Any | None = None) -> None:
        self._content_client = content_client or ContentServiceClient()
        self._cache: dict[str, CachedTravelNearbyResult] = {}
        self._usage_guard = GooglePlacesUsageGuard()

    def get_nearby(self, payload: dict[str, Any]) -> dict[str, Any]:
        anchors = self._normalize_anchors(payload.get("anchors") or [])
        category = self._normalize_category(payload.get("category"))
        radius_km = min(max(self._safe_float(payload.get("radiusKm"), 16.09), 1.0), 50.0)
        limit = min(max(self._safe_int(payload.get("limit"), 8), 1), 24)
        fuel_type = self._normalize_fuel_type(payload.get("fuelType"))
        context = {
            "interests": {str(value).strip().lower() for value in payload.get("interests") or [] if str(value).strip()},
            "pace": str(payload.get("pace") or "relaxed").strip().lower(),
            "budget_floor": self._safe_float(payload.get("budgetFloor"), 0.0),
            "budget_ceiling": self._safe_float(payload.get("budgetCeiling"), 0.0),
            "latest_intent": str(payload.get("latestIntent") or "").strip().lower(),
            "route_points": self._normalize_route_points(payload.get("routePoints") or []),
            "fuel_type": fuel_type,
            "radiusKm": radius_km,
        }

        if not anchors:
            return {
                "configured": bool((current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()),
                "coverage": "Add a route point before loading travel suggestions.",
                "source": "Scope + Google Places",
                "category": category,
                "radiusKm": radius_km,
                "suggestions": [],
            }

        suggestions: list[dict[str, Any]] = []
        google_configured = bool((current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip())
        google_messages: list[str] = []

        for anchor in anchors[:3]:
            scope_spots = self._load_scope_spots(anchor, radius_km, limit * 3)
            suggestions.extend(self._build_scope_suggestions(scope_spots, anchor, category, context))
            google_payload = self._load_google_places(anchor, category, radius_km, fuel_type)
            google_messages.extend(google_payload["messages"])
            suggestions.extend(self._build_google_suggestions(google_payload["places"], anchor, category, context))

        ranked = self._rank_and_dedupe(suggestions, category, limit, context)
        google_messages.extend(self._hydrate_google_photos(ranked, category))
        public_suggestions = [self._strip_internal_score(suggestion) for suggestion in ranked]
        coverage = self._build_coverage_message(google_configured, google_messages, public_suggestions)
        return {
            "configured": google_configured,
            "coverage": coverage,
            "source": "Scope + Google Places",
            "category": category,
            "radiusKm": radius_km,
            "suggestions": public_suggestions,
        }

    def _load_scope_spots(self, anchor: dict[str, Any], radius_km: float, limit: int) -> list[Spot]:
        try:
            return self._content_client.nearby_spots(
                float(anchor["latitude"]),
                float(anchor["longitude"]),
                radius_km,
                limit=limit,
            )
        except Exception:
            return []

    def _load_google_places(self, anchor: dict[str, Any], category: str, radius_km: float, fuel_type: str) -> dict[str, Any]:
        api_key = (current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()
        if not api_key:
            return {"places": [], "messages": ["Set GOOGLE_PLACES_API_KEY to blend Google Places travel essentials."]}

        google_types = TRAVEL_CATEGORY_CONFIG[category]["google_types"]
        cache_key = self._google_cache_key(anchor, category, radius_km, fuel_type)
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached.expires_at > now:
            return cached.payload

        cap_key = (
            "GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP"
            if category == "fuel"
            else "GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_MONTHLY_CAP"
        )
        usage_bucket = (
            "places_nearby_search_enterprise_atmosphere"
            if category == "fuel"
            else "places_nearby_search_enterprise"
        )
        usage = self._usage_guard.consume(usage_bucket, self._monthly_cap(cap_key, 1000))
        if not usage["allowed"]:
            return {
                "places": [],
                "messages": [
                    f"Google Places Nearby Search monthly free usage cap reached ({usage['cap']}/month)."
                ],
            }

        base_url = str(current_app.config.get("GOOGLE_PLACES_BASE_URL") or "https://places.googleapis.com/v1").rstrip("/")
        field_mask = GOOGLE_FIELD_MASK_FUEL if category == "fuel" else GOOGLE_FIELD_MASK_BASIC
        try:
            response = requests.post(
                f"{base_url}/places:searchNearby",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": field_mask,
                },
                json={
                    "includedTypes": google_types,
                    "maxResultCount": GOOGLE_PLACES_MAX_RESULT_COUNT,
                    "rankPreference": "DISTANCE",
                    "locationRestriction": {
                        "circle": {
                            "center": {
                                "latitude": anchor["latitude"],
                                "longitude": anchor["longitude"],
                            },
                            "radius": radius_km * 1000,
                        },
                    },
                },
                timeout=5,
            )
            response.raise_for_status()
            body = response.json()
        except requests.RequestException as exc:
            return {"places": [], "messages": [self._google_error_message(exc)]}
        except ValueError:
            return {"places": [], "messages": ["Google Places returned an unreadable travel suggestion response."]}

        payload = {"places": body.get("places", []) if isinstance(body.get("places"), list) else [], "messages": []}
        ttl = int(current_app.config.get("GOOGLE_PLACES_CACHE_SECONDS") or 180)
        self._cache[cache_key] = CachedTravelNearbyResult(expires_at=now + ttl, payload=payload)
        return payload

    def _build_scope_suggestions(
        self,
        spots: list[Spot],
        anchor: dict[str, Any],
        requested_category: str,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        suggestions: list[dict[str, Any]] = []
        allowed_categories: set[str] = TRAVEL_CATEGORY_CONFIG[requested_category]["scope_categories"]
        for spot in spots:
            if allowed_categories and requested_category != "recommended" and spot.category not in allowed_categories:
                continue
            distance_km = self._distance_km(anchor["latitude"], anchor["longitude"], spot.latitude, spot.longitude)
            category = self._scope_category_for_requested_category(spot, requested_category)
            score = self._score_suggestion(
                source="scope",
                category=category,
                requested_category=requested_category,
                distance_km=distance_km,
                rating=spot.rating,
                review_count=max(0, int(spot.popularity // 5)),
                price_value=spot.estimated_cost,
                is_open=None,
                context=context,
            )
            suggestions.append(
                {
                    "id": f"scope-{spot.spot_id}",
                    "placeId": spot.spot_id,
                    "title": spot.title or "Scope spot",
                    "subtitle": spot.description[:96] or "Scope community pin",
                    "address": "",
                    "latitude": spot.latitude,
                    "longitude": spot.longitude,
                    "category": category,
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "distanceKm": round(distance_km, 2),
                    "rating": spot.rating or None,
                    "reviewCount": max(0, int(spot.popularity // 5)),
                    "priceValue": spot.estimated_cost,
                    "priceLabel": self._scope_price_label(spot.estimated_cost),
                    "isOpen": None,
                    "reason": self._scope_reason(spot, category),
                    "score": round(score, 3),
                    "anchorId": anchor["id"],
                    "anchorLabel": anchor["placeLabel"],
                }
            )
        return suggestions

    def _build_google_suggestions(
        self,
        places: list[Any],
        anchor: dict[str, Any],
        requested_category: str,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        suggestions: list[dict[str, Any]] = []
        for place in places:
            if not isinstance(place, dict):
                continue
            normalized = self._normalize_google_place(place, anchor, requested_category, context)
            if normalized:
                suggestions.append(normalized)
        return suggestions

    def _normalize_google_place(
        self,
        place: dict[str, Any],
        anchor: dict[str, Any],
        requested_category: str,
        context: dict[str, Any],
    ) -> dict[str, Any] | None:
        coordinates = self._google_place_coordinates(place)
        if coordinates is None:
            return None
        latitude, longitude = coordinates

        title = self._google_place_title(place)
        types = [str(value) for value in place.get("types", []) if isinstance(value, str)]
        primary_type = str(place.get("primaryType") or (types[0] if types else "")).strip()
        category = self._infer_google_category([primary_type, *types], requested_category)
        if not self._is_google_place_valid_for_requested_category(place, category, requested_category):
            return None
        distance_km = self._distance_km(anchor["latitude"], anchor["longitude"], latitude, longitude)
        price_value, price_label, fuel_type = self._extract_fuel_price(place, context["fuel_type"])
        rating = self._safe_float(place.get("rating"), 0.0)
        review_count = self._safe_int(place.get("userRatingCount"), 0)
        is_open = self._google_open_now(place)
        photo = self._first_photo(place)
        photo_attribution = self._first_photo_attribution(photo)
        score = self._score_suggestion(
            source="google",
            category=category,
            requested_category=requested_category,
            distance_km=distance_km,
            rating=rating,
            review_count=review_count,
            price_value=price_value,
            is_open=is_open,
            context=context,
        )

        return {
            "id": f"google-{place.get('id') or self._slug(title)}",
            "placeId": place.get("id") or "",
            "title": title,
            "subtitle": self._google_subtitle(place, category),
            "address": str(place.get("formattedAddress") or ""),
            "latitude": latitude,
            "longitude": longitude,
            "category": category,
            "source": "google",
            "sourceLabel": self._google_source_label(requested_category, price_label, is_open),
            "distanceKm": round(distance_km, 2),
            "rating": rating or None,
            "reviewCount": review_count or None,
            "priceLevel": str(place.get("priceLevel") or ""),
            "priceLabel": price_label or self._price_level_label(place.get("priceLevel")),
            "priceValue": price_value,
            "fuelType": fuel_type,
            "isOpen": is_open,
            "websiteUrl": str(place.get("websiteUri") or ""),
            "_photoName": self._normalize_text(photo.get("name") if photo else None, 512),
            "_photoAttribution": photo_attribution.get("displayName"),
            "_photoAttributionUrl": photo_attribution.get("uri"),
            "reason": self._google_reason(category, distance_km, rating, is_open, price_label),
            "score": round(score, 3),
            "anchorId": anchor["id"],
            "anchorLabel": anchor["placeLabel"],
        }

    def _google_place_coordinates(self, place: dict[str, Any]) -> tuple[float, float] | None:
        location = place.get("location") if isinstance(place.get("location"), dict) else {}
        latitude = self._safe_float(location.get("latitude"), float("nan"))
        longitude = self._safe_float(location.get("longitude"), float("nan"))
        return (latitude, longitude) if -90 <= latitude <= 90 and -180 <= longitude <= 180 else None

    @staticmethod
    def _google_place_title(place: dict[str, Any]) -> str:
        display_name = place.get("displayName") if isinstance(place.get("displayName"), dict) else {}
        return str(display_name.get("text") or "Google place").strip() or "Google place"

    @staticmethod
    def _google_source_label(requested_category: str, price_label: str | None, is_open: bool | None) -> str:
        if requested_category == "fuel" and price_label:
            return "Fuel price"
        if is_open is True:
            return "Open"
        return "Google"

    def _score_suggestion(
        self,
        *,
        source: str,
        category: str,
        requested_category: str,
        distance_km: float,
        rating: float | None,
        review_count: int | None,
        price_value: float | None,
        is_open: bool | None,
        context: dict[str, Any],
    ) -> float:
        return score_travel_suggestion(
            source=source,
            category=category,
            requested_category=requested_category,
            distance_km=distance_km,
            rating=rating,
            review_count=review_count,
            price_value=price_value,
            is_open=is_open,
            context=context,
            safe_float=self._safe_float,
            log1p=self._log1p,
        )

    def _rank_and_dedupe(
        self,
        suggestions: list[dict[str, Any]],
        category: str,
        limit: int,
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        deduped: dict[str, dict[str, Any]] = {}
        for suggestion in suggestions:
            key = self._dedupe_key(suggestion)
            existing = deduped.get(key)
            if not existing or suggestion.get("score", 0) > existing.get("score", 0):
                deduped[key] = suggestion

        ranked = sorted(
            deduped.values(),
            key=lambda suggestion: (
                -float(suggestion.get("score") or 0),
                float(suggestion.get("distanceKm") or 9999),
                str(suggestion.get("title") or ""),
            ),
        )
        return ranked[:limit]

    @staticmethod
    def _strip_internal_score(suggestion: dict[str, Any]) -> dict[str, Any]:
        cleaned = dict(suggestion)
        cleaned.pop("score", None)
        for key in list(cleaned.keys()):
            if key.startswith("_"):
                cleaned.pop(key, None)
        return cleaned

    def _hydrate_google_photos(self, suggestions: list[dict[str, Any]], category: str) -> list[str]:
        if category == "fuel":
            return []

        api_key = (current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()
        if not api_key:
            return []

        base_url = str(current_app.config.get("GOOGLE_PLACES_BASE_URL") or "https://places.googleapis.com/v1").rstrip("/")
        messages: list[str] = []
        cap_message_added = False
        for suggestion in suggestions:
            if suggestion.get("source") != "google" or suggestion.get("photoUrl"):
                continue

            photo_name = self._normalize_text(suggestion.get("_photoName"), 512)
            if not photo_name:
                continue

            usage = self._usage_guard.consume(
                "places_place_details_photos",
                self._monthly_cap("GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP", 1000),
            )
            if not usage["allowed"]:
                if not cap_message_added:
                    messages.append(
                        "Google Places Place Details Photos monthly free usage cap reached "
                        f"({usage['cap']}/month)."
                    )
                    cap_message_added = True
                break

            try:
                response = requests.get(
                    f"{base_url}/{photo_name}/media",
                    params={
                        "key": api_key,
                        "maxWidthPx": GOOGLE_PLACE_PHOTO_MAX_WIDTH_PX,
                        "skipHttpRedirect": "true",
                    },
                    timeout=5,
                )
                response.raise_for_status()
                body = response.json()
            except requests.RequestException:
                continue
            except ValueError:
                continue

            photo_url = self._normalize_text(body.get("photoUri"), 2048)
            if not photo_url:
                continue

            suggestion["photoUrl"] = photo_url
            if suggestion.get("_photoAttribution"):
                suggestion["photoAttribution"] = suggestion["_photoAttribution"]
            if suggestion.get("_photoAttributionUrl"):
                suggestion["photoAttributionUrl"] = suggestion["_photoAttributionUrl"]

        return messages

    @staticmethod
    def _normalize_category(value: Any) -> str:
        normalized = str(value or "recommended").strip().lower().replace("-", "_")
        return normalized if normalized in TRAVEL_CATEGORY_CONFIG else "recommended"

    @staticmethod
    def _normalize_fuel_type(value: Any) -> str:
        normalized = str(value or "all").strip().lower()
        return normalized if normalized in SUPPORTED_FUEL_TYPES else "all"

    @staticmethod
    def _normalize_anchors(anchors: list[Any]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for index, anchor in enumerate(anchors):
            if not isinstance(anchor, dict):
                continue
            latitude = TravelNearbyService._safe_float(anchor.get("latitude"), float("nan"))
            longitude = TravelNearbyService._safe_float(anchor.get("longitude"), float("nan"))
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                continue
            normalized.append(
                {
                    "id": str(anchor.get("id") or f"anchor-{index}"),
                    "placeLabel": str(anchor.get("placeLabel") or anchor.get("title") or "Route point"),
                    "latitude": latitude,
                    "longitude": longitude,
                    "routeRole": str(anchor.get("routeRole") or ""),
                }
            )
        return normalized

    @staticmethod
    def _normalize_route_points(points: list[Any]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for point in points:
            if not isinstance(point, dict):
                continue
            latitude = TravelNearbyService._safe_float(point.get("latitude"), float("nan"))
            longitude = TravelNearbyService._safe_float(point.get("longitude"), float("nan"))
            if -90 <= latitude <= 90 and -180 <= longitude <= 180:
                normalized.append({"latitude": latitude, "longitude": longitude})
        return normalized

    @staticmethod
    def _normalize_text(value: Any, max_length: int) -> str:
        return normalize_provider_text(value, max_length)

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return default
        return parsed if parsed == parsed else default

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _distance_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
        return haversine_distance_km(lat_a, lng_a, lat_b, lng_b)

    @staticmethod
    def _monthly_cap(config_key: str, fallback: int) -> int:
        value = current_app.config.get(config_key)
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback

    @staticmethod
    def _log1p(value: int) -> float:
        # Keep the service dependency-light; this is close enough for ranking.
        import math

        return math.log1p(max(0, value))

    @staticmethod
    def _scope_category_for_requested_category(spot: Spot, requested_category: str) -> str:
        if requested_category in {"food", "scenic", "outdoors", "shopping", "entertainment", "nightlife"}:
            return spot.category
        if spot.category in {"nature", "culture", "adventure", "scenic", "food", "shopping", "entertainment", "nightlife"}:
            return spot.category
        return "other"

    @staticmethod
    def _scope_price_label(value: float | None) -> str:
        if not value:
            return ""
        return f"${round(value)} est."

    @staticmethod
    def _scope_reason(spot: Spot, category: str) -> str:
        if spot.rating:
            return f"Scope community {category} pick with {spot.rating:.1f} rating"
        if spot.popularity:
            return "Scope community pick with nearby activity"
        return "Scope community pin near this route point"

    @staticmethod
    def _infer_google_category(types: list[str], requested_category: str) -> str:
        if requested_category == "nightlife" and any(place_type in {"bar", "night_club"} for place_type in types):
            return "nightlife"
        for place_type in types:
            if place_type in GOOGLE_TYPE_TO_CATEGORY:
                return GOOGLE_TYPE_TO_CATEGORY[place_type]
        return "other"

    @classmethod
    def _google_validation_text(cls, place: dict[str, Any]) -> str:
        display_name = place.get("displayName") if isinstance(place.get("displayName"), dict) else {}
        return " ".join(
            [
                cls._normalize_text(display_name.get("text"), 160),
                cls._normalize_text(place.get("formattedAddress"), 220),
                cls._normalize_text(place.get("primaryType"), 80),
                " ".join(str(value) for value in place.get("types", []) if isinstance(value, str)),
            ]
        ).lower()

    @classmethod
    def _is_google_place_valid_for_requested_category(
        cls,
        place: dict[str, Any],
        category: str,
        requested_category: str,
    ) -> bool:
        text = cls._google_validation_text(place)
        if re.search(r"\b(weigh station|truck scale|inspection station|port of entry|highway patrol|state trooper|sheriff|police|department of transportation|\bdot\b|dmv|courthouse|jail|prison)\b", text):
            return False

        if requested_category == "recommended":
            return category in {"food", "stay", "essentials", "scenic", "nature", "culture", "adventure", "shopping", "entertainment", "nightlife", "fuel"}

        if requested_category == "food":
            return category == "food" or bool(re.search(r"\b(restaurant|cafe|coffee|bakery|bistro|grill|diner|pizza|burger|taco|bbq|barbecue|kitchen|steak|seafood|sushi|ramen|noodle|breakfast|brunch|ice cream|donut|doughnut|brewery|winery)\b", text))

        if requested_category == "stay":
            if re.search(r"\b(gas station|fuel|restaurant|cafe|pharmacy|supermarket|police|courthouse)\b", text):
                return False
            return category == "stay" or bool(re.search(r"\b(hotel|motel|lodging|inn|suites|resort|hostel|campground|rv park|bed and breakfast|bnb|lodge|cabin)\b", text))

        if requested_category == "essentials":
            if re.search(r"\b(tourist attraction|museum|gallery|nightclub)\b", text):
                return False
            return category == "essentials" or bool(re.search(r"\b(rest stop|rest area|convenience store|supermarket|grocery|pharmacy|parking|car repair|auto repair|urgent care|hospital|bank|atm|market|travel center)\b", text))

        if requested_category == "scenic":
            if re.search(r"\b(gas station|fuel|convenience store|supermarket|pharmacy|parking lot|police)\b", text):
                return False
            return category in {"scenic", "nature", "culture", "adventure"} or bool(re.search(r"\b(scenic|view|overlook|lookout|vista|park|trail|lake|river|garden|museum|gallery|historic|landmark|monument|tourist attraction|nature|wildlife)\b", text))

        if requested_category == "outdoors":
            if re.search(r"\b(gas station|fuel|convenience store|supermarket|pharmacy|parking lot|police|courthouse|indoor mall)\b", text):
                return False
            return category in {"nature", "scenic", "adventure"} or bool(re.search(r"\b(outdoor|outdoors|park|trail|hike|hiking|lake|river|garden|campground|camping|nature|wildlife|greenway|preserve|botanical)\b", text))

        if requested_category == "shopping":
            if re.search(r"\b(gas station|fuel|police|courthouse|hospital|clinic|school)\b", text):
                return False
            return category == "shopping" or bool(re.search(r"\b(shopping|shop|shops|mall|market|boutique|store|retail|bookstore|book store|clothing|outlet|plaza)\b", text))

        if requested_category == "entertainment":
            if re.search(r"\b(gas station|fuel|convenience store|supermarket|pharmacy|parking lot|police|courthouse|hospital|clinic)\b", text):
                return False
            return category == "entertainment" or bool(re.search(r"\b(entertainment|amusement park|theme park|six flags|bowling|bowling alley|arcade|movie theater|movie theatre|cinema|concert|music venue|stadium|arena|zoo|aquarium|escape room|laser tag|mini golf|carnival|fair)\b", text))

        if requested_category == "nightlife":
            if re.search(r"\b(gas station|fuel|convenience store|supermarket|pharmacy|parking lot|police|courthouse|hospital|clinic|daycare|school)\b", text):
                return False
            return category == "nightlife" or bool(re.search(r"\b(nightlife|night club|nightclub|bar|pub|lounge|cocktail|speakeasy|brewery|wine bar|live music|music venue|concert)\b", text))

        return category == requested_category

    def _extract_fuel_price(self, place: dict[str, Any], requested_fuel_type: str) -> tuple[float | None, str, str | None]:
        fuel_options = place.get("fuelOptions") if isinstance(place.get("fuelOptions"), dict) else {}
        raw_prices = fuel_options.get("fuelPrices") if isinstance(fuel_options, dict) else []
        if not isinstance(raw_prices, list):
            raw_prices = []
        prices = [self._normalize_google_fuel_price(entry) for entry in raw_prices if isinstance(entry, dict)]
        prices = [price for price in prices if price is not None]
        if not prices:
            return None, "", "ev" if requested_fuel_type == "ev" else None

        selected_prices = prices
        if requested_fuel_type not in {"all", "ev"}:
            selected_prices = [price for price in prices if price["fuelType"] == requested_fuel_type]
        if not selected_prices:
            return None, "", requested_fuel_type
        selected = min(selected_prices, key=lambda price: price["price"])
        return selected["price"], self._format_price(selected["price"], selected["currency"]), selected["fuelType"]

    @staticmethod
    def _normalize_google_fuel_price(entry: dict[str, Any]) -> dict[str, Any] | None:
        price = entry.get("price") if isinstance(entry.get("price"), dict) else {}
        try:
            units = float(price.get("units", 0))
            nanos = float(price.get("nanos", 0)) / 1_000_000_000
            amount = units + nanos
        except (TypeError, ValueError):
            return None
        if amount <= 0:
            return None
        raw_type = str(entry.get("type") or "").upper()
        return {
            "fuelType": GOOGLE_FUEL_TYPE_ALIASES.get(raw_type, raw_type.lower() or "all"),
            "price": round(amount, 3),
            "currency": str(price.get("currencyCode") or "USD"),
        }

    @staticmethod
    def _format_price(value: float, currency: str) -> str:
        if currency.upper() == "USD":
            return f"${value:.2f}/gal"
        return f"{value:.2f} {currency}/unit"

    @staticmethod
    def _price_level_label(value: Any) -> str:
        normalized = str(value or "").upper()
        if "FREE" in normalized:
            return "Free"
        if "INEXPENSIVE" in normalized:
            return "$"
        if "MODERATE" in normalized:
            return "$$"
        if "EXPENSIVE" in normalized and "VERY" not in normalized:
            return "$$$"
        if "VERY_EXPENSIVE" in normalized:
            return "$$$$"
        return ""

    @staticmethod
    def _google_open_now(place: dict[str, Any]) -> bool | None:
        hours = place.get("currentOpeningHours") if isinstance(place.get("currentOpeningHours"), dict) else {}
        open_now = hours.get("openNow") if isinstance(hours, dict) else None
        return open_now if isinstance(open_now, bool) else None

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
    def _google_subtitle(place: dict[str, Any], category: str) -> str:
        address = str(place.get("formattedAddress") or "").strip()
        category_label = category.replace("_", " ").title()
        return " - ".join([value for value in [category_label, address] if value]) or "Google Places result"

    @staticmethod
    def _google_reason(category: str, distance_km: float, rating: float, is_open: bool | None, price_label: str) -> str:
        details = [f"{category.replace('_', ' ')} near route", f"{distance_km * 0.621371:.1f} mi away"]
        if rating:
            details.append(f"{rating:.1f} rating")
        if price_label:
            details.append(price_label)
        if is_open is True:
            details.append("open now")
        return ", ".join(details)

    @staticmethod
    def _dedupe_key(suggestion: dict[str, Any]) -> str:
        title = re.sub(r"[^a-z0-9]+", "", str(suggestion.get("title") or "").lower())
        lat = TravelNearbyService._safe_float(suggestion.get("latitude"), 0.0)
        lng = TravelNearbyService._safe_float(suggestion.get("longitude"), 0.0)
        return f"{title}:{lat:.3f}:{lng:.3f}"

    @staticmethod
    def _slug(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "place"

    @staticmethod
    def _google_cache_key(anchor: dict[str, Any], category: str, radius_km: float, fuel_type: str) -> str:
        return f"google:{category}:{round(anchor['latitude'], 4)}:{round(anchor['longitude'], 4)}:{radius_km:.1f}:{fuel_type}"

    @staticmethod
    def _google_error_message(error: requests.RequestException) -> str:
        response = getattr(error, "response", None)
        if response is not None:
            try:
                body = response.json()
                message = body.get("error", {}).get("message")
                if message:
                    return f"Google Places travel suggestions failed: {message}"
            except ValueError:
                return f"Google Places travel suggestions failed with status {response.status_code}."
        return "Google Places travel suggestions are temporarily unavailable."

    @staticmethod
    def _build_coverage_message(google_configured: bool, google_messages: list[str], suggestions: list[dict[str, Any]]) -> str:
        if google_messages:
            return " ".join(dict.fromkeys(google_messages))
        if google_configured and suggestions:
            return "Blended Scope community posts with Google Places travel essentials."
        if suggestions:
            return "Scope community suggestions are available; Google Places did not return extra matches."
        return "No travel suggestions were found for this route point and radius."
