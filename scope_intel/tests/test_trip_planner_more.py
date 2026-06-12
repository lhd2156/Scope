from __future__ import annotations

import queue
from types import SimpleNamespace

import pytest

from app.agents import trip_planner


def test_trip_planner_parsers_boundaries_and_fallback_branches(monkeypatch):
    prompt = "\n".join(
        [
            "Start: Dallas",
            "End: Austin",
            "Dates: 2026-06-01 to 2026-06-03",
            "Budget: $500",
            "Pace: relaxed",
            "Interests: food, culture",
            "Travelers: 2",
            "Recent chat:",
            "Scope AI: how many days?",
            "Traveler request: 3 days",
        ]
    )

    assert trip_planner._env_int("MISSING_INT", 7) == 7
    monkeypatch.setenv("BAD_INT", "nope")
    assert trip_planner._env_int("BAD_INT", 7) == 7
    assert trip_planner._env_float("MISSING_FLOAT", 1.5) == 1.5
    monkeypatch.setenv("BAD_FLOAT", "nope")
    assert trip_planner._env_float("BAD_FLOAT", 1.5) == 1.5
    assert trip_planner._read_prompt_line(prompt, "Start") == "Dallas"
    assert trip_planner._read_traveler_request(prompt) == "3 days"
    assert "Scope AI" in trip_planner._read_recent_chat(prompt)
    assert trip_planner._is_itinerary_build_request("build a weekend itinerary") is True
    assert trip_planner._parse_trip_duration_days(prompt, "2026-06-01 to 2026-06-03") == 3
    assert trip_planner._has_travel_party_brief(prompt) is True
    assert trip_planner._missing_itinerary_brief_questions("", "", "", "", "", "")[0].startswith("What destination")
    assert trip_planner._is_vague_brief_reply("idk you pick") is True
    assert trip_planner._is_vague_brief_reply("food museums 3 days") is False
    assert trip_planner._has_pending_itinerary_brief(prompt, trip_planner._read_recent_chat(prompt)) is True
    assert trip_planner._parse_pending_duration_reply("12 days please") == 12
    assert trip_planner._normalize_request("Hello!!!") == "hello"
    assert trip_planner._is_scope_domain_request("trip route food") is True
    assert "988" in trip_planner._professional_boundary_response("I want to kill myself")
    assert "respectful" in trip_planner._professional_boundary_response("fuck you")
    assert "professional" in trip_planner._professional_boundary_response("send nudes")
    assert "sexual orientation" in trip_planner._professional_boundary_response("are you gay")
    assert "qualified professional" in trip_planner._professional_boundary_response("medical advice")
    assert "outside Scope" in trip_planner._professional_boundary_response("what is the capital of France?")

    assert "3 days" in trip_planner._fallback_plan(prompt)
    assert "hard cap" in trip_planner._fallback_plan(prompt.replace("3 days", "keep it under budget"))
    assert "tighten" in trip_planner._fallback_plan(prompt.replace("3 days", "tighten this route")).lower()
    assert "check Dallas to Austin" in trip_planner._fallback_plan(prompt.replace("3 days", "does this timing work"))
    assert "midpoint" in trip_planner._fallback_plan(prompt.replace("3 days", "add a stop on the way")).lower()
    assert "weekend route" in trip_planner._fallback_plan(prompt.replace("3 days", "make this an easy weekend"))
    assert "next move" in trip_planner._fallback_plan(prompt.replace("3 days", "recommend ideas")).lower()
    assert "focused planning pass" in trip_planner._fallback_plan(prompt.replace("3 days", "organize my thoughts"))


