from datetime import timedelta

from app.api import itinerary as itinerary_module
from app.extensions import db
from app.models import ItineraryCache, utcnow

VALID_PAYLOAD = {
    "destination": "Fort Worth, TX",
    "startDate": "2026-04-01",
    "endDate": "2026-04-03",
    "budget": 500,
    "interests": ["food", "culture", "nightlife"],
    "pace": "moderate",
    "groupSize": 2,
}


def test_generate_itinerary_uses_cached_result_on_request_hash_hit(client, auth_header, monkeypatch):
    generated_calls = {"count": 0}
    weather_calls = {"count": 0}
    original_generate = itinerary_module.engine.generate
    original_weather = itinerary_module.weather_service.get_planning_snapshot

    def wrapped_generate(payload, weather):
        generated_calls["count"] += 1
        return original_generate(payload, weather)

    def wrapped_weather(start_date):
        weather_calls["count"] += 1
        return original_weather(start_date)

    monkeypatch.setattr(itinerary_module.engine, "generate", wrapped_generate)
    monkeypatch.setattr(itinerary_module.weather_service, "get_planning_snapshot", wrapped_weather)

    first_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)
    second_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.get_json()["data"] == second_response.get_json()["data"]
    assert generated_calls["count"] == 1
    assert weather_calls["count"] == 1

    with client.application.app_context():
        assert ItineraryCache.query.count() == 1


def test_generate_itinerary_recomputes_when_cached_result_has_expired(client, auth_header, monkeypatch):
    generated_calls = {"count": 0}
    weather_calls = {"count": 0}
    original_generate = itinerary_module.engine.generate
    original_weather = itinerary_module.weather_service.get_planning_snapshot

    def wrapped_generate(payload, weather):
        generated_calls["count"] += 1
        return original_generate(payload, weather)

    def wrapped_weather(start_date):
        weather_calls["count"] += 1
        return original_weather(start_date)

    monkeypatch.setattr(itinerary_module.engine, "generate", wrapped_generate)
    monkeypatch.setattr(itinerary_module.weather_service, "get_planning_snapshot", wrapped_weather)

    first_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)
    first_payload = first_response.get_json()["data"]

    with client.application.app_context():
        record = ItineraryCache.query.filter_by(id=first_payload["id"]).first()
        assert record is not None
        record.expires_at = utcnow() - timedelta(seconds=1)
        db.session.commit()

    second_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)
    second_payload = second_response.get_json()["data"]

    assert second_response.status_code == 200
    assert second_payload["id"] != first_payload["id"]
    assert generated_calls["count"] == 2
    assert weather_calls["count"] == 2

    with client.application.app_context():
        assert ItineraryCache.query.count() == 1


def test_generate_itinerary_does_not_share_cache_rows_across_users(client, auth_header, second_auth_header, monkeypatch):
    generated_calls = {"count": 0}
    original_generate = itinerary_module.engine.generate

    def wrapped_generate(payload, weather):
        generated_calls["count"] += 1
        return original_generate(payload, weather)

    monkeypatch.setattr(itinerary_module.engine, "generate", wrapped_generate)

    first_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)
    second_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=second_auth_header)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.get_json()["data"]["id"] != second_response.get_json()["data"]["id"]
    assert generated_calls["count"] == 2

    with client.application.app_context():
        assert ItineraryCache.query.count() == 2


def test_get_itinerary_is_scoped_to_the_owning_user(client, auth_header, second_auth_header):
    create_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)
    itinerary_id = create_response.get_json()["data"]["id"]

    response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=second_auth_header)

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "NOT_FOUND"


def test_get_itinerary_returns_not_found_when_cache_row_has_expired(client, auth_header):
    first_response = client.post("/api/intel/itinerary/generate", json=VALID_PAYLOAD, headers=auth_header)
    itinerary_id = first_response.get_json()["data"]["id"]

    with client.application.app_context():
        record = ItineraryCache.query.filter_by(id=itinerary_id).first()
        assert record is not None
        record.expires_at = utcnow() - timedelta(seconds=1)
        db.session.commit()

    response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=auth_header)

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "NOT_FOUND"

    with client.application.app_context():
        assert ItineraryCache.query.filter_by(id=itinerary_id).first() is None
