from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace

from app.services.content_client import Spot
from app.services.recommendation_engine import RecommendationEngine
from app.services.route_optimizer import RouteOptimizer


class EqualSimilarityModel:
    def fit_transform(self, documents: list[str]):
        return list(documents)

    @staticmethod
    def transform(documents: list[str]):
        return list(documents)

    @staticmethod
    def cosine_similarity(_left, right):
        return [[0.5 for _ in right]]


class EqualSimilarityLoader:
    def __init__(self) -> None:
        self.build_calls = 0

    def build_text_similarity_model(self):
        self.build_calls += 1
        return EqualSimilarityModel()


class GeoContentClient:
    def __init__(self, spots: list[Spot]) -> None:
        self._spots = list(spots)

    def get_all_spots(self) -> list[Spot]:
        return list(self._spots)

    def get_spot(self, spot_id: str) -> Spot | None:
        return next((spot for spot in self._spots if spot.spot_id == spot_id), None)


def build_fake_native_geo():
    counters = {
        "haversine_calls": 0,
        "index_builds": 0,
        "nearest_queries": 0,
    }

    @dataclass
    class Coordinate:
        latitude: float
        longitude: float

    @dataclass
    class SpatialPoint:
        id: str
        coordinate: Coordinate

    @dataclass
    class NearestNeighbor:
        point: SpatialPoint
        distance_km: float

    def distance(left: Coordinate, right: Coordinate) -> float:
        return abs(left.latitude - right.latitude) + abs(left.longitude - right.longitude)

    class RTreeIndex:
        def __init__(self, points, node_capacity=8):
            counters["index_builds"] += 1
            self.points = list(points)
            self.node_capacity = node_capacity

        def nearest_neighbor(self, query):
            counters["nearest_queries"] += 1
            if not self.points:
                return None

            best_point = min(self.points, key=lambda point: distance(point.coordinate, query))
            return NearestNeighbor(best_point, distance(best_point.coordinate, query))

    def haversine_distance_km(left: Coordinate, right: Coordinate) -> float:
        counters["haversine_calls"] += 1
        return distance(left, right)

    return SimpleNamespace(
        Coordinate=Coordinate,
        SpatialPoint=SpatialPoint,
        RTreeIndex=RTreeIndex,
        haversine_distance_km=haversine_distance_km,
        counters=counters,
    )


def test_route_optimizer_uses_native_rtree_when_available():
    native_geo = build_fake_native_geo()
    optimizer = RouteOptimizer(native_geo)

    result = optimizer.optimize(
        [
            {"spotId": "alpha", "latitude": 0.0, "longitude": 0.1},
            {"spotId": "beta", "latitude": 0.0, "longitude": 1.0},
            {"spotId": "gamma", "latitude": 0.0, "longitude": 2.0},
        ],
        0.0,
        0.0,
    )

    assert [spot["spotId"] for spot in result["orderedSpots"]] == ["alpha", "beta", "gamma"]
    assert result["estimatedDistance"] == 2.0
    assert native_geo.counters["index_builds"] == 3
    assert native_geo.counters["nearest_queries"] == 3


def test_recommendation_engine_uses_native_geo_bonus_for_liked_spot_proximity():
    native_geo = build_fake_native_geo()
    engine = RecommendationEngine(
        GeoContentClient(
            [
                Spot("spot-1", "Liked", "Culture hub", "culture", "social", 4.7, 50, 0, 0.0, 0.0, False, 3, ("user-1",)),
                Spot("spot-2", "Nearby", "Culture hub", "culture", "social", 4.7, 50, 0, 0.0, 0.5, False, 3, ()),
                Spot("spot-3", "Far Away", "Culture hub", "culture", "social", 4.7, 50, 0, 0.0, 15.0, False, 3, ()),
            ]
        ),
        EqualSimilarityLoader(),
        native_geo,
    )

    recommendations = engine.recommend_spots("user-1", ["spot-1"], ["culture"], 2)

    assert [item["spotId"] for item in recommendations] == ["spot-2", "spot-3"]
    assert "close to spots you already liked" in recommendations[0]["reason"]
    assert native_geo.counters["index_builds"] == 1
    assert native_geo.counters["nearest_queries"] == 3


def test_similar_spots_uses_native_haversine_bonus_for_geographic_tiebreaks():
    native_geo = build_fake_native_geo()
    engine = RecommendationEngine(
        GeoContentClient(
            [
                Spot("spot-1", "Source", "Culture hub", "culture", "social", 4.7, 50, 0, 0.0, 0.0, False, 3, ()),
                Spot("spot-2", "Nearby", "Culture hub", "culture", "social", 4.7, 50, 0, 0.0, 1.0, False, 3, ()),
                Spot("spot-3", "Far Away", "Culture hub", "culture", "social", 4.7, 50, 0, 0.0, 20.0, False, 3, ()),
            ]
        ),
        EqualSimilarityLoader(),
        native_geo,
    )

    recommendations = engine.similar_spots("spot-1", 2)

    assert [item["spotId"] for item in recommendations] == ["spot-2", "spot-3"]
    assert native_geo.counters["haversine_calls"] == 2
