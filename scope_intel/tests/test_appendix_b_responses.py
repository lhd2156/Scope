def test_itinerary_generate_response_matches_appendix_b_exact_shape(client, auth_header):
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
    assert list(response.get_json().keys()) == ["data"]

    payload = response.get_json()["data"]
    assert list(payload.keys()) == ["id", "destination", "days", "totalEstimatedCost", "weatherForecast"]
    assert payload["destination"] == "Fort Worth, TX"
    assert isinstance(payload["id"], str)
    assert isinstance(payload["totalEstimatedCost"], float)
    assert isinstance(payload["weatherForecast"], str)
    assert len(payload["days"]) == 3

    first_day = payload["days"][0]
    assert list(first_day.keys()) == ["dayNumber", "date", "spots"]
    assert first_day["dayNumber"] == 1
    assert first_day["date"] == "2026-04-01"
    assert first_day["spots"]

    first_spot = first_day["spots"][0]
    assert list(first_spot.keys()) == [
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
    ]
    assert isinstance(first_spot["estimatedCost"], float)
    assert isinstance(first_spot["reason"], str)
    assert 0 <= first_spot["confidence"] <= 1


def test_itinerary_fetch_response_matches_cached_appendix_b_shape(client, auth_header):
    create_response = client.post(
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
    itinerary_id = create_response.get_json()["data"]["id"]

    response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=auth_header)

    assert response.status_code == 200
    assert list(response.get_json().keys()) == ["data"]
    payload = response.get_json()["data"]
    assert list(payload.keys()) == ["id", "destination", "days", "totalEstimatedCost", "weatherForecast"]
    assert payload["id"] == itinerary_id
