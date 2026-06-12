from __future__ import annotations

import json

import pytest

from app.agents import trip_ai_orchestrator
from app.services.travel_nearby_service import TravelNearbyService


class FakeGeminiResponse:
    def __init__(
        self,
        text: str = "Use the live picks, then add one only after confirming it fits the route.",
        grounding_chunks: list[dict] | None = None,
    ) -> None:
        self.text = text
        self.grounding_chunks = grounding_chunks or []
        self.status_code = 200

    def raise_for_status(self):
        return None

    def json(self):
        candidate = {"content": {"parts": [{"text": self.text}]}}
        if self.grounding_chunks:
            candidate["groundingMetadata"] = {"groundingChunks": self.grounding_chunks}
        return {"candidates": [candidate]}


class FakeHttpResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


def _http_error(status_code: int):
    error = trip_ai_orchestrator.requests.HTTPError(f"HTTP {status_code}")
    error.response = FakeHttpResponse(status_code)
    return error


def _grounding_with_card():
    return trip_ai_orchestrator.TravelGrounding(
        anchors=[{"id": "start", "placeLabel": "Dallas", "latitude": 32.7767, "longitude": -96.797, "routeRole": "start"}],
        place_cards=[
            {
                "title": "Route Cafe",
                "subtitle": "Coffee stop",
                "sourceLabel": "Scope",
                "reason": "It fits the route and timing.",
            }
        ],
        sources=["Scope"],
        coverage="Live place evidence.",
        category="food",
    )


def _base_model_kwargs(**overrides):
    values = {
        "message": "find food nearby",
        "prompt": "Traveler request: find food nearby",
        "planner_state": {},
        "preferences": {},
        "session_history": [],
        "grounding": trip_ai_orchestrator.TravelGrounding([], [], [], "", "recommended"),
        "user_id": "user-1",
        "start_date": None,
        "image_parts": [],
    }
    values.update(overrides)
    return values


def test_trip_chat_simple_actions_do_not_misread_what_to_do_questions():
    actions = trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions(
        "What should I do around Dallas this weekend?"
    )

    assert actions == []


def test_trip_chat_simple_actions_parse_from_to_route_without_overcapturing():
    actions = trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions(
        "Recommend a weekend trip from Dallas to Austin."
    )

    assert {"type": "SET_FIELD", "field": "start", "value": "Dallas"} in actions
    assert {"type": "SET_FIELD", "field": "end", "value": "Austin"} in actions
    assert {"type": "SET_FIELD", "field": "start", "value": "Dallas to Austin"} not in actions


def test_trip_chat_simple_actions_keep_route_modifiers_out_of_destination():
    actions = trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions(
        "Plan a trip from Dallas to Austin with budget 500."
    )

    assert {"type": "SET_FIELD", "field": "start", "value": "Dallas"} in actions
    assert {"type": "SET_FIELD", "field": "end", "value": "Austin"} in actions
    assert {"type": "SET_FIELD", "field": "end", "value": "Austin with budget 500"} not in actions
    assert {"type": "SET_FIELD", "field": "budget_max", "value": 500} in actions


def test_trip_chat_stops_from_prompt_keeps_multiple_numbered_stops():
    stops = trip_ai_orchestrator.TripAiOrchestrator._stops_from_prompt(
        "Start: Dallas\nStops:\n1. \n2. Roadside Cafe (32.1, -97.1)\n3. Hill Museum\nDates: 2026-06-01"
    )

    assert stops == [
        {"name": "Roadside Cafe", "position": 2},
        {"name": "Hill Museum", "position": 3},
    ]


