def test_generate_itinerary(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-03", "budget": 500, "interests": ["food", "culture", "nightlife"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "Fort Worth, TX"
    assert len(payload["days"]) == 3
    assert payload["weatherForecast"]

def test_generate_point_to_point_itinerary(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "Dallas, TX", "endDestination": "Austin, TX", "startDate": "2026-04-01", "endDate": "2026-04-02", "budget": 500, "interests": ["food", "culture"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "Dallas, TX to Austin, TX"
    assert len(payload["days"]) == 2

def test_generate_itinerary_accepts_precise_start_coordinates(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "1600 Pennsylvania Avenue NW, Washington, DC", "destinationLatitude": 38.8977, "destinationLongitude": -77.0365, "startDate": "2026-04-01", "endDate": "2026-04-01", "budget": 500, "interests": ["food", "culture"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "1600 Pennsylvania Avenue NW, Washington, DC"
    assert len(payload["days"]) == 1

def test_get_itinerary_by_id(client, auth_header):
    create_response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-01", "budget": 200, "interests": ["food"], "pace": "relaxed", "groupSize": 1}, headers=auth_header)
    itinerary_id = create_response.get_json()["data"]["id"]
    fetch_response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=auth_header)
    assert fetch_response.status_code == 200
    assert fetch_response.get_json()["data"]["id"] == itinerary_id
