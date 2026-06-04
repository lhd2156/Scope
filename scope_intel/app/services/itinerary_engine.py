from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, timedelta
from math import sqrt

from app.services.content_client import ContentServiceClient, Spot

PACE_MAP = {"relaxed": 3, "moderate": 5, "packed": 8}
TIME_SLOTS_BY_PACE = {
    "relaxed": ["09:00", "12:30", "16:00"],
    "moderate": ["08:30", "10:45", "13:00", "15:30", "18:30"],
    "packed": ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", "19:00"],
}

@dataclass(frozen=True, slots=True)
class WeatherSnapshot:
    summary: str
    sunny_bias: float

@dataclass(frozen=True, slots=True)
class ScoredSpot:
    spot: Spot
    score: float
    confidence: float
    reason: str

class ItineraryEngine:
    def __init__(self, content_client: ContentServiceClient) -> None:
        self.content_client = content_client

    def generate(self, payload: dict, weather: WeatherSnapshot) -> dict:
        destination = payload["destination"]
        end_destination = payload.get("endDestination")
        spots = self._search_route_spots(destination, end_destination, payload["interests"])
        scored_spots = sorted(
            [self._score_spot(spot, payload, weather) for spot in spots],
            key=lambda scored: scored.score,
            reverse=True,
        )
        selected_spots = self._select_budgeted_spots(scored_spots, payload)
        ordered_spots = self._nearest_neighbor(
            selected_spots,
            self._payload_coordinate(payload, "destinationLatitude", "destinationLongitude"),
            self._payload_coordinate(payload, "endDestinationLatitude", "endDestinationLongitude"),
        )
        days = self._build_days(ordered_spots, payload["startDate"], payload["endDate"], payload["pace"], payload["groupSize"])
        total_cost = sum(spot["estimatedCost"] for day in days for spot in day["spots"])
        return {
            "destination": self._build_route_label(destination, end_destination),
            "days": days,
            "totalEstimatedCost": float(round(total_cost, 2)),
            "weatherForecast": weather.summary,
        }

    def _search_route_spots(self, destination: str, end_destination: str | None, interests: list[str]) -> list[Spot]:
        start_spots = self.content_client.search_spots(destination, interests)
        if not end_destination:
            return start_spots

        end_spots = self.content_client.search_spots(end_destination, interests)
        merged: dict[str, Spot] = {spot.spot_id: spot for spot in start_spots}
        for spot in end_spots:
            merged.setdefault(spot.spot_id, spot)
        return list(merged.values())

    @staticmethod
    def _build_route_label(destination: str, end_destination: str | None) -> str:
        if not end_destination:
            return destination

        return f"{destination} to {end_destination}"

    def _select_budgeted_spots(self, scored_spots: list[ScoredSpot], payload: dict) -> list[ScoredSpot]:
        days_count = (payload["endDate"] - payload["startDate"]).days + 1
        max_spots = days_count * PACE_MAP.get(payload["pace"], PACE_MAP["moderate"])
        group_size = int(payload["groupSize"])
        remaining_budget = float(payload["budget"])
        selected: list[ScoredSpot] = []

        for scored in scored_spots:
            group_cost = scored.spot.estimated_cost * group_size
            if group_cost <= remaining_budget or group_cost == 0:
                selected.append(scored)
                remaining_budget -= group_cost
            if len(selected) >= max_spots:
                break

        if selected:
            return selected

        if not scored_spots:
            return []

        cheapest = min(scored_spots, key=lambda scored: scored.spot.estimated_cost * group_size)
        return [
            replace(
                cheapest,
                confidence=min(cheapest.confidence, 0.42),
                reason=f"Budget stretch fallback: {cheapest.reason}",
            )
        ]

    def _score_spot(self, spot: Spot, payload: dict, weather: WeatherSnapshot) -> ScoredSpot:
        interests = self._normalized_interests(payload["interests"])
        rating_component = self._clamp01(spot.rating / 5)
        interest_component = self._interest_component(spot, interests)
        popularity_component = self._clamp01(spot.popularity / 100)
        group_cost = max(0.0, spot.estimated_cost * int(payload["groupSize"]))
        budget_component = 1 - self._clamp01(group_cost / max(float(payload["budget"]) * 0.35, 1.0))
        weather_component = self._weather_component(spot, weather)
        photo_component = self._clamp01(spot.photos_count / 40)
        route_component = self._route_component(spot, payload)
        score = (
            (0.30 * rating_component)
            + (0.25 * interest_component)
            + (0.16 * popularity_component)
            + (0.14 * budget_component)
            + (0.08 * weather_component)
            + (0.04 * photo_component)
            + (0.03 * route_component)
        )
        confidence = self._clamp(0.48 + (score * 0.48), 0.48, 0.96)
        return ScoredSpot(
            spot=spot,
            score=round(score, 4),
            confidence=round(confidence, 2),
            reason=self._build_reason(spot, interest_component, route_component, weather_component, budget_component, popularity_component),
        )

    @staticmethod
    def _normalized_interests(interests: list[str]) -> set[str]:
        return {interest.strip().lower() for interest in interests if interest.strip()}

    def _interest_component(self, spot: Spot, interests: set[str]) -> float:
        category = spot.category.lower()
        vibe_tokens = set(spot.vibe.lower().replace(",", " ").split())
        description_tokens = set(spot.description.lower().replace(",", " ").split())
        title_tokens = set(spot.title.lower().replace(",", " ").split())
        if category in interests:
            return 1.0
        if interests & vibe_tokens:
            return 0.82
        if interests & (description_tokens | title_tokens):
            return 0.68
        return 0.45 if interests else 0.55

    @staticmethod
    def _weather_component(spot: Spot, weather: WeatherSnapshot) -> float:
        if spot.is_outdoor:
            return ItineraryEngine._clamp01(0.35 + weather.sunny_bias)
        return 0.58 if weather.sunny_bias < 0.25 else 0.48

    def _route_component(self, spot: Spot, payload: dict) -> float:
        start_coordinate = self._payload_coordinate(payload, "destinationLatitude", "destinationLongitude")
        end_coordinate = self._payload_coordinate(payload, "endDestinationLatitude", "endDestinationLongitude")
        if not start_coordinate and not end_coordinate:
            return 0.55

        distances = []
        if start_coordinate:
            distances.append(self._distance(start_coordinate[0], start_coordinate[1], spot.latitude, spot.longitude))
        if end_coordinate:
            distances.append(self._distance(end_coordinate[0], end_coordinate[1], spot.latitude, spot.longitude))
        nearest_anchor_distance = min(distances) if distances else 0
        return 1 - self._clamp01(nearest_anchor_distance / 2.5)

    def _build_reason(
        self,
        spot: Spot,
        interest_component: float,
        route_component: float,
        weather_component: float,
        budget_component: float,
        popularity_component: float,
    ) -> str:
        parts: list[str] = []
        if interest_component >= 0.95:
            parts.append(f"matches your {spot.category} preference")
        elif interest_component >= 0.68 and spot.vibe:
            parts.append(f"fits the {spot.vibe} vibe")
        else:
            parts.append(f"adds a {spot.category} contrast")

        if route_component >= 0.7:
            parts.append("keeps the route tight")
        if weather_component >= 0.7 and spot.is_outdoor:
            parts.append("works well with the forecast")
        if budget_component >= 0.65:
            parts.append("stays light on the budget")
        elif budget_component <= 0.15:
            parts.append("uses more budget, so treat it as a priority stop")
        elif popularity_component >= 0.8:
            parts.append("has a strong community signal")

        reason = "; ".join(parts[:3])
        return f"{reason[:1].upper()}{reason[1:]}."

    def _nearest_neighbor(
        self,
        spots: list[ScoredSpot],
        start_coordinate: tuple[float, float] | None = None,
        end_coordinate: tuple[float, float] | None = None,
    ) -> list[ScoredSpot]:
        if not spots:
            return []
        remaining = spots.copy()
        if start_coordinate:
            start_latitude, start_longitude = start_coordinate
            first_spot = min(
                remaining,
                key=lambda candidate: self._route_step_cost(start_latitude, start_longitude, candidate, end_coordinate),
            )
            remaining.remove(first_spot)
            route = [first_spot]
        else:
            route = [remaining.pop(0)]
        while remaining:
            current = route[-1].spot
            next_spot = min(
                remaining,
                key=lambda candidate: self._route_step_cost(current.latitude, current.longitude, candidate, end_coordinate),
            )
            route.append(next_spot)
            remaining.remove(next_spot)
        return route

    def _route_step_cost(
        self,
        current_latitude: float,
        current_longitude: float,
        candidate: ScoredSpot,
        end_coordinate: tuple[float, float] | None,
    ) -> float:
        spot = candidate.spot
        next_leg = self._distance(current_latitude, current_longitude, spot.latitude, spot.longitude)
        end_bias = 0.0
        if end_coordinate:
            end_bias = 0.35 * self._distance(spot.latitude, spot.longitude, end_coordinate[0], end_coordinate[1])
        return next_leg + end_bias - (0.08 * candidate.score)

    @staticmethod
    def _payload_coordinate(payload: dict, latitude_key: str, longitude_key: str) -> tuple[float, float] | None:
        latitude = payload.get(latitude_key)
        longitude = payload.get(longitude_key)
        if latitude is None or longitude is None:
            return None
        return float(latitude), float(longitude)

    def _build_days(self, spots: list[ScoredSpot], start_date: date, end_date: date, pace: str, group_size: int) -> list[dict]:
        days_count = (end_date - start_date).days + 1
        spots_per_day = PACE_MAP.get(pace, PACE_MAP["moderate"])
        time_slots = TIME_SLOTS_BY_PACE.get(pace, TIME_SLOTS_BY_PACE["moderate"])
        days: list[dict] = []
        for index in range(days_count):
            date_value = start_date + timedelta(days=index)
            start = index * spots_per_day
            day_spots = spots[start:start + spots_per_day]
            serialized = []
            for slot_index, scored in enumerate(day_spots):
                spot = scored.spot
                serialized.append({
                    "spotId": spot.spot_id,
                    "title": spot.title,
                    "timeSlot": time_slots[slot_index],
                    "duration": 90 if spot.category == "culture" else 60,
                    "latitude": spot.latitude,
                    "longitude": spot.longitude,
                    "category": spot.category,
                    "estimatedCost": float(round(spot.estimated_cost * group_size, 2)),
                    "reason": scored.reason,
                    "confidence": scored.confidence,
                })
            days.append({"dayNumber": index + 1, "date": date_value.isoformat(), "spots": serialized})
        return days

    @staticmethod
    def _clamp(value: float, minimum: float, maximum: float) -> float:
        return min(max(value, minimum), maximum)

    @staticmethod
    def _clamp01(value: float) -> float:
        return ItineraryEngine._clamp(value, 0.0, 1.0)

    @staticmethod
    def _distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return sqrt(((lat1 - lat2) ** 2) + ((lon1 - lon2) ** 2))