def test_trip_chat_requires_location_for_current_location_nearby(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "what should I do around me"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "scope-location-required"
    assert "need a real location" in payload["response"]
    assert payload["grounding"]["truth_policy"] == "verified_or_labeled"
    assert payload["action_policy"]["confirm_stop_and_trip_document_changes"] is True


def test_trip_chat_uses_current_location_for_near_me_activity_request(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")
    captured = {}

    def fake_get_nearby(self, payload):
        captured["payload"] = payload
        return {
            "configured": True,
            "coverage": "Current location lookup grounded.",
            "source": "Scope + Google Places",
            "category": "recommended",
            "radiusKm": 16.09,
            "suggestions": [
                {
                    "id": "scope-current-location-pick",
                    "title": "Klyde Warren Park",
                    "subtitle": "Walkable current-location anchor",
                    "category": "scenic",
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "reason": "Good fit near the user's current location.",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "what should we do near me",
            "locationContext": {
                "permission": "granted",
                "label": "Dallas current spot",
                "latitude": 32.7866,
                "longitude": -96.8001,
            },
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert captured["payload"]["category"] == "recommended"
    assert captured["payload"]["anchors"][0]["placeLabel"] == "Dallas current spot"
    assert captured["payload"]["anchors"][0]["routeRole"] == "current"
    assert payload["place_cards"][0]["title"] == "Klyde Warren Park"


def test_trip_chat_best_time_to_visit_is_not_misread_as_nearby_places(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "best time to visit Dallas"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] != "scope-location-required"
    assert payload["place_cards"] == []
    assert "need a real location" not in payload["response"]


def test_trip_chat_rejects_cross_user_payload(client, auth_header, second_auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "check this route", "user_id": "user-2"},
        headers=auth_header,
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "FORBIDDEN"

    allowed = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "check this route", "user_id": "user-2"},
        headers=second_auth_header,
    )

    assert allowed.status_code == 200


def test_trip_chat_returns_live_place_cards_from_travel_grounding(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    def fake_get_nearby(self, payload):
        assert payload["category"] == "food"
        assert payload["anchors"][0]["placeLabel"] == "Fort Worth"
        return {
            "configured": True,
            "coverage": "Scope + Google Places live blend.",
            "source": "Scope + Google Places",
            "category": "food",
            "radiusKm": 16.09,
            "suggestions": [
                {
                    "id": "google-food-1",
                    "title": "Panther City Tacos",
                    "subtitle": "High-rated nearby food stop",
                    "address": "100 Main St, Fort Worth, TX",
                    "latitude": 32.755,
                    "longitude": -97.331,
                    "category": "food",
                    "source": "google",
                    "sourceLabel": "Google Places",
                    "distanceKm": 1.2,
                    "rating": 4.7,
                    "reviewCount": 800,
                    "priceLabel": "$$",
                    "isOpen": True,
                    "reason": "Close to the route anchor and provider-backed.",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "what food should I do nearby",
            "plannerState": {
                "start": "Fort Worth",
                "startLatitude": 32.7555,
                "startLongitude": -97.3308,
                "pace": "relaxed",
                "theme": ["food"],
            },
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["place_cards"][0]["title"] == "Panther City Tacos"
    assert payload["place_cards"][0]["sourceLabel"] == "Google Places"
    assert "Panther City Tacos" in payload["response"]
    assert payload["provider"] == "local"


def test_trip_chat_routes_nightlife_prompts_to_nightlife_grounding(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    def fake_get_nearby(self, payload):
        assert payload["category"] == "nightlife"
        return {
            "configured": True,
            "coverage": "Nightlife lookup grounded.",
            "source": "Scope + Google Places",
            "category": "nightlife",
            "radiusKm": 16.09,
            "suggestions": [
                {
                    "id": "google-nightlife-1",
                    "title": "Deep Ellum Listening Room",
                    "subtitle": "Live music near the route anchor",
                    "category": "nightlife",
                    "source": "google",
                    "sourceLabel": "Google Places",
                    "reason": "Nightlife near route, 1.2 mi away, open now",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "find nightlife and live music around Dallas",
            "plannerState": {
                "start": "Dallas",
                "startLatitude": 32.7767,
                "startLongitude": -96.797,
            },
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["grounding"]["category"] == "nightlife"
    assert payload["place_cards"][0]["category"] == "nightlife"
    assert "Deep Ellum Listening Room" in payload["response"]

@pytest.mark.parametrize(
    "message,expected_category",
    [
        ("things to do in Dallas this weekend", "recommended"),
        ("things to do Dallas this weekend", "recommended"),
        ("what to do Dallas this weekend", "recommended"),
        ("fun things Dallas", "recommended"),
        ("Dallas fun things to do", "recommended"),
        ("things to do in Dallas for kids", "recommended"),
        ("best restaurants Dallas", "food"),
        ("restaurants in Dallas with family", "food"),
        ("good restaurants Dallas", "food"),
        ("best brunch Dallas", "food"),
        ("where should we eat Dallas", "food"),
        ("shopping in Dallas", "shopping"),
        ("shopping Dallas", "shopping"),
        ("Dallas shopping", "shopping"),
        ("scenic views Dallas", "scenic"),
        ("Dallas scenic views", "scenic"),
        ("outdoor activities Dallas", "outdoors"),
        ("parks Dallas", "outdoors"),
        ("entertainment Dallas", "entertainment"),
        ("bowling Dallas", "entertainment"),
        ("live music Dallas", "nightlife"),
        ("what should I do around me in Dallas tonight", "recommended"),
    ],
)
def test_trip_chat_treats_city_activity_phrasing_as_live_location_request(
    client,
    auth_header,
    monkeypatch,
    message,
    expected_category,
):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")
    captured = {}

    def fake_get_nearby(self, payload):
        captured["payload"] = payload
        return {
            "configured": True,
            "coverage": "City activity lookup grounded.",
            "source": "Scope + Google Places",
            "category": expected_category,
            "radiusKm": 16.09,
            "suggestions": [
                {
                    "id": "scope-dallas-activity",
                    "title": "Dallas Arts District",
                    "subtitle": "Daytime city anchor",
                    "category": "culture",
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "reason": "Good fit for a Dallas things-to-do request.",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": message},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] != "scope-location-required"
    assert captured["payload"]["category"] == expected_category
    assert captured["payload"]["anchors"][0]["placeLabel"] == "Dallas, USA"
    assert payload["place_cards"][0]["title"] == "Dallas Arts District"


def test_trip_chat_geocodes_prompt_route_labels_for_nearby_grounding(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    def fake_get_nearby(self, payload):
        assert payload["anchors"][0]["placeLabel"] == "Fort Worth"
        assert payload["anchors"][0]["routeRole"] == "start"
        return {
            "coverage": "Prompt route anchor geocoded.",
            "category": "recommended",
            "suggestions": [
                {
                    "id": "scope-garden",
                    "title": "Fort Worth Water Gardens",
                    "subtitle": "Easy downtown anchor",
                    "category": "scenic",
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "reason": "Good first stop near the route start.",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "prompt": "\n".join(
                [
                    "Help refine this Scope trip draft.",
                    "Start: Fort Worth",
                    "End: Austin",
                    "Traveler request: what should I do around the start?",
                ]
            )
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["place_cards"][0]["title"] == "Fort Worth Water Gardens"
    assert "Fort Worth Water Gardens" in payload["response"]


def test_trip_chat_uses_route_text_locations_without_location_required(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    def fake_get_nearby(self, payload):
        assert [anchor["placeLabel"] for anchor in payload["anchors"][:2]] == ["Dallas", "Austin"]
        return {
            "coverage": "Route text anchors geocoded.",
            "category": "recommended",
            "suggestions": [
                {
                    "id": "scope-stop",
                    "title": "Waco Coffee Stop",
                    "subtitle": "Practical midpoint-style break",
                    "category": "food",
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "reason": "Useful stop between the provided route endpoints.",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "recommend a weekend trip from Dallas to Austin"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] != "scope-location-required"
    assert payload["place_cards"][0]["title"] == "Waco Coffee Stop"


def test_trip_chat_strips_trip_modifiers_before_geocoding_location_query(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    def fake_get_nearby(self, payload):
        assert payload["anchors"][0]["placeLabel"] == "Fort Worth, USA"
        return {
            "coverage": "Location modifier stripped.",
            "category": "recommended",
            "suggestions": [
                {
                    "id": "scope-museum",
                    "title": "Fort Worth Museum Stop",
                    "subtitle": "Good weekend anchor",
                    "category": "culture",
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "reason": "Grounded to the cleaned city query.",
                }
            ],
        }

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "what should I do around Fort Worth this weekend?"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["place_cards"][0]["title"] == "Fort Worth Museum Stop"


def test_trip_chat_gemini_path_returns_actions_and_model_contract(client, auth_header, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "gemini-fast-test")
    monkeypatch.setenv("SCOPE_AI_LITE_MODEL", "gemini-lite-test")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "off")
    monkeypatch.setenv("SCOPE_AI_GEMINI_FAST_MONTHLY_CAP", "-1")
    captured = {}

    def fake_post(url, params=None, json=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        captured["json"] = json
        captured["timeout"] = timeout
        return FakeGeminiResponse("Budget is set. Keep the next move practical and route-aware.")

    monkeypatch.setattr(trip_ai_orchestrator.requests, "post", fake_post)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "set budget 500",
            "plannerState": {"start": "Dallas", "end": "Austin"},
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["provider"] == "gemini"
    assert payload["model"] == "gemini-fast-test"
    assert payload["actions"] == [{"type": "SET_FIELD", "field": "budget_max", "value": 500}]
    assert payload["chips"] == ["Check route status", "Build the itinerary", "Find places nearby"]
    assert captured["params"] == {"key": "test-key"}
    assert "models/gemini-fast-test:generateContent" in captured["url"]
    assert "tools" not in captured["json"]


def test_trip_chat_routes_complex_grounded_turns_to_pro_first(client, auth_header, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "gemini-fast-test")
    monkeypatch.setenv("SCOPE_AI_PRO_MODEL", "gemini-pro-test")
    monkeypatch.setenv("SCOPE_AI_LITE_MODEL", "gemini-lite-test")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "off")
    monkeypatch.setenv("SCOPE_AI_GEMINI_PRO_MONTHLY_CAP", "-1")
    captured = {}

    def fake_get_nearby(self, payload):
        return {
            "coverage": "Live evidence.",
            "category": "food",
            "suggestions": [
                {
                    "id": "scope-food",
                    "title": "Route Cafe",
                    "subtitle": "Practical stop",
                    "category": "food",
                    "source": "scope",
                    "sourceLabel": "Scope",
                    "reason": "Fits the route anchor.",
                }
            ],
        }

    def fake_post(url, params=None, json=None, timeout=None):
        captured["url"] = url
        return FakeGeminiResponse("Rank Route Cafe first, then verify hours before committing.")

    monkeypatch.setattr(TravelNearbyService, "get_nearby", fake_get_nearby)
    monkeypatch.setattr(trip_ai_orchestrator.requests, "post", fake_post)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "rank the best food nearby",
            "plannerState": {
                "start": "Fort Worth",
                "startLatitude": 32.7555,
                "startLongitude": -97.3308,
            },
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "gemini-pro-test"
    assert "models/gemini-pro-test:generateContent" in captured["url"]


def test_trip_chat_surfaces_gemini_search_grounding_sources(client, auth_header, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "gemini-fast-test")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "explicit")
    monkeypatch.setenv("SCOPE_AI_GEMINI_FAST_MONTHLY_CAP", "-1")
    monkeypatch.setenv("SCOPE_AI_GEMINI_SEARCH_MONTHLY_CAP", "-1")
    captured = {}

    def fake_post(url, params=None, json=None, timeout=None):
        captured["json"] = json
        return FakeGeminiResponse(
            "Current route context should be verified from live sources.",
            grounding_chunks=[
                {"web": {"title": "Travel advisory", "uri": "https://example.com/travel"}},
                {"web": {"title": "Travel advisory duplicate", "uri": "https://example.com/travel"}},
            ],
        )

    monkeypatch.setattr(trip_ai_orchestrator.requests, "post", fake_post)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "search current route travel guidance"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert captured["json"]["tools"] == [{"google_search": {}}]
    assert payload["grounding"]["search_grounding_used"] is True
    assert payload["grounding"]["web_sources"] == [{"title": "Travel advisory", "uri": "https://example.com/travel"}]


def test_trip_chat_sends_supported_images_to_gemini(client, auth_header, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "gemini-fast-test")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "off")
    monkeypatch.setenv("SCOPE_AI_GEMINI_FAST_MONTHLY_CAP", "-1")
    captured = {}

    def fake_post(url, params=None, json=None, timeout=None):
        captured["json"] = json
        return FakeGeminiResponse("The attached image looks useful as a scenic stop to verify.")

    monkeypatch.setattr(trip_ai_orchestrator.requests, "post", fake_post)

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "review this attached image for my trip",
            "images": [{"filename": "view.png", "mime_type": "image/png", "data": "YXRsYXM="}],
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    parts = captured["json"]["contents"][0]["parts"]
    assert payload["model"] == "gemini-fast-test"
    assert parts[1]["inline_data"] == {"mime_type": "image/png", "data": "YXRsYXM="}
    assert "Attached image count: 1" in parts[0]["text"]


def test_trip_chat_image_request_without_gemini_is_truthful(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={
            "message": "inspect this attached photo for my route",
            "images": [{"filename": "view.png", "mime_type": "image/png", "data": "YXRsYXM="}],
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "scope-ai-vision-unavailable"
    assert "cannot inspect the attached image" in payload["response"]


def test_trip_chat_streams_ndjson_events(client, auth_header, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")

    response = client.post(
        "/api/intel/agent/trip-chat",
        json={"message": "check this route", "responseMode": "stream"},
        headers=auth_header,
        buffered=True,
    )

    assert response.status_code == 200
    assert response.headers["X-Accel-Buffering"] == "no"
    lines = [json.loads(line) for line in response.data.decode("utf-8").splitlines()]
    assert lines[0]["type"] == "status"
    assert lines[-1]["type"] == "final"
    assert lines[-1]["model"] in {"scope-local-copilot", "llama3.2:3b"}


def test_trip_ai_boundary_and_helper_edge_contracts(monkeypatch):
    orchestrator_cls = trip_ai_orchestrator.TripAiOrchestrator

    boundary = orchestrator_cls().chat({"message": "what is quantum entanglement?"}, user_id="user-1")
    assert boundary["model"] == "scope-boundary"
    assert boundary["actions"] == []

    assert orchestrator_cls._start_date_from_payload({"startDate": "2026-07-01"}, "", {}) == "2026-07-01"
    assert orchestrator_cls._mentions_current_location("show food near me")
    assert orchestrator_cls._travel_category("need gas or ev charging") == "fuel"
    assert orchestrator_cls._travel_category("book a hotel stay") == "stay"
    assert orchestrator_cls._travel_category("find parking or a pharmacy") == "essentials"
    assert orchestrator_cls._clean_location_query("parks trails") == ""
    assert orchestrator_cls._extract_location_query("restaurants nearby") is None
    assert orchestrator_cls._interests_from_state({"theme": "coffee, art,, parks"}) == ["coffee", "art", "parks"]
    assert orchestrator_cls._place_card({}) is None
    assert orchestrator_cls._estimated_base64_bytes("AAAA==") == 2

    image_parts = orchestrator_cls._image_parts_from_payload(
        {
            "images": [
                "not-a-dict",
                {"mime_type": "text/plain", "data": "abc"},
                {"mimeType": "image/png", "data": "data:image/png;base64,YXRsYXM="},
                {"mime_type": "image/jpeg", "data": "A" * 5_700_000},
            ]
        }
    )
    assert image_parts == [{"inline_data": {"mime_type": "image/png", "data": "YXRsYXM="}}]
    assert orchestrator_cls._image_parts_from_payload({"images": [{"mime_type": "image/png", "data": "A" * 5_700_000}]}) == []

    formatted_history = orchestrator_cls._format_session_history(
        [None, {"role": "assistant", "content": "Done"}, {"role": "user", "content": "Hi"}, {"role": "user", "content": ""}]
    )
    assert "Scope AI: Done" in formatted_history
    assert "User: Hi" in formatted_history
    assert orchestrator_cls._format_session_history("not-a-list") == "No prior chat."
    with pytest.raises(RuntimeError):
        orchestrator_cls._extract_gemini_text({"candidates": [{"content": {"parts": [{"text": ""}]}}]})

    sources = orchestrator_cls._extract_gemini_grounding_sources(
        {
            "candidates": [
                {
                    "groundingMetadata": {
                        "groundingChunks": [
                            None,
                            {"web": {}},
                            *[{"web": {"uri": f"https://example.test/{index}", "title": ""}} for index in range(10)],
                        ]
                    }
                }
            ]
        }
    )
    assert len(sources) == 8
    assert sources[0] == {"title": "https://example.test/0", "uri": "https://example.test/0"}

    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "fast")
    monkeypatch.setenv("SCOPE_AI_LITE_MODEL", "lite")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "fast,backup,backup")
    sequence = orchestrator_cls()._model_sequence("simple route check", trip_ai_orchestrator.TravelGrounding([], [], [], "", "recommended"))
    assert sequence == ["fast", "lite", "backup"]

    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "explicit")
    assert orchestrator_cls._should_use_search_grounding("search latest route guidance")
    assert not orchestrator_cls._should_use_search_grounding("rank food nearby")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "off")
    assert not orchestrator_cls._should_use_search_grounding("search latest route guidance")

    assert orchestrator_cls._cap_name_for_model("models/gemini-pro") == "SCOPE_AI_GEMINI_PRO_MONTHLY_CAP"
    assert orchestrator_cls._cap_name_for_model("models/gemini-lite") == "SCOPE_AI_GEMINI_LITE_MONTHLY_CAP"
    assert orchestrator_cls._default_cap_for_model("models/gemini-lite") == 1000
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "bad-provider")
    assert orchestrator_cls._configured_provider() == "auto"
    monkeypatch.setenv("BAD_INT", "not-an-int")
    monkeypatch.setenv("BAD_FLOAT", "not-a-float")
    assert orchestrator_cls._env_int("BAD_INT", 7) == 7
    assert orchestrator_cls._env_float("BAD_FLOAT", 1.5) == 1.5


def test_trip_ai_grounding_handles_route_label_stops_and_provider_failures():
    class FakeGeocoder:
        def __init__(self, results=None, raises=False):
            self.results = results if results is not None else [
                {"formattedAddress": "Austin, TX", "latitude": 30.2672, "longitude": -97.7431}
            ]
            self.raises = raises

        def geocode(self, query, limit=1):
            if self.raises:
                raise RuntimeError("geocoder down")
            return self.results

    class FailingNearby:
        def get_nearby(self, payload):
            assert payload["anchors"][0]["routeRole"] == "end"
            assert payload["anchors"][0]["placeLabel"] == "Austin"
            assert payload["interests"] == ["food", "art"]
            raise RuntimeError("provider down")

    orchestrator = trip_ai_orchestrator.TripAiOrchestrator(
        travel_nearby_service=FailingNearby(),
        geocoding_service=FakeGeocoder(),
    )
    grounding = orchestrator._ground_travel_request(
        "find restaurants near the destination",
        {"start": "Dallas", "end": "Austin", "theme": "food, art"},
        {},
    )
    assert grounding.coverage == "Live travel lookup failed."
    assert grounding.anchors[0]["placeLabel"] == "Austin"

    anchors = orchestrator._anchors_from_payload(
        {"locationContext": {"permission": "granted", "label": "Here", "latitude": "32.7", "longitude": "-97.3"}},
        {
            "start": "Invalid start",
            "startLatitude": "bad",
            "startLongitude": "-97.3",
            "stops": [
                None,
                {"name": "Bad stop", "latitude": 999, "longitude": 10},
                {"id": "museum", "name": "Museum", "latitude": 32.7, "longitude": -97.3},
                {"title": "Garden", "latitude": 33.0, "longitude": -98.0},
            ],
        },
    )
    assert [anchor["placeLabel"] for anchor in anchors] == ["Here", "Garden"]
    assert orchestrator._anchors_from_payload({"locationContext": {"permission": "granted", "latitude": "bad", "longitude": 0}}, {}) == []

    assert trip_ai_orchestrator.TripAiOrchestrator(geocoding_service=FakeGeocoder(raises=True))._anchors_from_geocode("Dallas") == []
    empty_geocode = trip_ai_orchestrator.TripAiOrchestrator(geocoding_service=FakeGeocoder(results=[]))
    assert empty_geocode._anchors_from_geocode("Dallas") == []
    assert empty_geocode._anchors_from_planner_labels({"start": "Dallas"}, "start nearby") == []
    assert empty_geocode._anchors_from_route_text("from Dallas to Austin.") == []


def test_trip_ai_stream_events_emit_cards_and_actions(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    class NearbyWithCard:
        def get_nearby(self, payload):
            return {
                "coverage": "Live food evidence.",
                "category": "food",
                "suggestions": [
                    {
                        "id": "route-cafe",
                        "title": "Route Cafe",
                        "subtitle": "Coffee stop",
                        "category": "food",
                        "source": "scope",
                        "sourceLabel": "Scope",
                        "reason": "Good route break.",
                    }
                ],
            }

    monkeypatch.setattr(
        trip_ai_orchestrator,
        "plan_trip",
        lambda *args, **kwargs: {"itinerary": "Pick the nearby place after confirming hours.", "model": "local-test", "steps": 1},
    )
    orchestrator = trip_ai_orchestrator.TripAiOrchestrator(travel_nearby_service=NearbyWithCard())

    events = list(
        orchestrator.stream_events(
            {
                "message": "set budget 500 and find food nearby",
                "plannerState": {"start": "Dallas", "startLatitude": 32.7767, "startLongitude": -96.797},
            },
            user_id="user-1",
        )
    )

    assert [event["type"] for event in events[:3]] == ["status", "place_cards", "actions"]
    assert events[1]["place_cards"][0]["title"] == "Route Cafe"
    assert {"type": "SET_FIELD", "field": "budget_max", "value": 500} in events[2]["actions"]
    assert events[-1]["place_cards"][0]["title"] == "Route Cafe"


def test_trip_ai_answer_fallbacks_are_truthful_and_preserve_live_cards(monkeypatch):
    orchestrator = trip_ai_orchestrator.TripAiOrchestrator()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setattr(orchestrator, "_generate_with_gemini", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("vision down")))
    vision_result = orchestrator._answer_with_model(
        **_base_model_kwargs(
            message="inspect this attached image",
            image_parts=[{"inline_data": {"mime_type": "image/png", "data": "YXRsYXM="}}],
        )
    )
    assert vision_result.model == "scope-ai-vision-unavailable"
    assert vision_result.fallback_reason == "gemini_vision_failed"

    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setattr(trip_ai_orchestrator, "plan_trip", lambda *args, **kwargs: {"itinerary": "", "model": "empty", "steps": 0})
    auto_empty_result = orchestrator._answer_with_model(**_base_model_kwargs())
    assert auto_empty_result.fallback_reason == "all_models_failed"

    monkeypatch.setenv("SCOPE_AI_PROVIDER", "gemini")
    gemini_result = orchestrator._answer_with_model(**_base_model_kwargs(grounding=_grounding_with_card(), start_date="2026-07-01"))
    assert gemini_result.fallback_reason == "gemini_failed"
    assert gemini_result.answer.startswith("Here is the strongest nearby read from live travel data:")

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(
        trip_ai_orchestrator,
        "plan_trip",
        lambda *args, **kwargs: {"itinerary": "Legacy planner answer.", "model": "ollama-test", "steps": 1},
    )
    legacy_result = orchestrator._answer_with_model(**_base_model_kwargs(grounding=_grounding_with_card()))
    assert legacy_result.provider == "ollama"
    assert legacy_result.fallback_reason == "gemini_unavailable"
    assert legacy_result.answer.startswith("Live nearby picks:")

    monkeypatch.setattr(trip_ai_orchestrator, "plan_trip", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("ollama down")))
    local_result = orchestrator._answer_with_model(**_base_model_kwargs(start_date="2026-07-01"))
    assert local_result.model == "scope-local-copilot"
    assert local_result.fallback_reason == "all_models_failed"


def test_trip_ai_gemini_generation_respects_caps_and_retries_without_search(monkeypatch):
    orchestrator = trip_ai_orchestrator.TripAiOrchestrator()
    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "fast")
    monkeypatch.setenv("SCOPE_AI_LITE_MODEL", "lite")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "always_under_cap")

    def fake_consume_budget(sku, monthly_cap):
        assert monthly_cap >= 0
        return sku != "gemini_model:fast"

    calls = []

    def fake_generate_model(**kwargs):
        calls.append((kwargs["model_name"], kwargs["use_search"]))
        if kwargs["use_search"]:
            raise _http_error(400)
        return "Retry without search produced a useful, specific answer.", [{"title": "Source", "uri": "https://example.test/source"}]

    monkeypatch.setattr(orchestrator, "_consume_budget", fake_consume_budget)
    monkeypatch.setattr(orchestrator, "_generate_with_gemini_model", fake_generate_model)

    result = orchestrator._generate_with_gemini(**_base_model_kwargs(message="search current trip food"))

    assert result.model == "lite"
    assert result.search_grounding_used is False
    assert result.web_sources == [{"title": "Source", "uri": "https://example.test/source"}]
    assert calls == [("lite", True), ("lite", False)]

    def fake_low_quality_retry(**kwargs):
        calls.append((kwargs["model_name"], kwargs["use_search"], "low-quality-retry"))
        if kwargs["model_name"] == "fast":
            if kwargs["use_search"]:
                raise _http_error(400)
            return "{}", []
        return "Lite model produced enough useful travel guidance.", []

    calls.clear()
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "")
    monkeypatch.setattr(orchestrator, "_consume_budget", lambda sku, monthly_cap: True)
    monkeypatch.setattr(orchestrator, "_generate_with_gemini_model", fake_low_quality_retry)

    retry_result = orchestrator._generate_with_gemini(**_base_model_kwargs(message="search current trip food"))

    assert retry_result.model == "lite"
    assert calls == [
        ("fast", True, "low-quality-retry"),
        ("fast", False, "low-quality-retry"),
        ("lite", True, "low-quality-retry"),
    ]


def test_trip_ai_gemini_generation_handles_low_quality_network_and_terminal_errors(monkeypatch):
    orchestrator = trip_ai_orchestrator.TripAiOrchestrator()
    monkeypatch.setenv("SCOPE_AI_FAST_MODEL", "fast")
    monkeypatch.setenv("SCOPE_AI_LITE_MODEL", "lite")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "")
    monkeypatch.setenv("SCOPE_AI_SEARCH_GROUNDING_POLICY", "off")

    def fake_generate_model(**kwargs):
        if kwargs["model_name"] == "fast":
            return "{}", []
        raise trip_ai_orchestrator.requests.ConnectionError("network down")

    monkeypatch.setattr(orchestrator, "_generate_with_gemini_model", fake_generate_model)
    with pytest.raises(RuntimeError, match="fast:low_quality"):
        orchestrator._generate_with_gemini(**_base_model_kwargs(message="simple route check"))

    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "backup")

    def fake_generate_with_backup(**kwargs):
        if kwargs["model_name"] == "fast":
            return "[]", []
        if kwargs["model_name"] == "lite":
            raise trip_ai_orchestrator.requests.Timeout("timeout")
        return "Backup model produced enough useful trip guidance.", []

    monkeypatch.setattr(orchestrator, "_generate_with_gemini_model", fake_generate_with_backup)
    result = orchestrator._generate_with_gemini(**_base_model_kwargs(message="simple route check"))
    assert result.model == "backup"

    def fake_non_retryable(**kwargs):
        raise _http_error(403)

    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "")
    monkeypatch.setattr(orchestrator, "_generate_with_gemini_model", fake_non_retryable)
    with pytest.raises(trip_ai_orchestrator.requests.HTTPError):
        orchestrator._generate_with_gemini(**_base_model_kwargs(message="simple route check"))

    def fake_retryable_http(**kwargs):
        if kwargs["model_name"] == "fast":
            raise _http_error(503)
        return "Lite recovered after retryable upstream outage.", []

    monkeypatch.setattr(orchestrator, "_generate_with_gemini_model", fake_retryable_http)
    retryable_result = orchestrator._generate_with_gemini(**_base_model_kwargs(message="simple route check"))
    assert retryable_result.model == "lite"


def test_trip_ai_usage_guard_closed_and_fail_open_paths(app):
    class DenyingGuard:
        def consume(self, sku, monthly_cap):
            assert sku == "gemini_model:fast"
            assert monthly_cap == 1
            return {"allowed": False}

    class FailingGuard:
        def consume(self, sku, monthly_cap):
            raise RuntimeError("usage service down")

    with app.app_context():
        assert not trip_ai_orchestrator.TripAiOrchestrator(usage_guard=DenyingGuard())._consume_budget("gemini_model:fast", 1)
        assert trip_ai_orchestrator.TripAiOrchestrator(usage_guard=FailingGuard())._consume_budget("gemini_model:fast", 1)


def test_trip_ai_simple_actions_and_chip_contracts():
    actions = trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions(
        "set a packed pace for group size 4 and start in Dallas and destination to Austin"
    )

    assert {"type": "SET_FIELD", "field": "pace", "value": "packed"} in actions
    assert {"type": "SET_FIELD", "field": "party_size", "value": 4} in actions
    assert {"type": "SET_FIELD", "field": "start", "value": "Dallas"} in actions
    assert {"type": "SET_FIELD", "field": "end", "value": "Austin"} in actions
    assert {"type": "SET_FIELD", "field": "end", "value": "Austin"} in trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions(
        "Plan from for tacos to Austin."
    )
    assert {"type": "SET_FIELD", "field": "start", "value": "Dallas"} in trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions(
        "Plan from Dallas to with snacks."
    )
    assert not any(
        action["field"] == "party_size"
        for action in trip_ai_orchestrator.TripAiOrchestrator._extract_simple_actions("group of 31")
    )
    assert trip_ai_orchestrator.TripAiOrchestrator._chips_for(
        "continue",
        {"start": "Dallas"},
        trip_ai_orchestrator.TravelGrounding([], [], [], "", "recommended"),
        [],
    ) == ["Find places nearby", "Check timing", "Build the itinerary"]
