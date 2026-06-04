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
