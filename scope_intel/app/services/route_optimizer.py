from __future__ import annotations

from typing import Any

from app.services.geo_math import haversine_distance_km
from app.services.native_geo import get_native_geo

NATIVE_R_TREE_NODE_CAPACITY = 8


class RouteOptimizer:
    def __init__(self, native_geo_module: Any | None = None) -> None:
        self.native_geo = native_geo_module if native_geo_module is not None else get_native_geo()

    def optimize(self, spots: list[dict], start_lat: float | None, start_lng: float | None) -> dict:
        if not spots:
            return {"orderedSpots": [], "estimatedDistance": 0.0}

        if self.native_geo is not None:
            return self._optimize_with_native(spots, start_lat, start_lng)

        return self._optimize_with_python(spots, start_lat, start_lng)

    def _optimize_with_native(self, spots: list[dict], start_lat: float | None, start_lng: float | None) -> dict:
        ordered: list[dict] = []
        remaining = [
            {
                "entry_id": f"{spot.get('spotId', 'spot')}-{index}",
                "spot": spot,
            }
            for index, spot in enumerate(spots)
        ]
        start_coordinate = self._start_coordinates(spots, start_lat, start_lng)
        current_coordinate = self.native_geo.Coordinate(*start_coordinate)
        total_distance_km = 0.0

        while remaining:
            spatial_points = [
                self.native_geo.SpatialPoint(
                    entry["entry_id"],
                    self.native_geo.Coordinate(entry["spot"]["latitude"], entry["spot"]["longitude"]),
                )
                for entry in remaining
            ]
            index = self.native_geo.RTreeIndex(spatial_points, NATIVE_R_TREE_NODE_CAPACITY)
            nearest = index.nearest_neighbor(current_coordinate)
            if nearest is None:
                break

            next_index = next(
                index
                for index, entry in enumerate(remaining)
                if entry["entry_id"] == nearest.point.id
            )
            next_entry = remaining.pop(next_index)
            ordered.append(next_entry["spot"])
            total_distance_km += float(nearest.distance_km)
            current_coordinate = nearest.point.coordinate

        return {"orderedSpots": ordered, "estimatedDistance": round(total_distance_km, 2)}

    def _optimize_with_python(self, spots: list[dict], start_lat: float | None, start_lng: float | None) -> dict:
        ordered: list[dict] = []
        remaining = spots.copy()
        current_latitude, current_longitude = self._start_coordinates(spots, start_lat, start_lng)
        total_distance_km = 0.0

        while remaining:
            next_spot = min(
                remaining,
                key=lambda spot: self._distance_km(
                    current_latitude,
                    current_longitude,
                    spot["latitude"],
                    spot["longitude"],
                ),
            )
            leg_distance_km = self._distance_km(
                current_latitude,
                current_longitude,
                next_spot["latitude"],
                next_spot["longitude"],
            )
            total_distance_km += leg_distance_km
            ordered.append(next_spot)
            current_latitude = next_spot["latitude"]
            current_longitude = next_spot["longitude"]
            remaining.remove(next_spot)

        return {"orderedSpots": ordered, "estimatedDistance": round(total_distance_km, 2)}

    @staticmethod
    def _start_coordinates(spots: list[dict], start_lat: float | None, start_lng: float | None) -> tuple[float, float]:
        first_spot = spots[0]
        latitude = start_lat if start_lat is not None else first_spot["latitude"]
        longitude = start_lng if start_lng is not None else first_spot["longitude"]
        return latitude, longitude

    @staticmethod
    def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return haversine_distance_km(lat1, lon1, lat2, lon2)
