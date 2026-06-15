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

import requests
from flask import has_app_context

from app.agents.trip_ai_orchestrator_helpers import (
    anchor_from_fields,
    cap_name_for_model,
    chips_for,
    clean_location_query,
    clean_route_label,
    configured_provider,
    default_cap_for_model,
    env_float,
    env_int,
    estimated_base64_bytes,
    extract_gemini_grounding_sources,
    extract_gemini_text,
    extract_location_query,
    extract_simple_actions,
    format_grounding,
    format_session_history,
    gemini_endpoint,
    image_parts_from_payload,
    interests_from_state,
    is_complex_request,
    is_image_inspection_request,
    is_nearby_request,
    looks_low_quality,
    mentions_current_location,
    message_from_payload,
    number,
    place_card,
    planner_label_candidates,
    planner_state_from_payload,
    prepend_place_card_summary,
    prompt_from_payload,
    response_payload,
    route_labels_from_text,
    sentence_chunks,
    should_use_gemini,
    should_use_live_travel_data,
    should_use_search_grounding,
    snake,
    start_date_from_payload,
    stops_from_prompt,
    travel_category,
)
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


@dataclass(frozen=True, slots=True)
class _GeminiGenerationContext:
    message: str
    prompt: str
    planner_state: dict[str, Any]
    preferences: dict[str, Any]
    session_history: list[Any]
    grounding: TravelGrounding
    user_id: str | None
    start_date: str | None
    image_parts: list[dict[str, Any]]


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

    _message_from_payload = staticmethod(message_from_payload)
    _prompt_from_payload = staticmethod(prompt_from_payload)
    _planner_state_from_payload = staticmethod(planner_state_from_payload)
    _stops_from_prompt = staticmethod(stops_from_prompt)
    _start_date_from_payload = staticmethod(start_date_from_payload)
    _is_nearby_request = staticmethod(is_nearby_request)
    _should_use_live_travel_data = staticmethod(should_use_live_travel_data)
    _mentions_current_location = staticmethod(mentions_current_location)
    _travel_category = staticmethod(travel_category)
    _snake = staticmethod(snake)
    _anchor_from_fields = staticmethod(anchor_from_fields)
    _planner_label_candidates = staticmethod(planner_label_candidates)
    _route_labels_from_text = staticmethod(route_labels_from_text)
    _clean_route_label = staticmethod(clean_route_label)
    _extract_location_query = staticmethod(extract_location_query)
    _clean_location_query = staticmethod(clean_location_query)
    _interests_from_state = staticmethod(interests_from_state)
    _number = staticmethod(number)
    _place_card = staticmethod(place_card)
    _image_parts_from_payload = staticmethod(image_parts_from_payload)
    _estimated_base64_bytes = staticmethod(estimated_base64_bytes)
    _is_image_inspection_request = staticmethod(is_image_inspection_request)
    _configured_provider = staticmethod(configured_provider)
    _should_use_gemini = staticmethod(should_use_gemini)
    _format_session_history = staticmethod(format_session_history)
    _format_grounding = staticmethod(format_grounding)
    _extract_gemini_text = staticmethod(extract_gemini_text)
    _extract_gemini_grounding_sources = staticmethod(extract_gemini_grounding_sources)
    _gemini_endpoint = staticmethod(gemini_endpoint)
    _is_complex_request = staticmethod(is_complex_request)
    _should_use_search_grounding = staticmethod(should_use_search_grounding)
    _cap_name_for_model = staticmethod(cap_name_for_model)
    _default_cap_for_model = staticmethod(default_cap_for_model)
    _looks_low_quality = staticmethod(looks_low_quality)
    _prepend_place_card_summary = staticmethod(prepend_place_card_summary)
    _extract_simple_actions = staticmethod(extract_simple_actions)
    _chips_for = staticmethod(chips_for)
    _response = staticmethod(response_payload)
    _sentence_chunks = staticmethod(sentence_chunks)
    _env_int = staticmethod(env_int)
    _env_float = staticmethod(env_float)

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

    def _anchors_from_route_text(self, message: str) -> list[dict[str, Any]]:
        labels = self._route_labels_from_text(message)
        anchors: list[dict[str, Any]] = []
        for role, label in labels:
            for anchor in self._anchors_from_geocode(label):
                anchors.append({**anchor, "id": f"message-{role}-geocoded", "routeRole": role, "placeLabel": label})
                break
        return anchors[:2]

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
        context = _GeminiGenerationContext(
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
        use_search = self._gemini_search_grounding_enabled(message)

        for model_name in self._model_sequence(message, grounding):
            if not self._consume_gemini_model_budget(model_name):
                failures.append(f"{model_name}:cap")
                continue

            try:
                result = self._generate_gemini_model_result(
                    model_name=model_name,
                    context=context,
                    use_search=use_search,
                )
                if result is None:
                    failures.append(f"{model_name}:low_quality")
                    continue
                return result
            except requests.HTTPError as exc:
                status_code = exc.response.status_code if exc.response is not None else 0
                failures.append(f"{model_name}:{status_code}")
                retry_result, retry_consumed_error = self._retry_gemini_without_search_after_http_error(
                    model_name=model_name,
                    context=context,
                    use_search=use_search,
                    status_code=status_code,
                    failures=failures,
                )
                if retry_result is not None:
                    return retry_result
                if retry_consumed_error:
                    continue
                if status_code not in {408, 429, 500, 502, 503, 504}:
                    raise
            except (requests.Timeout, requests.ConnectionError):
                failures.append(f"{model_name}:network")

        raise RuntimeError(f"Gemini trip chat failed for configured models: {', '.join(failures)}")

    def _gemini_search_grounding_enabled(self, message: str) -> bool:
        use_search = self._should_use_search_grounding(message)
        if use_search:
            return self._consume_budget("gemini_search_grounding", self._env_int("SCOPE_AI_GEMINI_SEARCH_MONTHLY_CAP", 500))
        return False

    def _consume_gemini_model_budget(self, model_name: str) -> bool:
        cap_name = self._cap_name_for_model(model_name)
        monthly_cap = self._env_int(cap_name, self._default_cap_for_model(model_name))
        return self._consume_budget(f"gemini_model:{model_name}", monthly_cap)

    def _generate_gemini_model_result(
        self,
        *,
        model_name: str,
        context: _GeminiGenerationContext,
        use_search: bool,
    ) -> ModelResult | None:
        answer, web_sources = self._generate_with_gemini_model(
            model_name=model_name,
            message=context.message,
            prompt=context.prompt,
            planner_state=context.planner_state,
            preferences=context.preferences,
            session_history=context.session_history,
            grounding=context.grounding,
            user_id=context.user_id,
            start_date=context.start_date,
            use_search=use_search,
            image_parts=context.image_parts,
        )
        if self._looks_low_quality(answer):
            return None
        return ModelResult(answer, model_name, "gemini", search_grounding_used=use_search, web_sources=web_sources)

    def _retry_gemini_without_search_after_http_error(
        self,
        *,
        model_name: str,
        context: _GeminiGenerationContext,
        use_search: bool,
        status_code: int,
        failures: list[str],
    ) -> tuple[ModelResult | None, bool]:
        if not use_search or status_code != 400:
            return None, False
        try:
            result = self._generate_gemini_model_result(
                model_name=model_name,
                context=context,
                use_search=False,
            )
            if result is None:
                failures.append(f"{model_name}:retry_low_quality")
                return None, True
            return result, True
        except Exception:
            logger.warning("trip_ai_gemini_retry_without_search_failed", exc_info=True)
            return None, False

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

    def _consume_budget(self, sku: str, monthly_cap: int) -> bool:
        if monthly_cap < 0 or not has_app_context():
            return True
        try:
            usage = self._usage_guard.consume(sku, monthly_cap)
        except Exception:
            logger.info("trip_ai_usage_guard_failed_open", exc_info=True)
            return True
        return bool(usage.get("allowed"))

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
