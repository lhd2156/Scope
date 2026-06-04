from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import requests
from redis.exceptions import RedisError

from app.services import content_client
from app.services.content_client import (
    ContentServiceClient,
    FixtureContentServiceClient,
    HttpContentServiceClient,
)
from app.services.geocoding_service import GeocodingService
from app.services.weather_service import WeatherService, WeatherUnavailableError


class JsonResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.ok = status_code < 400
        self.content = b"image"

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError("bad status", response=self)

    def json(self):
        return self._payload


def _row(**overrides):
    base = {
        "id": "spot-1",
        "title": "River Walk",
        "description": "Food and river views in Fort Worth",
        "category": "food",
        "vibe": "calm",
        "rating": "4.6",
        "likesCount": "10",
        "photosCount": "4",
        "latitude": 32.75,
        "longitude": -97.33,
        "likedByUsers": ["user-1", 7],
    }
    base.update(overrides)
    return base


def test_content_client_helpers_fixture_and_mapping():
    assert content_client._safe_int("4.9") == 4
    assert content_client._safe_int("bad", default=3) == 3
    assert content_client._safe_float(float("nan"), default=2.5) == 2.5
    assert content_client._safe_float("999", maximum=5.0) == 5.0
    assert round(content_client._distance_km(32.75, -97.33, 32.76, -97.34), 2) > 0

    with pytest.raises(ValueError):
        content_client._coordinate("999", -90, 90)
    with pytest.raises(ValueError):
        content_client._map_content_row({"title": "missing id", "latitude": 0, "longitude": 0})

    mapped = content_client._map_content_row(_row(category="scenic", rating=None, averageRating="4.2"))
    assert mapped.spot_id == "spot-1"
    assert mapped.rating == 4.2
    assert mapped.popularity == 54.0
    assert mapped.estimated_cost == 0.0
    assert mapped.is_outdoor is True
    assert mapped.liked_by_users == ("user-1", "7")

    entertainment = content_client._map_content_row(_row(category="entertainment"))
    assert entertainment.estimated_cost == 45.0
    assert entertainment.is_outdoor is False

    fixtures = FixtureContentServiceClient([mapped])
    assert fixtures.get_all_spots() == [mapped]
    assert fixtures.get_spot("spot-1") == mapped
    assert fixtures.get_spot("missing") is None
    assert fixtures.search_spots("Fort Worth", ["food"]) == [mapped]
    assert fixtures.search_spots("Nowhere", []) == [mapped]
    assert fixtures.nearby_spots(32.75, -97.33, 1, limit=1) == [mapped]


def test_http_content_client_fetches_caches_searches_and_handles_failures(monkeypatch, app):
    calls = []

    class FakeSession:
        def get(self, url, **kwargs):
            calls.append((url, kwargs))
            if url.endswith("/spots/bad-json"):
                return SimpleNamespace(status_code=200, json=lambda: (_ for _ in ()).throw(ValueError("bad json")))
            if url.endswith("/spots/missing"):
                return JsonResponse({}, status_code=404)
            if url.endswith("/spots/error"):
                return JsonResponse({}, status_code=500)
            if url.endswith("/spots/invalid"):
                return JsonResponse({"data": {"id": "x", "latitude": 999, "longitude": 0}})
            if url.endswith("/spots/spot-list"):
                return JsonResponse({"data": [_row(id="spot-list")]})
            return JsonResponse({"data": [_row()]})

    client = HttpContentServiceClient("https://content.example/api/content", session=FakeSession(), timeout=1, fetch_limit=50)

    first = client.get_all_spots()
    second = client.get_all_spots()
    assert first[0].spot_id == "spot-1"
    assert second[0].spot_id == "spot-1"
    assert len([call for call in calls if call[0].endswith("/spots/")]) == 1

    assert client.get_spot("spot-list").spot_id == "spot-list"
    assert client.get_spot("") is None
    assert client.get_spot("missing") is None
    assert client.get_spot("error") is None
    assert client.get_spot("bad-json") is None
    assert client.get_spot("invalid") is None
    assert client.search_spots("river", ["food"])[0].title == "River Walk"
    assert client.nearby_spots(32.75, -97.33, 2, limit=5)[0].spot_id == "spot-1"

    class BrokenSession:
        def get(self, *args, **kwargs):
            raise RuntimeError("offline")

    broken = HttpContentServiceClient("https://content.example/api/content", session=BrokenSession())
    assert broken.get_spot("spot-1") is None
    assert broken.get_all_spots() == []

    assert isinstance(content_client.build_content_service_client(), FixtureContentServiceClient)
    with app.app_context():
        app.config["TESTING"] = False
        app.config["CONTENT_SERVICE_URL"] = ""
        with pytest.raises(RuntimeError):
            content_client.build_content_service_client()
        app.config["CONTENT_SERVICE_URL"] = "https://content.example/api/content"
        built = content_client.build_content_service_client()
        assert built is content_client.build_content_service_client()
        explicit = FixtureContentServiceClient(first)
        assert ContentServiceClient(explicit).get_all_spots() == explicit.get_all_spots()


