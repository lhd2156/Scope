def test_itinerary_response_matches_appendix_b_shape(client, auth_header):
    response = client.post(
        "/api/intel/itinerary/generate",
        json={
            "destination": "Fort Worth, TX",
            "startDate": "2026-04-01",
            "endDate": "2026-04-03",
            "budget": 500,
            "interests": ["food", "culture", "nightlife"],
            "pace": "moderate",
            "groupSize": 2,
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert set(payload.keys()) == {"id", "destination", "days", "totalEstimatedCost", "weatherForecast"}
    assert payload["destination"] == "Fort Worth, TX"
    assert isinstance(payload["days"], list)
    assert payload["days"]

    day = payload["days"][0]
    assert set(day.keys()) == {"dayNumber", "date", "spots"}
    assert isinstance(day["spots"], list)
    assert day["spots"]

    spot = day["spots"][0]
    assert set(spot.keys()) == {
        "spotId",
        "title",
        "timeSlot",
        "duration",
        "latitude",
        "longitude",
        "category",
        "estimatedCost",
        "reason",
        "confidence",
    }
    assert isinstance(spot["reason"], str)
    assert 0 <= spot["confidence"] <= 1


def test_route_optimizer_contract(client, auth_header):
    response = client.post(
        "/api/intel/route/optimize",
        json={
            "spots": [
                {"spotId": "spot-1", "latitude": 32.7555, "longitude": -97.3308},
                {"spotId": "spot-2", "latitude": 32.7489, "longitude": -97.3623},
                {"spotId": "spot-3", "latitude": 32.7507, "longitude": -97.3511},
            ],
            "startLat": 32.7555,
            "startLng": -97.3308,
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert set(payload.keys()) == {"orderedSpots", "estimatedDistance"}
    assert len(payload["orderedSpots"]) == 3
    assert payload["estimatedDistance"] >= 0


class WeatherResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_weather_contract(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.services.weather_service.requests.get", lambda *_args, **_kwargs: WeatherResponse({
        "daily": {
            "time": ["2026-04-01"],
            "weather_code": [0],
            "temperature_2m_max": [78.1],
            "temperature_2m_min": [61.8],
            "wind_speed_10m_max": [9.2],
        },
    }))

    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload == {
        "latitude": 32.7555,
        "longitude": -97.3308,
        "date": "2026-04-01",
        "forecast": "Clear, high 78F / low 62F, wind up to 9 mph",
        "source": "Open-Meteo",
        "provider": "openmeteo",
        "condition": "Clear",
        "temperatureHighF": 78.1,
        "temperatureLowF": 61.8,
        "windMph": 9.2,
        "weatherCode": 0.0,
    }


def test_current_weather_contract(app, client, auth_header, monkeypatch):
    app.config["OPENWEATHERMAP_API_KEY"] = ""
    app.config["WEATHER_NWS_ENABLED"] = False
    from app.api.weather import service

    service.clear_current_cache()
    monkeypatch.setattr("app.services.weather_service.requests.get", lambda *_args, **_kwargs: WeatherResponse({
        "current": {
            "time": 1_779_151_200,
            "temperature_2m": 82.7,
            "weather_code": 0,
            "wind_speed_10m": 11.6,
            "is_day": 0,
        },
    }))

    response = client.get("/api/intel/weather/current?lat=32.8343&lng=-97.2289&q=North%20Richland%20Hills", headers=auth_header)

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["label"] == "North Richland Hills"
    assert payload["latitude"] == 32.8343
    assert payload["longitude"] == -97.2289
    assert payload["temperatureF"] == 82.7
    assert payload["condition"] == "Clear"
    assert payload["windMph"] == 11.6
    assert payload["provider"] == "openmeteo"
    assert payload["providerLabel"] == "Open-Meteo"
    assert payload["source"] == "Open-Meteo"
    assert payload["weatherCode"] == 0.0
    assert payload["conditionCode"] == 0.0
    assert payload["isDaytime"] is False
    assert set(payload["cache"]) == {"hit", "expiresAtUtc", "ttlSeconds"}
    assert payload["cache"]["hit"] is False


def test_geocoding_contract(client, auth_header):
    geocode_response = client.get("/api/intel/geocode?q=Fort%20Worth%2C%20TX", headers=auth_header)
    reverse_response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308", headers=auth_header)

    assert geocode_response.status_code == 200
    assert geocode_response.get_json()["data"] == [{
        "query": "Fort Worth, TX",
        "latitude": 32.7555,
        "longitude": -97.3308,
        "placeName": "Fort Worth, TX",
        "formattedAddress": "Fort Worth, TX, USA",
        "city": "Fort Worth",
        "country": "United States",
        "precision": "fallback",
    }]

    assert reverse_response.status_code == 200
    assert reverse_response.get_json()["data"] == {
        "latitude": 32.7555,
        "longitude": -97.3308,
        "placeName": "Pinned location",
        "formattedAddress": "32.755500, -97.330800",
        "city": None,
        "country": None,
        "precision": "coordinate",
    }


def test_health_contract_matches_architecture(client):
    response = client.get("/api/intel/health")

    assert response.status_code == 200
    payload = response.get_json()
    assert set(payload.keys()) == {"status", "version", "uptime"}
    assert payload["status"] == "healthy"
    assert payload["version"] == "1.0.0"
    assert isinstance(payload["uptime"], int)


def test_recommendation_and_vibe_contracts(client, auth_header):
    recommendation_response = client.post(
        "/api/intel/recommend/spots",
        json={
            "userId": "user-1",
            "likedSpotIds": ["spot-1"],
            "interests": ["culture", "nightlife"],
            "limit": 3,
        },
        headers=auth_header,
    )
    similar_response = client.post("/api/intel/recommend/similar/spot-2", json={"limit": 2}, headers=auth_header)
    vibe_response = client.post(
        "/api/intel/vibe-match",
        json={"description": "I want a chill outdoor walk with sunset views", "limit": 2},
        headers=auth_header,
    )

    assert recommendation_response.status_code == 200
    recommendation_payload = recommendation_response.get_json()["data"]
    assert list(recommendation_payload.keys()) == ["recommendations"]
    assert len(recommendation_payload["recommendations"]) == 3

    assert similar_response.status_code == 200
    similar_payload = similar_response.get_json()["data"]
    assert list(similar_payload.keys()) == ["recommendations"]
    assert len(similar_payload["recommendations"]) == 2

    assert vibe_response.status_code == 200
    vibe_payload = vibe_response.get_json()["data"]
    assert list(vibe_payload.keys()) == ["matches"]
    assert len(vibe_payload["matches"]) == 2
