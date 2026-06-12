from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from flask import Flask, g
from marshmallow import ValidationError
import pytest
import requests
from werkzeug.exceptions import BadRequest, Conflict

from app import errors
from app.api import recommendations as recommendations_module
from app.eval import offline
from app.ml.runtime import MlComputationTimeoutError
from app.services import content_client
from app.services.content_client import HttpContentServiceClient, Spot
from app.services.geocoding_service import GeocodingService
from app.services.google_places_usage_guard import GooglePlacesUsageGuard, _redis_client_for, _redis_clients
from app.services.itinerary_engine import ItineraryEngine, ScoredSpot, WeatherSnapshot
from app.services.recommendation_engine import RecommendationEngine, _ScoredCandidate
from app.services.travel_nearby_service import TravelNearbyService
from app.services.vibe_matcher import VibeMatcher
from app.services.weather_service import WeatherService, WeatherUnavailableError
from app.schemas import (
    AgentTripChatRequestSchema,
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
    from app.api.fuel import FuelStationsQuerySchema

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
        AgentTripChatRequestSchema().normalize_payload,
    ]
    for normalize in normalizers:
        assert normalize("raw") == "raw"

    assert RecommendationRequestSchema().normalize_payload({"userId": " user-1 "})["userId"] == "user-1"
    assert ItineraryRequestSchema().normalize_payload({"destination": " Austin ", "pace": " relaxed "}) == {"destination": "Austin", "pace": "relaxed"}
    assert VibeMatchRequestSchema().normalize_payload({"limit": 1}) == {"limit": 1}
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
    assert AgentTripChatRequestSchema().load({"message": " hi ", "prompt": ""})["message"] == "hi"

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
    with pytest.raises(ValidationError, match="Provide message or prompt"):
        AgentTripChatRequestSchema().load({})
    with pytest.raises(ValidationError):
        FuelStationsQuerySchema().load({"lat": 91, "lng": 0})
    with pytest.raises(ValidationError):
        FuelStationsQuerySchema().load({"lat": 0, "lng": 181})


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


def test_content_client_response_shapes_cache_headers_and_fetch_guards(app, monkeypatch):
    class FakeResponse:
        def __init__(self, payload, status_code=200):
            self.payload = payload
            self.status_code = status_code

        def json(self):
            if isinstance(self.payload, BaseException):
                raise self.payload
            return self.payload

    class FakeSession:
        def __init__(self):
            self.calls = []

        def get(self, url, **kwargs):
            self.calls.append((url, kwargs))
            if url.endswith("/spots/cache"):
                return FakeResponse({"data": [_row("cache")]})
            if url.endswith("/spots/none"):
                return FakeResponse({"data": None})
            if url.endswith("/spots/empty-list"):
                return FakeResponse({"data": []})
            if url.endswith("/spots/list"):
                return FakeResponse({"data": [_row("list")]})
            if url.endswith("/spots/bare"):
                return FakeResponse(_row("bare"))
            if url.endswith("/spots/invalid-row"):
                return FakeResponse({"data": {"id": "bad", "latitude": 999, "longitude": 0}})
            if "bad-status" in url:
                return FakeResponse({}, status_code=503)
            if "bad-json" in url:
                return FakeResponse(ValueError("bad json"))
            if "results" in url:
                return FakeResponse({"results": [_row("results"), "skip-me"]})
            if "bare-list" in url:
                return FakeResponse([_row("bare-list")])
            if "weird" in url:
                return FakeResponse("not rows")
            return FakeResponse({"data": [_row("default", title="River Walk", description="Austin food")]})

    def _row(spot_id, **overrides):
        row = {
            "id": spot_id,
            "title": "Title",
            "description": "",
            "category": "food",
            "latitude": 1,
            "longitude": 2,
            "likedByUsers": "not-a-list",
        }
        row.update(overrides)
        return row

    session = FakeSession()
    client = HttpContentServiceClient("https://content.example/api/content", session=session, timeout=1, fetch_limit=2)
    client._all_spots_cache = (10.0, [content_client._map_content_row(_row("cached"))])
    client._all_spots_cache_ttl = 60.0
    monkeypatch.setattr("time.monotonic", lambda: 12.0)
    assert client.get_all_spots()[0].spot_id == "cached"

    assert content_client._map_content_row(_row("likers")).liked_by_users == ()
    assert client.get_spot("none") is None
    assert client.get_spot("empty-list") is None
    assert client.get_spot("list").spot_id == "list"
    assert client.get_spot("bare") is None
    assert client.get_spot("invalid-row") is None
    assert client.search_spots("", [])[0].spot_id == "default"
    assert client.search_spots("Austin", ["food"])[0].spot_id == "default"

    assert client._fetch_spots(path="/spots/bad-status", params={}) == []
    assert client._fetch_spots(path="/spots/bad-json", params={}) == []
    assert client._fetch_spots(path="/spots/results", params={})[0].spot_id == "results"
    assert client._fetch_spots(path="/spots/bare-list", params={})[0].spot_id == "bare-list"
    assert client._fetch_spots(path="/spots/weird", params={}) == []

    with app.test_request_context("/api/intel/test", headers={"Authorization": "Bearer user-token"}):
        assert client._headers()["Authorization"] == "Bearer user-token"


