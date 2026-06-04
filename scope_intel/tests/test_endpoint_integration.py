from datetime import datetime, timezone

import requests

from app import create_app

TEST_SECRET_KEY = "scope-intel-test-secret"
TEST_JWT_SECRET = "scope-intel-test-jwt-secret"
TEST_JWT_ISSUER = "scope-core"
TEST_JWT_AUDIENCE = "scope-frontend"
TEST_FRONTEND_ORIGIN = "https://scope-frontend.example"

VALID_ITINERARY_PAYLOAD = {
    "destination": "Fort Worth, TX",
    "startDate": "2026-04-01",
    "endDate": "2026-04-03",
    "budget": 500,
    "interests": ["food", "culture", "nightlife"],
    "pace": "moderate",
    "groupSize": 2,
}

VALID_RECOMMENDATION_PAYLOAD = {
    "userId": "user-1",
    "likedSpotIds": ["spot-1"],
    "interests": ["culture", "nightlife"],
    "limit": 3,
}

VALID_ROUTE_PAYLOAD = {
    "spots": [
        {"spotId": "spot-1", "latitude": 32.7555, "longitude": -97.3308},
        {"spotId": "spot-2", "latitude": 32.7489, "longitude": -97.3623},
        {"spotId": "spot-3", "latitude": 32.7507, "longitude": -97.3511},
    ],
    "startLat": 32.7555,
    "startLng": -97.3308,
}

VALID_VIBE_PAYLOAD = {
    "description": "I want a chill outdoor walk with sunset views",
    "limit": 2,
}


def build_low_limit_client():
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": TEST_SECRET_KEY,
            "JWT_SECRET": TEST_JWT_SECRET,
            "JWT_ISSUER": TEST_JWT_ISSUER,
            "JWT_AUDIENCE": TEST_JWT_AUDIENCE,
            "FRONTEND_ORIGIN": TEST_FRONTEND_ORIGIN,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "RATE_LIMIT_PER_MINUTE": 1,
            "RATELIMIT_ENABLED": True,
        }
    )
    return app.test_client()


def create_itinerary(client, auth_header) -> dict:
    response = client.post("/api/intel/itinerary/generate", json=VALID_ITINERARY_PAYLOAD, headers=auth_header)
    assert response.status_code == 200
    return response.get_json()["data"]


def test_health_endpoint_happy_path(client):
    response = client.get("/api/intel/health")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "healthy"
    assert payload["version"] == "1.0.0"
    assert isinstance(payload["uptime"], int)


def test_health_endpoint_rate_limit_error_path():
    client = build_low_limit_client()

    first_response = client.get("/api/intel/health")
    second_response = client.get("/api/intel/health")

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    error = second_response.get_json()["error"]
    assert error["code"] == "RATE_LIMITED"
    assert second_response.headers["Retry-After"] == "60"


def test_itinerary_generate_happy_path(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json=VALID_ITINERARY_PAYLOAD, headers=auth_header)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "Fort Worth, TX"
    assert payload["weatherForecast"] == "Sunny, 75F"
    assert len(payload["days"]) == 3
    assert payload["days"][0]["spots"]


def test_itinerary_generate_validation_error_path(client, auth_header):
    invalid_payload = dict(VALID_ITINERARY_PAYLOAD)
    invalid_payload["pace"] = "sprint"

    response = client.post("/api/intel/itinerary/generate", json=invalid_payload, headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"pace"}


def test_itinerary_fetch_happy_path(client, auth_header):
    itinerary = create_itinerary(client, auth_header)

    response = client.get(f"/api/intel/itinerary/{itinerary['id']}", headers=auth_header)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["id"] == itinerary["id"]
    assert payload["destination"] == itinerary["destination"]


def test_itinerary_fetch_not_found_error_path(client, auth_header):
    response = client.get("/api/intel/itinerary/missing-itinerary", headers=auth_header)

    assert response.status_code == 404
    error = response.get_json()["error"]
    assert error["code"] == "NOT_FOUND"


def test_recommend_spots_happy_path(client, auth_header):
    response = client.post("/api/intel/recommend/spots", json=VALID_RECOMMENDATION_PAYLOAD, headers=auth_header)

    assert response.status_code == 200
    recommendations = response.get_json()["data"]["recommendations"]
    assert len(recommendations) == 3
    assert all(item["spotId"] != "spot-1" for item in recommendations)


