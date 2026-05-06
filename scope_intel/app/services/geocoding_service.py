from __future__ import annotations

from typing import Any
from urllib.parse import quote

import requests
from flask import current_app


class GeocodingService:
    def geocode(self, query: str, limit: int = 5) -> list[dict]:
        normalized_query = " ".join(query.split())
        safe_limit = self._normalize_limit(limit)

        if current_app.config.get("TESTING"):
            return [self._fallback_geocode_result(normalized_query)]

        try:
            mapbox_results = self._geocode_with_mapbox(normalized_query, safe_limit)
            if mapbox_results:
                return mapbox_results

            response = requests.get(
                current_app.config["GEOCODE_BASE_URL"],
                params=self._build_search_params(normalized_query, safe_limit),
                headers=self._request_headers(),
                timeout=self._request_timeout(),
            )
            response.raise_for_status()
            results = self._parse_search_response(response.json(), normalized_query, safe_limit)
            if results:
                return results
        except Exception:  # noqa: BLE001 - geocoding should degrade to a deterministic local result
            current_app.logger.info("intel_geocode_provider_unavailable", exc_info=True)

        return [self._fallback_geocode_result(normalized_query)]

    def reverse_geocode(self, latitude: float, longitude: float) -> dict:
        if current_app.config.get("TESTING"):
            return self._fallback_reverse_geocode_result(latitude, longitude)

        try:
            mapbox_result = self._reverse_geocode_with_mapbox(latitude, longitude)
            if mapbox_result:
                return mapbox_result

            response = requests.get(
                current_app.config["REVERSE_GEOCODE_BASE_URL"],
                params=self._build_reverse_params(latitude, longitude),
                headers=self._request_headers(),
                timeout=self._request_timeout(),
            )
            response.raise_for_status()
            result = self._parse_reverse_response(response.json(), latitude, longitude)
            if result:
                return result
        except Exception:  # noqa: BLE001 - map clicks still need a useful label offline
            current_app.logger.info("intel_reverse_geocode_provider_unavailable", exc_info=True)

        return self._fallback_reverse_geocode_result(latitude, longitude)

    def _geocode_with_mapbox(self, query: str, limit: int) -> list[dict]:
        access_token = self._mapbox_access_token()
        if not access_token:
            return []

        response = requests.get(
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{quote(query, safe='')}.json",
            params={
                "access_token": access_token,
                "autocomplete": "true",
                "limit": limit,
                "types": "address,poi,place,locality,neighborhood,postcode",
                "language": "en",
            },
            timeout=self._request_timeout(),
        )
        response.raise_for_status()
        return [self._mapbox_feature_to_result(feature) for feature in response.json().get("features", [])][:limit]

    def _reverse_geocode_with_mapbox(self, latitude: float, longitude: float) -> dict | None:
        access_token = self._mapbox_access_token()
        if not access_token:
            return None

        response = requests.get(
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{longitude},{latitude}.json",
            params={
                "access_token": access_token,
                "types": "address,poi,place,locality,neighborhood",
                "language": "en",
                "limit": 1,
            },
            timeout=self._request_timeout(),
        )
        response.raise_for_status()
        features = response.json().get("features", [])
        if not features:
            return None

        return self._mapbox_feature_to_result(features[0], fallback_latitude=latitude, fallback_longitude=longitude)

    def _build_search_params(self, query: str, limit: int) -> dict[str, Any]:
        base_url = current_app.config["GEOCODE_BASE_URL"].lower()
        if "open-meteo" in base_url:
            return {"name": query, "count": limit, "language": "en", "format": "json"}

        params: dict[str, Any] = {
            "q": query,
            "format": "json",
            "limit": limit,
            "addressdetails": 1,
        }
        api_key = current_app.config.get("GEOCODE_API_KEY")
        if api_key:
            params["api_key"] = api_key
        return params

    def _build_reverse_params(self, latitude: float, longitude: float) -> dict[str, Any]:
        params: dict[str, Any] = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "addressdetails": 1,
            "zoom": 14,
        }
        api_key = current_app.config.get("GEOCODE_API_KEY")
        if api_key:
            params["api_key"] = api_key
        return params

    def _parse_search_response(self, payload: Any, query: str, limit: int) -> list[dict]:
        if isinstance(payload, dict) and isinstance(payload.get("results"), list):
            return [self._open_meteo_result_to_result(result, query) for result in payload["results"][:limit]]

        if isinstance(payload, list):
            return [self._nominatim_result_to_result(result, query) for result in payload[:limit]]

        return []

    def _parse_reverse_response(self, payload: Any, latitude: float, longitude: float) -> dict | None:
        if not isinstance(payload, dict):
            return None

        address = payload.get("address") if isinstance(payload.get("address"), dict) else {}
        formatted_address = str(payload.get("display_name") or payload.get("formattedAddress") or "").strip()
        city = self._extract_city(address)
        country = self._safe_string(address.get("country") or payload.get("country"))
        place_name = formatted_address.split(",")[0].strip() if formatted_address else "Pinned location"

        return {
            "latitude": float(payload.get("lat") or latitude),
            "longitude": float(payload.get("lon") or longitude),
            "placeName": place_name,
            "formattedAddress": formatted_address or f"{latitude:.4f}, {longitude:.4f}",
            "address": self._street_address(address),
            "city": city,
            "country": country,
            "precision": self._safe_string(payload.get("type") or payload.get("class") or "reverse"),
        }

    def _open_meteo_result_to_result(self, result: dict, query: str) -> dict:
        name = self._safe_string(result.get("name")) or query
        admin = self._safe_string(result.get("admin1"))
        country = self._safe_string(result.get("country"))
        formatted_address = ", ".join(part for part in (name, admin, country) if part)
        return {
            "latitude": float(result.get("latitude")),
            "longitude": float(result.get("longitude")),
            "placeName": name,
            "formattedAddress": formatted_address,
            "city": name,
            "country": country,
            "precision": self._safe_string(result.get("feature_code") or "place"),
        }

    def _nominatim_result_to_result(self, result: dict, query: str) -> dict:
        address = result.get("address") if isinstance(result.get("address"), dict) else {}
        formatted_address = self._safe_string(result.get("display_name")) or query
        place_name = self._safe_string(result.get("name")) or formatted_address.split(",")[0].strip() or query
        return {
            "latitude": float(result.get("lat")),
            "longitude": float(result.get("lon")),
            "placeName": place_name,
            "formattedAddress": formatted_address,
            "address": self._street_address(address),
            "city": self._extract_city(address),
            "country": self._safe_string(address.get("country")),
            "precision": self._safe_string(result.get("type") or result.get("class") or "place"),
        }

    def _mapbox_feature_to_result(
        self,
        feature: dict,
        fallback_latitude: float | None = None,
        fallback_longitude: float | None = None,
    ) -> dict:
        center = feature.get("center") if isinstance(feature.get("center"), list) else []
        longitude = float(center[0]) if len(center) >= 2 else float(fallback_longitude if fallback_longitude is not None else 0.0)
        latitude = float(center[1]) if len(center) >= 2 else float(fallback_latitude if fallback_latitude is not None else 0.0)
        context = feature.get("context") if isinstance(feature.get("context"), list) else []
        city = self._mapbox_context_value(context, ("place", "locality", "neighborhood"))
        country = self._mapbox_context_value(context, ("country",))
        place_name = self._safe_string(feature.get("text")) or "Pinned location"
        house_number = self._safe_string(feature.get("address"))
        formatted_address = self._safe_string(feature.get("place_name")) or place_name

        return {
            "latitude": latitude,
            "longitude": longitude,
            "placeName": place_name,
            "formattedAddress": formatted_address,
            "address": " ".join(part for part in (house_number, place_name) if part) or None,
            "city": city,
            "country": country,
            "precision": self._safe_string((feature.get("place_type") or ["place"])[0]),
        }

    @staticmethod
    def _mapbox_context_value(context: list[dict], prefixes: tuple[str, ...]) -> str | None:
        for item in context:
            identifier = str(item.get("id") or "")
            if any(identifier.startswith(f"{prefix}.") for prefix in prefixes):
                value = str(item.get("text") or "").strip()
                if value:
                    return value
        return None

    @staticmethod
    def _extract_city(address: dict) -> str | None:
        for key in ("city", "town", "village", "municipality", "locality", "county", "state"):
            value = str(address.get(key) or "").strip()
            if value:
                return value
        return None

    @staticmethod
    def _street_address(address: dict) -> str | None:
        house_number = str(address.get("house_number") or "").strip()
        road = str(address.get("road") or address.get("pedestrian") or address.get("footway") or "").strip()
        street_address = " ".join(part for part in (house_number, road) if part)
        return street_address or None

    @staticmethod
    def _safe_string(value: Any) -> str | None:
        sanitized = str(value or "").strip()
        return sanitized or None

    @staticmethod
    def _normalize_limit(limit: int) -> int:
        try:
            return max(1, min(int(limit), 10))
        except (TypeError, ValueError):
            return 5

    @staticmethod
    def _request_timeout() -> float:
        return float(current_app.config.get("ML_REQUEST_TIMEOUT_SECONDS", 5.0))

    @staticmethod
    def _request_headers() -> dict[str, str]:
        return {"User-Agent": "ScopeIntel/1.0 (geocoding)"}

    @staticmethod
    def _mapbox_access_token() -> str | None:
        return current_app.config.get("MAPBOX_ACCESS_TOKEN")

    @staticmethod
    def _fallback_geocode_result(query: str) -> dict:
        return {
            "query": query,
            "latitude": 32.7555,
            "longitude": -97.3308,
            "placeName": query,
            "formattedAddress": f"{query}, USA",
            "city": "Fort Worth",
            "country": "United States",
            "precision": "fallback",
        }

    @staticmethod
    def _fallback_reverse_geocode_result(latitude: float, longitude: float) -> dict:
        return {
            "latitude": latitude,
            "longitude": longitude,
            "placeName": "Fort Worth, TX, USA",
            "formattedAddress": "Fort Worth, TX, USA",
            "city": "Fort Worth",
            "country": "United States",
            "precision": "fallback",
        }
