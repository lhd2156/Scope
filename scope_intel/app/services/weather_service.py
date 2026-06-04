import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

import requests
from flask import current_app, has_app_context
from redis import Redis
from redis.exceptions import RedisError

from app.services.itinerary_engine import WeatherSnapshot


class WeatherUnavailableError(RuntimeError):
    """Raised when the configured weather provider cannot return a real forecast."""


class WeatherService:
    _FORECAST_PATH_CURRENT = "current"
    _FORECAST_PATH_DAILY = "daily"
    _GEOCODE_BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"
    _OPENWEATHERMAP_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"
    _NWS_BASE_URL = "https://api.weather.gov"
    _CURRENT_CACHE: dict[str, dict[str, Any]] = {}
    _NWS_POINT_CACHE: dict[str, dict[str, Any]] = {}
    _REDIS_CLIENTS: dict[str, Redis] = {}

    def get_forecast(self, latitude: float, longitude: float, target_date: date) -> dict:
        payload = self._fetch_open_meteo_forecast(latitude, longitude, target_date)
        daily = payload.get("daily") if isinstance(payload, dict) else None
        daily_snapshot = self._read_daily_snapshot(daily, target_date)
        if daily_snapshot:
            condition = self._condition_from_weather_code(daily_snapshot["weatherCode"])
            high = round(daily_snapshot["temperatureHighF"])
            low = round(daily_snapshot["temperatureLowF"])
            wind = round(daily_snapshot["windMph"])
            return {
                "latitude": latitude,
                "longitude": longitude,
                "date": target_date.isoformat(),
                "forecast": f"{condition}, high {high}F / low {low}F, wind up to {wind} mph",
                "source": "Open-Meteo",
                "provider": "openmeteo",
                "condition": condition,
                "temperatureHighF": daily_snapshot["temperatureHighF"],
                "temperatureLowF": daily_snapshot["temperatureLowF"],
                "windMph": daily_snapshot["windMph"],
                "weatherCode": daily_snapshot["weatherCode"],
            }

        current = payload.get("current") if isinstance(payload, dict) else None
        current_snapshot = self._read_current_snapshot(current)
        if current_snapshot:
            condition = self._condition_from_weather_code(current_snapshot["weatherCode"])
            temperature = round(current_snapshot["temperatureF"])
            wind = round(current_snapshot["windMph"])
            return {
                "latitude": latitude,
                "longitude": longitude,
                "date": target_date.isoformat(),
                "forecast": f"{condition}, {temperature}F, wind {wind} mph",
                "source": "Open-Meteo",
                "provider": "openmeteo",
                "condition": condition,
                "temperatureF": current_snapshot["temperatureF"],
                "windMph": current_snapshot["windMph"],
                "weatherCode": current_snapshot["weatherCode"],
            }

        raise WeatherUnavailableError("Weather is unavailable right now.")

    def get_planning_snapshot(self, target_date: date) -> WeatherSnapshot:
        sunny = target_date.day % 2 == 1
        return WeatherSnapshot(summary="Sunny, 75F" if sunny else "Cloudy, 68F", sunny_bias=0.5 if sunny else 0.1)

    def get_current_snapshot(
        self,
        latitude: float | None = None,
        longitude: float | None = None,
        query: str | None = None,
    ) -> dict:
        resolved_location = self._resolve_current_location(latitude, longitude, query)
        cache_key = self._current_cache_key(resolved_location["latitude"], resolved_location["longitude"])
        now = self._utc_now()
        cache_ttl = self._current_cache_ttl()
        cached = self._read_cache_payload(cache_key, now)
        if cached:
            payload = dict(cached["payload"])
            payload["cache"] = {
                "hit": True,
                "expiresAtUtc": cached["expiresAtUtc"].isoformat(),
                "ttlSeconds": cache_ttl,
            }
            return payload

        payload = self._fetch_current_snapshot(resolved_location)
        expires_at = now + timedelta(seconds=cache_ttl)
        self._write_cache_payload(cache_key, payload, expires_at, cache_ttl)
        payload = dict(payload)
        payload["cache"] = {
            "hit": False,
            "expiresAtUtc": expires_at.isoformat(),
            "ttlSeconds": cache_ttl,
        }
        return payload

    def clear_current_cache(self) -> None:
        self._CURRENT_CACHE.clear()
        self._NWS_POINT_CACHE.clear()
        if not has_app_context():
            return
        redis_client = self._redis_client()
        if redis_client:
            try:
                for pattern in ["weather:current:*", "weather:nws:*"]:
                    for key in redis_client.scan_iter(pattern):
                        redis_client.delete(key)
            except RedisError:
                current_app.logger.info("weather_redis_cache_clear_failed", exc_info=True)

    def _fetch_open_meteo_forecast(self, latitude: float, longitude: float, target_date: date) -> dict[str, Any]:
        base_url = current_app.config.get("WEATHER_BASE_URL") or "https://api.open-meteo.com/v1/forecast"
        timeout_seconds = float(current_app.config.get("ML_REQUEST_TIMEOUT_SECONDS", 5.0))
        try:
            response = requests.get(
                base_url,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max",
                    "current": "temperature_2m,weather_code,wind_speed_10m",
                    "temperature_unit": "fahrenheit",
                    "wind_speed_unit": "mph",
                    "timezone": "auto",
                    "start_date": target_date.isoformat(),
                    "end_date": target_date.isoformat(),
                },
                timeout=timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise WeatherUnavailableError("Weather provider unavailable.") from exc

        body = response.json()
        if not isinstance(body, dict):
            raise WeatherUnavailableError("Weather provider returned malformed data.")

        return body

    def _fetch_current_snapshot(self, location: dict[str, Any]) -> dict[str, Any]:
        last_error: WeatherUnavailableError | None = None
        stale_fallback: dict[str, Any] | None = None
        for provider in self._provider_order(location):
            try:
                payload = self._fetch_current_snapshot_for_provider(provider, location)
            except WeatherUnavailableError as exc:
                last_error = exc
                current_app.logger.info("%s_current_unavailable", provider, exc_info=True)
                continue

            if not self._is_current_payload_stale(payload):
                return payload

            stale_fallback = self._pick_fresher_current_payload(stale_fallback, payload)

        if stale_fallback:
            return stale_fallback

        raise last_error or WeatherUnavailableError("Weather is unavailable right now.")

    def _fetch_current_snapshot_for_provider(self, provider: str, location: dict[str, Any]) -> dict[str, Any]:
        if provider == "nws":
            return self._fetch_nws_current(location)

        if provider == "openweather":
            openweather_key = str(current_app.config.get("OPENWEATHERMAP_API_KEY") or "").strip()
            if not openweather_key:
                raise WeatherUnavailableError("OpenWeatherMap API key is not configured.")
            return self._fetch_openweathermap_current(location, openweather_key)

        if provider == "openmeteo":
            return self._fetch_open_meteo_current(location)

        raise WeatherUnavailableError("Unknown weather provider.")

    def _fetch_nws_current(self, location: dict[str, Any]) -> dict[str, Any]:
        if not current_app.config.get("WEATHER_NWS_ENABLED", True):
            raise WeatherUnavailableError("NWS weather provider is disabled.")

        point_metadata = self._get_nws_point_metadata(location["latitude"], location["longitude"])
        stations_url = point_metadata.get("observationStations")
        if not isinstance(stations_url, str) or not stations_url.strip():
            raise WeatherUnavailableError("NWS station metadata is missing.")

        station_ids = self._get_nws_station_ids(location["latitude"], location["longitude"], stations_url)
        observations: list[dict[str, Any]] = []
        for station_id in station_ids[:8]:
            try:
                observations.append(self._fetch_nws_station_observation(location, station_id))
            except WeatherUnavailableError:
                current_app.logger.info("nws_station_observation_unavailable", extra={"station": station_id}, exc_info=True)

        if observations:
            return sorted(observations, key=self._current_payload_freshness_sort_key)[0]

        raise WeatherUnavailableError("NWS did not return a usable current observation.")

    def _get_nws_point_metadata(self, latitude: float, longitude: float) -> dict[str, Any]:
        cache_key = f"weather:nws:point:{round(latitude, 3):.3f}:{round(longitude, 3):.3f}"
        cached = self._read_ttl_cache(cache_key, self._NWS_POINT_CACHE)
        if cached:
            return cached

        body = self._request_nws_json(f"/points/{latitude:.4f},{longitude:.4f}")
        properties = body.get("properties") if isinstance(body, dict) else None
        if not isinstance(properties, dict):
            raise WeatherUnavailableError("NWS point metadata is malformed.")

        point_metadata = {
            "observationStations": properties.get("observationStations"),
            "forecastOffice": properties.get("forecastOffice"),
        }
        if not isinstance(point_metadata["observationStations"], str):
            raise WeatherUnavailableError("NWS point metadata did not include observation stations.")

        self._write_ttl_cache(
            cache_key,
            point_metadata,
            self._nws_point_cache_ttl(),
            self._NWS_POINT_CACHE,
        )
        return point_metadata

    def _get_nws_station_ids(self, latitude: float, longitude: float, stations_url: str) -> list[str]:
        cache_key = f"weather:nws:stations:{round(latitude, 3):.3f}:{round(longitude, 3):.3f}"
        cached = self._read_ttl_cache(cache_key, self._NWS_POINT_CACHE)
        if cached and isinstance(cached.get("stationIds"), list):
            return [station_id for station_id in cached["stationIds"] if isinstance(station_id, str) and station_id.strip()]

        body = self._request_nws_json(stations_url)
        features = body.get("features") if isinstance(body, dict) else None
        if not isinstance(features, list):
            raise WeatherUnavailableError("NWS stations response is malformed.")

        station_ids = []
        for feature in features:
            properties = feature.get("properties") if isinstance(feature, dict) else None
            station_id = properties.get("stationIdentifier") if isinstance(properties, dict) else None
            if isinstance(station_id, str) and station_id.strip():
                station_ids.append(station_id.strip())

        if not station_ids:
            raise WeatherUnavailableError("NWS did not return observation stations.")

        self._write_ttl_cache(
            cache_key,
            {"stationIds": station_ids},
            self._nws_point_cache_ttl(),
            self._NWS_POINT_CACHE,
        )
        return station_ids

    def _fetch_nws_station_observation(self, location: dict[str, Any], station_id: str) -> dict[str, Any]:
        body = self._request_nws_json(f"/stations/{station_id}/observations/latest")
        properties = body.get("properties") if isinstance(body, dict) else None
        if not isinstance(properties, dict):
            raise WeatherUnavailableError("NWS observation response is malformed.")

        temperature = self._nws_temperature_f(properties.get("temperature"))
        wind = self._nws_wind_mph(properties.get("windSpeed"))
        condition = self._normalize_condition(properties.get("textDescription")) or "Current Conditions"
        observed_at = self._datetime_from_iso(properties.get("timestamp"))
        if temperature is None or wind is None:
            raise WeatherUnavailableError("NWS observation is missing current temperature or wind.")

        return self._build_current_payload(
            location=location,
            provider="nws",
            provider_label="National Weather Service",
            condition=condition,
            temperature=temperature,
            wind=wind,
            weather_code=None,
            observed_at=observed_at,
        )

    def _request_nws_json(self, path_or_url: str) -> dict[str, Any]:
        base_url = str(current_app.config.get("WEATHER_NWS_BASE_URL") or self._NWS_BASE_URL).rstrip("/")
        url = path_or_url if path_or_url.startswith("http") else f"{base_url}/{path_or_url.lstrip('/')}"
        timeout_seconds = float(current_app.config.get("ML_REQUEST_TIMEOUT_SECONDS", 5.0))
        try:
            response = requests.get(url, headers=self._nws_headers(), timeout=timeout_seconds)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise WeatherUnavailableError("NWS weather provider unavailable.") from exc

        body = response.json()
        if not isinstance(body, dict):
            raise WeatherUnavailableError("NWS returned malformed data.")
        return body

    def _fetch_openweathermap_current(self, location: dict[str, Any], api_key: str) -> dict[str, Any]:
        timeout_seconds = float(current_app.config.get("ML_REQUEST_TIMEOUT_SECONDS", 5.0))
        try:
            response = requests.get(
                current_app.config.get("OPENWEATHERMAP_BASE_URL") or self._OPENWEATHERMAP_BASE_URL,
                params={
                    "lat": location["latitude"],
                    "lon": location["longitude"],
                    "units": "imperial",
                    "appid": api_key,
                },
                timeout=timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise WeatherUnavailableError("OpenWeatherMap provider unavailable.") from exc

        body = response.json()
        if not isinstance(body, dict):
            raise WeatherUnavailableError("OpenWeatherMap returned malformed data.")

        temperature = self._finite_number((body.get("main") or {}).get("temp") if isinstance(body.get("main"), dict) else None)
        wind = self._finite_number((body.get("wind") or {}).get("speed") if isinstance(body.get("wind"), dict) else None)
        weather = body.get("weather")
        first_weather = weather[0] if isinstance(weather, list) and weather and isinstance(weather[0], dict) else {}
        condition = self._normalize_condition(first_weather.get("description") or first_weather.get("main"))
        observed_at = self._datetime_from_unix(body.get("dt"))
        weather_code = self._finite_number(first_weather.get("id"))
        icon_code = first_weather.get("icon") if isinstance(first_weather.get("icon"), str) else None
        if temperature is None or wind is None or not condition:
            raise WeatherUnavailableError("OpenWeatherMap returned incomplete current weather.")

        return self._build_current_payload(
            location=location,
            provider="openweather",
            provider_label="OpenWeatherMap",
            condition=condition,
            temperature=temperature,
            wind=wind,
            weather_code=weather_code,
            observed_at=observed_at,
            icon_code=icon_code,
            is_daytime=self._resolve_openweather_is_daytime(body, observed_at),
        )

    def _fetch_open_meteo_current(self, location: dict[str, Any]) -> dict[str, Any]:
        base_url = current_app.config.get("WEATHER_BASE_URL") or "https://api.open-meteo.com/v1/forecast"
        timeout_seconds = float(current_app.config.get("ML_REQUEST_TIMEOUT_SECONDS", 5.0))
        try:
            response = requests.get(
                base_url,
                params={
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "current": "temperature_2m,weather_code,wind_speed_10m,is_day",
                    "temperature_unit": "fahrenheit",
                    "wind_speed_unit": "mph",
                    "timezone": "auto",
                    "timeformat": "unixtime",
                },
                timeout=timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise WeatherUnavailableError("Weather provider unavailable.") from exc

        body = response.json()
        current = body.get("current") if isinstance(body, dict) else None
        current_snapshot = self._read_current_snapshot(current)
        if not current_snapshot:
            raise WeatherUnavailableError("Weather provider returned malformed data.")

        return self._build_current_payload(
            location=location,
            provider="openmeteo",
            provider_label="Open-Meteo",
            condition=self._condition_from_weather_code(current_snapshot["weatherCode"]),
            temperature=current_snapshot["temperatureF"],
            wind=current_snapshot["windMph"],
            weather_code=current_snapshot["weatherCode"],
            observed_at=self._datetime_from_unix(current.get("time") if isinstance(current, dict) else None),
            is_daytime=self._bool_from_current_daylight(current.get("is_day") if isinstance(current, dict) else None),
        )

    def _resolve_current_location(
        self,
        latitude: float | None,
        longitude: float | None,
        query: str | None,
    ) -> dict[str, Any]:
        if latitude is not None and longitude is not None:
            return {
                "label": query.strip() if isinstance(query, str) and query.strip() else None,
                "latitude": latitude,
                "longitude": longitude,
            }

        if not isinstance(query, str) or not query.strip():
            raise WeatherUnavailableError("Weather location is missing.")

        base_url = current_app.config.get("WEATHER_GEOCODE_BASE_URL") or self._GEOCODE_BASE_URL
        timeout_seconds = float(current_app.config.get("ML_REQUEST_TIMEOUT_SECONDS", 5.0))
        try:
            response = requests.get(
                base_url,
                params={
                    "name": query.strip(),
                    "count": 1,
                    "language": "en",
                    "format": "json",
                },
                timeout=timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise WeatherUnavailableError("Weather geocoder unavailable.") from exc

        body = response.json()
        results = body.get("results") if isinstance(body, dict) else None
        result = results[0] if isinstance(results, list) and results and isinstance(results[0], dict) else None
        resolved_latitude = self._finite_number(result.get("latitude") if result else None)
        resolved_longitude = self._finite_number(result.get("longitude") if result else None)
        if resolved_latitude is None or resolved_longitude is None:
            raise WeatherUnavailableError("Weather location could not be resolved.")

        label_parts = [result.get("name"), result.get("admin1"), result.get("country")] if result else []
        label = ", ".join(str(part).strip() for part in label_parts if isinstance(part, str) and part.strip())
        return {
            "label": label or query.strip(),
            "latitude": resolved_latitude,
            "longitude": resolved_longitude,
        }

    def _build_current_payload(
        self,
        *,
        location: dict[str, Any],
        provider: str,
        provider_label: str,
        condition: str,
        temperature: float,
        wind: float,
        weather_code: float | None,
        observed_at: datetime | None,
        icon_code: str | None = None,
        is_daytime: bool | None = None,
    ) -> dict[str, Any]:
        checked_at = self._utc_now()
        freshness_seconds = round((checked_at - observed_at).total_seconds()) if observed_at else None
        stale_seconds = int(current_app.config.get("WEATHER_CURRENT_STALE_SECONDS") or 30 * 60)
        payload = {
            "label": location.get("label"),
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "temperatureF": temperature,
            "condition": condition,
            "windMph": wind,
            "provider": provider,
            "providerLabel": provider_label,
            "source": provider_label,
            "checkedAtIso": checked_at.isoformat(),
            "freshnessSeconds": freshness_seconds,
            "isStale": freshness_seconds is not None and freshness_seconds > stale_seconds,
        }
        if observed_at:
            payload["observedAtIso"] = observed_at.isoformat()
        if weather_code is not None:
            payload["weatherCode"] = weather_code
            payload["conditionCode"] = weather_code
        if icon_code:
            payload["iconCode"] = icon_code
        if is_daytime is not None:
            payload["isDaytime"] = is_daytime
        return payload

    def _read_daily_snapshot(self, daily: Any, target_date: date) -> dict[str, float] | None:
        if not isinstance(daily, dict):
            return None

        dates = daily.get("time")
        codes = daily.get("weather_code")
        highs = daily.get("temperature_2m_max")
        lows = daily.get("temperature_2m_min")
        winds = daily.get("wind_speed_10m_max")
        if not all(isinstance(value, list) for value in [dates, codes, highs, lows, winds]):
            return None

        target = target_date.isoformat()
        try:
            index = dates.index(target)
        except ValueError:
            return None

        weather_code = self._finite_number_at(codes, index)
        high = self._finite_number_at(highs, index)
        low = self._finite_number_at(lows, index)
        wind = self._finite_number_at(winds, index)
        if weather_code is None or high is None or low is None or wind is None:
            return None

        return {
            "weatherCode": weather_code,
            "temperatureHighF": high,
            "temperatureLowF": low,
            "windMph": wind,
        }

    def _read_current_snapshot(self, current: Any) -> dict[str, float] | None:
        if not isinstance(current, dict):
            return None

        temperature = self._finite_number(current.get("temperature_2m"))
        weather_code = self._finite_number(current.get("weather_code"))
        wind = self._finite_number(current.get("wind_speed_10m"))
        if temperature is None or weather_code is None or wind is None:
            return None

        return {
            "temperatureF": temperature,
            "weatherCode": weather_code,
            "windMph": wind,
        }

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _normalize_condition(value: Any) -> str:
        if not isinstance(value, str):
            return ""
        text = value.strip()
        return text.title() if text else ""

    @staticmethod
    def _datetime_from_unix(value: Any) -> datetime | None:
        if isinstance(value, bool):
            return None
        if not isinstance(value, (int, float)):
            return None
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None

    @staticmethod
    def _bool_from_current_daylight(value: Any) -> bool | None:
        if isinstance(value, bool):
            return value
        if value in (1, "1"):
            return True
        if value in (0, "0"):
            return False
        return None

    def _resolve_openweather_is_daytime(self, body: dict[str, Any], observed_at: datetime | None) -> bool | None:
        weather = body.get("weather")
        first_weather = weather[0] if isinstance(weather, list) and weather and isinstance(weather[0], dict) else {}
        icon = first_weather.get("icon")
        if isinstance(icon, str) and icon.endswith("d"):
            return True
        if isinstance(icon, str) and icon.endswith("n"):
            return False

        sys_payload = body.get("sys") if isinstance(body.get("sys"), dict) else {}
        sunrise = self._datetime_from_unix(sys_payload.get("sunrise"))
        sunset = self._datetime_from_unix(sys_payload.get("sunset"))
        if observed_at is None or sunrise is None or sunset is None:
            return None
        return sunrise <= observed_at < sunset

    def _provider_order(self, location: dict[str, Any] | None = None) -> list[str]:
        configured_order = str(current_app.config.get("WEATHER_PROVIDER_ORDER") or "nws,openweather,openmeteo")
        providers = []
        for provider in configured_order.split(","):
            normalized_provider = provider.strip().lower()
            if normalized_provider in {"nws", "openweather", "openmeteo"} and normalized_provider not in providers:
                providers.append(normalized_provider)
        providers = providers or ["nws", "openweather", "openmeteo"]

        if not location:
            return providers

        if self._is_nws_supported_location(location["latitude"], location["longitude"]):
            return ["nws", *[provider for provider in providers if provider != "nws"]]

        return [provider for provider in providers if provider != "nws"]

    def _redis_client(self) -> Redis | None:
        if not has_app_context():
            return None

        raw_url = current_app.config.get("WEATHER_CACHE_REDIS_URL")
        if not raw_url:
            return None

        redis_url = self._normalize_redis_url(str(raw_url))
        client = self._REDIS_CLIENTS.get(redis_url)
        if client:
            return client

        try:
            client = Redis.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1, decode_responses=True)
            client.ping()
        except RedisError:
            current_app.logger.info("weather_redis_unavailable", exc_info=True)
            return None

        self._REDIS_CLIENTS[redis_url] = client
        return client

    @staticmethod
    def _normalize_redis_url(value: str) -> str:
        redis_url = value.strip()
        if not redis_url:
            return ""
        if "://" in redis_url:
            return redis_url
        return f"redis://{redis_url}/4"

    def _read_cache_payload(self, cache_key: str, now: datetime) -> dict[str, Any] | None:
        redis_client = self._redis_client()
        if redis_client:
            try:
                cached_value = redis_client.get(cache_key)
                if cached_value:
                    decoded = json.loads(cached_value)
                    expires_at = self._datetime_from_iso(decoded.get("expiresAtUtc"))
                    payload = decoded.get("payload")
                    if expires_at and expires_at > now and isinstance(payload, dict):
                        return {"expiresAtUtc": expires_at, "payload": payload}
                    redis_client.delete(cache_key)
            except (RedisError, json.JSONDecodeError, TypeError):
                current_app.logger.info("weather_redis_read_failed", exc_info=True)

        cached = self._CURRENT_CACHE.get(cache_key)
        if cached and cached["expiresAtUtc"] > now:
            return cached
        return None

    def _write_cache_payload(self, cache_key: str, payload: dict[str, Any], expires_at: datetime, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return

        cache_entry = {
            "expiresAtUtc": expires_at,
            "payload": payload,
        }
        self._CURRENT_CACHE[cache_key] = cache_entry
        redis_client = self._redis_client()
        if not redis_client:
            return

        try:
            redis_client.setex(
                cache_key,
                ttl_seconds,
                json.dumps({"expiresAtUtc": expires_at.isoformat(), "payload": payload}),
            )
        except (RedisError, TypeError):
            current_app.logger.info("weather_redis_write_failed", exc_info=True)

    def _read_ttl_cache(self, cache_key: str, memory_cache: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
        now = self._utc_now()
        redis_client = self._redis_client()
        if redis_client:
            try:
                cached_value = redis_client.get(cache_key)
                if cached_value:
                    decoded = json.loads(cached_value)
                    expires_at = self._datetime_from_iso(decoded.get("expiresAtUtc"))
                    payload = decoded.get("payload")
                    if expires_at and expires_at > now and isinstance(payload, dict):
                        return payload
                    redis_client.delete(cache_key)
            except (RedisError, json.JSONDecodeError, TypeError):
                current_app.logger.info("weather_redis_read_failed", exc_info=True)

        cached = memory_cache.get(cache_key)
        if cached and cached["expiresAtUtc"] > now and isinstance(cached.get("payload"), dict):
            return cached["payload"]
        return None

    def _write_ttl_cache(
        self,
        cache_key: str,
        payload: dict[str, Any],
        ttl_seconds: int,
        memory_cache: dict[str, dict[str, Any]],
    ) -> None:
        if ttl_seconds <= 0:
            return

        expires_at = self._utc_now() + timedelta(seconds=ttl_seconds)
        memory_cache[cache_key] = {
            "expiresAtUtc": expires_at,
            "payload": payload,
        }
        redis_client = self._redis_client()
        if not redis_client:
            return

        try:
            redis_client.setex(
                cache_key,
                ttl_seconds,
                json.dumps({"expiresAtUtc": expires_at.isoformat(), "payload": payload}),
            )
        except (RedisError, TypeError):
            current_app.logger.info("weather_redis_write_failed", exc_info=True)

    def _current_cache_ttl(self) -> int:
        value = current_app.config.get("WEATHER_CURRENT_CACHE_SECONDS")
        try:
            ttl = int(value)
        except (TypeError, ValueError):
            ttl = 60
        return max(0, ttl)

    def _nws_point_cache_ttl(self) -> int:
        value = current_app.config.get("WEATHER_NWS_POINT_CACHE_SECONDS")
        try:
            ttl = int(value)
        except (TypeError, ValueError):
            ttl = 86400
        return max(0, ttl)

    def _nws_headers(self) -> dict[str, str]:
        user_agent = str(current_app.config.get("WEATHER_NWS_USER_AGENT") or "").strip()
        return {
            "Accept": "application/geo+json, application/json",
            "User-Agent": user_agent or "Scope/1.0 (weather-cache; contact: ops@scope.local)",
        }

    @staticmethod
    def _current_cache_key(latitude: float, longitude: float) -> str:
        return f"weather:current:v3:{round(latitude, 4):.4f}:{round(longitude, 4):.4f}"

    @staticmethod
    def _current_payload_freshness_sort_key(payload: dict[str, Any]) -> tuple[int, float]:
        freshness = payload.get("freshnessSeconds")
        if not isinstance(freshness, (int, float)) or isinstance(freshness, bool):
            freshness_value = float("inf")
        else:
            freshness_value = max(float(freshness), 0)
        return (1 if payload.get("isStale") else 0, freshness_value)

    def _pick_fresher_current_payload(
        self,
        left: dict[str, Any] | None,
        right: dict[str, Any],
    ) -> dict[str, Any]:
        if left is None:
            return right
        return min([left, right], key=self._current_payload_freshness_sort_key)

    @staticmethod
    def _is_current_payload_stale(payload: dict[str, Any]) -> bool:
        return bool(payload.get("isStale"))

    @staticmethod
    def _is_nws_supported_location(latitude: float, longitude: float) -> bool:
        regions = [
            (24.0, 50.0, -125.0, -66.0),   # Contiguous United States
            (51.0, 72.0, -170.0, -129.0),  # Alaska
            (18.0, 23.0, -161.0, -154.0),  # Hawaii
            (17.0, 19.0, -68.0, -64.0),    # Puerto Rico / USVI
            (13.0, 15.0, 144.0, 146.0),    # Guam / Northern Mariana Islands
            (-15.0, -11.0, -171.0, -168.0), # American Samoa
        ]
        return any(
            min_latitude <= latitude <= max_latitude and min_longitude <= longitude <= max_longitude
            for min_latitude, max_latitude, min_longitude, max_longitude in regions
        )

    def _nws_temperature_f(self, value: Any) -> float | None:
        temperature = self._quantitative_value(value)
        if temperature is None:
            return None

        unit_code = value.get("unitCode") if isinstance(value, dict) else None
        if isinstance(unit_code, str) and ("degf" in unit_code.lower() or "fahrenheit" in unit_code.lower()):
            return round(temperature, 1)
        return round((temperature * 9 / 5) + 32, 1)

    def _nws_wind_mph(self, value: Any) -> float | None:
        wind = self._quantitative_value(value)
        if wind is None:
            return None

        unit_code = value.get("unitCode") if isinstance(value, dict) else None
        normalized_unit = unit_code.lower() if isinstance(unit_code, str) else ""
        if "mile" in normalized_unit or "mi_h-1" in normalized_unit:
            return round(wind, 1)
        if "m_s-1" in normalized_unit:
            return round(wind * 2.23694, 1)
        return round(wind * 0.621371, 1)

    def _quantitative_value(self, payload: Any) -> float | None:
        if not isinstance(payload, dict):
            return None
        return self._finite_number(payload.get("value"))

    @staticmethod
    def _finite_number(value: Any) -> float | None:
        if isinstance(value, bool):
            return None

        if isinstance(value, (int, float)) and value == value and abs(float(value)) != float("inf"):
            return float(value)

        return None

    def _finite_number_at(self, values: list[Any], index: int) -> float | None:
        if index < 0 or index >= len(values):
            return None

        return self._finite_number(values[index])

    @staticmethod
    def _datetime_from_iso(value: Any) -> datetime | None:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            normalized_value = value.strip().replace("Z", "+00:00")
            parsed_value = datetime.fromisoformat(normalized_value)
        except ValueError:
            return None
        if parsed_value.tzinfo is None:
            return parsed_value.replace(tzinfo=timezone.utc)
        return parsed_value.astimezone(timezone.utc)

    @staticmethod
    def _condition_from_weather_code(weather_code: float) -> str:
        code = round(weather_code)
        if code == 0:
            return "Clear"
        if code in {1, 2, 3}:
            return "Partly Cloudy"
        if code in {45, 48}:
            return "Fog"
        if code in {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}:
            return "Rain"
        if code in {71, 73, 75, 77, 85, 86}:
            return "Snow"
        if code in {95, 96, 99}:
            return "Thunderstorms"
        return "Current Conditions"
