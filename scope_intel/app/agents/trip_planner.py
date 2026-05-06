"""LangGraph agentic trip planner - multi-step reasoning over Scope data."""

import multiprocessing as mp
import os
import queue
import re
from datetime import date
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agents.tools import (
    calculate_distance,
    get_spot_reviews,
    get_weather,
    predict_trip_cost,
    search_nearby,
    search_spots,
)

TOOLS = [search_spots, search_nearby, get_spot_reviews, get_weather, calculate_distance, predict_trip_cost]

SYSTEM_MESSAGE = """You are Scope AI, a concise trip and app copilot inside an interactive route planner.

You have access to tools that let you:
- Search for spots by keyword or location
- Read real user reviews for spots
- Check weather forecasts
- Calculate distances between spots
- Predict trip cost and duration

Process:
1. Understand what the user wants (destination, interests, duration, budget)
2. Search for relevant spots using multiple queries based on their interests
3. Read reviews to evaluate spot quality
4. Check weather for the travel dates
5. Calculate distances to plan an efficient route
6. Predict cost and duration
7. Give the next useful planning move

Operate like a polished in-app copilot, not a generic chatbot. Use the visible route, stops, budget,
pace, dates, recent chat, images, and Scope app context as the working surface. Answer the traveler's
actual question directly in plain text. Talk to them as "you" and "your", like a focused support-style
trip copilot. Keep normal chat replies to 2-4 short sentences.
Before building any itinerary, confirm destination(s), trip length in days, interests, travel pace,
and who is traveling. If any are missing from the visible draft or recent chat, ask only the single
most essential missing question in one short conversational message. If the traveler replies "idk",
"not sure", "whatever", "u wanna help", or anything similarly vague, treat that as "surprise me":
assume a weekend trip, balanced food/culture/key-sights interests, reasonable pace, and keep building
instead of asking again. Keep follow-ups attached to the last question unless the traveler clearly starts
a new location, new destination, or new trip. When you do build, organize by day with Morning, Afternoon, and
Evening slots, use specific real places, factor travel time between stops, personalize to interests, and flag
must-sees versus hidden gems.
Never output JSON, markdown tables, or schema-like objects for this chat endpoint. If the route needs a full
rebuild, say what should change and leave the itinerary build to the planner UI.
Never expose internal model names, implementation labels, debug tags, or tool chatter to the traveler.
If the same route action was already completed and the planner state has not changed, say it is already
synced and give one useful next move instead of repeating the same done message.

Professional boundary rules:
- If the user asks personal identity questions about you, say those labels or relationships do not apply because you are Scope AI, then redirect to Scope trip/app help.
- If the user sends romantic, sexual, or abusive prompts, stay calm, set a short professional boundary, and ask what Scope trip/app issue should be fixed.
- If the user asks unrelated general trivia, homework, code, news, medical, legal, financial, or emergency questions, do not pretend to be a general assistant. Redirect to trusted/professional sources and offer to help with the Scope planning context.
- For unclear one- or two-word prompts, ask one concise clarifying question instead of guessing."""


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


def _env_int(name: str, default: int) -> int:
    """Parse optional integer tuning values from the environment."""
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


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
        questions.append("What are your interests: food, nightlife, nature, culture, shopping, adventure, or something else?")
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
        r"\b(?:\d{1,2}\s*(?:day|days|d)|weekend|food|restaurants?|coffee|cafes?|culture|museums?|art|history|nature|parks?|trails?|hikes?|adventure|nightlife|bars?|shopping|scenic|views?|relaxed|chill|balanced|moderate|packed|busy|solo|alone|couple|partner|family|kids?|children|group|friends?)\b",
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


