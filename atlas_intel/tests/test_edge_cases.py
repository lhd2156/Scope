def test_itinerary_rejects_blank_destination_input(client, auth_header):
    response = client.post(
        "/api/intel/itinerary/generate",
        json={
            "destination": "   ",
            "startDate": "2026-04-01",
            "endDate": "2026-04-03",
            "budget": 500,
            "interests": ["food", "culture"],
            "pace": "moderate",
            "groupSize": 2,
        },
        headers=auth_header,
    )

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"destination"}


def test_geocode_rejects_blank_query_input(client, auth_header):
    response = client.get("/api/intel/geocode?q=%20%20%20", headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"q"}


def test_weather_rejects_out_of_range_latitude(client, auth_header):
    response = client.get("/api/intel/weather?lat=91&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"lat"}


def test_reverse_geocode_rejects_out_of_range_longitude(client, auth_header):
    response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-181", headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"lng"}


def test_weather_unauthorized_edge_case_returns_standard_error_envelope(client):
    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01")

    assert response.status_code == 401
    error = response.get_json()["error"]
    assert error["code"] == "UNAUTHORIZED"
    assert error["message"] == "Missing or expired token"
    assert isinstance(error["details"], list)
