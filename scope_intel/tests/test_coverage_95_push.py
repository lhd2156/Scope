from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import requests
from redis.exceptions import RedisError

from app.agents import trip_planner
from app.extensions import db
from app.models import ItineraryCache, RecommendationAudit, SpotFeature, UserPreference
from app.repositories import IntelRepository
from app.routes import agent as agent_route
from app.services.fuel_price_service import FuelPriceService
from app.services.geocoding_service import GeocodingService
from app.services.place_photo_service import PlacePhotoService
from app.services.place_verification_service import PlaceVerificationService
from app.services.weather_service import WeatherService, WeatherUnavailableError


class Response:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code
        self.ok = status_code < 400

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError("bad", response=self)

    def json(self):
        if isinstance(self._payload, BaseException):
            raise self._payload
        return self._payload


def _agent_prompt(request: str, **overrides) -> str:
    fields = {
        "Start": "Dallas",
        "End": "Austin",
        "Dates": "2026-06-01 to 2026-06-03",
        "Budget": "$500",
        "Pace": "balanced",
        "Interests": "food, culture",
        "Travelers": "2",
        "Recent chat": "",
        "Traveler request": request,
    }
    fields.update(overrides)
    return "\n".join(f"{key}: {value}" for key, value in fields.items())


def test_agent_route_helpers_location_lookup_and_fallback_branches(monkeypatch):
    assert agent_route._parse_trip_duration_days("Trip duration: 3 days", "") == 3
    assert agent_route._parse_trip_duration_days("Trip duration: 0 days", "") is None
    assert agent_route._parse_trip_duration_days("", "bad to 2026-01-01") is None
    assert agent_route._parse_trip_duration_days("", "2026-02-02 to 2026-01-01") is None
    assert agent_route._has_travel_party_brief("Travelers: two\nTravel party: family") is True
    assert agent_route._missing_itinerary_brief_questions("", "", "", "", "", "")[0].startswith("What destination")

    assert agent_route._extract_location_lookup_query("where is the 100 Main Street") == "where is the 100 Main Street"
    assert agent_route._extract_location_lookup_query("where is the search bar") is None
    assert agent_route._extract_location_lookup_query("where am I?") is None
    assert agent_route._extract_location_lookup_query("where is stop 2?") is None
    assert agent_route._extract_location_lookup_query("tell me jokes") is None

    class FakeGeocoder:
        def geocode(self, query, limit=3):
            if query == "Missing Place":
                return []
            return [
                {"formattedAddress": "100 Main St, Austin, TX", "city": "Austin", "country": "US"},
                {"placeName": "Main Plaza", "city": "Dallas", "country": "US"},
            ]

    monkeypatch.setattr(agent_route, "GeocodingService", FakeGeocoder)
    assert "could not place" in agent_route._location_lookup_response("where is Missing Place")["itinerary"]
    lookup = agent_route._location_lookup_response("where is Main Plaza")["itinerary"]
    assert "2 location matches" in lookup
    assert "narrow it" in lookup

    branch_expectations = {
        "keep it under budget": "hard cap",
        "tighten this route": "clear route purpose",
        "does the timing work": "against 2026-06-01",
        "add a midpoint stop": "only add a midpoint",
        "make this an easy weekend": "weekend route",
        "recommend ideas": "next move",
        "organize my thoughts": "focused planning pass",
    }
    for request_text, expected in branch_expectations.items():
        assert expected in agent_route._fallback_plan(_agent_prompt(request_text))["itinerary"]

    missing = agent_route._fallback_plan(_agent_prompt("build itinerary", Pace="", Interests="", Travelers=""))
    assert missing["itinerary"].startswith("I can build that.")
    pending = _agent_prompt("4 days", **{"Recent chat": "Scope AI: how many days?"})
    assert "4 days" in agent_route._fallback_plan(pending)["itinerary"]
    vague = _agent_prompt("whatever you think", **{"Recent chat": "Scope AI: what are your interests?"})
    assert "surprise me" in agent_route._fallback_plan(vague)["itinerary"]