def test_offline_eval_usage_guard_and_vibe_helper_edges(app, monkeypatch, tmp_path):
    with pytest.raises(ValueError, match="k"):
        offline.evaluate(users=[], ground_truth={}, rank_fn=lambda _user_id: [], catalog_size=1, k=0)
    with pytest.raises(ValueError, match="catalog_size"):
        offline.evaluate(users=[], ground_truth={}, rank_fn=lambda _user_id: [], catalog_size=0, k=1)

    empty = offline.evaluate(users=["u"], ground_truth={"u": set()}, rank_fn=lambda _user_id: ["s"], catalog_size=1, k=1)
    assert empty.users_evaluated == 0
    assert offline._ndcg([]) == 0.0
    assert offline._average_precision([0.0, 0.0]) == 0.0
    assert offline._gini([], 0) == 0.0
    assert offline._gini([], 3) == 0.0

    app.config.update(GOOGLE_PLACES_USAGE_FILE=str(tmp_path / "usage.json"), GOOGLE_PLACES_USAGE_REDIS_URL="")
    with app.app_context():
        guard = GooglePlacesUsageGuard()
        assert guard.consume("sku", monthly_cap=-1)["remaining"] is None
        usage_path = guard._usage_path()
        assert usage_path == tmp_path / "usage.json"
        guard._write_usage({"month": guard._current_month(), "counters": {"sku": 1}})
        assert guard.consume("sku", monthly_cap=2)["allowed"] is True
        assert guard.consume("sku", monthly_cap=2)["allowed"] is False

        class FakeRedis:
            pass

        monkeypatch.setitem(__import__("sys").modules, "redis", type("RedisModule", (), {"from_url": staticmethod(lambda url, **kwargs: FakeRedis())}))
        _redis_clients.clear()
        assert _redis_client_for("redis://cache") is _redis_client_for("redis://cache")

    spot = Spot("spot-1", "Sunny Patio", "quiet brunch patio", "food", "calm", 4.8, 1, 2, 1, 1, True, 1, ())
    matcher = VibeMatcher(content_client=object())
    assert matcher._lexical_boost(spot, set()) == 0.0
    assert matcher._lexical_boost(spot, {"calm", "food", "sunny", "brunch"}) == 0.28
    assert "calm vibe" in matcher._serialize_match(spot, 0.5, 0.18)["reason"]
    no_vibe = Spot("spot-2", "Gallery", "art", "culture", "", 4.2, 1, 2, 0, 0, True, 0, ())
    assert "culture theme" in matcher._serialize_match(no_vibe, 0.2, 0.12)["reason"]
    assert "semantic match" in matcher._serialize_match(no_vibe, 0.2, 0.0)["reason"]


def _spot(spot_id: str = "spot-1", **overrides):
    payload = {
        "title": "River Walk",
        "description": "river food patio",
        "category": "food",
        "vibe": "calm",
        "rating": 4.6,
        "popularity": 80,
        "estimated_cost": 20,
        "latitude": 32.75,
        "longitude": -97.33,
        "is_outdoor": True,
        "photos_count": 4,
        "liked_by_users": ("friend-1",),
    }
    payload.update(overrides)
    return Spot(spot_id=spot_id, **payload)


