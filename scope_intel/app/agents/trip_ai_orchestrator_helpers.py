"""Pure helper functions for the Scope AI trip chat orchestrator."""

from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.parse import quote


_NON_LOCATION_CATEGORY_TOKENS = {
    "activity",
    "activities",
    "adventure",
    "bar",
    "bars",
    "brunch",
    "coffee",
    "culture",
    "entertainment",
    "food",
    "hike",
    "hikes",
    "market",
    "markets",
    "museum",
    "museums",
    "nature",
    "nightlife",
    "outdoor",
    "outdoors",
    "park",
    "parks",
    "place",
    "places",
    "restaurant",
    "restaurants",
    "scenic",
    "shop",
    "shopping",
    "shops",
    "spot",
    "spots",
    "trail",
    "trails",
    "view",
    "views",
}


def message_from_payload(payload: dict[str, Any]) -> str:
    message = str(payload.get("message") or "").strip()
    if message:
        return message[:4000]
    prompt = str(payload.get("prompt") or "").strip()
    matched = re.search(r"Traveler request:\s*([\s\S]+)$", prompt, flags=re.IGNORECASE)
    return (matched.group(1).strip() if matched else prompt)[:4000]


def prompt_from_payload(payload: dict[str, Any], message: str) -> str:
    prompt = str(payload.get("prompt") or "").strip()
    if prompt:
        return prompt[:12000]
    planner_state = payload.get("plannerState") or payload.get("planner_state") or {}
    return "\n\n".join(
        [
            "Help refine this Scope trip draft.",
            f"Planner state JSON:\n{json.dumps(planner_state, sort_keys=True)}",
            f"Traveler request: {message}",
        ]
    )[:12000]


def planner_state_from_payload(payload: dict[str, Any], prompt: str) -> dict[str, Any]:
    state = payload.get("plannerState") or payload.get("planner_state")
    if isinstance(state, dict) and state:
        return state

    def read_line(label: str) -> str:
        matched = re.search(rf"^{label}:\s*(.+)$", prompt, flags=re.IGNORECASE | re.MULTILINE)
        return matched.group(1).strip() if matched else ""

    return {
        "start": read_line("Start"),
        "end": read_line("End"),
        "dates": read_line("Dates"),
        "budget": read_line("Budget"),
        "pace": read_line("Pace"),
        "theme": [value.strip() for value in read_line("Interests").split(",") if value.strip()],
        "party_size": read_line("Travelers"),
        "stops": stops_from_prompt(prompt),
    }


def stops_from_prompt(prompt: str) -> list[dict[str, Any]]:
    matched = re.search(r"^Stops:\s*([\s\S]*?)(?=\n[A-Z][A-Za-z ]+:|$)", prompt, flags=re.IGNORECASE | re.MULTILINE)
    if not matched:
        return []
    stops: list[dict[str, Any]] = []
    for index, raw_line in enumerate(matched.group(1).splitlines(), 1):
        cleaned = re.sub(r"^\d+\.\s*", "", raw_line).strip()
        if cleaned:
            stops.append({"name": re.sub(r"\s+\([^)]*\)\s*$", "", cleaned), "position": index})
    return stops[:12]


def start_date_from_payload(payload: dict[str, Any], prompt: str, planner_state: dict[str, Any]) -> str | None:
    direct = payload.get("start_date") or payload.get("startDate") or planner_state.get("start_date") or planner_state.get("startDate")
    if direct:
        return str(direct)
    matched = re.search(r"Dates:\s*(\d{4}-\d{2}-\d{2})", prompt, flags=re.IGNORECASE)
    return matched.group(1) if matched else None


def is_nearby_request(message: str) -> bool:
    return bool(
        re.search(
            r"\b(around|nearby|near me|around me|near here|what to do|what should (?:i|we) do|what can (?:i|we) do|things to do|fun things|cool things|activities|places to go|best places|where should (?:i|we) eat|find|show|recommend|suggest|food|restaurants?|brunch|coffee|shopping|shops?|markets?|scenic|views?|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|concerts?|nightlife|bars?|live music)\b",
            message,
            flags=re.IGNORECASE,
        )
    )


