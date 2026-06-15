"""Agentic trip planner API routes."""

import json
import re
from datetime import date

from flask import Blueprint, Response, current_app, g, jsonify, request, stream_with_context

from app.auth import require_auth
from app.extensions import limiter
from app.rate_limit import rate_limited
from app.responses import error_response
from app.schemas import AgentPlanTripRequestSchema, AgentTripChatRequestSchema
from app.services.geocoding_service import GeocodingService

bp = Blueprint("agent", __name__, url_prefix="/api/intel/agent")
schema = AgentPlanTripRequestSchema()
trip_chat_schema = AgentTripChatRequestSchema()
LOCATION_LOOKUP_PATTERN = re.compile(
    r"^(?:where is|where's|where are|locate|what(?:'s| is) the address(?: for| of)?|address(?: for| of)|directions to|how do i get to)\s+(.+)$",
    flags=re.IGNORECASE,
)
APP_UI_LOOKUP_PATTERN = re.compile(
    r"\b(app|screen|button|click|tap|ui|search bar|profile|notifications?|chat bar|route canvas|image icon|add start|add end|start point|end point)\b",
    flags=re.IGNORECASE,
)
SELF_LOCATION_PATTERN = re.compile(
    r"\b(where am i|what is my location|what'?s my location|current location|my location)\b",
    flags=re.IGNORECASE,
)
STREET_ADDRESS_PATTERN = re.compile(
    r"\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,6}\s+"
    r"(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|parkway|pkwy|"
    r"highway|hwy|trail|trl|terrace|ter|plaza|plz|farm(?:\s+to\s+market|-to-market)|fm|county road|cr|route)\b",
    flags=re.IGNORECASE,
)


def _read_prompt_line(prompt: str, label: str) -> str:
    matched = re.search(rf"^{label}:\s*(.+)$", prompt, flags=re.IGNORECASE | re.MULTILINE)
    return matched.group(1).strip() if matched else ""


def _read_traveler_request(prompt: str) -> str:
    matched = re.search(r"Traveler request:\s*([\s\S]+)$", prompt, flags=re.IGNORECASE)
    return matched.group(1).strip() if matched else prompt.strip()


def _read_recent_chat(prompt: str) -> str:
    matched = re.search(r"^Recent chat:\s*([\s\S]*?)(?=\nTraveler request:|$)", prompt, flags=re.IGNORECASE | re.MULTILINE)
    return matched.group(1).strip() if matched else ""


def _is_itinerary_build_request(value: str) -> bool:
    return bool(
        re.search(r"\b(build|generate|make|create)\b.*\b(itinerary|plan|route|first draft|weekend)\b", value, flags=re.IGNORECASE)
        or re.search(r"\b(balanced first draft|first itinerary|starter itinerary)\b", value, flags=re.IGNORECASE)
    )


def _parse_trip_duration_days(prompt: str, dates: str) -> int | None:
    duration_line = _read_prompt_line(prompt, "Trip duration")
    duration_match = re.search(r"\b(\d+)\s+day", duration_line, flags=re.IGNORECASE)
    if duration_match:
        parsed = int(duration_match.group(1))
        return parsed if parsed > 0 else None

    date_match = re.search(r"(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})", dates, flags=re.IGNORECASE)
    if not date_match:
        return None

    try:
        start = date.fromisoformat(date_match.group(1))
        end = date.fromisoformat(date_match.group(2))
    except ValueError:
        return None

    if end < start:
        return None

    return (end - start).days + 1


def _has_travel_party_brief(prompt: str) -> bool:
    travelers = _read_prompt_line(prompt, "Travelers")
    travel_party = _read_prompt_line(prompt, "Travel party")
    try:
        if int(travelers) > 0:
            return True
    except (TypeError, ValueError):
        pass

    return bool(re.search(r"\b(solo|couple|pair|group|family|friends?|travelers?)\b", travel_party, flags=re.IGNORECASE))