def test_geocoding_parser_provider_and_fallback_branch_edges(app, monkeypatch):
    service = GeocodingService()
    app.config.update(
        TESTING=False,
        MAPBOX_ACCESS_TOKEN="",
        GEOCODE_BASE_URL="https://nominatim.example/search",
        REVERSE_GEOCODE_BASE_URL="https://nominatim.example/reverse",
        GEOCODE_API_KEY="",
    )

    class Response:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    with app.app_context():
        monkeypatch.setattr("app.services.geocoding_service.requests.get", lambda *args, **kwargs: Response({"unexpected": []}))
        assert service.geocode("No provider result") == []
        monkeypatch.setattr("app.services.geocoding_service.requests.get", lambda *args, **kwargs: Response("bad"))
        assert service.reverse_geocode(1.25, 2.5)["precision"] == "coordinate"

        assert service._parse_reverse_response("bad", 1, 2) is None
        reverse = service._parse_reverse_response(
            {
                "lat": 1,
                "lon": 2,
                "display_name": "Main Place",
                "address": {"town": "Smalltown", "country": "US"},
            },
            1,
            2,
        )
        assert "postalCode" not in reverse
        nominatim = service._nominatim_result_to_result(
            {
                "lat": "3",
                "lon": "4",
                "display_name": "Park, City",
                "address": {"state": "Texas", "country": "US"},
            },
            "Park",
        )
        assert "postalCode" not in nominatim
        mapbox = service._mapbox_feature_to_result(
            {
                "text": "Fallback Pin",
                "place_type": ["poi"],
                "context": [
                    {"id": "region.1", "text": "Texas"},
                    {"id": "place.1", "text": "Austin"},
                    {"id": "country.1", "text": "United States", "short_code": "us"},
                ],
            },
            fallback_latitude=30.2,
            fallback_longitude=-97.7,
        )
        assert mapbox["latitude"] == 30.2
        assert "postalCode" not in mapbox
        assert service._mapbox_context_value([{"id": "region.1", "text": ""}], ("place",)) is None
        assert service._mapbox_context_short_code([{"id": "region.1", "short_code": ""}], ("country",)) is None
        assert service._mapbox_context_value([{"id": "place.1", "text": ""}, {"id": "place.2", "text": "Austin"}], ("place",)) == "Austin"
        assert service._mapbox_context_short_code([{"id": "country.1", "short_code": ""}, {"id": "country.2", "short_code": "us"}], ("country",)) == "us"


def test_itinerary_and_recommendation_helper_branch_edges(monkeypatch):
    expensive = _spot("expensive", estimated_cost=500, rating=4.8)
    cheap = _spot("cheap", estimated_cost=0, category="culture", vibe="history", is_outdoor=False)
    engine = ItineraryEngine(content_client=object())
    payload = {
        "startDate": date(2026, 1, 1),
        "endDate": date(2026, 1, 1),
        "budget": 1,
        "pace": "relaxed",
        "groupSize": 2,
        "interests": ["history"],
    }
    assert engine._select_budgeted_spots([], payload) == []
    fallback = engine._select_budgeted_spots([ScoredSpot(expensive, 0.8, 0.9, "great")], payload)
    assert fallback[0].confidence == 0.42
    assert fallback[0].reason.startswith("Budget stretch fallback")
    assert engine._interest_component(cheap, {"history"}) == 0.82
    assert engine._interest_component(cheap, set()) == 0.55
    assert engine._weather_component(_spot(is_outdoor=False), WeatherSnapshot("rain", 0.1)) == 0.58
    assert engine._payload_coordinate({}, "lat", "lng") is None
    assert engine._nearest_neighbor([]) == []
    assert "has a strong community signal" in engine._build_reason(cheap, 0.4, 0.5, 0.3, 0.4, 0.95)
    assert "uses more budget" in engine._build_reason(expensive, 0.4, 0.5, 0.3, 0.01, 0.1)
    assert "keeps the route tight" in engine._build_reason(cheap, 0.8, 0.8, 0.3, 0.4, 0.1)
    assert engine._build_reason(cheap, 0.4, 0.5, 0.3, 0.4, 0.1) == "Adds a culture contrast."
    assert engine._route_component(
        _spot(latitude=32.751, longitude=-97.331),
        {"destinationLatitude": 32.75, "destinationLongitude": -97.33},
    ) > 0.9
    days = engine._build_days(
        [ScoredSpot(cheap, 0.8, 0.7, "reason")],
        date(2026, 1, 1),
        date(2026, 1, 1),
        "unknown",
        1,
    )
    assert days[0]["spots"][0]["duration"] == 90

    class FakeRecommendationContent:
        def get_all_spots(self):
            return [cheap]

    rec_engine = RecommendationEngine(content_client=FakeRecommendationContent(), native_geo_module=None)
    assert rec_engine.similar_spots("missing", 5) == []
    assert rec_engine._category_affinity_from_weights([cheap], {"missing": 3.0}) == {}
    assert rec_engine._normalize_affinity(-1) == 0.0
    assert "your friends like it too" in rec_engine._build_reason(cheap, 0, 0, 0, friend_component=1, is_cold_start=True)
    assert "popular with people" in rec_engine._build_reason(cheap, 0, 0.1, 0.5)
    assert rec_engine._apply_mmr([], 5) == []
    candidates = [
        _ScoredCandidate(_spot("a", category="food", vibe="calm"), 0.9, {}, "a"),
        _ScoredCandidate(_spot("b", category="food", vibe="calm"), 0.8, {}, "b"),
        _ScoredCandidate(_spot("c", category="culture", vibe="bright"), 0.7, {}, "c"),
    ]
    assert [candidate.spot.spot_id for candidate in rec_engine._apply_mmr(candidates, 2)] == ["a", "c"]
    rec_engine._write_audit("", [{"spotId": "a", "score": 1}])

    class FakeNativeGeo:
        class Coordinate:
            def __init__(self, latitude, longitude):
                self.latitude = latitude
                self.longitude = longitude

        class SpatialPoint:
            def __init__(self, spot_id, coordinate):
                self.spot_id = spot_id
                self.coordinate = coordinate

        class RTreeIndex:
            def __init__(self, points, node_capacity):
                self.points = points
                self.node_capacity = node_capacity

            def nearest_neighbor(self, coordinate):
                return None

    rec_engine.native_geo = FakeNativeGeo
    assert rec_engine._location_bonus_by_spot_id([cheap], [expensive]) == {}
    rec_engine.native_geo = None
    assert rec_engine._location_bonus_by_spot_id([cheap], []) == {}
    assert rec_engine._native_distance_km(cheap, expensive) is None
    assert rec_engine._location_bonus_from_distance_km(None) == 0.0


