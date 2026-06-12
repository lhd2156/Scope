"""Enterprise Scope AI trip chat orchestration.

This module keeps the production planner path in one place: intent/context
normalization, live travel grounding, model routing, safe planner actions, and
the response contract the frontend can render.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import requests
from flask import has_app_context

from app.agents.trip_planner import _fallback_plan, _professional_boundary_response, plan_trip
from app.services.geocoding_service import GeocodingService
from app.services.google_places_usage_guard import GooglePlacesUsageGuard
from app.services.travel_nearby_service import TravelNearbyService

logger = logging.getLogger(__name__)

TRIP_AI_SYSTEM_PROMPT = """You are Scope AI, the production trip-planning copilot inside Scope.

Mission:
- Help everyday travelers make real route and nearby-place decisions.
- Use Scope context and live provider evidence first.
- Give concise guide-style answers: direct recommendation, 3-5 ranked choices when available, why each fits, verification notes, and one next action.
- Sound like a smart friend: warm, practical, direct, no filler.

Truth and safety:
- Do not invent exact venues, open-now status, hours, ticket prices, reservations, traffic, or drive times.
- Exact claims must come from the supplied provider evidence. Otherwise label them as estimates to verify.
- Never complete bookings, purchases, reservations, or ticket actions.
- Ask exactly one location question when a nearby request has no explicit location, route point, or permitted current location.

Planner action policy:
- Simple explicit field edits may be applied.
- Adding, removing, reordering, saving, sharing, inviting, visibility changes, and deleting require user confirmation.
- Return planner edits only through the structured actions provided by the API response, not hidden prose.