def should_use_live_travel_data(message: str) -> bool:
    return bool(
        re.search(
            r"\b(trip|travel|route|road trip|nearby|near me|around|around me|near here|best|things to do|what should (?:i|we) do|what can (?:i|we) do|fun things|cool things|activities|food|restaurants?|brunch|coffee|fuel|gas|ev|hotel|stay|shopping|shops?|markets?|scenic|views?|outdoors?|parks?|trails?|hikes?|hiking|museum|culture|entertainment|bowling|arcade|movies?|concerts?|nightlife|bars?|live music|weather|what to do|where should)\b",
            message,
            flags=re.IGNORECASE,
        )
    )


def mentions_current_location(message: str) -> bool:
    return bool(re.search(r"\b(around me|near me|my location|current location|where i am|here)\b", message, flags=re.IGNORECASE))


def travel_category(message: str) -> str:
    normalized = message.lower()
    if re.search(r"\b(gas|fuel|diesel|ev|charging)\b", normalized):
        return "fuel"
    if re.search(r"\b(nightlife|night\s*club|nightclub|bars?|pubs?|lounges?|cocktails?|speakeasy|live music|music venue|clubs?)\b", normalized):
        return "nightlife"
    if re.search(r"\b(food|restaurants?|brunch|coffee|cafe|breakfast|lunch|dinner|eat)\b", normalized):
        return "food"
    if re.search(r"\b(hotel|stay|sleep|camp|lodging)\b", normalized):
        return "stay"
    if re.search(r"\b(restroom|pharmacy|grocery|parking|repair|essentials?)\b", normalized):
        return "essentials"
    if re.search(r"\b(shopping|shops?|markets?|mall|boutique|store|retail)\b", normalized):
        return "shopping"
    if re.search(r"\b(outdoors?|parks?|trails?|hikes?|hiking|nature|camping|lake|river|garden)\b", normalized):
        return "outdoors"
    if re.search(r"\b(bowling|arcade|movie|cinema|concert|amusement|theme park|entertainment)\b", normalized):
        return "entertainment"
    if re.search(r"\b(scenic|view|overlook|park|trail|museum|culture|history|art)\b", normalized):
        return "scenic"
    return "recommended"


def snake(value: str) -> str:
    return re.sub(r"(?<!^)([A-Z])", r"_\1", value).lower()


