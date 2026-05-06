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


def test_weather_happy_path(client, auth_header):
    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "latitude": 32.7555,
        "longitude": -97.3308,
        "date": "2026-04-01",
        "forecast": "Sunny, 75F",
    }


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
        "placeName": "Fort Worth, TX, USA",
        "formattedAddress": "Fort Worth, TX, USA",
        "city": "Fort Worth",
        "country": "United States",
        "precision": "fallback",
    }


def test_reverse_geocode_auth_error_path(client):
    response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHORIZED"