Ollama role:
- Local fallback and memory support only. Do not present local fallback as the preferred production model.
"""


@dataclass(slots=True)
class ModelResult:
    answer: str
    model: str
    provider: str
    search_grounding_used: bool = False
    fallback_reason: str | None = None
    web_sources: list[dict[str, str]] = field(default_factory=list)


@dataclass(slots=True)
class TravelGrounding:
    anchors: list[dict[str, Any]]
    place_cards: list[dict[str, Any]]
    sources: list[str]
    coverage: str
    category: str
    needs_location: bool = False


class TripAiOrchestrator:
    """Coordinate the enterprise planner answer path."""

    def __init__(
        self,
        travel_nearby_service: TravelNearbyService | None = None,
        geocoding_service: GeocodingService | None = None,
        usage_guard: GooglePlacesUsageGuard | None = None,
    ) -> None:
        self._travel_nearby_service = travel_nearby_service or TravelNearbyService()
        self._geocoding_service = geocoding_service or GeocodingService()
        self._usage_guard = usage_guard or GooglePlacesUsageGuard()

    def chat(self, payload: dict[str, Any], user_id: str | None = None) -> dict[str, Any]:
        message = self._message_from_payload(payload)
        prompt = self._prompt_from_payload(payload, message)
        planner_state = self._planner_state_from_payload(payload, prompt)
        preferences = payload.get("preferences") if isinstance(payload.get("preferences"), dict) else {}
        session_history = payload.get("sessionHistory") or payload.get("session_history") or []
        image_parts = self._image_parts_from_payload(payload)

        is_travel_turn = self._is_nearby_request(message) or self._should_use_live_travel_data(message)
        boundary = _professional_boundary_response(message)
        if boundary and not is_travel_turn:
            return self._response(
                answer=boundary,
                model_result=ModelResult(boundary, "scope-boundary", "local"),
                grounding=TravelGrounding([], [], [], "", "recommended"),
                actions=[],
                chips=["Fix my route", "Find places nearby", "Check route status"],
            )

        grounding = self._ground_travel_request(message, planner_state, payload)
        actions = self._extract_simple_actions(message)
        chips = self._chips_for(message, planner_state, grounding, actions)

        if grounding.needs_location:
            answer = (
                "I can help with what to do around you, but I need a real location first. "
                "Add a start point, choose a map pin, or share current location and I will rank nearby picks from live travel data."
            )
            return self._response(
                answer=answer,
                model_result=ModelResult(answer, "scope-location-required", "local"),
                grounding=grounding,
                actions=actions,
                chips=["Use current location", "Add a start place", "Search near a city"],
            )

        model_result = self._answer_with_model(
            message=message,
            prompt=prompt,
            planner_state=planner_state,
            preferences=preferences,
            session_history=session_history,
            grounding=grounding,
            user_id=user_id,
            start_date=self._start_date_from_payload(payload, prompt, planner_state),
            image_parts=image_parts,
        )

        return self._response(
            answer=model_result.answer,
            model_result=model_result,
            grounding=grounding,
            actions=actions,
            chips=chips,
        )

    def stream_events(self, payload: dict[str, Any], user_id: str | None = None):
        yield {"type": "status", "message": "Reading the trip context and live travel signals."}
        result = self.chat(payload, user_id=user_id)
        if result.get("place_cards"):
            yield {"type": "place_cards", "place_cards": result["place_cards"]}
        if result.get("actions"):
            yield {"type": "actions", "actions": result["actions"]}
        for chunk in self._sentence_chunks(str(result.get("response") or "")):
            yield {"type": "delta", "text": chunk}
        yield {"type": "final", **result}

    @staticmethod
    def _message_from_payload(payload: dict[str, Any]) -> str:
        message = str(payload.get("message") or "").strip()
        if message:
            return message[:4000]
        prompt = str(payload.get("prompt") or "").strip()
        matched = re.search(r"Traveler request:\s*([\s\S]+)$", prompt, flags=re.IGNORECASE)
        return (matched.group(1).strip() if matched else prompt)[:4000]

    @staticmethod
    def _prompt_from_payload(payload: dict[str, Any], message: str) -> str:
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

    @staticmethod
    def _planner_state_from_payload(payload: dict[str, Any], prompt: str) -> dict[str, Any]:
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
            "stops": TripAiOrchestrator._stops_from_prompt(prompt),
        }

    @staticmethod
    def _stops_from_prompt(prompt: str) -> list[dict[str, Any]]:
        matched = re.search(r"^Stops:\s*([\s\S]*?)(?=\n[A-Z][A-Za-z ]+:|\Z)", prompt, flags=re.IGNORECASE | re.MULTILINE)
        if not matched:
            return []
        stops: list[dict[str, Any]] = []
        for index, raw_line in enumerate(matched.group(1).splitlines(), 1):
            cleaned = re.sub(r"^\d+\.\s*", "", raw_line).strip()
            if cleaned:
                stops.append({"name": re.sub(r"\s+\([^)]*\)\s*$", "", cleaned), "position": index})
        return stops[:12]

    @staticmethod
    def _start_date_from_payload(payload: dict[str, Any], prompt: str, planner_state: dict[str, Any]) -> str | None:
        direct = payload.get("start_date") or payload.get("startDate") or planner_state.get("start_date") or planner_state.get("startDate")
        if direct:
            return str(direct)
        matched = re.search(r"Dates:\s*(\d{4}-\d{2}-\d{2})", prompt, flags=re.IGNORECASE)
        return matched.group(1) if matched else None

    def _ground_travel_request(self, message: str, planner_state: dict[str, Any], payload: dict[str, Any]) -> TravelGrounding:
        category = self._travel_category(message)
        anchors = self._anchors_from_payload(payload, planner_state)
        is_nearby_request = self._is_nearby_request(message)
        if not anchors and is_nearby_request:
            location_query = self._extract_location_query(message)
            if location_query:
                anchors = self._anchors_from_geocode(location_query)
            if not anchors:
                anchors = self._anchors_from_planner_labels(planner_state, message)
            if not anchors:
                anchors = self._anchors_from_route_text(message)
            if not anchors:
                return TravelGrounding([], [], [], "", category, needs_location=True)

        if not anchors or not self._should_use_live_travel_data(message):
            return TravelGrounding(anchors, [], [], "", category)

        try:
            provider_payload = self._travel_nearby_service.get_nearby(
                {
                    "anchors": anchors[:3],
                    "category": category,
                    "radiusKm": 16.09,
                    "limit": 5,
                    "interests": self._interests_from_state(planner_state),
                    "pace": str(planner_state.get("pace") or "balanced"),
                    "budgetFloor": self._number(planner_state.get("budget_min") or planner_state.get("budgetFloor")),
                    "budgetCeiling": self._number(planner_state.get("budget_max") or planner_state.get("budget")),
                    "fuelType": str(planner_state.get("fuel_type") or planner_state.get("fuelType") or "all"),
                    "latestIntent": message,
                }
            )
        except Exception:
            logger.warning("trip_ai_live_grounding_failed", exc_info=True)
            return TravelGrounding(anchors, [], [], "Live travel lookup failed.", category)

        cards = [self._place_card(item) for item in provider_payload.get("suggestions", [])[:5]]
        cards = [card for card in cards if card]
        sources = sorted({str(card["sourceLabel"]) for card in cards if card.get("sourceLabel")})
        return TravelGrounding(
            anchors=anchors,
            place_cards=cards,
            sources=sources,
            coverage=str(provider_payload.get("coverage") or ""),
            category=str(provider_payload.get("category") or category),
        )

    @staticmethod
    def _is_nearby_request(message: str) -> bool:
        return bool(
            re.search(
                r"\b(around|nearby|near me|around me|near here|what to do|what should (?:i|we) do|what can (?:i|we) do|things to do|fun things|cool things|activities|places to go|best places|where should (?:i|we) eat|find|show|recommend|suggest|food|restaurants?|brunch|coffee|shopping|shops?|markets?|scenic|views?|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|concerts?|nightlife|bars?|live music)\b",
                message,
                flags=re.IGNORECASE,
            )
        )

    @staticmethod
    def _should_use_live_travel_data(message: str) -> bool:
        return bool(
            re.search(
                r"\b(trip|travel|route|road trip|nearby|near me|around|around me|near here|best|things to do|what should (?:i|we) do|what can (?:i|we) do|fun things|cool things|activities|food|restaurants?|brunch|coffee|fuel|gas|ev|hotel|stay|shopping|shops?|markets?|scenic|views?|outdoors?|parks?|trails?|hikes?|hiking|museum|culture|entertainment|bowling|arcade|movies?|concerts?|nightlife|bars?|live music|weather|what to do|where should)\b",
                message,
                flags=re.IGNORECASE,
            )
        )

    @staticmethod
    def _mentions_current_location(message: str) -> bool:
        return bool(re.search(r"\b(around me|near me|my location|current location|where i am|here)\b", message, flags=re.IGNORECASE))

    @staticmethod
    def _travel_category(message: str) -> str:
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

    def _anchors_from_payload(self, payload: dict[str, Any], planner_state: dict[str, Any]) -> list[dict[str, Any]]:
        anchors: list[dict[str, Any]] = []
        location_context = payload.get("locationContext") or payload.get("location_context") or {}
        if isinstance(location_context, dict) and str(location_context.get("permission") or "").lower() == "granted":
            anchor = self._anchor_from_fields(
                "current-location",
                str(location_context.get("label") or "current location"),
                location_context.get("latitude"),
                location_context.get("longitude"),
                "current",
            )
            if anchor:
                anchors.append(anchor)

        for key, label_key, lat_key, lng_key, role in [
            ("start", "start", "startLatitude", "startLongitude", "start"),
            ("end", "end", "endLatitude", "endLongitude", "end"),
            ("destination", "destination", "destinationLatitude", "destinationLongitude", "start"),
            ("endDestination", "endDestination", "endDestinationLatitude", "endDestinationLongitude", "end"),
        ]:
            anchor = self._anchor_from_fields(
                f"planner-{role}-{key}",
                str(planner_state.get(label_key) or planner_state.get(key) or role),
                planner_state.get(lat_key) or planner_state.get(self._snake(lat_key)),
                planner_state.get(lng_key) or planner_state.get(self._snake(lng_key)),
                role,
            )
            if anchor:
                anchors.append(anchor)

        for index, stop in enumerate(planner_state.get("stops") or [], 1):
            if not isinstance(stop, dict):
                continue
            anchor = self._anchor_from_fields(
                str(stop.get("id") or f"stop-{index}"),
                str(stop.get("name") or stop.get("title") or f"stop {index}"),
                stop.get("latitude"),
                stop.get("longitude"),
                "stop",
            )
            if anchor:
                anchors.append(anchor)

        deduped: list[dict[str, Any]] = []
        seen: set[tuple[float, float]] = set()
        for anchor in anchors:
            key = (round(float(anchor["latitude"]), 4), round(float(anchor["longitude"]), 4))
            if key not in seen:
                seen.add(key)
                deduped.append(anchor)
        return deduped[:5]

    @staticmethod
    def _snake(value: str) -> str:
        return re.sub(r"(?<!^)([A-Z])", r"_\1", value).lower()

    @staticmethod
    def _anchor_from_fields(id_value: str, label: str, latitude: Any, longitude: Any, role: str) -> dict[str, Any] | None:
        lat = TripAiOrchestrator._number(latitude)
        lng = TripAiOrchestrator._number(longitude)
        if lat is None or lng is None or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return None
        return {
            "id": id_value,
            "placeLabel": label or role,
            "latitude": lat,
            "longitude": lng,
            "routeRole": role,
        }

    def _anchors_from_geocode(self, query: str) -> list[dict[str, Any]]:
        try:
            results = self._geocoding_service.geocode(query, limit=1)
        except Exception:
            logger.info("trip_ai_location_geocode_failed", exc_info=True)
            return []
        if not results:
            return []
        best = results[0]
        anchor = self._anchor_from_fields(
            "typed-location",
            str(best.get("formattedAddress") or best.get("placeName") or query),
            best.get("latitude"),
            best.get("longitude"),
            "typed-location",
        )
        return [anchor] if anchor else []

    def _anchors_from_planner_labels(self, planner_state: dict[str, Any], message: str) -> list[dict[str, Any]]:
        candidates = self._planner_label_candidates(planner_state, message)
        anchors: list[dict[str, Any]] = []
        seen_labels: set[str] = set()
        for role, label in candidates:
            normalized_label = re.sub(r"\s+", " ", label).strip()
            if not normalized_label or normalized_label.lower() in seen_labels:
                continue
            seen_labels.add(normalized_label.lower())
            for anchor in self._anchors_from_geocode(normalized_label):
                anchors.append({**anchor, "id": f"planner-{role}-geocoded", "routeRole": role, "placeLabel": normalized_label})
                break
            if len(anchors) >= 2:
                break
        return anchors

    @staticmethod
    def _planner_label_candidates(planner_state: dict[str, Any], message: str) -> list[tuple[str, str]]:
        start_label = str(planner_state.get("start") or planner_state.get("destination") or "").strip()
        end_label = str(planner_state.get("end") or planner_state.get("endDestination") or "").strip()
        mentions_end = bool(re.search(r"\b(end|destination|finish|arrival)\b", message, flags=re.IGNORECASE))
        mentions_start = bool(re.search(r"\b(start|starting point|origin|departure)\b", message, flags=re.IGNORECASE))

        if mentions_end and end_label:
            return [("end", end_label), ("start", start_label)]
        if mentions_start and start_label:
            return [("start", start_label), ("end", end_label)]
        return [("start", start_label), ("end", end_label)]

    def _anchors_from_route_text(self, message: str) -> list[dict[str, Any]]:
        labels = self._route_labels_from_text(message)
        anchors: list[dict[str, Any]] = []
        for role, label in labels:
            for anchor in self._anchors_from_geocode(label):
                anchors.append({**anchor, "id": f"message-{role}-geocoded", "routeRole": role, "placeLabel": label})
                break
        return anchors[:2]

    @classmethod
    def _route_labels_from_text(cls, message: str) -> list[tuple[str, str]]:
        normalized = re.sub(r"\s+", " ", message).strip()
        patterns = [
            (r"\bfrom\s+(.{2,120}?)\s+\bto\s+(.{2,120})(?:[?.!]|$)", ("start", "end")),
            (r"\bbetween\s+(.{2,120}?)\s+\band\s+(.{2,120})(?:[?.!]|$)", ("start", "end")),
        ]
        for pattern, roles in patterns:
            matched = re.search(pattern, normalized, flags=re.IGNORECASE)
            if not matched:
                continue
            start = cls._clean_route_label(matched.group(1))
            end = cls._clean_route_label(matched.group(2))
            return [(roles[0], start), (roles[1], end)] if start and end else []
        return []

    @staticmethod
    def _clean_route_label(value: str) -> str:
        cleaned = re.sub(
            r"\b(?:for|with|on|this|next|over|under|that has|and then|please)\b.*$",
            "",
            value,
            flags=re.IGNORECASE,
        )
        return cleaned.strip(" .,!?'\"")[:120]

    @staticmethod
    def _extract_location_query(message: str) -> str | None:
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
        query = TripAiOrchestrator._clean_location_query(query)
        if not query or re.search(
            r"^(me|here|my location|current location|the route|this route|start|the start|starting point|origin|end|the end|destination|the destination)$",
            query,
            flags=re.IGNORECASE,
        ):
            return None
        return query[:160]

    @staticmethod
    def _clean_location_query(value: str) -> str:
        value = re.sub(
            r"^(?:me|here|my location|current location)\s+(?:around|near|in)\s+",
            "",
            value,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(
            r"\b(?:this|next|coming)\s+(?:weekend|week|month|summer|spring|fall|winter)\b.*$",
            "",
            value,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(
            r"\b(?:today|tomorrow|tonight|now|later|open now|kid[-\s]?friendly|family[-\s]?friendly)\b.*$",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = cleaned.strip(" ,;:?.!\"'")
        if re.search(
            r"\b(?:the route|this route|stops?|nearby|trip|vibe|vibes|theme|interests?)\b",
            cleaned,
            flags=re.IGNORECASE,
        ):
            return ""

        tokens = re.findall(r"[a-z][a-z']*", cleaned.lower())
        non_location_tokens = {
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
        if tokens and all(token in non_location_tokens for token in tokens):
            return ""

        return cleaned

    @staticmethod
    def _interests_from_state(planner_state: dict[str, Any]) -> list[str]:
        for key in ("theme", "interests"):
            value = planner_state.get(key)
            if isinstance(value, list):
                return [str(item) for item in value if str(item).strip()][:8]
            if isinstance(value, str) and value.strip():
                return [part.strip() for part in value.split(",") if part.strip()][:8]
        return []

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed == parsed and parsed not in {float("inf"), float("-inf")} else None

    @staticmethod
    def _place_card(raw: dict[str, Any]) -> dict[str, Any] | None:
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

    @staticmethod
    def _image_parts_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
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
            if TripAiOrchestrator._estimated_base64_bytes(data) > 4 * 1024 * 1024:
                continue
            image_parts.append({"inline_data": {"mime_type": mime_type, "data": data}})
        return image_parts

    @staticmethod
    def _estimated_base64_bytes(value: str) -> int:
        padding = len(value) - len(value.rstrip("="))
        return max(0, (len(value) * 3) // 4 - padding)

    @staticmethod
    def _is_image_inspection_request(message: str) -> bool:
        return bool(
            re.search(
                r"\b(attached|image|images|inspect|look|photo|photos|picture|pictures|review|see|visible|screenshot)\b",
                message,
                flags=re.IGNORECASE,
            )
        )

    def _answer_with_model(
        self,
        *,
        message: str,
        prompt: str,
        planner_state: dict[str, Any],
        preferences: dict[str, Any],
        session_history: list[Any],
        grounding: TravelGrounding,
        user_id: str | None,
        start_date: str | None,
        image_parts: list[dict[str, Any]],
    ) -> ModelResult:
        if image_parts and self._is_image_inspection_request(message) and not self._should_use_gemini():
            answer = (
                "I can help with the route text, but I cannot inspect the attached image until Gemini vision is configured. "
                "Describe what is visible or try again after the hosted vision model is connected."
            )
            return ModelResult(answer, "scope-ai-vision-unavailable", "local", fallback_reason="gemini_vision_unavailable")

        if self._should_use_gemini():
            try:
                return self._generate_with_gemini(
                    message=message,
                    prompt=prompt,
                    planner_state=planner_state,
                    preferences=preferences,
                    session_history=session_history,
                    grounding=grounding,
                    user_id=user_id,
                    start_date=start_date,
                    image_parts=image_parts,
                )
            except Exception:
                if image_parts and self._is_image_inspection_request(message):
                    logger.warning("trip_ai_gemini_vision_failed", exc_info=True)
                    answer = (
                        "I could not inspect the attached image because the hosted vision model failed. "
                        "The rest of the trip planner is still available if you describe the image in text."
                    )
                    return ModelResult(answer, "scope-ai-vision-unavailable", "local", fallback_reason="gemini_vision_failed")
                if self._configured_provider() == "gemini":
                    logger.warning("trip_ai_gemini_failed_provider_gemini", exc_info=True)
                    fallback = self._deterministic_answer(message, prompt, grounding, start_date)
                    return ModelResult(fallback, "scope-local-copilot", "local", fallback_reason="gemini_failed")
                logger.warning("trip_ai_gemini_failed_falling_back", exc_info=True)

        try:
            legacy = plan_trip(prompt, user_id=user_id, start_date=start_date)
            answer = str(legacy.get("itinerary") or "").strip()
            if answer:
                if grounding.place_cards:
                    answer = self._prepend_place_card_summary(answer, grounding.place_cards)
                return ModelResult(
                    answer=answer,
                    model=str(legacy.get("model") or os.environ.get("OLLAMA_MODEL", "llama3.2:3b")),
                    provider="ollama" if legacy.get("steps") else "local",
                    fallback_reason="gemini_unavailable",
                )
        except Exception:
            logger.warning("trip_ai_ollama_fallback_failed", exc_info=True)

        fallback = self._deterministic_answer(message, prompt, grounding, start_date)
        return ModelResult(fallback, "scope-local-copilot", "local", fallback_reason="all_models_failed")

    @staticmethod
    def _configured_provider() -> str:
        provider = os.environ.get("SCOPE_AI_PROVIDER", "auto").strip().lower()
        return provider if provider in {"auto", "gemini", "ollama"} else "auto"

    @classmethod
    def _should_use_gemini(cls) -> bool:
        return cls._configured_provider() in {"auto", "gemini"} and bool(os.environ.get("GEMINI_API_KEY", "").strip())

    def _generate_with_gemini(
        self,
        *,
        message: str,
        prompt: str,
        planner_state: dict[str, Any],
        preferences: dict[str, Any],
        session_history: list[Any],
        grounding: TravelGrounding,
        user_id: str | None,
        start_date: str | None,
        image_parts: list[dict[str, Any]],
    ) -> ModelResult:
        failures: list[str] = []
        use_search = self._should_use_search_grounding(message)
        if use_search:
            use_search = self._consume_budget("gemini_search_grounding", self._env_int("SCOPE_AI_GEMINI_SEARCH_MONTHLY_CAP", 500))

        for model_name in self._model_sequence(message, grounding):
            cap_name = self._cap_name_for_model(model_name)
            if not self._consume_budget(f"gemini_model:{model_name}", self._env_int(cap_name, self._default_cap_for_model(model_name))):
                failures.append(f"{model_name}:cap")
                continue

            try:
                answer, web_sources = self._generate_with_gemini_model(
                    model_name=model_name,
                    message=message,
                    prompt=prompt,
                    planner_state=planner_state,
                    preferences=preferences,
                    session_history=session_history,
                    grounding=grounding,
                    user_id=user_id,
                    start_date=start_date,
                    use_search=use_search,
                    image_parts=image_parts,
                )
                if self._looks_low_quality(answer):
                    failures.append(f"{model_name}:low_quality")
                    continue
                return ModelResult(answer, model_name, "gemini", search_grounding_used=use_search, web_sources=web_sources)
            except requests.HTTPError as exc:
                status_code = exc.response.status_code if exc.response is not None else 0
                failures.append(f"{model_name}:{status_code}")
                if use_search and status_code == 400:
                    try:
                        answer, web_sources = self._generate_with_gemini_model(
                            model_name=model_name,
                            message=message,
                            prompt=prompt,
                            planner_state=planner_state,
                            preferences=preferences,
                            session_history=session_history,
                            grounding=grounding,
                            user_id=user_id,
                            start_date=start_date,
                            use_search=False,
                            image_parts=image_parts,
                        )
                        if self._looks_low_quality(answer):
                            failures.append(f"{model_name}:retry_low_quality")
                            continue
                        return ModelResult(answer, model_name, "gemini", search_grounding_used=False, web_sources=web_sources)
                    except Exception:
                        logger.warning("trip_ai_gemini_retry_without_search_failed", exc_info=True)
                if status_code not in {408, 429, 500, 502, 503, 504}:
                    raise
            except (requests.Timeout, requests.ConnectionError):
                failures.append(f"{model_name}:network")

        raise RuntimeError(f"Gemini trip chat failed for configured models: {', '.join(failures)}")

    def _generate_with_gemini_model(
        self,
        *,
        model_name: str,
        message: str,
        prompt: str,
        planner_state: dict[str, Any],
        preferences: dict[str, Any],
        session_history: list[Any],
        grounding: TravelGrounding,
        user_id: str | None,
        start_date: str | None,
        use_search: bool,
        image_parts: list[dict[str, Any]],
    ) -> tuple[str, list[dict[str, str]]]:
        parts = [
            {
                "text": self._model_prompt(
                    message=message,
                    prompt=prompt,
                    planner_state=planner_state,
                    preferences=preferences,
                    session_history=session_history,
                    grounding=grounding,
                    user_id=user_id,
                    start_date=start_date,
                    image_count=len(image_parts),
                )
            },
            *image_parts,
        ]
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": TRIP_AI_SYSTEM_PROMPT}]},
            "contents": [
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
            "generationConfig": {
                "temperature": self._env_float("SCOPE_AI_GEMINI_TEMPERATURE", 0.35),
                "maxOutputTokens": self._env_int(
                    "SCOPE_AI_GEMINI_MAX_OUTPUT_TOKENS",
                    self._env_int("GEMINI_MAX_OUTPUT_TOKENS", 1800),
                ),
            },
        }
        if use_search:
            body["tools"] = [{"google_search": {}}]

        response = requests.post(
            self._gemini_endpoint(model_name),
            params={"key": os.environ.get("GEMINI_API_KEY", "").strip()},
            json=body,
            timeout=self._env_float("SCOPE_AI_GEMINI_TIMEOUT_SECONDS", self._env_float("GEMINI_TIMEOUT_SECONDS", 30.0)),
        )
        response.raise_for_status()
        payload = response.json()
        return self._extract_gemini_text(payload), self._extract_gemini_grounding_sources(payload)

    def _model_prompt(
        self,
        *,
        message: str,
        prompt: str,
        planner_state: dict[str, Any],
        preferences: dict[str, Any],
        session_history: list[Any],
        grounding: TravelGrounding,
        user_id: str | None,
        start_date: str | None,
        image_count: int = 0,
    ) -> str:
        return "\n\n".join(
            [
                "Current planner prompt:",
                prompt,
                "Normalized planner state JSON:",
                json.dumps(planner_state, sort_keys=True)[:6000],
                "Preferences JSON:",
                json.dumps(preferences, sort_keys=True)[:2000],
                "Recent chat:",
                self._format_session_history(session_history),
                "Live provider evidence:",
                self._format_grounding(grounding),
                "Response contract:",
                (
                    "Answer in plain text. If provider evidence includes place cards, rank 3-5 picks and explain why each fits. "
                    "Mention that exact hours/prices/open-now are provider-backed only when present. "
                    "End with one concrete next action."
                ),
                f"User id for personalization: {user_id}" if user_id else "",
                f"Trip starts: {start_date}" if start_date else "",
                f"Attached image count: {image_count}. Inspect attached images only when present." if image_count else "",
                f"Traveler request: {message}",
            ]
        ).strip()

    @staticmethod
    def _format_session_history(session_history: list[Any]) -> str:
        lines: list[str] = []
        for entry in session_history[-8:] if isinstance(session_history, list) else []:
            if not isinstance(entry, dict):
                continue
            role = "Scope AI" if entry.get("role") == "assistant" else "User"
            content = str(entry.get("content") or "").strip()
            if content:
                lines.append(f"{role}: {content[:1000]}")
        return "\n".join(lines) or "No prior chat."

    @staticmethod
    def _format_grounding(grounding: TravelGrounding) -> str:
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

    @staticmethod
    def _extract_gemini_text(payload: dict[str, Any]) -> str:
        parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "\n".join(str(part.get("text") or "").strip() for part in parts).strip()
        if not text:
            raise RuntimeError("Gemini returned no text")
        return text

    @staticmethod
    def _extract_gemini_grounding_sources(payload: dict[str, Any]) -> list[dict[str, str]]:
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

    @staticmethod
    def _gemini_endpoint(model_name: str) -> str:
        model = model_name.removeprefix("models/")
        encoded_model = quote(model, safe="")
        base_url = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        return f"{base_url}/models/{encoded_model}:generateContent"

    def _model_sequence(self, message: str, grounding: TravelGrounding) -> list[str]:
        fast = os.environ.get("SCOPE_AI_FAST_MODEL") or os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
        pro = os.environ.get("SCOPE_AI_PRO_MODEL") or "gemini-2.5-pro"
        lite = os.environ.get("SCOPE_AI_LITE_MODEL") or "gemini-2.5-flash-lite"
        fallback_models = [model.strip() for model in os.environ.get("GEMINI_FALLBACK_MODELS", "").split(",") if model.strip()]
        if self._is_complex_request(message, grounding):
            sequence = [pro, fast, lite, *fallback_models]
        else:
            sequence = [fast, lite, *fallback_models]
        deduped: list[str] = []
        for model in sequence:
            if model and model not in deduped:
                deduped.append(model)
        return deduped

    @staticmethod
    def _is_complex_request(message: str, grounding: TravelGrounding) -> bool:
        return bool(
            grounding.place_cards
            or re.search(r"\b(build|optimize|compare|multi[-\s]?day|weekend|itinerary|best|around|nearby|rank|research)\b", message, flags=re.IGNORECASE)
        )

    @staticmethod
    def _should_use_search_grounding(message: str) -> bool:
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

    @staticmethod
    def _cap_name_for_model(model_name: str) -> str:
        lowered = model_name.lower()
        if "pro" in lowered:
            return "SCOPE_AI_GEMINI_PRO_MONTHLY_CAP"
        if "lite" in lowered:
            return "SCOPE_AI_GEMINI_LITE_MONTHLY_CAP"
        return "SCOPE_AI_GEMINI_FAST_MONTHLY_CAP"

    @staticmethod
    def _default_cap_for_model(model_name: str) -> int:
        lowered = model_name.lower()
        if "pro" in lowered:
            return 100
        if "lite" in lowered:
            return 1000
        return 1000

    def _consume_budget(self, sku: str, monthly_cap: int) -> bool:
        if monthly_cap < 0 or not has_app_context():
            return True
        try:
            usage = self._usage_guard.consume(sku, monthly_cap)
        except Exception:
            logger.info("trip_ai_usage_guard_failed_open", exc_info=True)
            return True
        return bool(usage.get("allowed"))

    @staticmethod
    def _looks_low_quality(answer: str) -> bool:
        stripped = answer.strip()
        return len(stripped) < 20 or stripped.startswith(("{", "["))

    def _deterministic_answer(self, message: str, prompt: str, grounding: TravelGrounding, start_date: str | None) -> str:
        if grounding.place_cards:
            lines = [
                "Here is the strongest nearby read from live travel data:",
                *[
                    f"{index}. {card['title']} - {card.get('reason') or card.get('subtitle') or 'good fit for this trip.'}"
                    for index, card in enumerate(grounding.place_cards[:5], 1)
                ],
                "Verify hours, prices, reservations, and drive timing before you commit.",
                "Next move: pick one and I can help add it to the route after you confirm.",
            ]
            return "\n".join(lines)
        return _fallback_plan(prompt, start_date)

    @staticmethod
    def _prepend_place_card_summary(answer: str, cards: list[dict[str, Any]]) -> str:
        card_lines = [
            "Live nearby picks:",
            *[
                f"{index}. {card['title']} - {card.get('reason') or card.get('subtitle') or 'provider-backed nearby option.'}"
                for index, card in enumerate(cards[:3], 1)
            ],
            "",
        ]
        return "\n".join(card_lines) + answer

    @staticmethod
    def _extract_simple_actions(message: str) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        normalized = message.strip()

        route_match = re.search(r"\bfrom\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)", normalized, flags=re.IGNORECASE)
        if route_match:
            start = TripAiOrchestrator._clean_route_label(route_match.group(1))
            end = TripAiOrchestrator._clean_route_label(route_match.group(2))
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

    @staticmethod
    def _chips_for(message: str, planner_state: dict[str, Any], grounding: TravelGrounding, actions: list[dict[str, Any]]) -> list[str]:
        if grounding.place_cards:
            return ["Add the best fit", "Show more nearby", "Build this into the route"]
        if actions:
            return ["Check route status", "Build the itinerary", "Find places nearby"]
        if not planner_state.get("start") and not planner_state.get("destination"):
            return ["Add a start place", "Use current location", "Search near a city"]
        return ["Find places nearby", "Check timing", "Build the itinerary"]

    @staticmethod
    def _response(
        *,
        answer: str,
        model_result: ModelResult,
        grounding: TravelGrounding,
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

    @staticmethod
    def _sentence_chunks(value: str) -> list[str]:
        chunks = [chunk.strip() for chunk in re.split(r"(?<=[.!?])\s+", value.strip()) if chunk.strip()]
        return chunks or ([value] if value else [])

    @staticmethod
    def _env_int(name: str, default: int) -> int:
        try:
            return int(os.environ.get(name, default))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _env_float(name: str, default: float) -> float:
        try:
            return float(os.environ.get(name, default))
        except (TypeError, ValueError):
            return default