def number(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed and parsed not in {float("inf"), float("-inf")} else None


def anchor_from_fields(id_value: str, label: str, latitude: Any, longitude: Any, role: str) -> dict[str, Any] | None:
    lat = number(latitude)
    lng = number(longitude)
    if lat is None or lng is None or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return None
    return {
        "id": id_value,
        "placeLabel": label or role,
        "latitude": lat,
        "longitude": lng,
        "routeRole": role,
    }


def planner_label_candidates(planner_state: dict[str, Any], message: str) -> list[tuple[str, str]]:
    start_label = str(planner_state.get("start") or planner_state.get("destination") or "").strip()
    end_label = str(planner_state.get("end") or planner_state.get("endDestination") or "").strip()
    mentions_end = bool(re.search(r"\b(end|destination|finish|arrival)\b", message, flags=re.IGNORECASE))
    mentions_start = bool(re.search(r"\b(start|starting point|origin|departure)\b", message, flags=re.IGNORECASE))

    if mentions_end and end_label:
        return [("end", end_label), ("start", start_label)]
    if mentions_start and start_label:
        return [("start", start_label), ("end", end_label)]
    return [("start", start_label), ("end", end_label)]


def route_labels_from_text(message: str) -> list[tuple[str, str]]:
    normalized = re.sub(r"\s+", " ", message).strip()
    patterns = [
        (r"\bfrom\s+(.{2,120}?)\s+\bto\s+(.{2,120})(?:[?.!]|$)", ("start", "end")),
        (r"\bbetween\s+(.{2,120}?)\s+\band\s+(.{2,120})(?:[?.!]|$)", ("start", "end")),
    ]
    for pattern, roles in patterns:
        matched = re.search(pattern, normalized, flags=re.IGNORECASE)
        if not matched:
            continue
        start = clean_route_label(matched.group(1))
        end = clean_route_label(matched.group(2))
        return [(roles[0], start), (roles[1], end)] if start and end else []
    return []


def clean_route_label(value: str) -> str:
    cleaned = re.sub(
        r"\b(?:for|with|on|this|next|over|under|that has|and then|please)\b.*$",
        "",
        value,
        flags=re.IGNORECASE,
    )
    return cleaned.strip(" .,!?'\"")[:120]


def extract_location_query(message: str) -> str | None:
    normalized = re.sub(r"\s+", " ", message).strip()
    matched = re.search(r"\b(?:around|near|in)\s+(.+)$", normalized, flags=re.IGNORECASE)
    if not matched:
        matched = re.search(
            r"^(.+?)\s+(?:fun\s+things(?:\s+to\s+do)?|cool\s+things(?:\s+to\s+do)?)\b",
            normalized,
            flags=re.IGNORECASE,
        )
    if not matched:
        matched = re.search(
            r"\b(?:what\s+to\s+do|fun\s+things(?:\s+to\s+do)?|cool\s+things(?:\s+to\s+do)?|things?\s+to\s+do|activities|best\s+(?:restaurants?|brunch)|good\s+restaurants?|restaurants?|brunch|food|coffee|shopping|shops?|markets?|scenic\s+(?:views?|spots?)|views?|outdoor\s+activities|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|cinemas?|concerts?|nightlife|bars?|pubs?|clubs?|lounges?|cocktails?|live music|music venues?|museums?|where\s+should\s+(?:i|we)\s+eat)\s+(.+)$",
            normalized,
            flags=re.IGNORECASE,
        )
    if not matched:
        matched = re.search(
            r"^(.+?)\s+(?:things?\s+to\s+do|activities|restaurants?|brunch|food|coffee|shopping|shops?|markets?|scenic\s+(?:views?|spots?)|views?|outdoor\s+activities|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|cinemas?|concerts?|nightlife|bars?|pubs?|clubs?|museums?)\b",
            normalized,
            flags=re.IGNORECASE,
        )
    if not matched:
        return None
    query = re.sub(
        r"\b(?:for|with|that has|and|plus)\b.*$",
        "",
        matched.group(1).strip(" ?.!"),
        flags=re.IGNORECASE,
    ).strip(" ?.!\"'")
    query = clean_location_query(query)
    if not query or re.search(
        r"^(me|here|my location|current location|the route|this route|start|the start|starting point|origin|end|the end|destination|the destination)$",
        query,
        flags=re.IGNORECASE,
    ):
        return None
    return query[:160]


def clean_location_query(value: str) -> str:
    cleaned = _strip_location_query_modifiers(value)
    if _mentions_route_context(cleaned):
        return ""

    if _is_only_category_terms(cleaned):
        return ""

    return cleaned


def _strip_location_query_modifiers(value: str) -> str:
    cleaned = re.sub(
        r"^(?:me|here|my location|current location)\s+(?:around|near|in)\s+",
        "",
        value,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\b(?:this|next|coming)\s+(?:weekend|week|month|summer|spring|fall|winter)\b.*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\b(?:today|tomorrow|tonight|now|later|open now|kid[-\s]?friendly|family[-\s]?friendly)\b.*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", cleaned).strip(" ,;:?.!\"'")


def _mentions_route_context(cleaned: str) -> bool:
    return bool(
        re.search(
            r"\b(?:the route|this route|stops?|nearby|trip|vibe|vibes|theme|interests?)\b",
            cleaned,
            flags=re.IGNORECASE,
        )
    )


def _is_only_category_terms(cleaned: str) -> bool:
    tokens = re.findall(r"[a-z][a-z']*", cleaned.lower())
    return bool(tokens) and all(token in _NON_LOCATION_CATEGORY_TOKENS for token in tokens)


def interests_from_state(planner_state: dict[str, Any]) -> list[str]:
    for key in ("theme", "interests"):
        value = planner_state.get(key)
        if isinstance(value, list):
            return [str(item) for item in value if str(item).strip()][:8]
        if isinstance(value, str) and value.strip():
            return [part.strip() for part in value.split(",") if part.strip()][:8]
    return []


def place_card(raw: dict[str, Any]) -> dict[str, Any] | None:
    title = str(raw.get("title") or "").strip()
    if not title:
        return None
    return {
        "id": str(raw.get("id") or title),
        "title": title,
        "subtitle": str(raw.get("subtitle") or ""),
        "address": str(raw.get("address") or ""),
        "latitude": raw.get("latitude"),
        "longitude": raw.get("longitude"),
        "category": str(raw.get("category") or "recommended"),
        "source": str(raw.get("source") or "scope"),
        "sourceLabel": str(raw.get("sourceLabel") or ("Google Places" if raw.get("source") == "google" else "Scope")),
        "distanceKm": raw.get("distanceKm"),
        "rating": raw.get("rating"),
        "reviewCount": raw.get("reviewCount"),
        "priceLabel": str(raw.get("priceLabel") or ""),
        "priceValue": raw.get("priceValue"),
        "isOpen": raw.get("isOpen"),
        "reason": str(raw.get("reason") or ""),
        "websiteUrl": str(raw.get("websiteUrl") or ""),
        "photoUrl": str(raw.get("photoUrl") or ""),
    }


def image_parts_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_images = payload.get("images")
    if not isinstance(raw_images, list):
        return []

    allowed_mime_types = {"image/jpeg", "image/png", "image/webp"}
    image_parts: list[dict[str, Any]] = []
    for raw_image in raw_images[:3]:
        if not isinstance(raw_image, dict):
            continue
        mime_type = str(raw_image.get("mime_type") or raw_image.get("mimeType") or "").strip().lower()
        data = str(raw_image.get("data") or "").strip()
        if "," in data and data.lower().startswith("data:"):
            data = data.split(",", 1)[1].strip()
        if mime_type not in allowed_mime_types or not data:
            continue
        if estimated_base64_bytes(data) > 4 * 1024 * 1024:
            continue
        image_parts.append({"inline_data": {"mime_type": mime_type, "data": data}})
    return image_parts


def estimated_base64_bytes(value: str) -> int:
    padding = len(value) - len(value.rstrip("="))
    return max(0, (len(value) * 3) // 4 - padding)


def is_image_inspection_request(message: str) -> bool:
    return bool(
        re.search(
            r"\b(attached|image|images|inspect|look|photo|photos|picture|pictures|review|see|visible|screenshot)\b",
            message,
            flags=re.IGNORECASE,
        )
    )


def configured_provider() -> str:
    provider = os.environ.get("SCOPE_AI_PROVIDER", "auto").strip().lower()
    return provider if provider in {"auto", "gemini", "ollama"} else "auto"


def should_use_gemini() -> bool:
    return configured_provider() in {"auto", "gemini"} and bool(os.environ.get("GEMINI_API_KEY", "").strip())


def format_session_history(session_history: list[Any]) -> str:
    lines: list[str] = []
    for entry in session_history[-8:] if isinstance(session_history, list) else []:
        if not isinstance(entry, dict):
            continue
        role = "Scope AI" if entry.get("role") == "assistant" else "User"
        content = str(entry.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content[:1000]}")
    return "\n".join(lines) or "No prior chat."


def format_grounding(grounding: Any) -> str:
    if not grounding.place_cards:
        return grounding.coverage or "No live place evidence for this turn."
    return json.dumps(
        {
            "category": grounding.category,
            "coverage": grounding.coverage,
            "anchors": grounding.anchors,
            "place_cards": grounding.place_cards,
        },
        sort_keys=True,
    )[:8000]


def extract_gemini_text(payload: dict[str, Any]) -> str:
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(str(part.get("text") or "").strip() for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned no text")
    return text


def extract_gemini_grounding_sources(payload: dict[str, Any]) -> list[dict[str, str]]:
    metadata = payload.get("candidates", [{}])[0].get("groundingMetadata")
    chunks = metadata.get("groundingChunks", []) if isinstance(metadata, dict) else []
    sources: list[dict[str, str]] = []
    seen: set[str] = set()
    for chunk in chunks:
        web = chunk.get("web") if isinstance(chunk, dict) else None
        if not isinstance(web, dict):
            continue
        uri = str(web.get("uri") or "").strip()
        title = str(web.get("title") or "").strip()
        if not uri or uri in seen:
            continue
        seen.add(uri)
        sources.append({"title": title or uri, "uri": uri})
        if len(sources) >= 8:
            break
    return sources


def gemini_endpoint(model_name: str) -> str:
    model = model_name.removeprefix("models/")
    encoded_model = quote(model, safe="")
    base_url = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
    return f"{base_url}/models/{encoded_model}:generateContent"


def is_complex_request(message: str, grounding: Any) -> bool:
    return bool(
        grounding.place_cards
        or re.search(r"\b(build|optimize|compare|multi[-\s]?day|weekend|itinerary|best|around|nearby|rank|research)\b", message, flags=re.IGNORECASE)
    )


def should_use_search_grounding(message: str) -> bool:
    policy = os.environ.get("SCOPE_AI_SEARCH_GROUNDING_POLICY", "always_under_cap").strip().lower()
    if policy in {"off", "false", "disabled"}:
        return False
    if policy in {"user_asks", "explicit"}:
        return bool(re.search(r"\b(search|web|current|latest|look up|research)\b", message, flags=re.IGNORECASE))
    return bool(
        re.search(
            r"\b(travel|trip|route|road trip|nearby|around|best|things to do|activities|what to do|current|latest|open now|events?|weather|food|restaurants?|hotel|fuel|nightlife|bars?|live music)\b",
            message,
            flags=re.IGNORECASE,
        )
    )


def cap_name_for_model(model_name: str) -> str:
    lowered = model_name.lower()
    if "pro" in lowered:
        return "SCOPE_AI_GEMINI_PRO_MONTHLY_CAP"
    if "lite" in lowered:
        return "SCOPE_AI_GEMINI_LITE_MONTHLY_CAP"
    return "SCOPE_AI_GEMINI_FAST_MONTHLY_CAP"


def default_cap_for_model(model_name: str) -> int:
    lowered = model_name.lower()
    if "pro" in lowered:
        return 100
    if "lite" in lowered:
        return 1000
    return 1000


def looks_low_quality(answer: str) -> bool:
    stripped = answer.strip()
    return len(stripped) < 20 or stripped.startswith(("{", "["))


def prepend_place_card_summary(answer: str, cards: list[dict[str, Any]]) -> str:
    card_lines = [
        "Live nearby picks:",
        *[
            f"{index}. {card['title']} - {card.get('reason') or card.get('subtitle') or 'provider-backed nearby option.'}"
            for index, card in enumerate(cards[:3], 1)
        ],
        "",
    ]
    return "\n".join(card_lines) + answer


def extract_simple_actions(message: str) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    normalized = message.strip()

    route_match = re.search(r"\bfrom\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)", normalized, flags=re.IGNORECASE)
    if route_match:
        start = clean_route_label(route_match.group(1))
        end = clean_route_label(route_match.group(2))
        if start:
            actions.append({"type": "SET_FIELD", "field": "start", "value": start})
        if end:
            actions.append({"type": "SET_FIELD", "field": "end", "value": end})

    budget_match = re.search(r"\b(?:set\s+)?(?:budget|cap|under|less than|no more than)\s*\$?\s*(\d{2,6})(?:\s*(k))?\b", normalized, flags=re.IGNORECASE)
    if budget_match:
        amount = int(budget_match.group(1)) * (1000 if budget_match.group(2) else 1)
        actions.append({"type": "SET_FIELD", "field": "budget_max", "value": amount})

    pace_match = re.search(r"\b(relaxed|chill|easy|balanced|standard|moderate|packed|busy|fast)\s+pace\b|\bpace\s+(relaxed|balanced|standard|packed)\b", normalized, flags=re.IGNORECASE)
    if pace_match:
        raw_pace = (pace_match.group(1) or pace_match.group(2) or "").lower()
        pace = "relaxed" if raw_pace in {"relaxed", "chill", "easy"} else "packed" if raw_pace in {"packed", "busy", "fast"} else "standard"
        actions.append({"type": "SET_FIELD", "field": "pace", "value": pace})

    party_match = re.search(r"\b(?:party|travelers?|people|group)\s*(?:of|size)?\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:people|travelers?)\b", normalized, flags=re.IGNORECASE)
    if party_match:
        count = int(party_match.group(1) or party_match.group(2))
        if 1 <= count <= 30:
            actions.append({"type": "SET_FIELD", "field": "party_size", "value": count})

    for field_name, pattern in [
        ("start", r"\b(?:start|starting|origin)\s+(?:at|in|from)?\s*([A-Za-z0-9 .,'-]{2,80})"),
        ("end", r"\b(?:end|destination|finish)\s+(?:at|in|to)?\s*([A-Za-z0-9 .,'-]{2,80})"),
    ]:
        matched = re.search(pattern, normalized, flags=re.IGNORECASE)
        if matched:
            value = re.sub(r"\s+(?:and|with|for|on|to)\s+.*$", "", matched.group(1), flags=re.IGNORECASE).strip(" .,!?'\"")
            if value:
                actions.append({"type": "SET_FIELD", "field": field_name, "value": value})

    return actions[:6]


def chips_for(message: str, planner_state: dict[str, Any], grounding: Any, actions: list[dict[str, Any]]) -> list[str]:
    if grounding.place_cards:
        return ["Add the best fit", "Show more nearby", "Build this into the route"]
    if actions:
        return ["Check route status", "Build the itinerary", "Find places nearby"]
    if not planner_state.get("start") and not planner_state.get("destination"):
        return ["Add a start place", "Use current location", "Search near a city"]
    return ["Find places nearby", "Check timing", "Build the itinerary"]


def response_payload(
    *,
    answer: str,
    model_result: Any,
    grounding: Any,
    actions: list[dict[str, Any]],
    chips: list[str],
) -> dict[str, Any]:
    return {
        "response": answer,
        "itinerary": answer,
        "steps": 1 if model_result.provider == "gemini" else 0,
        "model": model_result.model,
        "provider": model_result.provider,
        "actions": actions,
        "chips": chips[:3],
        "place_cards": grounding.place_cards,
        "grounding": {
            "sources": grounding.sources,
            "coverage": grounding.coverage,
            "category": grounding.category,
            "search_grounding_used": model_result.search_grounding_used,
            "web_sources": model_result.web_sources,
            "truth_policy": "verified_or_labeled",
        },
        "cost_policy": "free_tier_capped",
        "action_policy": {
            "auto_apply_simple_fields": True,
            "confirm_stop_and_trip_document_changes": True,
        },
        "fallback_reason": model_result.fallback_reason,
    }


def sentence_chunks(value: str) -> list[str]:
    chunks = [chunk.strip() for chunk in re.split(r"(?<=[.!?])\s+", value.strip()) if chunk.strip()]
    return chunks or ([value] if value else [])


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default
