"""LangGraph agentic trip planner - multi-step reasoning over Scope data."""

import logging
import multiprocessing as mp
import os
import queue
import re
from dataclasses import dataclass
from typing import Annotated, TypedDict
from urllib.parse import quote

import requests

try:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_ollama import ChatOllama
    from langgraph.graph import END, START, StateGraph
    from langgraph.graph.message import add_messages
    from langgraph.prebuilt import ToolNode
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    END = "__end__"
    START = "__start__"
    ChatOllama = None
    StateGraph = None
    ToolNode = None

    @dataclass(slots=True)
    class _FallbackMessage:
        content: str

    HumanMessage = _FallbackMessage
    SystemMessage = _FallbackMessage

    def add_messages(messages):
        return messages

from app.agents.tools import (
    calculate_distance,
    get_spot_reviews,
    get_weather,
    predict_trip_cost,
    search_nearby,
    search_spots,
)
from app.agents.trip_planner_heuristics import (
    _infer_interests_from_text,
    _infer_pace_from_text,
    _is_itinerary_build_request,
    _missing_itinerary_brief_questions,
    _missing_itinerary_brief_response,
    _parse_trip_duration_days,
    _read_prompt_line,
    _read_recent_chat,
    _read_traveler_request,
)

TOOLS = [search_spots, search_nearby, get_spot_reviews, get_weather, calculate_distance, predict_trip_cost]

logger = logging.getLogger(__name__)

SYSTEM_MESSAGE = """IDENTITY: You are Scope AI, an active route-planning copilot inside Scope. You guide the user toward a complete personalized route. You are not a passive search tool.

TONE: Warm, direct, brief. No filler openers. Lead with the answer or suggestion, then follow up. Sound like a knowledgeable local friend.

TOOLS: Use internal place data, reviews, nearby search, weather, distance, and cost tools when they help. Pull from internal place data and trending signals, then rank by the traveler's interests, pace, budget, route, and existing stops.

PLANNING QUALITY: First extract the hard constraints: route, dates, duration, interests, pace, budget, travelers, existing stops, accessibility/family needs, and must-avoid items. For exact venues, hours, ticket prices, reservations, weather, traffic, or drive times, use tools or say the item needs live verification. If tools are unavailable, give a plan shape using the planner state and label estimates clearly. Keep itinerary answers compact: guardrails, day-by-day anchors, verification items, and one next action.

FOLLOW-UP LOGIC: Ask exactly one follow-up question when context is missing. Stop at the first gap in this priority order:
1. No destination or final destination -> ask where they want to go.
2. No start point -> ask where they are starting from.
3. No interests -> ask what kind of experience they want: food, outdoors, culture, entertainment, or nightlife.
4. Duration unknown -> ask how many days.
5. Budget unclear -> check the injected planner context before asking.
Never ask something already answered in Planner context or Recent chat. Never ask the same question twice. Never end a response with only a question.

SUGGESTIONS: Surface the top 3-5 places when enough context exists. Always explain why each place fits this specific trip. Do not suggest over-budget places without flagging the budget risk. Do not re-suggest stops already on the map.

ANSWER EVERYTHING: Answer travel questions directly: transit, weather by season, dietary options, safety, accommodation, what is near a stop, what locals eat, timing, budget, and Scope app flow. If data is missing, answer from knowledge and note the gap. For unrelated general trivia, homework, code, news, medical, legal, financial, or emergency questions, do not pretend to be a general assistant; redirect to trusted/professional sources and connect back to Scope planning if useful.

MAP ACTIONS: Add, remove, or reorder map markers only after explicit user confirmation. When the user confirms adding a place, emit one structured JSON block at the very end of the response wrapped in [SCOPE_ACTION]...[/SCOPE_ACTION]. Supported action values are add_marker, remove_marker, and reorder_stops. Include place_name, address, stop_type (start, stop, or destination), day, order, and note. Omit coordinates if unsure; Scope will geocode from address. Never emit this block without user confirmation. When unsure, ask: "Want me to drop that on your map?"

CHIPS: After every response, emit 2-3 contextual follow-up prompts wrapped in [CHIPS]...[/CHIPS]. Make them specific to the current conversation state, not generic.

ITINERARY MODE: When 3+ stops are on the map, proactively offer to organize them day-by-day. On confirmation, output readable itinerary text and emit a reorder_stops action. When writing itinerary text, use Morning, Afternoon, and Evening slots, real places, practical travel time, and notes for must-sees versus hidden gems.

Before building any itinerary, confirm destination(s), trip length in days, interests, travel pace, and who is traveling. Treat details as answered when they appear in Planner context, Recent chat, or the user request. If the traveler replies "idk", "not sure", "whatever", "u wanna help", or anything similarly vague after a route brief question, treat that as "surprise me": choose smart defaults and keep moving.

NEVER:
- Add a marker without explicit user confirmation.
- Give a generic place list without destination plus at least one preference.
- Re-suggest stops already on the map.
- Expose internal model names, implementation labels, debug tags, or tool chatter.
- Output JSON except inside a confirmed [SCOPE_ACTION] block.

Professional boundary rules:
- If the user asks personal identity questions about you, say those labels or relationships do not apply because you are Scope AI, then redirect to Scope trip/app help.
- If the user sends romantic, sexual, or abusive prompts, stay calm, set a short professional boundary, and ask what Scope trip/app issue should be fixed.
- For unclear one- or two-word prompts, ask one concise clarifying question instead of guessing."""


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


