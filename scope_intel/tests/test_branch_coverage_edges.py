from __future__ import annotations

from flask import Flask, g
from marshmallow import ValidationError
import pytest
from werkzeug.exceptions import BadRequest, Conflict

from app import errors
from app.api import recommendations as recommendations_module
from app.ml.runtime import MlComputationTimeoutError
from app.schemas import (
    AgentPlanTripRequestSchema,
    CurrentWeatherQuerySchema,
    ItineraryRequestSchema,
    NcfRecommendationRequestSchema,
    RecommendationFeedbackSchema,
    RecommendationRequestSchema,
    RouteOptimizeRequestSchema,
    RouteSpotSchema,
    VibeMatchRequestSchema,
    _trim_text_list,
)
from app import telemetry


def test_schema_normalizers_and_cross_field_behavior_edges():
    assert _trim_text_list("food") == "food"
    assert _trim_text_list([" Food ", "food", 7, 7]) == ["Food", 7]

    normalizers = [
        ItineraryRequestSchema().normalize_payload,
        RecommendationRequestSchema().normalize_payload,
        NcfRecommendationRequestSchema().normalize_payload,
        RecommendationFeedbackSchema().normalize_payload,
        VibeMatchRequestSchema().normalize_payload,
        RouteSpotSchema().normalize_payload,
        RouteOptimizeRequestSchema().normalize_payload,
        CurrentWeatherQuerySchema().normalize_payload,
        AgentPlanTripRequestSchema().normalize_payload,
    ]
    for normalize in normalizers:
        assert normalize("raw") == "raw"

    recommendation = RecommendationRequestSchema().load(
        {
            "userId": " user-1 ",
            "likedSpotIds": [" spot-1 ", "SPOT-1", "spot-2"],
            "interests": [" Food ", "food", "Culture"],
            "destination": "ignored by intel",
        }
    )
    assert recommendation["userId"] == "user-1"
    assert recommendation["likedSpotIds"] == ["spot-1", "spot-2"]
    assert recommendation["interests"] == ["Food", "Culture"]
    assert "destination" not in recommendation

    assert NcfRecommendationRequestSchema().load({"userId": " user-1 "})["userId"] == "user-1"
    assert RecommendationFeedbackSchema().load({"spotId": " spot-1 ", "action": " click "}) == {
        "spotId": "spot-1",
        "action": "click",
    }
    assert VibeMatchRequestSchema().load({"vibe": " sunset patios "})["description"] == "sunset patios"
    assert RouteSpotSchema().load({"id": " stop-1 ", "latitude": 1, "longitude": 2})["spotId"] == "stop-1"
    assert RouteOptimizeRequestSchema().load({"points": [{"id": "a", "latitude": 1, "longitude": 2}]})["spots"][0]["spotId"] == "a"
    assert CurrentWeatherQuerySchema().load({"q": " Austin "})["q"] == "Austin"
    assert AgentPlanTripRequestSchema().load({"prompt": " plan ", "user_id": " user-1 "})["prompt"] == "plan"

    valid_itinerary = {
        "destination": "Austin",
        "startDate": "2026-06-03",
        "endDate": "2026-06-01",
        "budget": 100,
        "interests": ["food"],
        "pace": "moderate",
        "groupSize": 2,
    }
    with pytest.raises(ValidationError, match="startDate"):
        ItineraryRequestSchema().load(valid_itinerary)
    with pytest.raises(ValidationError, match="longer"):
        ItineraryRequestSchema().load({**valid_itinerary, "endDate": "2026-06-20"})
    with pytest.raises(ValidationError, match="budgetFloor"):
        ItineraryRequestSchema().load({**valid_itinerary, "endDate": "2026-06-03", "budgetFloor": 101})
    with pytest.raises(ValidationError, match="provided together"):
        ItineraryRequestSchema().load({**valid_itinerary, "endDate": "2026-06-03", "destinationLatitude": 30.0})
    with pytest.raises(ValidationError, match="startLat"):
        RouteOptimizeRequestSchema().load({"spots": [{"spotId": "a", "latitude": 1, "longitude": 2}], "startLat": 1})
    with pytest.raises(ValidationError, match="lat and lng"):
        CurrentWeatherQuerySchema().load({"lat": 1})
    with pytest.raises(ValidationError, match="Provide lat/lng or q"):
        CurrentWeatherQuerySchema().load({})


