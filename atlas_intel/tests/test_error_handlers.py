from app.api import itinerary as itinerary_module


def test_error_handler_returns_json_for_malformed_json_body(client, auth_header):
    response = client.post(
        "/api/intel/itinerary/generate",
        data="{",
        content_type="application/json",
        headers=auth_header,
    )

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "Invalid input data"
    assert error["details"]


def test_error_handler_returns_missing_query_parameter_detail(client, auth_header):
    response = client.get("/api/intel/weather?lat=32.7555&date=2026-04-01", headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "Invalid input data"
    assert error["details"] == [{"field": "lng", "message": "Missing required query parameter"}]


def test_error_handler_returns_json_for_invalid_query_value(client, auth_header):
    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=not-a-date", headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "Invalid input data"
    assert error["details"] == [{"field": "date", "message": "Not a valid date."}]


def test_error_handler_returns_json_for_method_not_allowed(client):
    response = client.post("/api/intel/health")

    assert response.status_code == 405
    error = response.get_json()["error"]
    assert error["code"] == "METHOD_NOT_ALLOWED"
    assert error["message"] == "Method not allowed"


def test_error_handler_returns_internal_error_envelope(client, auth_header, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(itinerary_module.engine, "generate", boom)

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

    assert response.status_code == 500
    error = response.get_json()["error"]
    assert error["code"] == "INTERNAL_ERROR"
    assert error["message"] == "Unexpected server error"
    assert error["traceId"]