def test_geocoding_provider_paths_and_parsers(app, monkeypatch):
    service = GeocodingService()
    app.config.update(TESTING=False, MAPBOX_ACCESS_TOKEN="", GEOCODE_BASE_URL="https://geocode.open-meteo.com/v1/search")

    with app.app_context():
        def fake_open_meteo_get(url, params, headers=None, timeout=0):
            return JsonResponse({"results": [{"name": "Dallas", "admin1": "Texas", "country": "United States", "latitude": 32.77, "longitude": -96.79, "feature_code": "PPLA"}]})

        monkeypatch.setattr("app.services.geocoding_service.requests.get", fake_open_meteo_get)
        geocoded = service.geocode("  Dallas   TX ", limit=99)
        assert geocoded[0]["formattedAddress"] == "Dallas, Texas, United States"
        assert service._normalize_limit("bad") == 5
        assert service._request_headers()["User-Agent"].startswith("ScopeIntel")

        app.config["GEOCODE_BASE_URL"] = "https://nominatim.example/search"
        app.config["GEOCODE_API_KEY"] = "geo-key"
        captured = {}

        def fake_nominatim_get(url, params, headers=None, timeout=0):
            captured.update(params)
            return JsonResponse([
                {
                    "display_name": "100 Main St, Austin, TX",
                    "name": "",
                    "lat": "30.26",
                    "lon": "-97.74",
                    "type": "restaurant",
                    "address": {"house_number": "100", "road": "Main St", "city": "Austin", "country": "United States", "postcode": "78701"},
                }
            ])

        monkeypatch.setattr("app.services.geocoding_service.requests.get", fake_nominatim_get)
        assert service.geocode("Austin", limit=2)[0]["address"] == "100 Main St"
        assert captured["api_key"] == "geo-key"

        app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"

        def fake_mapbox_get(url, params, timeout=0):
            assert "Austin" in url or "-97.74,30.26" in url
            return JsonResponse(
                {
                    "features": [
                        {
                            "id": "address.1",
                            "text": "Main St",
                            "address": "100",
                            "place_name": "100 Main St, Austin, Texas",
                            "center": [-97.74, 30.26],
                            "place_type": ["address"],
                            "properties": {"postcode": "78701"},
                            "context": [
                                {"id": "place.1", "text": "Austin"},
                                {"id": "country.1", "text": "United States", "short_code": "us"},
                            ],
                        }
                    ]
                }
            )

        monkeypatch.setattr("app.services.geocoding_service.requests.get", fake_mapbox_get)
        assert service.geocode("Austin", limit=1)[0]["providerPlaceId"] == "address.1"
        assert service.reverse_geocode(30.26, -97.74)["countryCode"] == "us"

        monkeypatch.setattr("app.services.geocoding_service.requests.get", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        assert service.geocode("Nowhere") == []
        assert service.reverse_geocode(1.2, 3.4)["precision"] == "coordinate"


def test_weather_forecast_current_cache_and_provider_helpers(app, monkeypatch):
    service = WeatherService()
    service._CURRENT_CACHE.clear()
    service._NWS_POINT_CACHE.clear()
    app.config.update(
        TESTING=False,
        WEATHER_CURRENT_CACHE_SECONDS=60,
        WEATHER_CURRENT_STALE_SECONDS=1800,
        WEATHER_PROVIDER_ORDER="nws,openweather,openmeteo,unknown",
        WEATHER_NWS_ENABLED=True,
        OPENWEATHERMAP_API_KEY="owm-key",
        ML_REQUEST_TIMEOUT_SECONDS=1,
    )

    with app.app_context():
        monkeypatch.setattr(
            service,
            "_fetch_open_meteo_forecast",
            lambda lat, lon, target: {
                "daily": {
                    "time": [target.isoformat()],
                    "weather_code": [0],
                    "temperature_2m_max": [80],
                    "temperature_2m_min": [60],
                    "wind_speed_10m_max": [8],
                }
            },
        )
        forecast = service.get_forecast(1, 2, date(2026, 5, 20))
        assert forecast["condition"] == "Clear"
        assert forecast["forecast"] == "Clear, high 80F / low 60F, wind up to 8 mph"

        monkeypatch.setattr(
            service,
            "_fetch_open_meteo_forecast",
            lambda lat, lon, target: {"current": {"temperature_2m": 70, "weather_code": 61, "wind_speed_10m": 12}},
        )
        assert "70F" in service.get_forecast(1, 2, date(2026, 5, 21))["forecast"]

        monkeypatch.setattr(service, "_fetch_open_meteo_forecast", lambda *args: {})
        with pytest.raises(WeatherUnavailableError):
            service.get_forecast(1, 2, date(2026, 5, 21))

        monkeypatch.setattr(service, "_resolve_current_location", lambda lat, lon, query: {"label": "Dallas", "latitude": 32.75, "longitude": -97.33})
        monkeypatch.setattr(
            service,
            "_fetch_current_snapshot",
            lambda location: service._build_current_payload(
                location=location,
                provider="openmeteo",
                provider_label="Open-Meteo",
                condition="Clear",
                temperature=75,
                wind=5,
                weather_code=0,
                observed_at=service._utc_now(),
            ),
        )

        first = service.get_current_snapshot(query="Dallas")
        second = service.get_current_snapshot(query="Dallas")
        assert first["cache"]["hit"] is False
        assert second["cache"]["hit"] is True
        assert second["temperatureF"] == 75

        assert service._condition_from_weather_code(95) == "Thunderstorms"
        assert service._bool_from_current_daylight("0") is False
        assert service._datetime_from_unix(True) is None
        assert service._datetime_from_iso("2026-05-20T10:00:00") is not None
        assert service._provider_order({"latitude": 35, "longitude": -97})[0] == "nws"
        assert "nws" not in service._provider_order({"latitude": 10, "longitude": 10})
        assert service._nws_temperature_f({"value": 20, "unitCode": "wmoUnit:degC"}) == 68.0
        assert service._nws_wind_mph({"value": 10, "unitCode": "wmoUnit:m_s-1"}) == 22.4
        assert service._finite_number(float("inf")) is None
        assert service._finite_number_at([1], 5) is None


def test_weather_nws_openweather_openmeteo_and_redis_paths(app, monkeypatch):
    service = WeatherService()
    service._CURRENT_CACHE.clear()
    service._NWS_POINT_CACHE.clear()
    app.config.update(
        TESTING=False,
        WEATHER_CACHE_REDIS_URL="localhost:6379",
        WEATHER_NWS_POINT_CACHE_SECONDS=60,
        WEATHER_CURRENT_CACHE_SECONDS=60,
        WEATHER_CURRENT_STALE_SECONDS=1800,
        OPENWEATHERMAP_API_KEY="owm-key",
        WEATHER_BASE_URL="https://openmeteo.test",
    )

    with app.app_context():
        def fake_nws_json(path):
            if "points" in path:
                return {"properties": {"observationStations": "https://nws.test/stations", "forecastOffice": "office"}}
            if "stations" in path and "observations" not in path:
                return {"features": [{"properties": {"stationIdentifier": "KDFW"}}, {"properties": {"stationIdentifier": ""}}]}
            return {
                "properties": {
                    "temperature": {"value": 20, "unitCode": "wmoUnit:degC"},
                    "windSpeed": {"value": 10, "unitCode": "wmoUnit:m_s-1"},
                    "textDescription": "mostly cloudy",
                    "timestamp": "2026-05-20T12:00:00Z",
                }
            }

        monkeypatch.setattr(service, "_request_nws_json", fake_nws_json)
        nws = service._fetch_nws_current({"label": "Dallas", "latitude": 32.75, "longitude": -97.33})
        assert nws["provider"] == "nws"
        assert nws["condition"] == "Mostly Cloudy"
        assert service._get_nws_station_ids(32.75, -97.33, "https://nws.test/stations") == ["KDFW"]

        def fake_get(url, params=None, headers=None, timeout=0):
            if "openweathermap" in url or "data/2.5/weather" in url:
                return JsonResponse(
                    {
                        "main": {"temp": 72},
                        "wind": {"speed": 9},
                        "weather": [{"description": "clear sky", "id": 800, "icon": "01d"}],
                        "dt": 1_700_000_000,
                        "sys": {"sunrise": 1_699_990_000, "sunset": 1_700_100_000},
                    }
                )
            return JsonResponse({"current": {"temperature_2m": 66, "weather_code": 3, "wind_speed_10m": 4, "time": 1_700_000_000, "is_day": 1}})

        monkeypatch.setattr("app.services.weather_service.requests.get", fake_get)
        location = {"label": "Dallas", "latitude": 32.75, "longitude": -97.33}
        assert service._fetch_openweathermap_current(location, "owm-key")["isDaytime"] is True
        assert service._fetch_open_meteo_current(location)["condition"] == "Partly Cloudy"
        with pytest.raises(WeatherUnavailableError):
            service._fetch_current_snapshot_for_provider("unknown", location)

        class FakeRedis:
            def __init__(self):
                self.store = {}

            def ping(self):
                return True

            def get(self, key):
                return self.store.get(key)

            def setex(self, key, ttl, value):
                self.store[key] = value

            def delete(self, key):
                self.store.pop(key, None)

            def scan_iter(self, pattern):
                return list(self.store)

        redis = FakeRedis()
        monkeypatch.setattr("app.services.weather_service.Redis.from_url", lambda *args, **kwargs: redis)
        WeatherService._REDIS_CLIENTS.clear()
        assert service._normalize_redis_url("localhost:6379") == "redis://localhost:6379/4"
        assert service._redis_client() is redis
        expires = datetime.now(timezone.utc) + timedelta(minutes=1)
        service._write_cache_payload("weather:current:test", {"temperatureF": 70}, expires, 60)
        assert service._read_cache_payload("weather:current:test", datetime.now(timezone.utc))["payload"]["temperatureF"] == 70
        service.clear_current_cache()
        assert redis.store == {}

        class BadRedis:
            def ping(self):
                raise RedisError("down")

        WeatherService._REDIS_CLIENTS.clear()
        monkeypatch.setattr("app.services.weather_service.Redis.from_url", lambda *args, **kwargs: BadRedis())
        assert service._redis_client() is None
