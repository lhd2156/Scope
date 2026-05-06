import pytest

from app.agents.trip_planner import SYSTEM_MESSAGE, _fallback_plan


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


def test_recommend_spots_accepts_authenticated_subject_without_user_id(client, auth_header):
    response = client.post(
        "/api/intel/recommend/spots",
        json={"likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 2},
        headers=auth_header,
    )

    assert response.status_code == 200
    assert len(response.get_json()["data"]["recommendations"]) == 2


def test_recommend_spots_rejects_user_id_spoofing(client, auth_header):
    response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "other-user", "likedSpotIds": [], "interests": ["culture"], "limit": 2},
        headers=auth_header,
    )

    assert response.status_code == 403
    error = response.get_json()["error"]
    assert error["code"] == "FORBIDDEN"
    assert {detail["field"] for detail in error["details"]} == {"userId"}


def test_vibe_match_accepts_frontend_vibe_alias(client, auth_header):
    response = client.post(
        "/api/intel/vibe-match",
        json={"vibe": "chill outdoor sunset walk", "limit": 2},
        headers=auth_header,
    )

    assert response.status_code == 200
    assert len(response.get_json()["data"]["matches"]) == 2


def test_route_optimizer_accepts_frontend_points_alias(client, auth_header):
    response = client.post(
        "/api/intel/route/optimize",
        json={
            "points": [
                {"id": "point-1", "title": "Start", "latitude": 32.7555, "longitude": -97.3308, "category": "other"},
                {"id": "point-2", "title": "Stop", "latitude": 32.7489, "longitude": -97.3623, "category": "food"},
            ],
            "startLat": 32.7555,
            "startLng": -97.3308,
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert len(payload["orderedSpots"]) == 2
    assert {spot["spotId"] for spot in payload["orderedSpots"]} == {"point-1", "point-2"}


def test_agent_plan_trip_rejects_blank_prompt_with_standard_error(client, auth_header):
    response = client.post("/api/intel/agent/plan-trip", json={"prompt": "   "}, headers=auth_header)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"prompt"}


def test_agent_plan_trip_rejects_user_id_spoofing(client, auth_header):
    response = client.post(
        "/api/intel/agent/plan-trip",
        json={"prompt": "Plan a quick coffee walk", "user_id": "other-user"},
        headers=auth_header,
    )

    assert response.status_code == 403
    error = response.get_json()["error"]
    assert error["code"] == "FORBIDDEN"
    assert {detail["field"] for detail in error["details"]} == {"user_id"}


def test_agent_prompt_instructs_professional_boundaries():
    assert "personal identity" in SYSTEM_MESSAGE
    assert "romantic, sexual, or abusive" in SYSTEM_MESSAGE
    assert "unrelated general trivia" in SYSTEM_MESSAGE
    assert "Before building any itinerary" in SYSTEM_MESSAGE
    assert "surprise me" in SYSTEM_MESSAGE
    assert "Morning, Afternoon, and" in SYSTEM_MESSAGE


def test_agent_fallback_handles_ai_personal_question_professionally():
    answer = _fallback_plan("Traveler request: are u gay")

    assert "sexual orientation" in answer
    assert "Scope AI" in answer
    assert "Say that a little more specifically" not in answer


def test_agent_fallback_redirects_high_stakes_off_topic_questions():
    answer = _fallback_plan("Traveler request: should I invest in crypto")

    assert "qualified professional" in answer
    assert "trip or app context" in answer
    assert "I would handle" not in answer


def test_agent_fallback_asks_for_missing_itinerary_brief_before_building():
    answer = _fallback_plan(
        "\n".join(
            [
                "Current draft:",
                "Start: Fort Worth, TX",
                "End: Austin, TX",
                "Dates: 2026-05-08 to 2026-05-10",
                "Budget: $500 - $1,500",
                "Pace: relaxed",
                "",
                "Traveler request: Build a balanced first draft",
            ]
        )
    )

    assert "I can build that" in answer
    assert "What are your interests" in answer
    assert "- What" not in answer
    assert "Day 1" not in answer


@pytest.mark.parametrize(
    "traveler_reply",
    [
        "idk u wanna help",
        "whatever you think",
        "no preference",
        "you-pick",
        "sounds good",
        "dealer’s choice",
        "I trust you",
    ],
)
def test_agent_fallback_treats_vague_help_reply_as_surprise_me_after_brief_question(traveler_reply):
    answer = _fallback_plan(
        "\n".join(
            [
                "Current draft:",
                "Start: Robert Lee, Texas",
                "End: 177 Kothman Road, La Vernia",
                "Dates: 2026-05-08 to 2026-05-08",
                "Budget: $500 - $1,500",
                "Pace: relaxed",
                "",
                "Recent chat:",
                "User: Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia",
                "Scope AI: I can build that. How many days should I plan for?",
                "",
                f"Traveler request: {traveler_reply}",
            ]
        )
    )

    assert "surprise me" in answer
    assert "2 days" in answer
    assert "Day 1" in answer
    assert "Say that a little more specifically" not in answer


def test_agent_endpoint_short_circuits_personal_questions_before_llm(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.agents.trip_planner.plan_trip", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("plan_trip should not run")))

    response = client.post(
        "/api/intel/agent/plan-trip",
        json={"prompt": "Traveler request: are u gay"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "scope-local-copilot"
    assert "Scope AI" in payload["itinerary"]
    assert "sexual orientation" in payload["itinerary"]
    assert payload["steps"] == 0


def test_agent_endpoint_fallback_asks_for_missing_itinerary_brief(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.agents.trip_planner.plan_trip", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline")))

    response = client.post(
        "/api/intel/agent/plan-trip",
        json={
            "prompt": "\n".join(
                [
                    "Current draft:",
                    "Start: Fort Worth, TX",
                    "End: Austin, TX",
                    "Dates: 2026-05-08 to 2026-05-10",
                    "Budget: $500 - $1,500",
                    "Pace: relaxed",
                    "",
                    "Traveler request: Build a balanced first draft",
                ]
            )
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "scope-local-copilot"
    assert "I can build that" in payload["itinerary"]
    assert "What are your interests" in payload["itinerary"]
    assert "- What" not in payload["itinerary"]
    assert payload["steps"] == 0


def test_agent_endpoint_fallback_treats_vague_help_reply_as_surprise_me(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.agents.trip_planner.plan_trip", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline")))

    response = client.post(
        "/api/intel/agent/plan-trip",
        json={
            "prompt": "\n".join(
                [
                    "Current draft:",
                    "Start: Robert Lee, Texas",
                    "End: 177 Kothman Road, La Vernia",
                    "Dates: 2026-05-08 to 2026-05-08",
                    "Budget: $500 - $1,500",
                    "Pace: relaxed",
                    "",
                    "Recent chat:",
                    "User: Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia",
                    "Scope AI: I can build that. How many days should I plan for?",
                    "",
                    "Traveler request: idk u wanna help",
                ]
            )
        },
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "scope-local-copilot"
    assert "surprise me" in payload["itinerary"]
    assert "Day 1" in payload["itinerary"]
    assert payload["steps"] == 0


def test_agent_endpoint_handles_real_world_location_questions_with_geocode(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.agents.trip_planner.plan_trip", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("plan_trip should not run")))
    monkeypatch.setattr(
        "app.services.geocoding_service.GeocodingService.geocode",
        lambda self, query, limit=3: [
            {
                "placeName": "Fort Worth Botanic Garden",
                "formattedAddress": "3220 Botanic Garden Blvd, Fort Worth, Texas 76107, United States",
                "city": "Fort Worth",
                "country": "United States",
            },
        ],
    )

    response = client.post(
        "/api/intel/agent/plan-trip",
        json={"prompt": "Traveler request: where is 3220 Botanic Garden Blvd"},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["model"] == "scope-location-lookup"
    assert "location match" in payload["itinerary"]
    assert "3220 Botanic Garden Blvd, Fort Worth, Texas 76107, United States" in payload["itinerary"]
    assert "add it as your start, end, or a stop" in payload["itinerary"]
    assert payload["steps"] == 0


def test_recommend_ncf_rejects_non_numeric_limit(client, auth_header):
    response = client.post(
        "/api/intel/recommend/ncf",
        json={"limit": "lots"},
        headers=auth_header,
    )

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"limit"}