def test_travel_nearby_scoring_validation_photo_and_message_edges(app, monkeypatch):
    service = TravelNearbyService(content_client=object())
    anchor = {"id": "start", "placeLabel": "Start", "latitude": 32.75, "longitude": -97.33}
    context = {
        "interests": {"food"},
        "pace": "packed",
        "budget_ceiling": 500,
        "latest_intent": "hotel gas culture",
        "fuel_type": "premium",
        "radiusKm": 10,
    }

    google_place = {
        "id": "",
        "displayName": {"text": "Gallery Stop"},
        "formattedAddress": "1 Art St",
        "location": {"latitude": 32.751, "longitude": -97.331},
        "primaryType": "art_gallery",
        "types": ["art_gallery", "tourist_attraction"],
        "rating": 4.2,
        "userRatingCount": 25,
        "priceLevel": "PRICE_LEVEL_EXPENSIVE",
        "currentOpeningHours": {"openNow": False},
        "photos": [{"name": "places/gallery/photos/1"}],
    }
    built = service._build_google_suggestions([None, {"location": {"latitude": 999}}, google_place], anchor, "recommended", context)
    assert built[0]["id"] == "google-gallery-stop"
    assert service._score_suggestion(source="google", category="culture", requested_category="recommended", distance_km=20, rating=0, review_count=0, price_value=250, is_open=False, context=context) < 60
    assert service._score_suggestion(source="google", category="culture", requested_category="shopping", distance_km=1, rating=0, review_count=0, price_value=70, is_open=None, context=context) > 60
    assert service._score_suggestion(source="google", category="nightlife", requested_category="entertainment", distance_km=1, rating=0, review_count=0, price_value=None, is_open=None, context=context) > 60
    assert service._score_suggestion(source="google", category="food", requested_category="nightlife", distance_km=1, rating=0, review_count=0, price_value=None, is_open=None, context=context) > 60
    assert service._score_suggestion(source="google", category="fuel", requested_category="essentials", distance_km=1, rating=0, review_count=0, price_value=None, is_open=None, context=context) > 60
    assert service._score_suggestion(source="google", category="stay", requested_category="other", distance_km=1, rating=0, review_count=0, price_value=70, is_open=None, context=context) > 60

    ranked = service._rank_and_dedupe(
        [
            {"title": "Same", "latitude": 1, "longitude": 2, "score": 10},
            {"title": "Same", "latitude": 1, "longitude": 2, "score": 5},
            {"title": "Other", "latitude": 1, "longitude": 3, "score": 9},
        ],
        "recommended",
        5,
        context,
    )
    assert [item["title"] for item in ranked] == ["Same", "Other"]
    assert service._normalize_route_points([{}, "bad", {"latitude": 1, "longitude": 2}, {"latitude": 999, "longitude": 0}]) == [{"latitude": 1.0, "longitude": 2.0}]
    assert service._scope_category_for_requested_category(_spot(category="other"), "recommended") == "other"
    assert service._scope_price_label(12.4) == "$12 est."
    assert service._scope_reason(_spot(rating=0, popularity=0), "food") == "Scope community pin near this route point"
    assert service._infer_google_category(["bar"], "nightlife") == "nightlife"
    assert service._first_photo({"photos": ["bad", {"name": ""}, {"name": "photo"}]})["name"] == "photo"
    assert service._first_photo_attribution({"authorAttributions": ["bad", {"displayName": "", "uri": ""}]}) == {"displayName": None, "uri": None}
    assert service._extract_fuel_price({"fuelOptions": {"fuelPrices": [{"type": "REGULAR_UNLEADED", "price": {"units": 3, "nanos": 500_000_000}}]}}, "diesel") == (None, "", "diesel")

    def _place(text, primary="store"):
        return {"displayName": {"text": text}, "formattedAddress": text, "primaryType": primary, "types": [primary]}

    assert service._is_google_place_valid_for_requested_category(_place("Lake trail park", "park"), "nature", "outdoors")
    assert not service._is_google_place_valid_for_requested_category(_place("Indoor mall"), "shopping", "outdoors")
    assert service._is_google_place_valid_for_requested_category(_place("Book store"), "shopping", "shopping")
    assert not service._is_google_place_valid_for_requested_category(_place("Hospital"), "essentials", "shopping")
    assert not service._is_google_place_valid_for_requested_category(_place("Gas station"), "fuel", "stay")
    assert service._is_google_place_valid_for_requested_category(_place("Movie theater"), "entertainment", "entertainment")
    assert not service._is_google_place_valid_for_requested_category(_place("Clinic"), "essentials", "entertainment")
    assert service._is_google_place_valid_for_requested_category(_place("Live music bar", "bar"), "nightlife", "nightlife")
    assert not service._is_google_place_valid_for_requested_category(_place("School"), "other", "nightlife")
    assert not service._is_google_place_valid_for_requested_category(_place("Other"), "other", "fuel")

    class PhotoResponse:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            if isinstance(self._payload, BaseException):
                raise self._payload
            return self._payload

    class AllowUsage:
        def consume(self, *args, **kwargs):
            return {"allowed": True, "cap": 10}

    class DenyUsage:
        def consume(self, *args, **kwargs):
            return {"allowed": False, "cap": 1}

    with app.app_context():
        app.config.update(GOOGLE_PLACES_API_KEY="google-key", GOOGLE_PLACES_BASE_URL="https://places.example")
        service._usage_guard = AllowUsage()
        responses = iter([requests.Timeout("slow"), PhotoResponse({}), PhotoResponse(ValueError("bad json")), PhotoResponse({"photoUri": "https://img.example/photo.jpg"})])

        def fake_photo_get(*args, **kwargs):
            response = next(responses)
            if isinstance(response, BaseException):
                raise response
            return response

        monkeypatch.setattr("app.services.travel_nearby_service.requests.get", fake_photo_get)
        photo_suggestions = [
            {"source": "google", "_photoName": "places/zero/photos/1"},
            {"source": "google", "_photoName": "places/one/photos/1"},
            {"source": "google", "_photoName": "places/two/photos/1"},
            {"source": "google", "_photoName": "places/three/photos/1"},
        ]
        assert service._hydrate_google_photos(photo_suggestions, "scenic") == []
        assert photo_suggestions[3]["photoUrl"] == "https://img.example/photo.jpg"

        service._usage_guard = DenyUsage()
        messages = service._hydrate_google_photos([{"source": "google", "_photoName": "places/four/photos/1"}], "scenic")
        assert "monthly free usage cap" in messages[0]

    error_response = type("ErrorResponse", (), {"status_code": 429, "json": lambda self: (_ for _ in ()).throw(ValueError("bad"))})()
    error = requests.HTTPError("bad", response=error_response)
    assert "status 429" in service._google_error_message(error)
    generic_response = type("GenericErrorResponse", (), {"status_code": 500, "json": lambda self: {"error": {}}})()
    assert service._google_error_message(requests.HTTPError("bad", response=generic_response)).endswith("temporarily unavailable.")
    assert service._build_coverage_message(False, [], [{"title": "Scope"}]).startswith("Scope community")


