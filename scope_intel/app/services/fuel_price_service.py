from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

import requests
from flask import current_app

from app.services.geo_math import haversine_distance_km
from app.services.google_places_usage_guard import GooglePlacesUsageGuard


SUPPORTED_FUEL_TYPES = {"all", "regular", "midgrade", "premium", "diesel"}
SUPPORTED_FUEL_SORTS = {"closest", "best_price"}
GOOGLE_PLACES_MAX_RESULT_COUNT = 20
GOOGLE_PLACES_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.currentOpeningHours",
        "places.fuelOptions",
    ]
)
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
GOOGLE_FUEL_MATCHES = {
    "regular": {"regular"},
    "midgrade": {"midgrade"},
    "premium": {"premium"},
    "diesel": {"diesel"},
}


@dataclass
class CachedFuelResult:
    expires_at: float
    payload: dict[str, Any]


class FuelPriceService:
    def __init__(self) -> None:
        self._cache: dict[str, CachedFuelResult] = {}
        self._usage_guard = GooglePlacesUsageGuard()

    def get_nearby_stations(
        self,
        *,
        lat: float,
        lng: float,
        radius_km: float = 10,
        fuel_type: str = "all",
        limit: int = 5,
        sort_by: str = "closest",
    ) -> dict[str, Any]:
        normalized_fuel_type = self._normalize_requested_fuel_type(fuel_type)
        normalized_sort = self._normalize_sort_by(sort_by)
        radius_km = min(max(float(radius_km), 1.0), 50.0)
        limit = min(max(int(limit), 1), 20)
        api_key = self._google_places_api_key()

        if not api_key:
            return self._missing_google_places_key_payload()

        cache_key = self._cache_key(lat, lng, radius_km, normalized_fuel_type, normalized_sort, limit)
        cached = self._cache.get(cache_key)
        now = time.time()
        if cached and cached.expires_at > now:
            return cached.payload

        base_url = self._google_places_base_url()
        usage = self._consume_nearby_search_usage()
        if not usage["allowed"]:
            return self._usage_cap_payload(usage, radius_km, normalized_sort)

        try:
            body = self._request_google_nearby_search(base_url, api_key, lat, lng, radius_km)
        except requests.RequestException as exc:
            return self._google_places_unavailable_payload(self._google_error_message(exc))
        except ValueError:
            return self._google_places_unavailable_payload("Google Places returned an unreadable fuel lookup response.")

        stations = self._stations_from_google_places(
            body.get("places", []),
            requested_fuel_type=normalized_fuel_type,
            origin_lat=lat,
            origin_lng=lng,
            sort_by=normalized_sort,
        )
        payload = self._fuel_lookup_payload(stations[:limit], radius_km, normalized_sort)
        self._cache_payload(cache_key, now, payload)
        return payload

    @staticmethod
    def _google_places_api_key() -> str:
        return (current_app.config.get("GOOGLE_PLACES_API_KEY") or "").strip()

    @staticmethod
    def _missing_google_places_key_payload() -> dict[str, Any]:
        return {
            "configured": False,
            "coverage": "Set GOOGLE_PLACES_API_KEY to show nearby gas stations and available fuel prices.",
            "stations": [],
            "source": "Google Places",
        }

    @staticmethod
    def _cache_key(
        lat: float,
        lng: float,
        radius_km: float,
        normalized_fuel_type: str,
        normalized_sort: str,
        limit: int,
    ) -> str:
        return f"google:{round(lat, 4)}:{round(lng, 4)}:{radius_km:.1f}:{normalized_fuel_type}:{normalized_sort}:{limit}"

    @staticmethod
    def _google_places_base_url() -> str:
        return str(current_app.config.get("GOOGLE_PLACES_BASE_URL") or "https://places.googleapis.com/v1").rstrip("/")

    def _consume_nearby_search_usage(self) -> dict[str, Any]:
        return self._usage_guard.consume(
            "places_nearby_search_enterprise_atmosphere",
            self._monthly_cap("GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP", 1000),
        )

    @staticmethod
    def _usage_cap_payload(usage: dict[str, Any], radius_km: float, normalized_sort: str) -> dict[str, Any]:
        return {
            "configured": True,
            "coverage": (
                "Google Places Nearby Search Enterprise + Atmosphere monthly free usage cap reached "
                f"({usage['cap']}/month). Fuel lookup stopped before pay-as-you-go usage."
            ),
            "stations": [],
            "source": "Google Places",
            "license": "Google Maps Platform",
            "radiusKm": radius_km,
            "sortBy": normalized_sort,
        }

    @staticmethod
    def _request_google_nearby_search(
        base_url: str,
        api_key: str,
        lat: float,
        lng: float,
        radius_km: float,
    ) -> dict[str, Any]:
        response = requests.post(
            f"{base_url}/places:searchNearby",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
            },
            json={
                "includedTypes": ["gas_station"],
                "maxResultCount": GOOGLE_PLACES_MAX_RESULT_COUNT,
                "rankPreference": "DISTANCE",
                "locationRestriction": {
                    "circle": {
                        "center": {
                            "latitude": lat,
                            "longitude": lng,
                        },
                        "radius": radius_km * 1000,
                    },
                },
            },
            timeout=5,
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _google_places_unavailable_payload(coverage: str) -> dict[str, Any]:
        return {
            "configured": True,
            "coverage": coverage,
            "stations": [],
            "source": "Google Places",
        }

    def _stations_from_google_places(
        self,
        places: list[dict[str, Any]],
        *,
        requested_fuel_type: str,
        origin_lat: float,
        origin_lng: float,
        sort_by: str,
    ) -> list[dict[str, Any]]:
        stations = [
            self._normalize_google_place(
                place,
                requested_fuel_type=requested_fuel_type,
                origin_lat=origin_lat,
                origin_lng=origin_lng,
            )
            for place in places
            if isinstance(place, dict)
        ]
        stations = [station for station in stations if station["latitude"] is not None and station["longitude"] is not None]
        stations.sort(key=lambda station: self._station_sort_key(station, sort_by))
        return stations

    @staticmethod
    def _fuel_lookup_payload(stations: list[dict[str, Any]], radius_km: float, normalized_sort: str) -> dict[str, Any]:
        return {
            "configured": True,
            "coverage": "Google Places gas station coverage with fuel prices where Google has current station data.",
            "stations": stations,
            "source": "Google Places",
            "license": "Google Maps Platform",
            "radiusKm": radius_km,
            "sortBy": normalized_sort,
        }

    def _cache_payload(self, cache_key: str, now: float, payload: dict[str, Any]) -> None:
        ttl = int(current_app.config.get("GOOGLE_PLACES_CACHE_SECONDS") or 180)
        self._cache[cache_key] = CachedFuelResult(expires_at=now + ttl, payload=payload)

    @staticmethod
    def _normalize_requested_fuel_type(fuel_type: str) -> str:
        normalized = str(fuel_type or "all").strip().lower()
        return normalized if normalized in SUPPORTED_FUEL_TYPES else "all"

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
    def _normalize_sort_by(sort_by: str) -> str:
        normalized = str(sort_by or "closest").strip().lower().replace("-", "_")
        return normalized if normalized in SUPPORTED_FUEL_SORTS else "closest"

    @staticmethod
    def _station_sort_key(station: dict[str, Any], sort_by: str) -> tuple:
        distance = station["distanceKm"] if station["distanceKm"] is not None else float("inf")
        price = station["pricePerUnit"] if station["pricePerUnit"] is not None else float("inf")
        has_no_price = station["pricePerUnit"] is None

        if sort_by == "best_price":
            return (has_no_price, price, distance)

        return (distance, has_no_price, price)

    @staticmethod
    def _normalize_google_place(
        place: dict[str, Any],
        *,
        requested_fuel_type: str,
        origin_lat: float,
        origin_lng: float,
    ) -> dict[str, Any]:
        display_name = place.get("displayName")
        name = display_name.get("text") if isinstance(display_name, dict) else ""
        location = place.get("location") if isinstance(place.get("location"), dict) else {}
        latitude = FuelPriceService._safe_float(location.get("latitude"))
        longitude = FuelPriceService._safe_float(location.get("longitude"))
        selected_price, prices = FuelPriceService._select_google_fuel_price(place, requested_fuel_type)
        opening_hours = place.get("currentOpeningHours")
        is_open = opening_hours.get("openNow") if isinstance(opening_hours, dict) else None
        currency = selected_price.get("currency") if selected_price else None

        return {
            "id": place.get("id") or place.get("name") or name or "google-fuel-station",
            "name": name or "Fuel station",
            "brand": "",
            "address": place.get("formattedAddress") or "",
            "latitude": latitude,
            "longitude": longitude,
            "distanceKm": FuelPriceService._distance_km(origin_lat, origin_lng, latitude, longitude),
            "fuelType": selected_price.get("fuelType") if selected_price else requested_fuel_type,
            "pricePerUnit": selected_price.get("price") if selected_price else None,
            "currency": currency or FuelPriceService._first_price_currency(prices) or "USD",
            "isOpen": is_open if isinstance(is_open, bool) else None,
            "updatedAt": selected_price.get("updatedAt") if selected_price else None,
            "prices": prices,
            "source": "Google Places",
        }

    @staticmethod
    def _select_google_fuel_price(place: dict[str, Any], requested_fuel_type: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        fuel_options = place.get("fuelOptions")
        fuel_prices = fuel_options.get("fuelPrices") if isinstance(fuel_options, dict) else []
        prices = [
            parsed_price
            for price_entry in fuel_prices
            if isinstance(price_entry, dict)
            for parsed_price in [FuelPriceService._normalize_google_price(price_entry)]
            if parsed_price is not None
        ]

        if requested_fuel_type != "all":
            allowed_types = GOOGLE_FUEL_MATCHES.get(requested_fuel_type, {requested_fuel_type})
            matching_prices = [price for price in prices if price["fuelType"] in allowed_types]
            if matching_prices:
                return min(matching_prices, key=lambda price: price["price"]), prices
            return None, prices

        if not prices:
            return None, prices

        return min(prices, key=lambda price: price["price"]), prices

    @staticmethod
    def _normalize_google_price(price_entry: dict[str, Any]) -> dict[str, Any] | None:
        fuel_type = FuelPriceService._normalize_google_fuel_type(price_entry.get("type"))
        price = price_entry.get("price") if isinstance(price_entry.get("price"), dict) else {}
        amount = FuelPriceService._parse_google_money(price)
        if amount is None:
            return None

        return {
            "fuelType": fuel_type,
            "price": amount,
            "currency": price.get("currencyCode") or "USD",
            "updatedAt": price_entry.get("updateTime"),
        }

    @staticmethod
    def _normalize_google_fuel_type(raw_fuel_type: Any) -> str:
        normalized = str(raw_fuel_type or "").strip().upper()
        return GOOGLE_FUEL_TYPE_ALIASES.get(normalized, normalized.lower() or "all")

    @staticmethod
    def _parse_google_money(price: dict[str, Any]) -> float | None:
        try:
            units = Decimal(str(price.get("units", "0")))
            nanos = Decimal(str(price.get("nanos", 0))) / Decimal("1000000000")
            amount = units + nanos
        except (InvalidOperation, ValueError):
            return None

        if amount <= 0:
            return None

        return float(amount.quantize(Decimal("0.001")))

    @staticmethod
    def _first_price_currency(prices: list[dict[str, Any]]) -> str | None:
        for price in prices:
            currency = price.get("currency")
            if currency:
                return str(currency)
        return None

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _distance_km(origin_lat: float, origin_lng: float, latitude: float | None, longitude: float | None) -> float | None:
        if latitude is None or longitude is None:
            return None

        return round(haversine_distance_km(origin_lat, origin_lng, latitude, longitude), 2)

    @staticmethod
    def _google_error_message(error: requests.RequestException) -> str:
        response = getattr(error, "response", None)
        if response is not None:
            try:
                body = response.json()
                message = body.get("error", {}).get("message")
                if message:
                    return f"Google Places fuel lookup failed: {message}"
            except ValueError:
                pass

        return "Google Places fuel lookup is temporarily unavailable."
