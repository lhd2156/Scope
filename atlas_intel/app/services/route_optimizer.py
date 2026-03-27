from math import sqrt

class RouteOptimizer:
    def optimize(self, spots: list[dict], start_lat: float | None, start_lng: float | None) -> dict:
        ordered: list[dict] = []
        remaining = spots.copy()
        current = {"latitude": start_lat or remaining[0]["latitude"], "longitude": start_lng or remaining[0]["longitude"]}
        total_distance = 0.0
        while remaining:
            next_spot = min(remaining, key=lambda spot: self._distance(current["latitude"], current["longitude"], spot["latitude"], spot["longitude"]))
            total_distance += self._distance(current["latitude"], current["longitude"], next_spot["latitude"], next_spot["longitude"])
            ordered.append(next_spot)
            current = next_spot
            remaining.remove(next_spot)
        return {"orderedSpots": ordered, "estimatedDistance": round(total_distance * 111, 2)}

    @staticmethod
    def _distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return sqrt(((lat1 - lat2) ** 2) + ((lon1 - lon2) ** 2))