def test_recommend_spots_validation_error_path(client, auth_header):
    invalid_payload = dict(VALID_RECOMMENDATION_PAYLOAD)
    invalid_payload["limit"] = 0

    response = client.post("/api/intel/recommend/spots", json=invalid_payload, headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"limit"}


def test_recommend_similar_happy_path(client, auth_header):
    response = client.post("/api/intel/recommend/similar/spot-2", json={"limit": 2}, headers=auth_header)

    assert response.status_code == 200
    recommendations = response.get_json()["data"]["recommendations"]
    assert len(recommendations) == 2
    assert all(item["spotId"] != "spot-2" for item in recommendations)


def test_recommend_similar_validation_error_path(client, auth_header):
    response = client.post("/api/intel/recommend/similar/spot-2", json={"limit": 0}, headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"limit"}


def test_vibe_match_happy_path(client, auth_header):
    response = client.post("/api/intel/vibe-match", json=VALID_VIBE_PAYLOAD, headers=auth_header)

    assert response.status_code == 200
    matches = response.get_json()["data"]["matches"]
    assert len(matches) == 2
    assert all("score" in item for item in matches)


def test_vibe_match_validation_error_path(client, auth_header):
    response = client.post("/api/intel/vibe-match", json={"description": "bad", "limit": 2}, headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"description"}


def test_route_optimize_happy_path(client, auth_header):
    response = client.post("/api/intel/route/optimize", json=VALID_ROUTE_PAYLOAD, headers=auth_header)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert len(payload["orderedSpots"]) == 3
    assert payload["estimatedDistance"] >= 0


def test_route_optimize_validation_error_path(client, auth_header):
    response = client.post(
        "/api/intel/route/optimize",
        json={
            "spots": [{"spotId": "spot-1", "latitude": 32.7555}],
            "startLat": 32.7555,
            "startLng": -97.3308,
        },
        headers=auth_header,
    )

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"spots[0].longitude"}


class WeatherResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError("weather provider failed")

    def json(self):
        return self.payload


def open_meteo_payload():
    return {
        "daily": {
            "time": ["2026-04-01"],
            "weather_code": [2],
            "temperature_2m_max": [82.4],
            "temperature_2m_min": [67.2],
            "wind_speed_10m_max": [14.6],
        },
        "current": {
            "temperature_2m": 75.1,
            "weather_code": 1,
            "wind_speed_10m": 8.2,
        },
    }


def test_weather_happy_path(client, auth_header, monkeypatch):
    def fake_weather_get(_url, params=None, timeout=None):
        assert params["latitude"] == 32.7555
        assert params["longitude"] == -97.3308
        assert params["start_date"] == "2026-04-01"
        assert params["end_date"] == "2026-04-01"
        assert timeout == 5.0
        return WeatherResponse(open_meteo_payload())

    monkeypatch.setattr("app.services.weather_service.requests.get", fake_weather_get)

    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "latitude": 32.7555,
        "longitude": -97.3308,
        "date": "2026-04-01",
        "forecast": "Partly Cloudy, high 82F / low 67F, wind up to 15 mph",
        "source": "Open-Meteo",
        "provider": "openmeteo",
        "condition": "Partly Cloudy",
        "temperatureHighF": 82.4,
        "temperatureLowF": 67.2,
        "windMph": 14.6,
        "weatherCode": 2.0,
    }


