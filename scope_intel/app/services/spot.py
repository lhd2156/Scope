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
