def test_itinerary_validation_rejects_invalid_pace(client, auth_header):
    response = client.post(
        "/api/intel/itinerary/generate",
        json={
            "destination": "Fort Worth, TX",
            "startDate": "2026-04-01",
            "endDate": "2026-04-03",
            "budget": 500,
            "interests": ["food"],
            "pace": "sprint",
            "groupSize": 2,
        },
        headers=auth_header,
    )

    assert response.status_code == 400
    payload = response.get_json()["error"]
    assert payload["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in payload["details"]} == {"pace"}


def test_recommendation_validation_rejects_zero_limit(client, auth_header):
    response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 0},
        headers=auth_header,
    )

    assert response.status_code == 400
    payload = response.get_json()["error"]
    assert payload["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in payload["details"]} == {"limit"}


def test_similar_spot_validation_rejects_zero_limit(client, auth_header):
    response = client.post("/api/intel/recommend/similar/spot-2", json={"limit": 0}, headers=auth_header)

    assert response.status_code == 400
    payload = response.get_json()["error"]
    assert payload["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in payload["details"]} == {"limit"}


def test_vibe_match_validation_rejects_short_description(client, auth_header):
    response = client.post("/api/intel/vibe-match", json={"description": "bad", "limit": 2}, headers=auth_header)

    assert response.status_code == 400
    payload = response.get_json()["error"]
    assert payload["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in payload["details"]} == {"description"}


def test_route_optimizer_validation_rejects_incomplete_spot_coordinates(client, auth_header):
    response = client.post(
        "/api/intel/route/optimize",
        json={
            "spots": [
                {"spotId": "spot-1", "latitude": 32.7555},
            ],
            "startLat": 32.7555,
            "startLng": -97.3308,
        },
        headers=auth_header,
    )

    assert response.status_code == 400
    payload = response.get_json()["error"]
    assert payload["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in payload["details"]} == {"spots[0].longitude"}