def test_current_weather_uses_backend_provider_and_cache(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = ""
    app.config["WEATHER_NWS_ENABLED"] = False
    app.config["WEATHER_CURRENT_CACHE_SECONDS"] = 120
    from app.api.weather import service

    service.clear_current_cache()
    provider_calls = []

    def fake_weather_get(_url, params=None, timeout=None):
        provider_calls.append(params)
        assert params["latitude"] == 32.8343
        assert params["longitude"] == -97.2289
        assert params["current"] == "temperature_2m,weather_code,wind_speed_10m,is_day"
        assert params["timeformat"] == "unixtime"
        assert timeout == 5.0
        return WeatherResponse({
            "current": {
                "time": 1_779_151_200,
                "temperature_2m": 82.7,
                "weather_code": 0,
                "wind_speed_10m": 11.6,
                "is_day": 0,
            },
        })

    monkeypatch.setattr("app.services.weather_service.requests.get", fake_weather_get)

    first_response = client.get(
        "/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills",
        headers=auth_header,
    )
    second_response = client.get(
        "/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills",
        headers=auth_header,
    )

    assert first_response.status_code == 200
    first_payload = first_response.get_json()["data"]
    assert first_payload["label"] == "North Richland Hills"
    assert first_payload["latitude"] == 32.8343
    assert first_payload["longitude"] == -97.2289
    assert first_payload["temperatureF"] == 82.7
    assert first_payload["condition"] == "Clear"
    assert first_payload["windMph"] == 11.6
    assert first_payload["provider"] == "openmeteo"
    assert first_payload["providerLabel"] == "Open-Meteo"
    assert first_payload["source"] == "Open-Meteo"
    assert first_payload["weatherCode"] == 0.0
    assert first_payload["conditionCode"] == 0.0
    assert first_payload["isDaytime"] is False
    assert isinstance(first_payload["checkedAtIso"], str)
    assert isinstance(first_payload["observedAtIso"], str)
    assert isinstance(first_payload["freshnessSeconds"], int)
    assert first_payload["cache"]["hit"] is False
    assert first_payload["cache"]["ttlSeconds"] == 120
    assert isinstance(first_payload["cache"]["expiresAtUtc"], str)
    assert second_response.status_code == 200
    assert second_response.get_json()["data"]["cache"]["hit"] is True
    assert len(provider_calls) == 1


def test_current_weather_uses_global_provider_for_non_us_coordinates(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = "owm-test-key"
    app.config["WEATHER_NWS_ENABLED"] = True
    app.config["WEATHER_PROVIDER_ORDER"] = "nws,openweather,openmeteo"
    from app.api.weather import service

    service.clear_current_cache()
    monkeypatch.setattr(service, "_utc_now", lambda: datetime(2026, 5, 19, 4, 0, tzinfo=timezone.utc))
    provider_urls = []

    def fake_weather_get(url, params=None, headers=None, timeout=None):
        provider_urls.append(url)
        assert "api.weather.gov" not in url
        assert params["lat"] == 35.6762
        assert params["lon"] == 139.6503
        assert params["appid"] == "owm-test-key"
        assert params["units"] == "imperial"
        assert timeout == 5.0
        return WeatherResponse({
            "name": "Tokyo",
            "main": {"temp": 78.6},
            "weather": [{"id": 800, "description": "clear sky", "icon": "01n"}],
            "wind": {"speed": 8.2},
            "dt": 1_779_162_900,
            "sys": {
                "sunrise": 1_779_120_000,
                "sunset": 1_779_180_000,
            },
        })

    monkeypatch.setattr("app.services.weather_service.requests.get", fake_weather_get)

    response = client.get(
        "/api/intel/weather/current?lat=35.6762&lng=139.6503&q=Tokyo",
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["provider"] == "openweather"
    assert payload["providerLabel"] == "OpenWeatherMap"
    assert payload["temperatureF"] == 78.6
    assert payload["condition"] == "Clear Sky"
    assert payload["windMph"] == 8.2
    assert payload["conditionCode"] == 800.0
    assert payload["iconCode"] == "01n"
    assert len(provider_urls) == 1


def test_current_weather_uses_free_nws_provider_first(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = "owm-test-key"
    app.config["WEATHER_NWS_ENABLED"] = True
    app.config["WEATHER_PROVIDER_ORDER"] = "nws,openweather,openmeteo"
    app.config["WEATHER_CURRENT_CACHE_SECONDS"] = 120
    from app.api.weather import service

    service.clear_current_cache()
    monkeypatch.setattr(service, "_utc_now", lambda: datetime(2026, 5, 19, 4, 0, tzinfo=timezone.utc))
    provider_urls = []

    def fake_weather_get(url, params=None, headers=None, timeout=None):
        provider_urls.append(url)
        assert headers["User-Agent"]
        assert timeout == 5.0
        if url.endswith("/points/32.8343,-97.2289"):
            return WeatherResponse({
                "properties": {
                    "observationStations": "https://api.weather.gov/gridpoints/FWD/73,107/stations",
                },
            })
        if url == "https://api.weather.gov/gridpoints/FWD/73,107/stations":
            return WeatherResponse({
                "features": [
                    {"properties": {"stationIdentifier": "KFTW"}},
                ],
            })
        if url.endswith("/stations/KFTW/observations/latest"):
            return WeatherResponse({
                "properties": {
                    "timestamp": "2026-05-19T03:40:00+00:00",
                    "textDescription": "Clear Sky",
                    "temperature": {
                        "value": 28.2,
                        "unitCode": "wmoUnit:degC",
                    },
                    "windSpeed": {
                        "value": 38.9,
                        "unitCode": "wmoUnit:km_h-1",
                    },
                },
            })
        raise AssertionError(f"unexpected weather URL: {url}")

    monkeypatch.setattr("app.services.weather_service.requests.get", fake_weather_get)

    first_response = client.get(
        "/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills",
        headers=auth_header,
    )
    second_response = client.get(
        "/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills",
        headers=auth_header,
    )

    assert first_response.status_code == 200
    payload = first_response.get_json()["data"]
    assert payload["provider"] == "nws"
    assert payload["providerLabel"] == "National Weather Service"
    assert payload["source"] == "National Weather Service"
    assert payload["temperatureF"] == 82.8
    assert payload["windMph"] == 24.2
    assert payload["condition"] == "Clear Sky"
    assert payload["observedAtIso"] == "2026-05-19T03:40:00+00:00"
    assert second_response.status_code == 200
    assert second_response.get_json()["data"]["cache"]["hit"] is True
    assert len(provider_urls) == 3
    assert not any("openweathermap" in url for url in provider_urls)


def test_current_weather_chooses_freshest_nws_station(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = "owm-test-key"
    app.config["WEATHER_NWS_ENABLED"] = True
    app.config["WEATHER_PROVIDER_ORDER"] = "nws,openweather,openmeteo"
    app.config["WEATHER_CURRENT_STALE_SECONDS"] = 1800
    from app.api.weather import service

    service.clear_current_cache()
    monkeypatch.setattr(service, "_utc_now", lambda: datetime(2026, 5, 19, 4, 0, tzinfo=timezone.utc))
    provider_urls = []

    def fake_weather_get(url, params=None, headers=None, timeout=None):
        provider_urls.append(url)
        assert headers["User-Agent"]
        if url.endswith("/points/32.8343,-97.2289"):
            return WeatherResponse({
                "properties": {
                    "observationStations": "https://api.weather.gov/gridpoints/FWD/73,107/stations",
                },
            })
        if url == "https://api.weather.gov/gridpoints/FWD/73,107/stations":
            return WeatherResponse({
                "features": [
                    {"properties": {"stationIdentifier": "KOLD"}},
                    {"properties": {"stationIdentifier": "KFRESH"}},
                ],
            })
        if url.endswith("/stations/KOLD/observations/latest"):
            return WeatherResponse({
                "properties": {
                    "timestamp": "2026-05-19T02:00:00+00:00",
                    "textDescription": "Clear",
                    "temperature": {"value": 29.4, "unitCode": "wmoUnit:degC"},
                    "windSpeed": {"value": 12, "unitCode": "wmoUnit:km_h-1"},
                },
            })
        if url.endswith("/stations/KFRESH/observations/latest"):
            return WeatherResponse({
                "properties": {
                    "timestamp": "2026-05-19T03:55:00+00:00",
                    "textDescription": "Mostly Clear",
                    "temperature": {"value": 25.6, "unitCode": "wmoUnit:degC"},
                    "windSpeed": {"value": 8, "unitCode": "wmoUnit:km_h-1"},
                },
            })
        raise AssertionError(f"unexpected weather URL: {url}")

    monkeypatch.setattr("app.services.weather_service.requests.get", fake_weather_get)

    response = client.get(
        "/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills",
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["provider"] == "nws"
    assert payload["temperatureF"] == 78.1
    assert payload["condition"] == "Mostly Clear"
    assert payload["observedAtIso"] == "2026-05-19T03:55:00+00:00"
    assert payload["freshnessSeconds"] == 300
    assert payload["isStale"] is False
    assert len(provider_urls) == 4
    assert not any("openweathermap" in url for url in provider_urls)


def test_current_weather_falls_through_stale_nws_to_openweather(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = "owm-test-key"
    app.config["WEATHER_NWS_ENABLED"] = True
    app.config["WEATHER_PROVIDER_ORDER"] = "nws,openweather,openmeteo"
    app.config["WEATHER_CURRENT_STALE_SECONDS"] = 1800
    from app.api.weather import service

    service.clear_current_cache()
    monkeypatch.setattr(service, "_utc_now", lambda: datetime(2026, 5, 19, 4, 0, tzinfo=timezone.utc))
    provider_urls = []

    def fake_weather_get(url, params=None, headers=None, timeout=None):
        provider_urls.append(url)
        if url.endswith("/points/32.8343,-97.2289"):
            return WeatherResponse({
                "properties": {
                    "observationStations": "https://api.weather.gov/gridpoints/FWD/73,107/stations",
                },
            })
        if url == "https://api.weather.gov/gridpoints/FWD/73,107/stations":
            return WeatherResponse({
                "features": [
                    {"properties": {"stationIdentifier": "KSTALE"}},
                ],
            })
        if url.endswith("/stations/KSTALE/observations/latest"):
            return WeatherResponse({
                "properties": {
                    "timestamp": "2026-05-19T02:00:00+00:00",
                    "textDescription": "Clear",
                    "temperature": {"value": 30.0, "unitCode": "wmoUnit:degC"},
                    "windSpeed": {"value": 12, "unitCode": "wmoUnit:km_h-1"},
                },
            })
        if "api.openweathermap.org" in url:
            assert params["lat"] == 32.8343
            assert params["lon"] == -97.2289
            return WeatherResponse({
                "name": "North Richland Hills",
                "main": {"temp": 78.4},
                "weather": [{"id": 801, "description": "few clouds", "icon": "02d"}],
                "wind": {"speed": 9.5},
                "dt": 1_779_163_100,
                "sys": {
                    "sunrise": 1_779_120_000,
                    "sunset": 1_779_180_000,
                },
            })
        raise AssertionError(f"unexpected weather URL: {url}")

    monkeypatch.setattr("app.services.weather_service.requests.get", fake_weather_get)

    response = client.get(
        "/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills",
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["provider"] == "openweather"
    assert payload["providerLabel"] == "OpenWeatherMap"
    assert payload["temperatureF"] == 78.4
    assert payload["condition"] == "Few Clouds"
    assert payload["isStale"] is False
    assert any("api.openweathermap.org" in url for url in provider_urls)


def test_weather_rejects_malformed_provider_payload(client, auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.services.weather_service.requests.get",
        lambda *_args, **_kwargs: WeatherResponse({"daily": {"time": ["2026-04-01"]}}),
    )

    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 503
    error = response.get_json()["error"]
    assert error["code"] == "WEATHER_UNAVAILABLE"
    assert error["message"] == "Weather is unavailable right now."


def test_weather_rejects_provider_error(client, auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.services.weather_service.requests.get",
        lambda *_args, **_kwargs: WeatherResponse({"reason": "downstream error"}, status_code=503),
    )

    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "WEATHER_UNAVAILABLE"


def test_weather_rejects_provider_timeout(client, auth_header, monkeypatch):
    def timeout(*_args, **_kwargs):
        raise requests.Timeout("weather timeout")

    monkeypatch.setattr("app.services.weather_service.requests.get", timeout)

    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "WEATHER_UNAVAILABLE"


def test_weather_auth_error_path(client):
    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_geocode_happy_path(client, auth_header):
    response = client.get("/api/intel/geocode?q=Fort%20Worth%2C%20TX", headers=auth_header)

    assert response.status_code == 200
    assert response.get_json()["data"] == [{
        "query": "Fort Worth, TX",
        "latitude": 32.7555,
        "longitude": -97.3308,
        "placeName": "Fort Worth, TX",
        "formattedAddress": "Fort Worth, TX, USA",
        "city": "Fort Worth",
        "country": "United States",
        "precision": "fallback",
    }]


def test_geocode_provider_outage_returns_empty_results(app, client, auth_header, monkeypatch):
    app.config["TESTING"] = False
    app.config["MAPBOX_ACCESS_TOKEN"] = ""

    def fail_request(*_args, **_kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr("app.services.geocoding_service.requests.get", fail_request)

    response = client.get("/api/intel/geocode?q=Pizza%20Hut%20near%20me", headers=auth_header)

    assert response.status_code == 200
    assert response.get_json()["data"] == []


def test_geocode_auth_error_path(client):
    response = client.get("/api/intel/geocode?q=Fort%20Worth%2C%20TX")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_reverse_geocode_happy_path(client, auth_header):
    response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308", headers=auth_header)

    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "latitude": 32.7555,
        "longitude": -97.3308,
        "placeName": "Pinned location",
        "formattedAddress": "32.755500, -97.330800",
        "city": None,
        "country": None,
        "precision": "coordinate",
    }


def test_reverse_geocode_auth_error_path(client):
    response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHORIZED"