@dataclass(frozen=True, slots=True)
class _FallbackPlanContext:
    prompt: str
    start: str
    end: str
    dates: str
    budget: str
    effective_pace: str
    effective_interests: str
    pace: str
    interests: str
    request_text: str
    recent_chat: str
    route: str
    normalized_request: str


def _env_int(name: str, default: int) -> int:
    """Parse optional integer tuning values from the environment."""
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    """Parse optional float tuning values from the environment."""
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _configured_provider() -> str:
    provider = os.environ.get("SCOPE_AI_PROVIDER", "auto").strip().lower()
    return provider if provider in {"auto", "gemini", "ollama"} else "auto"


def _should_use_gemini() -> bool:
    provider = _configured_provider()
    return provider in {"auto", "gemini"} and bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _gemini_model_names() -> list[str]:
    configured = [
        os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        *os.environ.get(
            "GEMINI_FALLBACK_MODELS",
            "gemini-2.5-flash-lite,gemini-2.0-flash",
        ).split(","),
    ]
    models: list[str] = []
    for model in configured:
        clean_model = model.strip()
        if clean_model and clean_model not in models:
            models.append(clean_model)
    return models or ["gemini-2.5-flash"]


def _gemini_endpoint(model_name: str) -> str:
    model = model_name.removeprefix("models/")
    encoded_model = quote(model, safe="")
    base_url = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
    return f"{base_url}/models/{encoded_model}:generateContent"


