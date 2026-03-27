def test_generate_itinerary(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-03", "budget": 500, "interests": ["food", "culture", "nightlife"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "Fort Worth, TX"
    assert len(payload["days"]) == 3
    assert payload["weatherForecast"]

def test_get_itinerary_by_id(client, auth_header):
    create_response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-01", "budget": 200, "interests": ["food"], "pace": "relaxed", "groupSize": 1}, headers=auth_header)
    itinerary_id = create_response.get_json()["data"]["id"]
    fetch_response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=auth_header)
    assert fetch_response.status_code == 200
    assert fetch_response.get_json()["data"]["id"] == itinerary_id
