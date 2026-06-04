from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0


def haversine_distance_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    return EARTH_RADIUS_KM * 2 * asin(
        sqrt(
            sin(radians(lat_b - lat_a) / 2) ** 2
            + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(radians(lng_b - lng_a) / 2) ** 2
        )
    )