def _extract_gemini_text(payload: dict) -> str:
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(str(part.get("text") or "").strip() for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned no text")
    return text


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


def _format_interest_phrase(interests: str) -> str:
    cleaned = (interests or "").strip()
    if not cleaned or cleaned == "the selected trip vibes":
        return "good-fit"
    return re.sub(r",\s*([^,]+)$", r" or \1", cleaned)


def _parse_planner_stop_names(prompt: str) -> list[str]:
    matched = re.search(r"^Stops:\s*([\s\S]*?)(?=\n[A-Z][A-Za-z ]+:|$)", prompt, flags=re.IGNORECASE | re.MULTILINE)
    if not matched:
        return []

    stops: list[str] = []
    for raw_line in matched.group(1).splitlines():
        cleaned = re.sub(r"^\d+\.\s*", "", raw_line).strip()
        cleaned = re.sub(r"\s+\([^)]*\)\s*$", "", cleaned).strip()
        if cleaned:
            stops.append(cleaned)
    return stops[:12]


def _travelers_label(prompt: str) -> str:
    travel_party = _read_prompt_line(prompt, "Travel party")
    if travel_party:
        return travel_party

    travelers = _read_prompt_line(prompt, "Travelers")
    try:
        count = int(travelers)
    except (TypeError, ValueError):
        count = 0

    if count > 0:
        return "solo traveler" if count == 1 else f"{count} travelers"

    request_text = _read_traveler_request(prompt)
    if re.search(r"\b(family|kids?|children)\b", request_text, flags=re.IGNORECASE):
        return "family"
    if re.search(r"\b(couple|pair|partner)\b", request_text, flags=re.IGNORECASE):
        return "couple"
    if re.search(r"\b(solo|alone)\b", request_text, flags=re.IGNORECASE):
        return "solo traveler"
    if re.search(r"\b(group|friends?)\b", request_text, flags=re.IGNORECASE):
        return "group"

    return "travel party not locked"


def _concise_plan_day_count(prompt: str, dates: str) -> int:
    parsed = _parse_trip_duration_days(prompt, dates)
    return min(parsed, 14) if parsed and parsed > 0 else 2


def _pace_stop_target(pace: str) -> str:
    if re.search(r"packed|busy|fast|full", pace or "", flags=re.IGNORECASE):
        return "up to 3 meaningful stops per full day, with drive time checked before adding more"
    if re.search(r"relaxed|slow|chill|easy", pace or "", flags=re.IGNORECASE):
        return "1 main anchor plus 1 flexible backup per day"
    return "2 main anchors per full day, with one practical break folded in"


def _interest_anchor(interests: str, day_number: int) -> str:
    normalized = (interests or "").lower()
    anchors: list[str] = []

    if re.search(r"\b(entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b", normalized):
        anchors.append("one verified entertainment anchor such as bowling, an arcade, a theater, or a theme park")
    if re.search(r"\b(food|restaurant|coffee|cafe|lunch|dinner|breakfast)\b", normalized):
        anchors.append("one food stop that also works as the real break")
    if re.search(r"\b(culture|museum|art|history|historic)\b", normalized):
        anchors.append("one culture or history stop with enough time to actually enjoy it")
    if re.search(r"\b(nature|scenic|view|park|trail|hike|outdoor)\b", normalized):
        anchors.append("one scenic or outdoor stop close to the route")
    if re.search(r"\b(shopping|market|mall|boutique)\b", normalized):
        anchors.append("one shopping district or market stop with easy parking")
    if re.search(r"\b(nightlife|bar|club|music)\b", normalized):
        anchors.append("one nightlife option only after arrival timing is comfortable")
    if re.search(r"\b(adventure|activity|activities)\b", normalized):
        anchors.append("one active stop that does not overload the drive day")

    if not anchors:
        anchors.append("one good-fit stop close to the route")
    return anchors[(day_number - 1) % len(anchors)]


def _should_return_concise_itinerary(request_text: str, normalized_request: str) -> bool:
    if not _is_itinerary_build_request(request_text):
        return False
    if not re.search(r"\b(weekend|simple|easy)\b", normalized_request):
        return True
    return bool(re.search(r"\b(itinerary|plan|route|draft)\b", normalized_request))


def _concise_itinerary_response(prompt: str, route: str, dates: str, budget: str, pace: str, interests: str) -> str:
    day_count = _concise_plan_day_count(prompt, dates)
    visible_day_count = min(day_count, 5)
    stop_names = _parse_planner_stop_names(prompt)
    interest_phrase = _format_interest_phrase(interests)
    travelers = _travelers_label(prompt)
    lines = [
        f"For you: I can turn {route} into a concise {day_count}-day plan from the context you gave me.",
        "Plan guardrails:",
        f"- Dates: {dates}.",
        f"- Pace: {pace}; target {_pace_stop_target(pace)}.",
        f"- Budget: {budget}; treat this as a cap, not a goal to spend.",
        f"- Vibes: {interest_phrase}.",
        f"- Travelers: {travelers}.",
    ]

    for day_number in range(1, visible_day_count + 1):
        existing_stop = stop_names[day_number - 1] if day_number - 1 < len(stop_names) else ""
        if day_number == 1:
            travel_shape = "Start with the cleanest travel leg, then add only one optional stop after timing is known."
        elif day_number == visible_day_count:
            travel_shape = "Protect the arrival window and keep the final leg easy to finish."
        else:
            travel_shape = "Use this as the main experience day, not another overloaded travel day."

        lines.extend([
            f"Day {day_number}:",
            f"- Anchor: {existing_stop or _interest_anchor(interests, day_number)}.",
            f"- {travel_shape}",
            "- Fold food, restrooms, fuel, or charging into the same area whenever possible.",
        ])

    if day_count > visible_day_count:
        lines.extend([
            "Later days:",
            f"- Repeat the same pattern for days {visible_day_count + 1}-{day_count}: one main anchor, one practical break, and one flexible backup.",
        ])

    lines.extend([
        "Verify before commit:",
        "- Use live route timing before locking optional stops.",
        "- Verify hours, tickets, reservations, parking, and weather for exact venues.",
        "- Use the stops already on the canvas first; replace weak ones instead of stacking more." if stop_names else "- Search live places before adding exact stop names, so Scope does not fake venues.",
        "Next action:",
        "- Build the live itinerary from this shape, then tighten any day that has too much drive time, cost, or backtracking.",
    ])

    return "\n".join(lines)


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


def _normalize_request(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s']", " ", value.lower())).strip()


def _is_scope_domain_request(normalized: str) -> bool:
    return bool(
        re.search(
            r"\b(scope|app|screen|button|click|tap|ui|planner|map|trip|travel|route|road trip|"
            r"itinerary|spot|spots|place|places|experience|experiences|destination|destinations|city|visit|go to|stay in|drive|flight|hotel|"
            r"restaurant|food|entertainment|bowling|arcade|theme park|amusement park|budget|pace|timing|schedule|start|end|stop|midpoint|address|"
            r"street|road|avenue|county road|farm to market|photo|photos|image|images|review|reviews|friend|friends|"
            r"notification|notifications|profile|search|weather|safe|safety|group|weekend|vacation)\b",
            normalized,
        )
    )


def _professional_boundary_response(request_text: str) -> str | None:
    normalized = _normalize_request(request_text)
    if not normalized:
        return None

    if re.search(r"\b(i want to (die|kill myself|hurt myself)|suicide|self harm|end my life|hurt myself)\b", normalized):
        return (
            "I am sorry you are dealing with that. If you might hurt yourself or someone else, call emergency services now. "
            "In the U.S. or Canada, call or text 988 for immediate crisis support. If you can, move near another person and tell them you need help right now."
        )

    if re.search(r"\b(fuck you|shut up|you suck|you are useless|you're useless|idiot|moron|dumbass|bitch|asshole)\b", normalized):
        return (
            "I will keep it respectful and useful. Tell me what needs fixing: the route, app flow, my last answer, budget, timing, stops, or search."
        )

    if (
        re.search(r"\b(send|show|give).*\b(nudes?|naked|porn|explicit pics?)\b", normalized)
        or re.search(r"\b(are|r)\s+(you|u)\s+(horny|sexy|hot)\b", normalized)
        or re.search(r"\b(date|kiss|marry|sleep with|hook up with)\s+(me|you)\b", normalized)
        or re.search(r"\b(i love you|love you|love u|luv you|be my girlfriend|be my boyfriend)\b", normalized)
    ):
        return (
            "I keep things professional. I cannot be romantic or sexual, but I can help with Scope trips, date-night spots, routes, budgets, timing, and app questions."
        )

    if (
        re.search(
            r"\b(are|r)\s+(you|u)\s+(gay|straight|bi|bisexual|lesbian|trans|transgender|queer|"
            r"asexual|male|female|a man|a woman|a boy|a girl|black|white|asian|latino|"
            r"hispanic|christian|muslim|jewish|religious|liberal|conservative|democrat|"
            r"republican|single|married|dating)\b",
            normalized,
        )
        or re.search(r"\b(what'?s|what is)\s+your\s+(sexuality|sexual orientation|gender|race|ethnicity|religion|politics|political party|age)\b", normalized)
        or re.search(r"\b(do|did)\s+(you|u)\s+(have|got|want)\s+(a\s+)?(girlfriend|boyfriend|partner|wife|husband|kids|children)\b", normalized)
        or re.search(r"\b(who did you vote for|are you into men|are you into women|you gay|u gay)\b", normalized)
    ):
        return (
            "I do not have a sexual orientation, gender, race, religion, politics, or personal relationships. "
            "I am Scope AI, and I will keep it professional: trips, spots, routes, budgets, timing, images, and app help."
        )

    if re.search(r"\b(medical advice|diagnose|prescription|legal advice|lawsuit|eviction|arrested|tax advice|invest|investment|stock|crypto|bet on|gambling)\b", normalized) and not _is_scope_domain_request(normalized):
        return (
            "That is outside what Scope AI should advise on. For medical, legal, tax, investment, or safety-critical decisions, use a qualified professional or current official source. "
            "I can still help with the trip or app context around it."
        )

    word_count = len(normalized.split())
    is_question_like = bool(re.search(r"^(what|who|when|why|how|can|could|would|should|do|does|did|is|are|am|will|write|draft|explain|solve|code|make|tell me|teach me|summarize)\b", normalized) or request_text.strip().endswith("?"))
    if word_count > 3 and is_question_like and not _is_scope_domain_request(normalized):
        return (
            "That is outside Scope trip and app help, so I will keep it professional. "
            "I am best for routes, spots, budgets, timing, photos, search, notifications, and how to use Scope."
        )

    return None


def create_trip_planner():
    """Create and return the LangGraph trip planner agent."""
    if not LANGGRAPH_AVAILABLE or ChatOllama is None or StateGraph is None or ToolNode is None:
        raise RuntimeError("LangGraph planner dependencies are not installed")

    llm = ChatOllama(
        model=os.environ.get("OLLAMA_MODEL", "llama3.2:3b"),
        temperature=0.3,
        base_url=os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434"),
        num_ctx=_env_int("OLLAMA_NUM_CTX", 1024),
        num_predict=_env_int("OLLAMA_NUM_PREDICT", 512),
        num_thread=_env_int("OLLAMA_NUM_THREAD", 4),
        client_kwargs={"timeout": _env_int("OLLAMA_TIMEOUT_SECONDS", 120)},
    ).bind_tools(TOOLS)

    tool_node = ToolNode(TOOLS)

    def agent_node(state: AgentState) -> AgentState:
        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return "end"

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "agent")
    return graph.compile()


def _fallback_plan_context(prompt: str, start_date: str | None = None) -> _FallbackPlanContext:
    start = _read_prompt_line(prompt, "Start")
    end = _read_prompt_line(prompt, "End")
    dates = _read_prompt_line(prompt, "Dates") or start_date or "the selected dates"
    budget = _read_prompt_line(prompt, "Budget") or "the current budget"
    raw_pace = _read_prompt_line(prompt, "Pace")
    raw_interests = _read_prompt_line(prompt, "Interests")
    request_text = _read_traveler_request(prompt)
    effective_pace = raw_pace or _infer_pace_from_text(request_text)
    pace = effective_pace or "balanced"
    effective_interests = raw_interests or _infer_interests_from_text(request_text)
    interests = effective_interests or "the selected trip vibes"
    recent_chat = _read_recent_chat(prompt)
    route = f"{start} to {end}" if start and end else start or end or "this draft route"
    normalized_request = request_text.lower()

    return _FallbackPlanContext(
        prompt=prompt,
        start=start,
        end=end,
        dates=dates,
        budget=budget,
        effective_pace=effective_pace,
        effective_interests=effective_interests,
        pace=pace,
        interests=interests,
        request_text=request_text,
        recent_chat=recent_chat,
        route=route,
        normalized_request=normalized_request,
    )


def _fallback_itinerary_response(ctx: _FallbackPlanContext) -> str | None:
    pending_duration_days = (
        _parse_pending_duration_reply(ctx.request_text)
        if _has_pending_duration_brief(ctx.prompt, ctx.recent_chat)
        else None
    )
    if pending_duration_days:
        return _duration_reply_itinerary_response(ctx.route, ctx.budget, ctx.pace, pending_duration_days)

    if _is_vague_brief_reply(ctx.request_text) and _has_pending_itinerary_brief(ctx.prompt, ctx.recent_chat):
        return _smart_default_itinerary_response(ctx.route, ctx.budget, ctx.pace)

    if _is_itinerary_build_request(ctx.request_text):
        missing_questions = _missing_itinerary_brief_questions(
            ctx.prompt,
            ctx.start,
            ctx.end,
            ctx.dates,
            ctx.effective_pace,
            ctx.effective_interests,
        )
        if missing_questions:
            return _missing_itinerary_brief_response(missing_questions)
        if _should_return_concise_itinerary(ctx.request_text, ctx.normalized_request):
            return _concise_itinerary_response(ctx.prompt, ctx.route, ctx.dates, ctx.budget, ctx.pace, ctx.interests)

    return None


def _budget_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"I would keep {ctx.route} inside {ctx.budget} by treating the top number as your hard cap, not the goal.",
            "",
            f"For {ctx.dates}, keep the pace {ctx.pace} and add only low-detour stops: fuel, food, rest, or one short scenic break.",
            "Avoid paid attractions or long side quests unless they replace another stop.",
            "If the route needs a midpoint, pick one stop that handles food/restrooms/views in the same area instead of stacking multiple stops.",
        ]
    )