def _normalize_request(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s']", " ", value.lower())).strip()


def _is_scope_domain_request(normalized: str) -> bool:
    return bool(
        re.search(
            r"\b(scope|app|screen|button|click|tap|ui|planner|map|trip|travel|route|road trip|"
            r"itinerary|spot|spots|place|places|experience|experiences|destination|destinations|city|visit|go to|stay in|drive|flight|hotel|"
            r"restaurant|food|budget|pace|timing|schedule|start|end|stop|midpoint|address|"
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


def _fallback_plan(prompt: str, start_date: str | None = None) -> str:
    """Return a useful itinerary shell if the local LLM is unavailable."""
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
    boundary_response = _professional_boundary_response(request_text)
    if boundary_response:
        return boundary_response

    if _is_vague_brief_reply(request_text) and _has_pending_itinerary_brief(prompt, recent_chat):
        return _smart_default_itinerary_response(route, budget, pace)

    if _is_itinerary_build_request(request_text):
        missing_questions = _missing_itinerary_brief_questions(prompt, start, end, dates, raw_pace, raw_interests)
        if missing_questions:
            return _missing_itinerary_brief_response(missing_questions)

    if re.search(r"\b(budget|inside|under|cap|\$|cost|spend)\b", normalized_request):
        return "\n".join(
            [
                f"I would keep {route} inside {budget} by treating the top number as your hard cap, not the goal.",
                "",
                f"For {dates}, keep the pace {pace} and add only low-detour stops: fuel, food, rest, or one short scenic break.",
                "Avoid paid attractions or long side quests unless they replace another stop.",
                "If the route needs a midpoint, pick one stop that handles food/restrooms/views in the same area instead of stacking multiple stops.",
            ]
        )

    if re.search(r"\b(tighten|remove filler|filler|clean up|simplify|rebalance)\b", normalized_request):
        return "\n".join(
            [
                f"I would tighten {route} around one clear route purpose.",
                "",
                f"At a {pace} pace, cut anything that does not shorten the drive, feed/rest the group, or create a standout memory.",
                "Use one midpoint stop, then keep the final leg clean. If a stop adds backtracking, replace it instead of adding more.",
            ]
        )

    if re.search(r"\b(timing|time|date|schedule|works?|pace)\b", normalized_request):
        return "\n".join(
            [
                f"I would check {route} against {dates} as a {pace} plan.",
                "",
                "Do not stack multiple optional stops on the longest driving day.",
                "Build around departure time, weather/border buffers if relevant, and one practical midpoint break.",
            ]
        )

    if re.search(r"\b(stop|midpoint|middle|halfway|between|on the way|en route)\b", normalized_request):
        return "\n".join(
            [
                f"I would only add a midpoint on {route} if it saves energy or solves a real need.",
                "",
                f"Best fit: one {interests} stop that also covers food, restrooms, fuel, or a short walk.",
                f"Budget guardrail: keep it inside {budget} with a free viewpoint, casual food stop, public park, or quick town-center break.",
                "Skip anything that adds more than about 20 minutes off-route unless it becomes the main stop.",
            ]
        )

    if re.search(r"\b(weekend|simple|easy)\b", normalized_request):
        return "\n".join(
            [
                f"I would make {route} a simple {pace} weekend route.",
                "",
                "Day 1: travel, take one easy food or rest stop, then arrive without adding extra detours.",
                f"Day 2: choose one {interests} anchor and one nearby flexible stop.",
                "Final leg: keep it light, with one practical break only if it helps the drive.",
                f"Keep {budget} as the cap by choosing free, scenic, public, or casual stops first.",
            ]
        )

    if re.search(r"\b(suggest|recommend|ideas?|what should)\b", normalized_request):
        return "\n".join(
            [
                f"For {route}, I would keep your next move narrow and useful.",
                "",
                f"Add one {interests} stop that sits close to the route and fits a {pace} pace.",
                f"Keep {budget} as the cap, then avoid adding another stop unless it replaces a weaker one.",
                "After that, build the itinerary so timing and driving legs can be checked together.",
            ]
        )

    return "\n".join(
        [
            f"I would handle \"{request_text}\" as a focused planning pass for {route}.",
            "",
            f"Use {budget} as the guardrail and keep the rhythm {pace}.",
            f"Prioritize {interests}, then add only stops that make the route easier or more memorable.",
        ]
    )


def _run_agent_process(prompt: str, user_id: str | None, start_date: str | None, result_queue) -> None:
    """Run LangGraph planning in an isolated process so timeouts can terminate it."""
    context_parts = [prompt]
    context_parts.append("Response style: plain conversational text, speak directly to the traveler as you/your, 2-4 short sentences, no JSON.")
    if start_date:
        context_parts.append(f"Travel dates starting: {start_date}")
    if user_id:
        context_parts.append(f"User ID for personalization: {user_id}")

    initial_state = {
        "messages": [
            SystemMessage(content=SYSTEM_MESSAGE),
            HumanMessage(content="\n".join(context_parts)),
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
    timeout_seconds = _env_int("AGENT_PLANNER_TIMEOUT_SECONDS", 45)
    if timeout_seconds <= 0:
        return {
            "itinerary": _fallback_plan(prompt, start_date),
            "steps": 0,
            "model": os.environ.get("OLLAMA_MODEL", "llama3.2:3b"),
        }

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
        if not itinerary.strip() or itinerary.lstrip().startswith(("{", "[")):
            itinerary = _fallback_plan(prompt, start_date)
            steps = 0
    except (Exception, queue.Empty):
        itinerary = _fallback_plan(prompt, start_date)
        steps = 0

    return {
        "itinerary": itinerary,
        "steps": steps,
        "model": os.environ.get("OLLAMA_MODEL", "llama3.2:3b"),
    }