def _missing_itinerary_brief_questions(prompt: str, start: str, end: str, dates: str, pace: str, interests: str) -> list[str]:
    questions: list[str] = []
    duration_days = _parse_trip_duration_days(prompt, dates)

    if not start:
        questions.append("What destination(s) are you visiting? Give me the start and finish, or the city/region for a one-place trip.")
    if not duration_days or duration_days <= 1:
        questions.append("How many days is the trip?")
    if not interests.strip():
        questions.append("What are your interests: food, nightlife, nature, culture, shopping, entertainment, adventure, or something else?")
    if not pace.strip():
        questions.append("Do you want the pace packed, balanced, or relaxed?")
    if not _has_travel_party_brief(prompt):
        questions.append("Who are you traveling with: solo, couple, group, or family?")

    return questions


def _missing_itinerary_brief_response(questions: list[str]) -> str:
    return f"I can build that. {questions[0] if questions else 'What kind of trip should this feel like?'}"


def _is_vague_brief_reply(value: str) -> bool:
    normalized = re.sub(r"[^\w'\s]+", " ", value.strip().lower().replace("’", "'"))
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if re.search(
        r"\b(?:\d{1,2}\s*(?:day|days|d)|weekend|food|restaurants?|coffee|cafes?|culture|museums?|art|history|nature|parks?|trails?|hikes?|adventure|nightlife|bars?|shopping|entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|scenic|views?|relaxed|chill|balanced|moderate|packed|busy|solo|alone|couple|partner|family|kids?|children|group|friends?)\b",
        normalized,
    ):
        return False

    return bool(
        re.search(r"\b(?:idk|idc|dunno|whatever|anything|anywhere|any|sure|yeah|yes|yep|ok|okay|fine|alright|meh)\b", normalized)
        or re.search(
            r"\b(?:i\s*(?:dont|don't|do\s*not)\s*know|(?:dont|don't|do\s*not)\s*know|i\s*(?:dont|don't|do\s*not)\s*care|(?:dont|don't|do\s*not)\s*care|not\s*sure|unsure|no\s*(?:idea|clue|preference|prefs?)|not\s*picky|doesn'?t\s*matter|does\s*not\s*matter|surprise\s*(?:me|us)|you\s*(?:choose|pick|decide|plan)|u\s*(?:choose|pick|decide|plan)|you\s*got\s*it|go\s*for\s*it|sounds\s*good|works\s*for\s*me|do\s*your\s*thing|make\s*it\s*good|best\s*option|whatever\s*you\s*(?:think|want|recommend)|anything\s*works|any\s*works|any\s*is\s*fine|i'?m\s*open|im\s*open|open\s*to\s*anything|dealer'?s?\s*choice|up\s*to\s*you|your\s*call|i\s*guess|i\s*trust\s*you|trust\s*you|you\s*know\s*best|help\s*me|just\s*help|u\s*wanna\s*help|you\s*wanna\s*help|pick\s*for\s*me|choose\s*for\s*me|plan\s*it|build\s*it|send\s*it)\b",
            normalized,
        )
    )