def _tighten_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"I would tighten {ctx.route} around one clear route purpose.",
            "",
            f"At a {ctx.pace} pace, cut anything that does not shorten the drive, feed/rest the group, or create a standout memory.",
            "Use one midpoint stop, then keep the final leg clean. If a stop adds backtracking, replace it instead of adding more.",
        ]
    )


def _timing_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"I would check {ctx.route} against {ctx.dates} as a {ctx.pace} plan.",
            "",
            "Do not stack multiple optional stops on the longest driving day.",
            "Build around departure time, weather/border buffers if relevant, and one practical midpoint break.",
        ]
    )


def _midpoint_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"I would only add a midpoint on {ctx.route} if it saves energy or solves a real need.",
            "",
            f"Best fit: one {ctx.interests} stop that also covers food, restrooms, fuel, or a short walk.",
            f"Budget guardrail: keep it inside {ctx.budget} with a free viewpoint, casual food stop, public park, or quick town-center break.",
            "Skip anything that adds more than about 20 minutes off-route unless it becomes the main stop.",
        ]
    )


def _weekend_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"I would make {ctx.route} a simple {ctx.pace} weekend route.",
            "",
            "Day 1: travel, take one easy food or rest stop, then arrive without adding extra detours.",
            f"Day 2: choose one {ctx.interests} anchor and one nearby flexible stop.",
            "Final leg: keep it light, with one practical break only if it helps the drive.",
            f"Keep {ctx.budget} as the cap by choosing free, scenic, public, or casual stops first.",
        ]
    )


