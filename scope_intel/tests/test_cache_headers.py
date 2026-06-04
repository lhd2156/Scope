class WeatherResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "daily": {
                "time": ["2026-04-01"],
                "weather_code": [1],
                "temperature_2m_max": [76],
                "temperature_2m_min": [62],
                "wind_speed_10m_max": [8],
            },
        }


class CurrentWeatherResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "current": {
                "time": 1_779_151_200,
                "temperature_2m": 82.7,
                "weather_code": 0,
                "wind_speed_10m": 11.6,
                "is_day": 0,
            },
        }


def test_weather_response_includes_private_cache_headers(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.services.weather_service.requests.get", lambda *_args, **_kwargs: WeatherResponse())

    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=300"
    assert "Authorization" in response.headers["Vary"]


def test_current_weather_response_includes_private_cache_headers(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = ""
    app.config["WEATHER_NWS_ENABLED"] = False
    monkeypatch.setattr("app.services.weather_service.requests.get", lambda *_args, **_kwargs: CurrentWeatherResponse())
    from app.api.weather import service

    service.clear_current_cache()

    response = client.get("/api/intel/weather/current?lat=32.7555&lng=-97.3308", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=300"
    assert "Authorization" in response.headers["Vary"]


def test_geocode_response_includes_private_cache_headers(client, auth_header):
    response = client.get("/api/intel/geocode?q=Fort%20Worth%2C%20TX", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=86400"
    assert "Authorization" in response.headers["Vary"]


def test_reverse_geocode_response_includes_private_cache_headers(client, auth_header):
    response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=86400"
    assert "Authorization" in response.headers["Vary"]