def test_error_flattening_and_handler_variants():
    assert errors._join_path("", 0) == "[0]"
    assert errors._join_path("items", 0) == "items[0]"
    assert errors._flatten_validation_messages("boom") == [{"field": "_schema", "message": "boom"}]
    details = errors._flatten_validation_messages(
        {
            "items": [{"name": ["Missing data."]}, "Bad row"],
            "plain": ["One", "Two"],
        }
    )
    assert {"field": "items.name", "message": "Missing data."} in details
    assert {"field": "items", "message": "Bad row"} in details
    assert {"field": "plain", "message": "One, Two"} in details

    app = Flask(__name__)
    errors.register_error_handlers(app)

    @app.get("/bad-request-empty")
    def bad_request_empty():
        raise BadRequest(description="")

    @app.get("/value-error-empty")
    def value_error_empty():
        raise ValueError("")

    @app.get("/conflict")
    def conflict():
        raise Conflict()

    @app.get("/ml-timeout")
    def ml_timeout():
        raise MlComputationTimeoutError("tagger", 0.25)

    client = app.test_client()
    assert client.get("/bad-request-empty").get_json()["error"]["details"] == []
    assert client.get("/value-error-empty").get_json()["error"]["details"] == []
    assert client.get("/conflict").get_json()["error"]["code"] == "CONFLICT"
    timeout_error = client.get("/ml-timeout").get_json()["error"]
    assert timeout_error["code"] == "ML_TIMEOUT"
    assert timeout_error["details"] == [{"field": "tagger", "message": "Exceeded 0.250s timeout"}]


def test_telemetry_endpoint_allowlist_and_route_edges(monkeypatch):
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    assert telemetry._trace_exporter_endpoint() is None
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://otel.example")
    assert telemetry._trace_exporter_endpoint() == "https://otel.example/v1/traces"
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://otel.example/v1/traces")
    assert telemetry._trace_exporter_endpoint() == "https://otel.example/v1/traces"

    monkeypatch.setenv("METRICS_ALLOWED_CIDRS", "bad,192.168.1.0/24,::1/128")
    networks = telemetry._metrics_allowlist_networks()
    assert any(str(network) == "192.168.1.0/24" for network in networks)
    assert telemetry.normalize_route(None) == "/"
    assert telemetry.normalize_route("metrics") == "/metrics"
    assert telemetry.normalize_route("/metrics") == "/metrics"

    app = Flask(__name__)
    app.config.update(RATELIMIT_ENABLED=False)
    telemetry.register_metrics_endpoint(app)
    client = app.test_client()

    assert client.get("/metrics", environ_base={"REMOTE_ADDR": "not-an-ip"}).status_code == 403
    assert client.get("/metrics", environ_base={"REMOTE_ADDR": "203.0.113.10"}).status_code == 403
    allowed = client.get("/api/intel/metrics", environ_base={"REMOTE_ADDR": "192.168.1.5"})
    assert allowed.status_code == 200
    assert allowed.content_type.startswith("text/plain")


def test_recommendation_request_user_resolution_guards(app):
    with app.test_request_context("/api/intel/recommend/spots", json={}):
        g.current_user = None
        assert recommendations_module._jwt_subject() is None
        user_id, failure = recommendations_module._resolve_request_user_id({})
        assert user_id is None
        assert failure.status_code == 401

    with app.test_request_context("/api/intel/recommend/spots", json={}):
        g.current_user = {"sub": 123}
        assert recommendations_module._jwt_subject() == "123"
        user_id, failure = recommendations_module._resolve_request_user_id({"userId": "other"})
        assert user_id is None
        assert failure.status_code == 403
        assert recommendations_module._resolve_request_user_id({"userId": "123"}) == ("123", None)