def _suggestion_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"For {ctx.route}, I would keep your next move narrow and useful.",
            "",
            f"Add one {ctx.interests} stop that sits close to the route and fits a {ctx.pace} pace.",
            f"Keep {ctx.budget} as the cap, then avoid adding another stop unless it replaces a weaker one.",
            "After that, build the itinerary so timing and driving legs can be checked together.",
        ]
    )


def _default_fallback_response(ctx: _FallbackPlanContext) -> str:
    return "\n".join(
        [
            f"I would handle \"{ctx.request_text}\" as a focused planning pass for {ctx.route}.",
            "",
            f"Use {ctx.budget} as the guardrail and keep the rhythm {ctx.pace}.",
            f"Prioritize {ctx.interests}, then add only stops that make the route easier or more memorable.",
        ]
    )


def _fallback_topic_response(ctx: _FallbackPlanContext) -> str:
    if re.search(r"\b(budget|inside|under|cap|\$|cost|spend)\b", ctx.normalized_request):
        return _budget_fallback_response(ctx)

    if re.search(r"\b(tighten|remove filler|filler|clean up|simplify|rebalance)\b", ctx.normalized_request):
        return _tighten_fallback_response(ctx)

    if re.search(r"\b(timing|time|date|schedule|works?|pace)\b", ctx.normalized_request):
        return _timing_fallback_response(ctx)

    if re.search(r"\b(stop|midpoint|middle|halfway|between|on the way|en route)\b", ctx.normalized_request):
        return _midpoint_fallback_response(ctx)

    if re.search(r"\b(weekend|simple|easy)\b", ctx.normalized_request):
        return _weekend_fallback_response(ctx)

    if re.search(r"\b(suggest|recommend|ideas?|what should)\b", ctx.normalized_request):
        return _suggestion_fallback_response(ctx)

    return _default_fallback_response(ctx)


