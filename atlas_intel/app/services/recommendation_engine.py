from __future__ import annotations

from typing import Any

from app.ml.model_loader import MlModelLoader, ml_model_loader
from app.services.content_client import ContentServiceClient, Spot
from app.services.native_geo import get_native_geo

TEXT_SIMILARITY_WEIGHT = 0.65
COLLABORATIVE_WEIGHT = 0.2
POPULARITY_WEIGHT = 0.1
GEO_PROXIMITY_WEIGHT = 0.05
SIMILARITY_TEXT_WEIGHT = 0.85
SIMILARITY_GEO_WEIGHT = 0.15
GEO_PROXIMITY_DISTANCE_CAP_KM = 25.0
NATIVE_R_TREE_NODE_CAPACITY = 8


class RecommendationEngine:
    def __init__(
        self,
        content_client: ContentServiceClient,
        model_loader: MlModelLoader = ml_model_loader,
        native_geo_module: Any | None = None,
    ) -> None:
        self.content_client = content_client
        self.model_loader = model_loader
        self.native_geo = native_geo_module if native_geo_module is not None else get_native_geo()

    def recommend_spots(self, user_id: str, liked_spot_ids: list[str], interests: list[str], limit: int) -> list[dict]:
        spots = self.content_client.get_all_spots()
        documents = [f"{spot.description} {spot.category} {spot.vibe}" for spot in spots]
        model = self.model_loader.build_text_similarity_model()
        matrix = model.fit_transform(documents)
        liked_spots = [spot for spot in spots if spot.spot_id in liked_spot_ids]
        liked_spot_likers = self._likers_for_spots(spots, liked_spot_ids)
        location_bonus_by_spot_id = self._location_bonus_by_spot_id(spots, liked_spots)
        user_profile = " ".join(interests + [spot.vibe for spot in liked_spots]) or "adventure culture food"
        user_vector = model.transform([user_profile])
        similarities = model.cosine_similarity(user_vector, matrix)[0]
        recommendations = []

        for index, spot in enumerate(spots):
            collaborative_score = sum(
                1
                for liker in spot.liked_by_users
                if liker == user_id or liker in liked_spot_likers
            )
            location_bonus = location_bonus_by_spot_id.get(spot.spot_id, 0.0)
            total_score = round(
                (float(similarities[index]) * TEXT_SIMILARITY_WEIGHT)
                + (collaborative_score * COLLABORATIVE_WEIGHT)
                + ((spot.popularity / 100) * POPULARITY_WEIGHT)
                + (location_bonus * GEO_PROXIMITY_WEIGHT),
                4,
            )
            reason = f"Matches interests in {spot.category} with {spot.vibe} vibe"
            if location_bonus > 0.0:
                reason = f"{reason}; close to spots you already liked"
            recommendations.append(
                {
                    "spotId": spot.spot_id,
                    "title": spot.title,
                    "category": spot.category,
                    "score": total_score,
                    "reason": reason,
                }
            )

        filtered = [spot for spot in recommendations if spot["spotId"] not in liked_spot_ids]
        return sorted(filtered, key=lambda item: item["score"], reverse=True)[:limit]

    def similar_spots(self, spot_id: str, limit: int = 5) -> list[dict]:
        spots = self.content_client.get_all_spots()
        source = self.content_client.get_spot(spot_id)
        if source is None:
            return []

        model = self.model_loader.build_text_similarity_model()
        matrix = model.fit_transform([f"{spot.description} {spot.category} {spot.vibe}" for spot in spots])
        source_index = next(index for index, spot in enumerate(spots) if spot.spot_id == spot_id)
        similarities = model.cosine_similarity(matrix[source_index], matrix)[0]
        similar = []

        for index, candidate in enumerate(spots):
            if candidate.spot_id == spot_id:
                continue

            location_bonus = self._location_bonus_from_distance_km(
                self._native_distance_km(source, candidate)
            )
            score = round(
                (float(similarities[index]) * SIMILARITY_TEXT_WEIGHT)
                + (location_bonus * SIMILARITY_GEO_WEIGHT),
                4,
            )
            similar.append(
                {
                    "spotId": candidate.spot_id,
                    "title": candidate.title,
                    "score": score,
                }
            )

        return sorted(similar, key=lambda item: item["score"], reverse=True)[:limit]

    def _location_bonus_by_spot_id(self, spots: list[Spot], reference_spots: list[Spot]) -> dict[str, float]:
        if self.native_geo is None or not reference_spots:
            return {}

        reference_points = [
            self.native_geo.SpatialPoint(
                spot.spot_id,
                self.native_geo.Coordinate(spot.latitude, spot.longitude),
            )
            for spot in reference_spots
        ]
        index = self.native_geo.RTreeIndex(reference_points, NATIVE_R_TREE_NODE_CAPACITY)
        bonuses: dict[str, float] = {}

        for spot in spots:
            nearest = index.nearest_neighbor(
                self.native_geo.Coordinate(spot.latitude, spot.longitude)
            )
            if nearest is None:
                continue
            bonuses[spot.spot_id] = self._location_bonus_from_distance_km(float(nearest.distance_km))

        return bonuses

    def _native_distance_km(self, left: Spot, right: Spot) -> float | None:
        if self.native_geo is None:
            return None

        return float(
            self.native_geo.haversine_distance_km(
                self.native_geo.Coordinate(left.latitude, left.longitude),
                self.native_geo.Coordinate(right.latitude, right.longitude),
            )
        )

    @staticmethod
    def _location_bonus_from_distance_km(distance_km: float | None) -> float:
        if distance_km is None:
            return 0.0

        bounded_distance = min(max(distance_km, 0.0), GEO_PROXIMITY_DISTANCE_CAP_KM)
        return 1.0 - (bounded_distance / GEO_PROXIMITY_DISTANCE_CAP_KM)

    @staticmethod
    def _likers_for_spots(spots: list[Spot], liked_spot_ids: list[str]) -> set[str]:
        return {liker for spot in spots if spot.spot_id in liked_spot_ids for liker in spot.liked_by_users}
