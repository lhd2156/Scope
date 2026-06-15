"""Prompt parsing and fallback heuristics for the Scope trip planner."""

from __future__ import annotations

import re
from datetime import date


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

    traveler_request = _read_traveler_request(prompt)
    if re.search(r"\bweekend\b", traveler_request, flags=re.IGNORECASE):
        return 2

    request_duration_match = re.search(r"\b(\d{1,2})\s*(?:day|days|d)\b", traveler_request, flags=re.IGNORECASE)
    if request_duration_match:
        parsed = int(request_duration_match.group(1))
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
    traveler_request = _read_traveler_request(prompt)
    try:
        if int(travelers) > 0:
            return True
    except (TypeError, ValueError):
        pass

    return bool(
        re.search(r"\b(solo|alone|couple|pair|partner|group|family|kids?|children|friends?|travelers?|people)\b", travel_party, flags=re.IGNORECASE)
        or re.search(r"\b(solo|alone|couple|pair|partner|group|family|kids?|children|friends?|travelers?|people)\b", traveler_request, flags=re.IGNORECASE)
    )


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


def _infer_interests_from_text(value: str) -> str:
    normalized = value.lower()
    interests: list[str] = []

    def add(interest: str, pattern: str) -> None:
        if re.search(pattern, normalized) and interest not in interests:
            interests.append(interest)

    add("food", r"\b(food|restaurants?|coffee|cafes?|lunch|dinner|breakfast|eat|drink)\b")
    add("culture", r"\b(culture|museums?|art|history|historic)\b")
    add("nature", r"\b(nature|parks?|trails?|hikes?|outdoors?)\b")
    add("scenic", r"\b(scenic|views?|overlooks?|photo)\b")
    add("adventure", r"\b(adventure|active|activities|zipline|rafting|climb)\b")
    add("nightlife", r"\b(nightlife|bars?|clubs?|live music)\b")
    add("shopping", r"\b(shopping|markets?|malls?|boutiques?)\b")
    add("entertainment", r"\b(entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b")

    if re.search(r"\b(?:balanced\s+(?:vibes?|interests?|mix)|mix|variety)\b", normalized) and not interests:
        interests.extend(["food", "culture", "scenic"])

    return ", ".join(interests)


def _infer_pace_from_text(value: str) -> str:
    if re.search(r"\b(relaxed|slow|chill|easy)\b", value, flags=re.IGNORECASE):
        return "relaxed"
    if re.search(r"\b(packed|busy|full|fast)\b", value, flags=re.IGNORECASE):
        return "packed"
    if re.search(r"\b(balanced|moderate|standard|normal)\b", value, flags=re.IGNORECASE):
        return "balanced"
    return ""