def _fallback_plan(prompt: str, start_date: str | None = None) -> str:
    """Return a useful itinerary shell if the local LLM is unavailable."""
    ctx = _fallback_plan_context(prompt, start_date)
    boundary_response = _professional_boundary_response(ctx.request_text)
    if boundary_response:
        return boundary_response

    itinerary_response = _fallback_itinerary_response(ctx)
    if itinerary_response:
        return itinerary_response

    return _fallback_topic_response(ctx)


def _agent_context_parts(prompt: str, user_id: str | None = None, start_date: str | None = None) -> list[str]:
    parts = [prompt]
    parts.append(
        "Response style: plain conversational text, speak directly to the traveler as you/your. "
        "For normal answers use 2-4 short sentences; for itinerary builds use compact sections with "
        "guardrails, day anchors, verification items, and one next action. Only use JSON inside "
        "confirmed [SCOPE_ACTION] blocks."
    )
    if start_date:
        parts.append(f"Travel dates starting: {start_date}")
    if user_id:
        parts.append(f"User ID for personalization: {user_id}")
    return parts


def _looks_invalid_itinerary(value: str) -> bool:
    stripped = (value or "").strip()
    return not stripped or stripped.startswith(("{", "["))


def _fallback_result(prompt: str, start_date: str | None = None, model: str = "scope-local-copilot") -> dict:
    return {
        "itinerary": _fallback_plan(prompt, start_date),
        "steps": 0,
        "model": model,
    }


