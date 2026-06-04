from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0088


def haversine_distance_km(
    lat_a: float,
    lng_a: float,
    lat_b: float,
    lng_b: float,
    *,
    earth_radius_km: float = EARTH_RADIUS_KM,
) -> float:
    lat_a_radians = radians(lat_a)
    lat_b_radians = radians(lat_b)
    delta_lat = radians(lat_b - lat_a)
    delta_lng = radians(lng_b - lng_a)
    haversine = (
        sin(delta_lat / 2) ** 2
        + cos(lat_a_radians) * cos(lat_b_radians) * sin(delta_lng / 2) ** 2
    )
    return earth_radius_km * 2 * asin(sqrt(haversine))


def haversine_distance_meters(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    return haversine_distance_km(lat_a, lng_a, lat_b, lng_b) * 1000
