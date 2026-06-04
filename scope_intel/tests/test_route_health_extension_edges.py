from __future__ import annotations

from types import SimpleNamespace

from app import extensions
from app.ml.model_loader import MlModelLoader
from app.services import health_service
from app.services import native_geo
from app.services import route_optimizer as route_optimizer_module


def test_route_optimizer_python_fallback_orders_spots_and_handles_empty(monkeypatch):
    monkeypatch.setattr(route_optimizer_module, "get_native_geo", lambda: None)
    optimizer = route_optimizer_module.RouteOptimizer()

    assert optimizer.optimize([], None, None) == {"orderedSpots": [], "estimatedDistance": 0.0}

    spots = [
        {"spotId": "far", "latitude": 0.0, "longitude": 2.0},
        {"spotId": "near", "latitude": 0.0, "longitude": 0.5},
        {"spotId": "middle", "latitude": 0.0, "longitude": 1.0},
    ]

    result = optimizer.optimize(spots, 0.0, 0.0)

    assert [spot["spotId"] for spot in result["orderedSpots"]] == ["near", "middle", "far"]
    assert result["estimatedDistance"] > 200
    assert route_optimizer_module.RouteOptimizer._start_coordinates(spots, None, None) == (0.0, 2.0)
    assert route_optimizer_module.RouteOptimizer._distance_km(0.0, 0.0, 0.0, 1.0) > 100


def test_route_optimizer_native_path_stops_when_no_neighbor_is_returned():
    class Coordinate:
        def __init__(self, latitude, longitude):
            self.latitude = latitude
            self.longitude = longitude

    class SpatialPoint:
        def __init__(self, point_id, coordinate):
            self.id = point_id
            self.coordinate = coordinate

    class EmptyIndex:
        def __init__(self, points, node_capacity):
            self.points = points
            self.node_capacity = node_capacity

        def nearest_neighbor(self, query):
            return None

    native_geo = SimpleNamespace(Coordinate=Coordinate, SpatialPoint=SpatialPoint, RTreeIndex=EmptyIndex)
    optimizer = route_optimizer_module.RouteOptimizer(native_geo)

    result = optimizer.optimize([{"spotId": "a", "latitude": 1.0, "longitude": 2.0}], 1.0, 2.0)

    assert result == {"orderedSpots": [], "estimatedDistance": 0.0}


def test_health_service_database_readiness_and_payload(monkeypatch):
    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

    class ReadyEngine:
        def connect(self):
            return Connection()

    class FailingEngine:
        def connect(self):
            raise RuntimeError("offline")

    service = health_service.HealthService(SimpleNamespace(verify=lambda: True))
    monkeypatch.setattr(health_service, "db", SimpleNamespace(engine=ReadyEngine()))

    assert service.database_ready() is True
    assert service.payload(version="1.2.3", uptime=42) == (
        {"status": "healthy", "version": "1.2.3", "uptime": 42},
        200,
    )

    monkeypatch.setattr(health_service, "db", SimpleNamespace(engine=FailingEngine()))
    unhealthy_service = health_service.HealthService(SimpleNamespace(verify=lambda: False))

    assert unhealthy_service.database_ready() is False
    assert unhealthy_service.payload(version="1.2.3", uptime=42) == (
        {"status": "unhealthy", "version": "1.2.3", "uptime": 42},
        503,
    )


def test_limiter_storage_uri_falls_back_to_memory_when_redis_dependency_is_missing(monkeypatch):
    monkeypatch.setenv("INTEL_RATE_LIMIT_STORAGE_URI", "redis://cache:6379/9")

    real_import = __import__

    def block_redis(name, *args, **kwargs):
        if name == "redis":
            raise ImportError("redis blocked")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", block_redis)
    assert extensions._limiter_storage_uri() == "memory://"

    monkeypatch.setenv("INTEL_RATE_LIMIT_STORAGE_URI", "memory://")
    assert extensions._limiter_storage_uri() == "memory://"


def test_model_loader_and_native_geo_unavailable_paths(monkeypatch):
    loader = MlModelLoader()
    monkeypatch.setattr(loader, "build_text_similarity_model", lambda: (_ for _ in ()).throw(RuntimeError("missing")))
    assert loader.verify() is False

    native_geo.get_native_geo.cache_clear()
    real_import = __import__

    def block_scope_geo(name, *args, **kwargs):
        if name == "scope_geo":
            raise ModuleNotFoundError("scope_geo blocked")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", block_scope_geo)
    assert native_geo.get_native_geo() is None
    assert native_geo.native_geo_available() is False
    native_geo.get_native_geo.cache_clear()