def _generate_with_gemini_model(
    model_name: str,
    prompt: str,
    user_id: str | None = None,
    start_date: str | None = None,
) -> str:
    response = requests.post(
        _gemini_endpoint(model_name),
        params={"key": os.environ.get("GEMINI_API_KEY", "").strip()},
        json={
            "systemInstruction": {"parts": [{"text": SYSTEM_MESSAGE}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "\n".join(_agent_context_parts(prompt, user_id, start_date))}],
                }
            ],
            "generationConfig": {
                "temperature": _env_float("GEMINI_TEMPERATURE", 0.25),
                "maxOutputTokens": _env_int("GEMINI_MAX_OUTPUT_TOKENS", 1536),
            },
        },
        timeout=_env_float("GEMINI_TIMEOUT_SECONDS", 30.0),
    )
    response.raise_for_status()
    return _extract_gemini_text(response.json())


def _generate_with_gemini(
    prompt: str,
    user_id: str | None = None,
    start_date: str | None = None,
) -> tuple[str, str]:
    retryable_statuses = {408, 429, 500, 502, 503, 504}
    failures: list[str] = []

    for model_name in _gemini_model_names():
        try:
            return _generate_with_gemini_model(model_name, prompt, user_id, start_date), model_name
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 0
            failures.append(f"{model_name}:{status_code}")
            if status_code not in retryable_statuses:
                raise
            logger.warning("Gemini trip-planner model %s failed with HTTP %s; trying fallback", model_name, status_code)
        except (requests.Timeout, requests.ConnectionError):
            failures.append(f"{model_name}:network")
            logger.warning("Gemini trip-planner model %s failed on network/timeout; trying fallback", model_name)

    raise RuntimeError(f"Gemini trip generation failed for configured models: {', '.join(failures)}")