def test_trip_planner_process_timeout_reload_and_nested_graph_edges(monkeypatch):
    assert trip_planner._parse_trip_duration_days("Trip duration: 2 days", "") == 2
    assert trip_planner._parse_trip_duration_days("Trip duration: 0 days", "") is None
    assert trip_planner._parse_trip_duration_days("", "2026-01-XX to 2026-01-02") is None
    assert trip_planner._parse_trip_duration_days("", "2026-01-03 to 2026-01-02") is None
    assert trip_planner._professional_boundary_response("") is None

    class CapturingGraph:
        conditional = None
        nodes = {}

        def __init__(self, _state_type):
            pass

        def add_node(self, name, node):
            self.nodes[name] = node

        def add_edge(self, *_args):
            pass

        def add_conditional_edges(self, _name, fn, _mapping):
            CapturingGraph.conditional = fn

        def compile(self):
            return self

    class FakeLLM:
        def bind_tools(self, _tools):
            return self

        def invoke(self, _messages):
            return SimpleNamespace(content="agent", tool_calls=[])

    monkeypatch.setattr(trip_planner, "LANGGRAPH_AVAILABLE", True)
    monkeypatch.setattr(trip_planner, "ChatOllama", lambda **_kwargs: FakeLLM())
    monkeypatch.setattr(trip_planner, "ToolNode", lambda _tools: "tools")
    monkeypatch.setattr(trip_planner, "StateGraph", CapturingGraph)
    graph = trip_planner.create_trip_planner()
    assert graph.nodes["agent"]({"messages": ["hello"]})["messages"][0].content == "agent"
    assert CapturingGraph.conditional({"messages": [SimpleNamespace(tool_calls=[{"name": "search"}])]}) == "tools"
    assert CapturingGraph.conditional({"messages": [SimpleNamespace(tool_calls=[])]}) == "end"

    class QueueCapture:
        def __init__(self):
            self.items = []

        def put(self, value):
            self.items.append(value)

    queue_capture = QueueCapture()
    monkeypatch.setattr(trip_planner, "create_trip_planner", lambda: SimpleNamespace(invoke=lambda *_args, **_kwargs: {"messages": [SimpleNamespace(content="done")]}))
    trip_planner._run_agent_process("Prompt", "user-1", "2026-01-01", queue_capture)
    assert queue_capture.items[-1] == {"itinerary": "done", "steps": 1}
    monkeypatch.setattr(trip_planner, "create_trip_planner", lambda: (_ for _ in ()).throw(RuntimeError("no graph")))
    trip_planner._run_agent_process("Prompt", None, None, queue_capture)
    assert "error" in queue_capture.items[-1]

    class AliveProcess:
        def __init__(self, target, args, daemon):
            self.terminated = False

        def start(self):
            pass

        def join(self, timeout=None):
            pass

        def is_alive(self):
            return not self.terminated

        def terminate(self):
            self.terminated = True

    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "1")
    monkeypatch.setattr(trip_planner.mp, "Process", AliveProcess)
    monkeypatch.setattr(trip_planner.mp, "Queue", lambda maxsize=1: SimpleNamespace(get_nowait=lambda: {"itinerary": "late", "steps": 3}))
    assert trip_planner.plan_trip("Traveler request: route")["steps"] == 0

    class DoneProcess(AliveProcess):
        def is_alive(self):
            return False

    monkeypatch.setattr(trip_planner.mp, "Process", DoneProcess)
    monkeypatch.setattr(trip_planner.mp, "Queue", lambda maxsize=1: SimpleNamespace(get_nowait=lambda: {"error": "bad"}))
    assert trip_planner.plan_trip("Traveler request: route")["steps"] == 0

    original_import = __import__

    def fake_import(name, *args, **kwargs):
        if name.startswith(("langchain_core", "langchain_ollama", "langgraph")):
            raise ImportError("missing")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", fake_import)
    reloaded = importlib.reload(trip_planner)
    assert reloaded.LANGGRAPH_AVAILABLE is False
    assert reloaded.HumanMessage("x").content == "x"
    assert reloaded.add_messages(["a"]) == ["a"]
    monkeypatch.setattr("builtins.__import__", original_import)
    importlib.reload(trip_planner)


