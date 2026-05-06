from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from math import sqrt

from app.services.content_client import ContentServiceClient, Spot

PACE_MAP = {"relaxed": 2, "moderate": 3, "packed": 4}
TIME_SLOTS = ["09:00", "12:00", "15:00", "19:00"]

@dataclass(frozen=True, slots=True)
class WeatherSnapshot:
    summary: str
    sunny_bias: float

class ItineraryEngine:
    def __init__(self, content_client: ContentServiceClient) -> None:
        self.content_client = content_client

    def generate(self, payload: dict, weather: WeatherSnapshot) -> dict:
        destination = payload["destination"]
        end_destination = payload.get("endDestination")
        spots = self._search_route_spots(destination, end_destination, payload["interests"])
        eligible_spots = [spot for spot in spots if spot.estimated_cost * payload["groupSize"] <= payload["budget"]]
        scored_spots = sorted(eligible_spots, key=lambda spot: self._score_spot(spot, payload["interests"], weather), reverse=True)
        ordered_spots = self._nearest_neighbor(scored_spots, self._payload_coordinate(payload, "destinationLatitude", "destinationLongitude"))
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

    def _score_spot(self, spot: Spot, interests: list[str], weather: WeatherSnapshot) -> float:
        vibe_match = 1.0 if spot.category in interests else 0.4
        weather_bonus = weather.sunny_bias if spot.is_outdoor else 0.3
        return round((0.45 * spot.rating) + (0.2 * vibe_match * 5) + (0.2 * (spot.popularity / 20)) - (0.1 * (spot.estimated_cost / 10)) + (0.05 * spot.photos_count / 10) + weather_bonus, 4)

    def _nearest_neighbor(self, spots: list[Spot], start_coordinate: tuple[float, float] | None = None) -> list[Spot]:
        if not spots:
            return []
        remaining = spots.copy()
        if start_coordinate:
            start_latitude, start_longitude = start_coordinate
            first_spot = min(remaining, key=lambda candidate: self._distance(start_latitude, start_longitude, candidate.latitude, candidate.longitude))
            remaining.remove(first_spot)
            route = [first_spot]
        else:
            route = [remaining.pop(0)]
        while remaining:
            current = route[-1]
            next_spot = min(remaining, key=lambda candidate: self._distance(current.latitude, current.longitude, candidate.latitude, candidate.longitude))
            route.append(next_spot)
            remaining.remove(next_spot)
        return route

    @staticmethod
    def _payload_coordinate(payload: dict, latitude_key: str, longitude_key: str) -> tuple[float, float] | None:
        latitude = payload.get(latitude_key)
        longitude = payload.get(longitude_key)
        if latitude is None or longitude is None:
            return None
        return float(latitude), float(longitude)

    def _build_days(self, spots: list[Spot], start_date: date, end_date: date, pace: str, group_size: int) -> list[dict]:
        days_count = (end_date - start_date).days + 1
        spots_per_day = PACE_MAP.get(pace, PACE_MAP["moderate"])
        days: list[dict] = []
        for index in range(days_count):
            date_value = start_date + timedelta(days=index)
            start = index * spots_per_day
            day_spots = spots[start:start + spots_per_day]
            serialized = []
            for slot_index, spot in enumerate(day_spots):
                serialized.append({
                    "spotId": spot.spot_id,
                    "title": spot.title,
                    "timeSlot": TIME_SLOTS[slot_index],
                    "duration": 90 if spot.category == "culture" else 60,
                    "latitude": spot.latitude,
                    "longitude": spot.longitude,
                    "category": spot.category,
                    "estimatedCost": float(round(spot.estimated_cost * group_size, 2)),
                })
            days.append({"dayNumber": index + 1, "date": date_value.isoformat(), "spots": serialized})
        return days

    @staticmethod
    def _distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return sqrt(((lat1 - lat2) ** 2) + ((lon1 - lon2) ** 2))
