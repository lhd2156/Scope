"""Scoring helpers for travel nearby suggestions."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


def score_travel_suggestion(
    *,
    source: str,
    category: str,
    requested_category: str,
    distance_km: float,
    rating: float | None,
    review_count: int | None,
    price_value: float | None,
    is_open: bool | None,
    context: dict[str, Any],
    safe_float: Callable[[Any, float], float],
    log1p: Callable[[int], float],
) -> float:
    interests: set[str] = context["interests"]
    latest_intent = context["latest_intent"]
    budget_ceiling = context["budget_ceiling"]
    pace = context["pace"]
    radius = max(1.0, safe_float(context.get("radiusKm"), 16.09))

    return (
        60.0
        + _category_affinity_score(category, requested_category, interests)
        + _source_score(source, category)
        + _distance_score(distance_km, radius)
        + _quality_score(rating, review_count, is_open, log1p)
        + _price_score(price_value, budget_ceiling)
        + _pace_score(pace, category)
        + _intent_score(latest_intent, category)
    )


def _category_affinity_score(category: str, requested_category: str, interests: set[str]) -> float:
    if requested_category == "recommended":
        if category in interests:
            return 24
        if interests and category not in {"fuel", "essentials", "stay"}:
            return -6
        return 0
    if category == requested_category:
        return 28
    if requested_category == "scenic" and category in {"nature", "culture", "adventure", "scenic"}:
        return 22
    if requested_category == "outdoors" and category in {"nature", "adventure", "scenic"}:
        return 22
    if requested_category == "shopping" and category in {"shopping", "food", "culture"}:
        return 22
    if requested_category == "entertainment" and category in {"entertainment", "nightlife", "adventure", "culture"}:
        return 22
    if requested_category == "nightlife" and category in {"nightlife", "entertainment", "food", "culture"}:
        return 22
    if requested_category == "essentials" and category in {"essentials", "fuel"}:
        return 18
    return -18


def _source_score(source: str, category: str) -> float:
    if source == "scope":
        return 16
    if source == "google" and category in {"fuel", "stay", "essentials"}:
        return 18
    return 8


def _distance_score(distance_km: float, radius: float) -> float:
    return max(0.0, 22.0 * (1.0 - min(distance_km, radius) / radius))


def _quality_score(
    rating: float | None,
    review_count: int | None,
    is_open: bool | None,
    log1p: Callable[[int], float],
) -> float:
    score = 0.0
    if rating:
        score += max(0.0, rating - 3.2) * 8
    if review_count:
        score += min(14.0, log1p(review_count) * 2.8)
    if is_open is True:
        score += 9
    elif is_open is False:
        score -= 22
    return score


def _price_score(price_value: float | None, budget_ceiling: float) -> float:
    if not price_value or not budget_ceiling:
        return 0
    if price_value <= max(35.0, budget_ceiling * 0.08):
        return 8
    if price_value > max(100.0, budget_ceiling * 0.25):
        return -10
    return 0


def _pace_score(pace: str, category: str) -> float:
    if pace == "relaxed" and category in {"stay", "scenic", "nature", "food"}:
        return 5
    if pace == "packed" and category in {"essentials", "fuel"}:
        return 5
    return 0


def _intent_score(latest_intent: str, category: str) -> float:
    score = 0.0
    if latest_intent and category in latest_intent:
        score += 12
    if latest_intent and "hotel" in latest_intent and category == "stay":
        score += 18
    if latest_intent and "gas" in latest_intent and category == "fuel":
        score += 18
    return score
