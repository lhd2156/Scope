from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Spot:
    spot_id: str
    title: str
    description: str
    category: str
    vibe: str
    rating: float
    popularity: float
    estimated_cost: float
    latitude: float
    longitude: float
    is_outdoor: bool
    photos_count: int
    liked_by_users: tuple[str, ...]

SAMPLE_SPOTS: tuple[Spot, ...] = (
    Spot("spot-1", "Fort Worth Taco Trail", "Tacos and street food near downtown", "food", "lively", 4.8, 91, 25, 32.7555, -97.3308, False, 18, ("user-1", "user-2")),
    Spot("spot-2", "Kimbell Art Museum", "World-class art and architecture", "culture", "inspiring", 4.9, 84, 20, 32.7489, -97.3623, False, 42, ("user-2", "user-3")),
    Spot("spot-3", "Trinity Trails Sunset", "Scenic river walk and cycling trail", "outdoors", "chill", 4.7, 79, 0, 32.7507, -97.3511, True, 27, ("user-1", "user-4")),
    Spot("spot-4", "Magnolia Night Market", "Late-night food and local music", "nightlife", "electric", 4.6, 88, 35, 32.7313, -97.3200, True, 24, ("user-2", "user-4")),
    Spot("spot-5", "Botanic Garden Escape", "Relaxed garden paths and seasonal blooms", "nature", "serene", 4.5, 72, 16, 32.7410, -97.3634, True, 30, ("user-3", "user-4")),
    Spot("spot-6", "Stockyards History Walk", "Historic district with culture and food", "culture", "western", 4.4, 86, 15, 32.7877, -97.3462, True, 33, ("user-1", "user-3")),
)

class ContentServiceClient:
    def search_spots(self, destination: str, interests: list[str]) -> list[Spot]:
        lowered = destination.lower()
        if "fort worth" in lowered:
            return [spot for spot in SAMPLE_SPOTS if not interests or spot.category in interests or any(interest in spot.description.lower() for interest in interests)] or list(SAMPLE_SPOTS)
        return list(SAMPLE_SPOTS)

    def get_all_spots(self) -> list[Spot]:
        return list(SAMPLE_SPOTS)

    def get_spot(self, spot_id: str) -> Spot | None:
        return next((spot for spot in SAMPLE_SPOTS if spot.spot_id == spot_id), None)