def test_trip_planner_helper_edges_cover_user_visible_fallback_copy():
    stops_prompt = "Stops:\n1. Roadside Cafe (32.1, -97.1)\n2. Hill Museum\nDates: 2026-06-01"
    assert trip_planner._parse_planner_stop_names("") == []
    assert trip_planner._parse_planner_stop_names(stops_prompt) == ["Roadside Cafe", "Hill Museum"]
    assert trip_planner._format_interest_phrase("") == "good-fit"
    assert trip_planner._format_interest_phrase("food, culture") == "food or culture"

    assert trip_planner._parse_trip_duration_days("Traveler request: weekend route", "") == 2
    assert trip_planner._parse_trip_duration_days("Traveler request: 5d route", "") == 5
    assert trip_planner._parse_trip_duration_days("", "2026-02-30 to 2026-03-01") is None
    assert trip_planner._concise_plan_day_count("Traveler request: 30 day route", "") == 14

    assert trip_planner._travelers_label("Travel party: two cousins") == "two cousins"
    assert trip_planner._travelers_label("Travelers: 1\nTraveler request: route") == "solo traveler"
    assert trip_planner._travelers_label("Travelers: 4\nTraveler request: route") == "4 travelers"
    assert trip_planner._travelers_label("Traveler request: family with kids") == "family"
    assert trip_planner._travelers_label("Traveler request: couple trip") == "couple"
    assert trip_planner._travelers_label("Traveler request: solo weekend") == "solo traveler"
    assert trip_planner._travelers_label("Traveler request: friends road trip") == "group"
    assert trip_planner._travelers_label("Traveler request: route") == "travel party not locked"

    assert "3 meaningful stops" in trip_planner._pace_stop_target("packed")
    assert "flexible backup" in trip_planner._pace_stop_target("relaxed")
    assert "2 main anchors" in trip_planner._pace_stop_target("moderate")

    assert "entertainment anchor" in trip_planner._interest_anchor("entertainment", 1)
    assert "food stop" in trip_planner._interest_anchor("food", 1)
    assert "culture or history" in trip_planner._interest_anchor("culture", 1)
    assert "scenic or outdoor" in trip_planner._interest_anchor("nature", 1)
    assert "shopping district" in trip_planner._interest_anchor("shopping", 1)
    assert "nightlife option" in trip_planner._interest_anchor("nightlife", 1)
    assert "active stop" in trip_planner._interest_anchor("adventure", 1)
    assert "good-fit stop" in trip_planner._interest_anchor("", 1)

    with pytest.raises(RuntimeError, match="no text"):
        trip_planner._extract_gemini_text({"candidates": [{"content": {"parts": [{"text": "  "} ]}}]})


def test_fallback_itinerary_brief_and_plan_trip_process_branches(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "ollama")

    missing_prompt = "Start: Dallas\nEnd: Austin\nTraveler request: build itinerary"
    assert trip_planner._fallback_plan(missing_prompt).startswith("I can build that.")

    complete_prompt = "\n".join(
        [
            "Start: Dallas",
            "End: San Antonio",
            "Dates: 2026-06-01 to 2026-06-01",
            "Budget: $400 - $900",
            "Traveler request: Build a relaxed 3 day entertainment and food itinerary for my family",
        ]
    )
    complete_response = trip_planner._fallback_plan(complete_prompt)
    assert "concise 3-day plan" in complete_response
    assert "Plan guardrails" in complete_response
    assert "Pace: relaxed" in complete_response
    assert "one verified entertainment anchor" in complete_response
    assert "Travelers: family" in complete_response
    assert "Verify before commit" in complete_response
    assert "tickets, reservations" in complete_response
    assert "does not fake venues" in complete_response

    vague_prompt = "\n".join(
        [
            "Start: Dallas",
            "End: Austin",
            "Budget: $500",
            "Pace: balanced",
            "Recent chat:",
            "Scope AI: what are your interests?",
            "Traveler request: whatever you think",
        ]
    )
    assert "surprise me" in trip_planner._fallback_plan(vague_prompt)

    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "0")
    assert trip_planner.plan_trip("Traveler request: budget check")["steps"] == 0

    class FakeQueue:
        def __init__(self, result):
            self.result = result

        def get_nowait(self):
            if isinstance(self.result, BaseException):
                raise self.result
            return self.result

    class FakeProcess:
        def __init__(self, target, args, daemon):
            self.alive = False

        def start(self):
            pass

        def join(self, timeout=None):
            pass

        def is_alive(self):
            return self.alive

        def terminate(self):
            self.alive = False

    monkeypatch.setenv("AGENT_PLANNER_TIMEOUT_SECONDS", "5")
    monkeypatch.setattr(trip_planner.mp, "Process", FakeProcess)
    monkeypatch.setattr(trip_planner.mp, "Queue", lambda maxsize=1: FakeQueue({"itinerary": "Agent text", "steps": 3}))
    assert trip_planner.plan_trip("Traveler request: hello")["itinerary"] == "Agent text"

    monkeypatch.setattr(trip_planner.mp, "Queue", lambda maxsize=1: FakeQueue({"itinerary": "{\"bad\": true}", "steps": 3}))
    assert trip_planner.plan_trip("Traveler request: hello")["steps"] == 0

    monkeypatch.setattr(trip_planner.mp, "Queue", lambda maxsize=1: FakeQueue(queue.Empty()))
    assert trip_planner.plan_trip("Traveler request: hello")["steps"] == 0