def test_weather_provider_parser_cache_and_error_branch_edges(app, monkeypatch):
    service = WeatherService()
    service._CURRENT_CACHE.clear()
    service._NWS_POINT_CACHE.clear()
    app.config.update(
        TESTING=False,
        WEATHER_PROVIDER_ORDER="unknown",
        WEATHER_CURRENT_STALE_SECONDS=1,
        WEATHER_CURRENT_CACHE_SECONDS=60,
        WEATHER_CACHE_REDIS_URL="",
    )

    with app.app_context():
        monkeypatch.setattr(service, "_request_nws_json", lambda path: {"properties": {"temperature": {}, "windSpeed": {"value": 1}}})
        with pytest.raises(WeatherUnavailableError, match="missing current"):
            service._fetch_nws_station_observation({"label": "Dallas", "latitude": 32.75, "longitude": -97.33}, "KDFW")

        assert service._geocode_query_variants("Dallas, TX")[0] == {"name": "Dallas", "admin1": "Texas"}
        assert service._geocode_query_variants("Dallas, ZZ")[0] == {"name": "Dallas"}
        assert service._select_geocode_result("bad") is None
        assert service._select_geocode_result([], None) is None
        assert service._select_geocode_result([{"admin1": "Texas", "country_code": "CA"}], "Texas") is None
        assert service._normalize_us_state("") is None
        assert service._normalize_us_state("New York") == "New York"
        assert service._normalize_us_state("not-a-state") is None

        stale_payload = service._build_current_payload(
            location={"label": "Dallas", "latitude": 1, "longitude": 2},
            provider="openmeteo",
            provider_label="Open-Meteo",
            condition="Clear",
            temperature=70,
            wind=5,
            weather_code=None,
            observed_at=datetime.now(timezone.utc) - timedelta(seconds=5),
        )
        assert stale_payload["isStale"] is True
        minimal_payload = service._build_current_payload(
            location={"label": None, "latitude": 1, "longitude": 2},
            provider="openmeteo",
            provider_label="Open-Meteo",
            condition="Clear",
            temperature=70,
            wind=5,
            weather_code=None,
            observed_at=None,
        )
        assert "observedAtIso" not in minimal_payload

        target = date(2026, 1, 1)
        assert service._read_daily_snapshot("bad", target) is None
        assert service._read_daily_snapshot({"time": [target.isoformat()], "weather_code": [], "temperature_2m_max": [], "temperature_2m_min": [], "wind_speed_10m_max": []}, target) is None
        assert service._read_daily_snapshot({"time": ["2026-01-02"], "weather_code": [1], "temperature_2m_max": [70], "temperature_2m_min": [50], "wind_speed_10m_max": [5]}, target) is None
        assert service._read_current_snapshot({"temperature_2m": None, "weather_code": 1, "wind_speed_10m": 2}) is None
        assert service._resolve_openweather_is_daytime({"weather": [{"icon": "01n"}]}, None) is False
        assert service._resolve_openweather_is_daytime({"weather": [{"icon": "01x"}], "sys": {}}, None) is None
        assert service._provider_order(None) == ["nws", "openweather", "openmeteo"]
        assert service._provider_order({"latitude": 0, "longitude": 0}) == ["openweather", "openmeteo"]

        class FakeRedis:
            def __init__(self):
                self.store = {}
                self.deleted = []

            def get(self, key):
                return self.store.get(key)

            def delete(self, key):
                self.deleted.append(key)
                self.store.pop(key, None)

            def setex(self, key, ttl, value):
                self.store[key] = value

        redis = FakeRedis()
        monkeypatch.setattr(service, "_redis_client", lambda: redis)
        expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        redis.store["ttl"] = '{"expiresAtUtc":"' + expires + '","payload":{"ok":true}}'
        assert service._read_ttl_cache("ttl", {}) == {"ok": True}
        redis.store["ttl-expired"] = '{"expiresAtUtc":"2020-01-01T00:00:00+00:00","payload":{"ok":true}}'
        assert service._read_ttl_cache("ttl-expired", {}) is None
        assert "ttl-expired" in redis.deleted
        assert service._read_cache_payload("missing-current", datetime.now(timezone.utc)) is None
        assert service._read_ttl_cache("missing-ttl", {}) is None
        service._write_ttl_cache("ttl-zero", {"ok": True}, 0, {})
        assert "ttl-zero" not in redis.store

    WeatherService().clear_current_cache()