def test_fuel_photo_verification_and_geocoding_error_edges(app, monkeypatch, tmp_path):
    app.config.update(
        TESTING=False,
        GOOGLE_PLACES_API_KEY="google-key",
        GOOGLE_PLACES_BASE_URL="https://places.test",
        GOOGLE_PLACES_USAGE_FILE=str(tmp_path / "usage.json"),
        MAPBOX_ACCESS_TOKEN="pk.test",
        GEOCODE_BASE_URL="https://nominatim.test/search",
        REVERSE_GEOCODE_BASE_URL="https://nominatim.test/reverse",
        GEOCODE_API_KEY="geo-key",
    )

    with app.app_context():
        fuel = FuelPriceService()
        app.config["GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP"] = "bad"
        assert fuel._monthly_cap("GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP", 7) == 7
        monkeypatch.setattr("app.services.fuel_price_service.requests.post", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        assert "temporarily unavailable" in fuel.get_nearby_stations(lat=1, lng=2)["coverage"]
        monkeypatch.setattr("app.services.fuel_price_service.requests.post", lambda *args, **kwargs: Response(ValueError("bad")))
        assert "unreadable" in fuel.get_nearby_stations(lat=1, lng=2, fuel_type="bad", sort_by="bad")["coverage"]
        assert FuelPriceService._select_google_fuel_price({}, "all") == (None, [])
        assert FuelPriceService._select_google_fuel_price({"fuelOptions": {"fuelPrices": [{"type": "REGULAR_UNLEADED", "price": {"units": 3}}]}}, "diesel")[0] is None
        assert FuelPriceService._normalize_google_price({"type": "SP95", "price": {"units": "0"}}) is None
        assert FuelPriceService._parse_google_money({"units": "bad"}) is None
        assert FuelPriceService._first_price_currency([{}, {"currency": "EUR"}]) == "EUR"
        assert FuelPriceService._safe_float("bad") is None
        assert FuelPriceService._distance_km(1, 2, None, 2) is None
        err = requests.HTTPError(response=Response({"error": {"message": "Quota"}}, 429))
        assert "Quota" in FuelPriceService._google_error_message(err)
        bad_json = requests.HTTPError(response=Response(ValueError("bad"), 500))
        assert "temporarily unavailable" in FuelPriceService._google_error_message(bad_json)

        photos = PlacePhotoService()
        assert photos.get_featured_photo(query=" ", lat=1, lng=2)["coverage"].startswith("A place name")
        monkeypatch.setattr("app.services.place_photo_service.requests.post", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        assert "photo search" in photos.get_featured_photo(query="Cafe", lat=1, lng=2)["coverage"]
        monkeypatch.setattr("app.services.place_photo_service.requests.post", lambda *args, **kwargs: Response(ValueError("bad")))
        assert "unreadable photo search" in photos.get_featured_photo(query="Cafe", lat=1, lng=2)["coverage"]
        monkeypatch.setattr("app.services.place_photo_service.requests.post", lambda *args, **kwargs: Response({"places": [{"photos": [{"name": "places/1/photos/a"}], "location": {"latitude": 1, "longitude": 2}}]}))
        monkeypatch.setattr("app.services.place_photo_service.requests.get", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        assert "photo media" in photos.get_featured_photo(query="Cafe", lat=1, lng=2)["coverage"]
        monkeypatch.setattr("app.services.place_photo_service.requests.get", lambda *args, **kwargs: Response(ValueError("bad")))
        assert "unreadable photo media" in photos.get_featured_photo(query="Cafe", lat=1, lng=2)["coverage"]
        monkeypatch.setattr("app.services.place_photo_service.requests.get", lambda *args, **kwargs: Response({"photoUri": ""}))
        assert "usable photo URL" in photos.get_featured_photo(query="Cafe", lat=1, lng=2)["coverage"]
        app.config["GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP"] = 0
        assert "Place Details Photos" in photos.get_featured_photo(query="Cafe", lat=1, lng=2)["coverage"]
        assert photos._monthly_cap("missing", 9) == 9
        app.config["BAD_PHOTO_CAP"] = "bad"
        assert photos._monthly_cap("BAD_PHOTO_CAP", 9) == 9
        assert photos._select_photo_place("bad", origin_lat=1, origin_lng=2) is None
        assert photos._first_photo({"photos": ["bad"]}) is None
        assert photos._first_photo_attribution({"authorAttributions": ["bad"]}) == {"displayName": None, "uri": None}
        assert photos._safe_float("bad") is None
        assert photos._distance_km(1, 2, None, 3) == float("inf")

        verifier = PlaceVerificationService()
        assert verifier.verify({"title": "", "latitude": 1, "longitude": 2})["verified"] is False
        app.config["GOOGLE_PLACES_API_KEY"] = ""
        app.config["MAPBOX_ACCESS_TOKEN"] = ""
        assert "No provider-backed" in verifier.verify({"title": "Cafe", "latitude": 1, "longitude": 2})["reason"]
        app.config["GOOGLE_PLACES_API_KEY"] = "google-key"
        app.config["GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP"] = 0
        assert verifier._search_google("Cafe", 1, 2) == []
        app.config["GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP"] = 5000
        monkeypatch.setattr("app.services.place_verification_service.requests.post", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        assert verifier._search_google("Cafe", 1, 2) == []
        monkeypatch.setattr("app.services.place_verification_service.requests.post", lambda *args, **kwargs: Response({"places": "bad"}))
        assert verifier._search_google("Cafe", 1, 2) == []
        monkeypatch.setattr("app.services.place_verification_service.requests.post", lambda *args, **kwargs: Response({"places": [{"location": {"latitude": "bad", "longitude": 2}}, "bad"]}))
        assert verifier._search_google("Cafe", 1, 2) == []
        app.config["GOOGLE_PLACES_API_KEY"] = ""
        app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"
        monkeypatch.setattr("app.services.place_verification_service.requests.get", lambda *args, **kwargs: Response({"features": "bad"}))
        assert verifier._search_mapbox("Cafe", 1, 2) == []
        monkeypatch.setattr("app.services.place_verification_service.requests.get", lambda *args, **kwargs: Response({"features": [{"center": ["bad"]}, "bad"]}))
        assert verifier._search_mapbox("Cafe", 1, 2) == []
        candidate = {"distanceMeters": 10, "precision": "poi", "providerPlaceId": "pid", "providerPlaceName": "Cafe", "providerPlaceAddress": "100 Main St"}
        assert verifier._candidate_verifies(candidate, title="Other", address="", provider_place_id="pid") is True
        assert verifier._candidate_verifies({**candidate, "distanceMeters": 500}, title="Cafe", address="", provider_place_id="") is False
        assert verifier._candidate_verifies({**candidate, "precision": "city"}, title="Cafe", address="", provider_place_id="") is False
        assert verifier._candidate_verifies(candidate, title="Cafe", address="100 Main", provider_place_id="") is True
        assert verifier._google_precision({"types": ["street_address"]}) == "address"
        assert verifier._google_precision({"types": ["locality"]}) == "city"
        assert verifier._google_precision({"types": []}) == ""
        assert verifier._google_component(["bad", {"types": ["country"], "shortText": "US"}], {"country"}, prefer_short=True) == "US"
        assert verifier._mapbox_context_value([{"id": "place.1", "text": "Austin"}], ("place",)) == "Austin"
        assert verifier._mapbox_context_short_code([{"id": "country.1", "short_code": "us"}], ("country",)) == "US"
        app.config["BAD_VERIFY_CAP"] = "bad"
        assert verifier._monthly_cap("BAD_VERIFY_CAP", 7) == 7

        geocoder = GeocodingService()
        app.config["MAPBOX_ACCESS_TOKEN"] = ""
        assert geocoder._geocode_with_mapbox("Austin", 2) == []
        assert geocoder._reverse_geocode_with_mapbox(1, 2) is None
        app.config["GEOCODE_BASE_URL"] = "https://geocode.open-meteo.com/v1/search"
        assert geocoder._build_search_params("Austin", 2)["name"] == "Austin"
        app.config["GEOCODE_BASE_URL"] = "https://nominatim.test/search"
        assert geocoder._build_search_params("Austin", 2)["api_key"] == "geo-key"
        assert geocoder._build_reverse_params(1, 2)["api_key"] == "geo-key"
        assert geocoder._parse_search_response("bad", "Austin", 2) == []
        assert geocoder._parse_reverse_response("bad", 1, 2) is None
        fallback_feature = {"text": "", "place_name": "", "place_type": ["poi"], "context": [{"id": "postcode.1", "text": "78701"}]}
        assert geocoder._mapbox_feature_to_result(fallback_feature, fallback_latitude=1, fallback_longitude=2)["postalCode"] == "78701"
        assert geocoder._mapbox_context_value([], ("place",)) is None
        assert geocoder._mapbox_context_short_code([], ("country",)) is None
        assert geocoder._extract_city({"state": "Texas"}) == "Texas"
        assert geocoder._street_address({"pedestrian": "Walkway"}) == "Walkway"
        assert geocoder._safe_string(" ") is None


def test_repository_update_expiry_feedback_and_failure_edges(app, monkeypatch):
    with app.app_context():
        payload = {"destination": "Austin", "startDate": "2026-01-01"}
        first_id = IntelRepository.cache_itinerary("user-1", payload, {"days": 1})
        second_id = IntelRepository.cache_itinerary("user-1", payload, {"days": 2})
        assert second_id == first_id
        assert IntelRepository.get_cached_itinerary_for_request("user-1", payload)[1] == {"days": 2}
        record = ItineraryCache.query.filter_by(id=first_id).first()
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
        assert IntelRepository.get_cached_itinerary_for_request("user-1", payload) is None

        itinerary_id = IntelRepository.cache_itinerary("user-1", {"destination": "Dallas"}, {"ok": True})
        record = ItineraryCache.query.filter_by(id=itinerary_id).first()
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
        assert IntelRepository.get_itinerary(itinerary_id, "user-1") is None

        IntelRepository.upsert_preference("user-1", ["food"], "medium", "packed")
        IntelRepository.upsert_preference("user-1", ["culture", "nature"], "low", "relaxed")
        preference = UserPreference.query.filter_by(user_id="user-1").first()
        assert preference.preferred_categories == "culture,nature"
        assert preference.pace_preference == "relaxed"

        IntelRepository.upsert_spot_feature("spot-1", "[1,2]", 1.0, 0.5)
        IntelRepository.upsert_spot_feature("spot-1", "[3,4]", 2.0, 0.7)
        feature = SpotFeature.query.filter_by(spot_id="spot-1").first()
        assert feature.feature_vector == "[3,4]"
        assert feature.sentiment_score == 0.7

        IntelRepository.record_interaction("user-1", "spot-1", "click", source_event_id="event-1")
        IntelRepository.record_interaction("user-1", "spot-1", "click", source_event_id="event-1")
        assert IntelRepository.get_user_interaction_weights("user-1")["spot-1"] == 1.5
        assert IntelRepository.has_any_interaction("user-1") is True
        assert IntelRepository.has_any_interaction("") is False
        assert IntelRepository.get_recently_dismissed_spot_ids("user-1") == set()

        IntelRepository.record_recommendation_audit("user-1", [])
        IntelRepository.record_recommendation_audit("user-1", [{"spotId": "spot-1", "score": 1, "reason": "good"}])
        assert IntelRepository.get_audit_history("user-1")
        assert IntelRepository.mark_recommendation_feedback("user-1", "spot-1", "bad") is False
        assert IntelRepository.mark_recommendation_feedback("user-1", "missing", "click") is False
        assert IntelRepository.mark_recommendation_feedback("user-1", "spot-1", "click") is True
        audit = RecommendationAudit.query.filter_by(user_id="user-1", spot_id="spot-1").first()
        assert audit.clicked_at is not None
        assert IntelRepository.mark_recommendation_feedback("user-1", "spot-1", "dismiss") is True
        assert audit.dismissed_at is not None
        assert "spot-1" in IntelRepository.get_recently_dismissed_spot_ids("user-1")

        IntelRepository.record_friend_edge("", "friend")
        IntelRepository.record_friend_edge("user-1", "user-1")
        IntelRepository.record_friend_edge("user-1", "friend-1")
        IntelRepository.record_interaction("friend-1", "spot-2", "like")
        assert IntelRepository.get_spots_liked_by_friends("user-1") == {"spot-2": 1}
        assert IntelRepository.get_spots_liked_by_friends("") == {}
        IntelRepository.remove_friend_edge("", "friend")

        original_add_all = db.session.add_all
        monkeypatch.setattr(db.session, "add_all", lambda _records: (_ for _ in ()).throw(RuntimeError("db down")))
        IntelRepository.record_recommendation_audit("user-2", [{"spotId": "spot-x"}])
        monkeypatch.setattr(db.session, "add_all", original_add_all)


def test_weather_remaining_provider_cache_and_parsing_edges(app, monkeypatch):
    service = WeatherService()
    service._CURRENT_CACHE.clear()
    service._NWS_POINT_CACHE.clear()
    app.config.update(
        TESTING=False,
        WEATHER_NWS_ENABLED=True,
        WEATHER_CURRENT_CACHE_SECONDS="bad",
        WEATHER_NWS_POINT_CACHE_SECONDS="bad",
        WEATHER_CACHE_REDIS_URL="redis://weather",
        OPENWEATHERMAP_API_KEY="",
        WEATHER_PROVIDER_ORDER="bad,nws,openweather,openmeteo",
    )

    with app.app_context():
        with pytest.raises(WeatherUnavailableError):
            service._fetch_current_snapshot_for_provider("openweather", {"latitude": 1, "longitude": 2})
        assert service._provider_order(None)[0] == "nws"
        assert service._current_cache_ttl() == 60
        assert service._nws_point_cache_ttl() == 86400
        assert service._normalize_redis_url(" ") == ""
        assert service._nws_headers()["User-Agent"].startswith("Scope/")
        assert service._read_daily_snapshot({"daily": {"time": "bad"}}, datetime(2026, 1, 1).date()) is None
        assert service._read_daily_snapshot({"daily": {"time": ["2026-01-02"], "weather_code": [], "temperature_2m_max": [], "temperature_2m_min": [], "wind_speed_10m_max": []}}, datetime(2026, 1, 1).date()) is None
        assert service._read_daily_snapshot({"daily": {"time": ["2026-01-01"], "weather_code": [None], "temperature_2m_max": [70], "temperature_2m_min": [50], "wind_speed_10m_max": [5]}}, datetime(2026, 1, 1).date()) is None
        assert service._read_current_snapshot(None) is None
        assert service._read_current_snapshot({"temperature_2m": 70}) is None
        assert service._normalize_condition(None) == ""
        assert service._datetime_from_unix("bad") is None
        assert service._datetime_from_unix(10**100) is None
        assert service._bool_from_current_daylight("bad") is None
        assert service._resolve_openweather_is_daytime({"weather": [{"icon": "01n"}]}, None) is False
        assert service._resolve_openweather_is_daytime({"weather": [{}], "sys": {}}, None) is None
        assert service._nws_temperature_f({"value": 32, "unitCode": "wmoUnit:degF"}) == 32
        assert service._nws_temperature_f({"value": None}) is None
        assert service._nws_wind_mph({"value": None}) is None
        assert service._nws_wind_mph({"value": 10, "unitCode": "wmoUnit:km_h-1"}) == 6.2
        assert service._quantitative_value("bad") is None
        assert service._finite_number(True) is None
        assert service._datetime_from_iso("") is None
        assert service._datetime_from_iso("not-date") is None
        for code, label in [(45, "Fog"), (51, "Rain"), (71, "Snow"), (1234, "Current Conditions")]:
            assert service._condition_from_weather_code(code) == label

        class RedisWithFailures:
            def __init__(self):
                self.store = {}

            def ping(self):
                return True

            def get(self, key):
                return self.store.get(key)

            def setex(self, key, ttl, value):
                if key == "bad-write":
                    raise RedisError("write")
                self.store[key] = value

            def delete(self, key):
                self.store.pop(key, None)

            def scan_iter(self, _pattern):
                raise RedisError("scan")

        redis = RedisWithFailures()
        WeatherService._REDIS_CLIENTS.clear()
        monkeypatch.setattr("app.services.weather_service.Redis.from_url", lambda *args, **kwargs: redis)
        assert service._redis_client() is redis
        now = datetime.now(timezone.utc)
        redis.store["expired"] = '{"expiresAtUtc":"2000-01-01T00:00:00Z","payload":{"x":1}}'
        assert service._read_cache_payload("expired", now) is None
        redis.store["bad-json"] = "{"
        assert service._read_cache_payload("bad-json", now) is None
        service._write_cache_payload("bad-write", {"x": 1}, now + timedelta(seconds=60), 60)
        service._write_cache_payload("skip", {"x": 1}, now + timedelta(seconds=60), 0)

        redis.store["ttl-expired"] = '{"expiresAtUtc":"2000-01-01T00:00:00Z","payload":{"x":1}}'
        assert service._read_ttl_cache("ttl-expired", {}) is None
        redis.store["ttl-bad"] = "{"
        assert service._read_ttl_cache("ttl-bad", {}) is None
        service._write_ttl_cache("bad-write", {"x": 1}, 60, {})
        service._write_ttl_cache("skip", {"x": 1}, 0, {})
        service.clear_current_cache()


def test_weather_and_geocoding_cover_remaining_failure_success_edges(app, monkeypatch):
    service = WeatherService()
    app.config.update(
        TESTING=False,
        WEATHER_NWS_ENABLED=True,
        WEATHER_CACHE_REDIS_URL="",
        OPENWEATHERMAP_API_KEY="owm-key",
        WEATHER_BASE_URL="https://openmeteo.test",
        GEOCODE_BASE_URL="https://nominatim.test/search",
        REVERSE_GEOCODE_BASE_URL="https://nominatim.test/reverse",
        MAPBOX_ACCESS_TOKEN="",
    )

    assert service._redis_client() is None

    with app.app_context():
        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: Response([]))
        with pytest.raises(WeatherUnavailableError):
            service._fetch_open_meteo_forecast(1, 2, datetime(2026, 1, 1).date())

        monkeypatch.setattr(service, "_provider_order", lambda _location: ["openmeteo"])
        monkeypatch.setattr(service, "_fetch_current_snapshot_for_provider", lambda *_args: (_ for _ in ()).throw(WeatherUnavailableError("down")))
        with pytest.raises(WeatherUnavailableError):
            service._fetch_current_snapshot({"latitude": 1, "longitude": 2})

        monkeypatch.setattr(service, "_get_nws_point_metadata", lambda *_args: {})
        with pytest.raises(WeatherUnavailableError):
            service._fetch_nws_current({"latitude": 1, "longitude": 2})

        monkeypatch.setattr(service, "_get_nws_point_metadata", lambda *_args: {"observationStations": "stations"})
        monkeypatch.setattr(service, "_get_nws_station_ids", lambda *_args: ["BAD1", "BAD2"])
        monkeypatch.setattr(service, "_fetch_nws_station_observation", lambda *_args: (_ for _ in ()).throw(WeatherUnavailableError("bad station")))
        with pytest.raises(WeatherUnavailableError):
            service._fetch_nws_current({"latitude": 1, "longitude": 2})

        monkeypatch.setattr(service, "_get_nws_point_metadata", WeatherService._get_nws_point_metadata.__get__(service, WeatherService))
        cached_key = "weather:nws:point:1.000:2.000"
        service._NWS_POINT_CACHE[cached_key] = {
            "expiresAtUtc": datetime.now(timezone.utc) + timedelta(minutes=1),
            "payload": {"observationStations": "cached-stations"},
        }
        assert service._get_nws_point_metadata(1, 2)["observationStations"] == "cached-stations"
        service._NWS_POINT_CACHE.clear()

        monkeypatch.setattr(service, "_request_nws_json", lambda _path: {"properties": {"observationStations": 123}})
        with pytest.raises(WeatherUnavailableError):
            service._get_nws_point_metadata(1, 2)
        monkeypatch.setattr(service, "_request_nws_json", lambda _path: {"features": [{"properties": {"stationIdentifier": ""}}]})
        monkeypatch.setattr(service, "_get_nws_station_ids", WeatherService._get_nws_station_ids.__get__(service, WeatherService))
        service._NWS_POINT_CACHE.clear()
        with pytest.raises(WeatherUnavailableError):
            service._get_nws_station_ids(1, 2, "stations")
        monkeypatch.setattr(service, "_request_nws_json", lambda _path: {"properties": {"temperature": {"value": None}, "windSpeed": {"value": 5}}})
        with pytest.raises(WeatherUnavailableError):
            service._fetch_nws_station_observation({"latitude": 1, "longitude": 2}, "BAD")

        monkeypatch.setattr(service, "_request_nws_json", WeatherService._request_nws_json.__get__(service, WeatherService))
        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        with pytest.raises(WeatherUnavailableError):
            service._request_nws_json("/points/1,2")
        with pytest.raises(WeatherUnavailableError):
            service._fetch_openweathermap_current({"latitude": 1, "longitude": 2}, "key")
        with pytest.raises(WeatherUnavailableError):
            service._fetch_open_meteo_current({"latitude": 1, "longitude": 2})
        with pytest.raises(WeatherUnavailableError):
            service._resolve_current_location(None, None, "Austin")

        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: Response([]))
        with pytest.raises(WeatherUnavailableError):
            service._fetch_openweathermap_current({"latitude": 1, "longitude": 2}, "key")
        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: Response({"main": {}, "wind": {}, "weather": []}))
        with pytest.raises(WeatherUnavailableError):
            service._fetch_openweathermap_current({"latitude": 1, "longitude": 2}, "key")
        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: Response({"current": {}}))
        with pytest.raises(WeatherUnavailableError):
            service._fetch_open_meteo_current({"latitude": 1, "longitude": 2})

        with pytest.raises(WeatherUnavailableError):
            service._resolve_current_location(None, None, "")

        assert service._read_daily_snapshot(
            {
                "daily": {
                    "time": ["2026-01-02"],
                    "weather_code": [0],
                    "temperature_2m_max": [70],
                    "temperature_2m_min": [50],
                    "wind_speed_10m_max": [5],
                }
            },
            datetime(2026, 1, 1).date(),
        ) is None
        assert service._read_daily_snapshot(
            {
                "daily": {
                    "time": ["2026-01-01"],
                    "weather_code": [0],
                    "temperature_2m_max": [None],
                    "temperature_2m_min": [50],
                    "wind_speed_10m_max": [5],
                }
            },
            datetime(2026, 1, 1).date(),
        ) is None
        assert service._bool_from_current_daylight(True) is True
        observed = datetime.fromtimestamp(100, tz=timezone.utc)
        assert service._resolve_openweather_is_daytime({"weather": [{}], "sys": {"sunrise": 50, "sunset": 150}}, observed) is True
        assert service._nws_wind_mph({"value": 10, "unitCode": "wmoUnit:mile_h-1"}) == 10

        class RedisOk:
            def __init__(self):
                self.store = {}

            def ping(self):
                return True

            def get(self, key):
                return self.store.get(key)

            def setex(self, key, ttl, value):
                self.store[key] = value

            def delete(self, key):
                self.store.pop(key, None)

        redis = RedisOk()
        app.config["WEATHER_CACHE_REDIS_URL"] = "redis://weather"
        WeatherService._REDIS_CLIENTS.clear()
        monkeypatch.setattr("app.services.weather_service.Redis.from_url", lambda *args, **kwargs: redis)
        future = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
        redis.store["ttl-hit"] = f'{{"expiresAtUtc":"{future}","payload":{{"stationIds":["KDFW"]}}}}'
        assert service._read_ttl_cache("ttl-hit", {}) == {"stationIds": ["KDFW"]}

        geocoder = GeocodingService()
        app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"
        monkeypatch.setattr("app.services.geocoding_service.requests.get", lambda *args, **kwargs: Response({"features": []}))
        assert geocoder._reverse_geocode_with_mapbox(1, 2) is None

        app.config["MAPBOX_ACCESS_TOKEN"] = ""
        monkeypatch.setattr(
            "app.services.geocoding_service.requests.get",
            lambda *args, **kwargs: Response(
                {
                    "display_name": "100 Main St, Austin, TX",
                    "lat": "30.26",
                    "lon": "-97.74",
                    "type": "house",
                    "address": {
                        "house_number": "100",
                        "road": "Main St",
                        "city": "Austin",
                        "country": "United States",
                        "postcode": "78701",
                    },
                }
            ),
        )
        reversed_location = geocoder.reverse_geocode(30.26, -97.74)
        assert reversed_location["postalCode"] == "78701"
        assert reversed_location["address"] == "100 Main St"
        assert geocoder._extract_city({}) is None