def _plan_trip_with_gemini(prompt: str, user_id: str | None = None, start_date: str | None = None) -> dict:
    itinerary, model_name = _generate_with_gemini(prompt, user_id=user_id, start_date=start_date)
    if _looks_invalid_itinerary(itinerary):
        return _fallback_result(prompt, start_date)

    return {
        "itinerary": itinerary,
        "steps": 1,
        "model": model_name,
    }


def _run_agent_process(prompt: str, user_id: str | None, start_date: str | None, result_queue) -> None:
    """Run LangGraph planning in an isolated process so timeouts can terminate it."""
    initial_state = {
        "messages": [
            SystemMessage(content=SYSTEM_MESSAGE),
            HumanMessage(content="\n".join(_agent_context_parts(prompt, user_id, start_date))),
        ]
    }

    try:
        agent = create_trip_planner()
        result = agent.invoke(initial_state, config={"recursion_limit": 25})
        final_message = result["messages"][-1]
        result_queue.put({
            "itinerary": final_message.content,
            "steps": len(result["messages"]),
        })
    except Exception as exc:
        result_queue.put({"error": str(exc)})


def plan_trip(prompt: str, user_id: str | None = None, start_date: str | None = None) -> dict:
    """Plan a trip using the agentic workflow."""
    provider = _configured_provider()
    if _should_use_gemini():
        try:
            return _plan_trip_with_gemini(prompt, user_id=user_id, start_date=start_date)
        except Exception:
            if provider == "gemini":
                logger.warning("Gemini trip planner failed with provider=gemini; using deterministic fallback", exc_info=True)
                return _fallback_result(prompt, start_date)
            logger.warning("Gemini trip planner failed; falling back to Ollama/local planner", exc_info=True)
    elif provider == "gemini":
        logger.warning("SCOPE_AI_PROVIDER=gemini but GEMINI_API_KEY is missing; using deterministic fallback")
        return _fallback_result(prompt, start_date)

    timeout_seconds = _env_int("AGENT_PLANNER_TIMEOUT_SECONDS", 45)
    if timeout_seconds <= 0:
        return _fallback_result(prompt, start_date)

    result_queue = mp.Queue(maxsize=1)
    process = mp.Process(
        target=_run_agent_process,
        args=(prompt, user_id, start_date, result_queue),
        daemon=True,
    )
    process.start()

    try:
        process.join(timeout=timeout_seconds)
        if process.is_alive():
            process.terminate()
            process.join(timeout=5)
            raise TimeoutError("agent planner exceeded wall-clock timeout")

        result = result_queue.get_nowait()
        if "error" in result:
            raise RuntimeError(result["error"])

        itinerary = result["itinerary"]
        steps = result["steps"]
        if _looks_invalid_itinerary(itinerary):
            itinerary = _fallback_plan(prompt, start_date)
            steps = 0
    except (Exception, queue.Empty):
        itinerary = _fallback_plan(prompt, start_date)
        steps = 0

    return {
        "itinerary": itinerary,
        "steps": steps,
        "model": os.environ.get("OLLAMA_MODEL", "llama3.2:3b") if steps else "scope-local-copilot",
    }