def test_create_trip_planner_with_fake_langgraph(monkeypatch):
    calls = []

    class FakeLLM:
        def __init__(self, **kwargs):
            calls.append(("llm", kwargs))

        def bind_tools(self, tools):
            calls.append(("bind", len(tools)))
            return self

        def invoke(self, messages):
            return SimpleNamespace(content="done", tool_calls=[])

    class FakeToolNode:
        def __init__(self, tools):
            calls.append(("toolnode", len(tools)))

    class FakeGraph:
        def __init__(self, state_type):
            calls.append(("graph", state_type))

        def add_node(self, name, node):
            calls.append(("node", name))

        def add_edge(self, left, right):
            calls.append(("edge", left, right))

        def add_conditional_edges(self, name, fn, mapping):
            calls.append(("conditional", name, sorted(mapping)))

        def compile(self):
            return "compiled"

    monkeypatch.setattr(trip_planner, "LANGGRAPH_AVAILABLE", True)
    monkeypatch.setattr(trip_planner, "ChatOllama", FakeLLM)
    monkeypatch.setattr(trip_planner, "ToolNode", FakeToolNode)
    monkeypatch.setattr(trip_planner, "StateGraph", FakeGraph)

    assert trip_planner.create_trip_planner() == "compiled"
    assert ("bind", len(trip_planner.TOOLS)) in calls

    monkeypatch.setattr(trip_planner, "LANGGRAPH_AVAILABLE", False)
    with pytest.raises(RuntimeError):
        trip_planner.create_trip_planner()


def test_gemini_provider_defaults_and_plan_trip_success(monkeypatch):
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "auto")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-primary")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "gemini-primary,gemini-backup")
    monkeypatch.setenv("GEMINI_MAX_OUTPUT_TOKENS", "2048")

    captured = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Gemini plan"}]}}]}

    def fake_post(url, params=None, json=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        captured["json"] = json
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(trip_planner.requests, "post", fake_post)

    assert trip_planner._configured_provider() == "auto"
    assert trip_planner._should_use_gemini() is True
    assert trip_planner._gemini_model_names() == ["gemini-primary", "gemini-backup"]

    result = trip_planner.plan_trip("Traveler request: Build a weekend entertainment trip", user_id="user-1", start_date="2026-06-01")

    assert result == {"itinerary": "Gemini plan", "steps": 1, "model": "gemini-primary"}
    assert captured["params"] == {"key": "test-key"}
    assert captured["json"]["generationConfig"]["maxOutputTokens"] == 2048
    assert "models/gemini-primary:generateContent" in captured["url"]
    user_text = captured["json"]["contents"][0]["parts"][0]["text"]
    assert "User ID for personalization: user-1" in user_text
    assert "Travel dates starting: 2026-06-01" in user_text


def test_gemini_retries_then_uses_fallback_model(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-primary")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "gemini-backup")

    calls = []

    class RateLimitedResponse:
        status_code = 429

        def raise_for_status(self):
            raise trip_planner.requests.HTTPError(response=self)

    class GoodResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Backup plan"}]}}]}

    def fake_post(url, **kwargs):
        calls.append(url)
        return RateLimitedResponse() if len(calls) == 1 else GoodResponse()

    monkeypatch.setattr(trip_planner.requests, "post", fake_post)

    text, model = trip_planner._generate_with_gemini("Traveler request: plan this")

    assert text == "Backup plan"
    assert model == "gemini-backup"
    assert len(calls) == 2


def test_gemini_nonretryable_and_exhausted_failures(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-primary")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "gemini-backup")

    class BadRequestResponse:
        status_code = 400

        def raise_for_status(self):
            raise trip_planner.requests.HTTPError(response=self)

    monkeypatch.setattr(trip_planner.requests, "post", lambda *args, **kwargs: BadRequestResponse())
    with pytest.raises(trip_planner.requests.HTTPError):
        trip_planner._generate_with_gemini("Traveler request: plan this")

    monkeypatch.setattr(
        trip_planner.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(trip_planner.requests.Timeout("slow")),
    )
    with pytest.raises(RuntimeError, match="network"):
        trip_planner._generate_with_gemini("Traveler request: plan this")

    monkeypatch.setattr(trip_planner, "_generate_with_gemini", lambda *args, **kwargs: ("{}", "gemini-primary"))
    fallback = trip_planner._plan_trip_with_gemini("Traveler request: budget check", start_date="2026-06-01")
    assert fallback["steps"] == 0


def test_gemini_provider_without_key_uses_local_fallback(monkeypatch):
    monkeypatch.setenv("SCOPE_AI_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(trip_planner, "LANGGRAPH_AVAILABLE", False)

    result = trip_planner.plan_trip("Traveler request: budget check")

    assert result["steps"] == 0
    assert result["model"] == "scope-local-copilot"
    assert "budget" in result["itinerary"].lower()