def _has_pending_itinerary_brief(prompt: str, recent_chat: str) -> bool:
    text = f"{recent_chat}\n{prompt}"
    return bool(
        re.search(
            r"Scope AI:\s*.*(?:how many days|what kind of trip|what are your interests|what pace|who is coming|who are you traveling|what destination)",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
    )


def _has_pending_duration_brief(prompt: str, recent_chat: str) -> bool:
    text = f"{recent_chat}\n{prompt}"
    return bool(re.search(r"Scope AI:\s*.*how many days", text, flags=re.IGNORECASE | re.DOTALL))


def _parse_pending_duration_reply(value: str) -> int | None:
    normalized = value.strip()
    matched = re.search(r"\b(\d{1,2})\s*(?:day|days|d)?\b", normalized, flags=re.IGNORECASE)
    if not matched:
        return None

    parsed = int(matched.group(1))
    return parsed if 1 <= parsed <= 30 else None


def _smart_default_itinerary_response(route: str, budget: str, pace: str) -> str:
    return "\n".join(
        [
            f'For you: I will treat that as "surprise me" and move forward with a balanced weekend plan for {route}.',
            "Smart defaults:",
            "- Length: 2 days, since you were not sure.",
            "- Interests: food, culture, and key sights.",
            f"- Pace: {pace or 'balanced'}, with enough breathing room to keep it usable.",
            f"- Budget guardrail: {budget}.",
            "Day 1:",
            "- Morning: start with the strongest landmark or scenic anchor near the route start.",
            "- Afternoon: add a local lunch stop, then one culture or history stop that fits the drive direction.",
            "- Evening: land near the overnight area with an easy dinner instead of a late detour.",
            "Day 2:",
            "- Morning: use the first stop for a must-see or photo-friendly place before crowds build.",
            "- Afternoon: keep the drive practical and add one hidden-gem stop close to the route.",
            "- Evening: finish near the destination with dinner or a relaxed walkable stop.",
        ]
    )


def _duration_reply_itinerary_response(route: str, budget: str, pace: str, duration_days: int) -> str:
    lines = [
        f"Got it. I will treat that as {duration_days} day{'s' if duration_days != 1 else ''} for {route}.",
        "Build guardrails:",
        f"- Length: {duration_days} day{'s' if duration_days != 1 else ''}.",
        f"- Pace: {pace or 'balanced'}, with sparse route days kept grounded instead of collapsed.",
        f"- Budget guardrail: {budget}.",
    ]

    for day_number in range(1, duration_days + 1):
        lines.extend([
            f"Day {day_number}:",
            "- Keep the route practical and add only stops the live route can support.",
        ])

    return "\n".join(lines)


def _complete_result(itinerary: str, model: str = "scope-local-copilot") -> dict:
    return {
        "itinerary": itinerary,
        "steps": 0,
        "model": model,
    }


def _extract_location_lookup_query(request_text: str) -> str | None:
    normalized = re.sub(r"\s+", " ", request_text).strip()
    if not normalized or APP_UI_LOOKUP_PATTERN.search(normalized) or SELF_LOCATION_PATTERN.search(normalized):
        return None

    if STREET_ADDRESS_PATTERN.search(normalized):
        return normalized.rstrip("?.! ")

    matched = LOCATION_LOOKUP_PATTERN.match(normalized)
    if not matched:
        return None

    query = re.sub(r"^(?:the|a|an)\s+", "", matched.group(1).strip(), flags=re.IGNORECASE).rstrip("?.! ")
    if not query or re.search(r"\b(stop\s+\d+|route start|route end|start point|end point|midpoint|my route|this route)\b", query, flags=re.IGNORECASE):
        return None

    return query


def _location_lookup_response(request_text: str) -> dict | None:
    query = _extract_location_lookup_query(request_text)
    if not query:
        return None

    results = GeocodingService().geocode(query, limit=3)
    if not results:
        return _complete_result(
            f'I could not place "{query}" yet. Add a city, region, or fuller address and I will try again.',
            model="scope-location-lookup",
        )

    best_match = results[0]
    best_label = str(best_match.get("formattedAddress") or best_match.get("address") or best_match.get("placeName") or query).strip()
    area = ", ".join(part for part in [best_match.get("city"), best_match.get("country")] if part)
    lines = [
        f'I found {len(results)} location match{"es" if len(results) != 1 else ""} for "{query}".',
        "",
        f"Best match: {best_label}.",
    ]
    if area and area.lower() not in best_label.lower():
        lines.append(f"Area: {area}.")
    lines.append("If that is the place you mean, add it as your start, end, or a stop and I can work it into the route.")
    if len(results) > 1:
        lines.append("If you meant a different one, add the city or state to narrow it.")

    return _complete_result("\n".join(lines), model="scope-location-lookup")


def _fallback_budget_lines(route: str, budget: str, dates: str, pace: str) -> list[str]:
    return [
        f"I would keep {route} inside {budget} by treating the top number as your hard cap, not the goal.",
        "",
        f"For {dates}, keep the pace {pace} and add only low-detour stops: fuel, food, rest, or one short scenic break.",
        "Avoid paid attractions or long side quests unless they replace another stop.",
        "If the route needs a midpoint, pick one stop that handles food/restrooms/views in the same area instead of stacking multiple stops.",
    ]


def _fallback_tighten_lines(route: str, pace: str) -> list[str]:
    return [
        f"I would tighten {route} around one clear route purpose.",
        "",
        f"At a {pace} pace, cut anything that does not shorten the drive, feed/rest the group, or create a standout memory.",
        "Use one midpoint stop, then keep the final leg clean. If a stop adds backtracking, replace it instead of adding more.",
    ]


def _fallback_timing_lines(route: str, dates: str, pace: str) -> list[str]:
    return [
        f"I would check {route} against {dates} as a {pace} plan.",
        "",
        "Do not stack multiple optional stops on the longest driving day.",
        "Build around departure time, weather/border buffers if relevant, and one practical midpoint break.",
    ]


def _fallback_midpoint_lines(route: str, budget: str, interests: str) -> list[str]:
    return [
        f"I would only add a midpoint on {route} if it saves energy or solves a real need.",
        "",
        f"Best fit: one {interests} stop that also covers food, restrooms, fuel, or a short walk.",
        f"Budget guardrail: keep it inside {budget} with a free viewpoint, casual food stop, public park, or quick town-center break.",
        "Skip anything that adds more than about 20 minutes off-route unless it becomes the main stop.",
    ]


def _fallback_weekend_lines(route: str, budget: str, pace: str, interests: str) -> list[str]:
    return [
        f"I would make {route} a simple {pace} weekend route.",
        "",
        "Day 1: travel, take one easy food or rest stop, then arrive without adding extra detours.",
        f"Day 2: choose one {interests} anchor and one nearby flexible stop.",
        "Final leg: keep it light, with one practical break only if it helps the drive.",
        f"Keep {budget} as the cap by choosing free, scenic, public, or casual stops first.",
    ]


def _fallback_recommendation_lines(route: str, budget: str, pace: str, interests: str) -> list[str]:
    return [
        f"For {route}, I would keep your next move narrow and useful.",
        "",
        f"Add one {interests} stop that sits close to the route and fits a {pace} pace.",
        f"Keep {budget} as the cap, then avoid adding another stop unless it replaces a weaker one.",
        "After that, build the itinerary so timing and driving legs can be checked together.",
    ]


def _fallback_general_lines(request_text: str, route: str, budget: str, pace: str, interests: str) -> list[str]:
    return [
        f"I would handle \"{request_text}\" as a focused planning pass for {route}.",
        "",
        f"Use {budget} as the guardrail and keep the rhythm {pace}.",
        f"Prioritize {interests}, then add only stops that make the route easier or more memorable.",
    ]


def _fallback_response_lines(
    *,
    request_text: str,
    normalized_request: str,
    route: str,
    dates: str,
    budget: str,
    pace: str,
    interests: str,
) -> list[str]:
    if re.search(r"\b(budget|inside|under|cap|\$|cost|spend)\b", normalized_request):
        return _fallback_budget_lines(route, budget, dates, pace)

    if re.search(r"\b(tighten|remove filler|filler|clean up|simplify|rebalance)\b", normalized_request):
        return _fallback_tighten_lines(route, pace)

    if re.search(r"\b(timing|time|date|schedule|works?|pace)\b", normalized_request):
        return _fallback_timing_lines(route, dates, pace)

    if re.search(r"\b(stop|midpoint|middle|halfway|between|on the way|en route)\b", normalized_request):
        return _fallback_midpoint_lines(route, budget, interests)

    if re.search(r"\b(weekend|simple|easy)\b", normalized_request):
        return _fallback_weekend_lines(route, budget, pace, interests)

    if re.search(r"\b(suggest|recommend|ideas?|what should)\b", normalized_request):
        return _fallback_recommendation_lines(route, budget, pace, interests)

    return _fallback_general_lines(request_text, route, budget, pace, interests)


def _fallback_plan(prompt: str, start_date: str | None = None) -> dict:
    """Return a deterministic planning answer if the local agent cannot boot."""
    start = _read_prompt_line(prompt, "Start")
    end = _read_prompt_line(prompt, "End")
    dates = _read_prompt_line(prompt, "Dates") or start_date or "the selected dates"
    budget = _read_prompt_line(prompt, "Budget") or "the current budget"
    raw_pace = _read_prompt_line(prompt, "Pace")
    pace = raw_pace or "balanced"
    raw_interests = _read_prompt_line(prompt, "Interests")
    interests = raw_interests or "the selected trip vibes"
    request_text = _read_traveler_request(prompt)
    recent_chat = _read_recent_chat(prompt)
    route = f"{start} to {end}" if start and end else start or end or "this draft route"
    normalized_request = request_text.lower()
    pending_duration_days = _parse_pending_duration_reply(request_text) if _has_pending_duration_brief(prompt, recent_chat) else None

    if pending_duration_days:
        return _complete_result(_duration_reply_itinerary_response(route, budget, pace, pending_duration_days))

    if _is_vague_brief_reply(request_text) and _has_pending_itinerary_brief(prompt, recent_chat):
        return _complete_result(_smart_default_itinerary_response(route, budget, pace))

    if _is_itinerary_build_request(request_text):
        missing_questions = _missing_itinerary_brief_questions(prompt, start, end, dates, raw_pace, raw_interests)
        if missing_questions:
            return _complete_result(_missing_itinerary_brief_response(missing_questions))

    lines = _fallback_response_lines(
        request_text=request_text,
        normalized_request=normalized_request,
        route=route,
        dates=dates,
        budget=budget,
        pace=pace,
        interests=interests,
    )

    return _complete_result("\n".join(lines))


@bp.route("/plan-trip", methods=["POST"])
@limiter.limit("5/minute")
@rate_limited
@require_auth
def plan():
    """Plan a trip using the AI agent."""
    data = schema.load(request.get_json() or {})
    subject = str((g.current_user or {}).get("sub") or "")
    if not subject:
        return error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))

    if data.get("user_id") and data["user_id"] != subject:
        return error_response(
            403,
            "FORBIDDEN",
            "Insufficient permissions",
            [{"field": "user_id", "message": "Must match authenticated user"}],
            getattr(g, "trace_id", None),
        )

    from app.agents.trip_planner import _professional_boundary_response

    traveler_request = _read_traveler_request(data["prompt"])
    boundary_response = _professional_boundary_response(traveler_request)
    if boundary_response:
        return jsonify(_complete_result(boundary_response))

    location_response = _location_lookup_response(traveler_request)
    if location_response:
        return jsonify(location_response)

    try:
        from app.agents.trip_planner import plan_trip

        start_date = data["start_date"].isoformat() if data.get("start_date") else None
        result = plan_trip(
            prompt=data["prompt"],
            user_id=subject,
            start_date=start_date,
        )
    except Exception:
        current_app.logger.exception("Scope agent planner failed; returning local fallback")
        result = _fallback_plan(data["prompt"], data.get("start_date").isoformat() if data.get("start_date") else None)

    return jsonify(result)


@bp.route("/trip-chat", methods=["POST"])
@limiter.limit("10/minute")
@rate_limited
@require_auth
def trip_chat():
    """Enterprise Scope AI trip planner chat contract."""
    data = trip_chat_schema.load(request.get_json() or {})
    subject = str((g.current_user or {}).get("sub") or "")
    if not subject:
        return error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))

    if data.get("user_id") and data["user_id"] != subject:
        return error_response(
            403,
            "FORBIDDEN",
            "Insufficient permissions",
            [{"field": "user_id", "message": "Must match authenticated user"}],
            getattr(g, "trace_id", None),
        )

    from app.agents.trip_ai_orchestrator import TripAiOrchestrator

    orchestrator = TripAiOrchestrator()
    if data.get("responseMode") == "stream":
        def generate():
            for event in orchestrator.stream_events(data, user_id=subject):
                yield json.dumps(event, separators=(",", ":")) + "\n"

        return Response(
            stream_with_context(generate()),
            mimetype="application/x-ndjson",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    return jsonify(orchestrator.chat(data, user_id=subject))
