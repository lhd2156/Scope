from __future__ import annotations

import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="module")
def scope_geo_module():
    try:
        import scope_geo
    except ModuleNotFoundError:
        pytest.skip(
            "Build the scope_geo pybind11 extension before running Python integration tests.",
            allow_module_level=False,
        )
    return scope_geo


def _coordinate_tuples(points):
    return [(point.latitude, point.longitude) for point in points]


def test_module_exposes_version_and_haversine_distance(scope_geo_module):
    chicago = scope_geo_module.Coordinate(41.8781, -87.6298)
    new_york = scope_geo_module.Coordinate(40.7128, -74.0060)

    assert scope_geo_module.version() == "0.1.0"
    assert scope_geo_module.is_coordinate_valid(chicago) is True
    assert scope_geo_module.haversine_distance_km(chicago, new_york) == pytest.approx(1144.291, abs=0.5)
    assert scope_geo_module.haversine_distance_meters(chicago, chicago) == pytest.approx(0.0, abs=1e-6)


def test_rtree_bindings_support_nearest_neighbor_queries(scope_geo_module):
    index = scope_geo_module.RTreeIndex(
        [
            scope_geo_module.SpatialPoint("chicago", scope_geo_module.Coordinate(41.8781, -87.6298)),
            scope_geo_module.SpatialPoint("milwaukee", scope_geo_module.Coordinate(43.0389, -87.9065)),
            scope_geo_module.SpatialPoint("new-york", scope_geo_module.Coordinate(40.7128, -74.0060)),
        ],
        2,
    )

    nearest = index.nearest_neighbor(scope_geo_module.Coordinate(42.0451, -87.6877))
    assert nearest is not None
    assert nearest.point.id == "chicago"

    neighbors = index.nearest_neighbors(scope_geo_module.Coordinate(42.0451, -87.6877), 2)
    assert [neighbor.point.id for neighbor in neighbors] == ["chicago", "milwaukee"]


def test_path_graph_bindings_expose_dijkstra_and_a_star(scope_geo_module):
    graph = scope_geo_module.PathGraph(
        [
            scope_geo_module.GraphNode("a", scope_geo_module.Coordinate(0.0, 0.0)),
            scope_geo_module.GraphNode("b", scope_geo_module.Coordinate(0.0, 1.0)),
            scope_geo_module.GraphNode("c", scope_geo_module.Coordinate(0.0, 2.0)),
            scope_geo_module.GraphNode("d", scope_geo_module.Coordinate(0.0, 3.0)),
        ],
        [
            scope_geo_module.GraphEdge("a", "b", 120.0, True),
            scope_geo_module.GraphEdge("b", "c", 120.0, True),
            scope_geo_module.GraphEdge("c", "d", 120.0, True),
            scope_geo_module.GraphEdge("a", "d", 450.0, True),
        ],
    )

    dijkstra = graph.shortest_path_dijkstra("a", "d")
    a_star = graph.shortest_path_a_star("a", "d")

    assert dijkstra is not None
    assert a_star is not None
    assert dijkstra.node_ids == ["a", "b", "c", "d"]
    assert a_star.node_ids == dijkstra.node_ids
    assert a_star.total_cost_km == pytest.approx(360.0)


def test_hull_and_clustering_bindings_round_trip_python_objects(scope_geo_module):
    hull = scope_geo_module.convex_hull(
        [
            scope_geo_module.Coordinate(0.0, 0.0),
            scope_geo_module.Coordinate(0.0, 2.0),
            scope_geo_module.Coordinate(2.0, 2.0),
            scope_geo_module.Coordinate(2.0, 0.0),
            scope_geo_module.Coordinate(1.0, 1.0),
        ]
    )

    assert _coordinate_tuples(hull) == [
        (0.0, 0.0),
        (0.0, 2.0),
        (2.0, 2.0),
        (2.0, 0.0),
    ]

    clusters = scope_geo_module.cluster_points_in_viewport(
        [
            scope_geo_module.SpatialPoint("alpha", scope_geo_module.Coordinate(1.0, 1.0)),
            scope_geo_module.SpatialPoint("beta", scope_geo_module.Coordinate(2.0, 2.0)),
            scope_geo_module.SpatialPoint("charlie", scope_geo_module.Coordinate(6.0, 7.0)),
            scope_geo_module.SpatialPoint("delta", scope_geo_module.Coordinate(9.0, 9.0)),
        ],
        scope_geo_module.Viewport(0.0, 0.0, 10.0, 10.0),
        scope_geo_module.ViewportClusteringOptions(2, 2),
    )

    assert len(clusters) == 2
    assert clusters[0].point_ids == ["alpha", "beta"]
    assert clusters[1].point_ids == ["charlie", "delta"]
    assert clusters[1].centroid.latitude == pytest.approx(7.5)
    assert clusters[1].centroid.longitude == pytest.approx(8.0)


def test_invalid_native_inputs_surface_as_python_value_errors(scope_geo_module):
    with pytest.raises(ValueError):
        scope_geo_module.RTreeIndex([scope_geo_module.SpatialPoint("bad", scope_geo_module.Coordinate(120.0, 0.0))])

    with pytest.raises(ValueError):
        scope_geo_module.PathGraph(
            [scope_geo_module.GraphNode("start", scope_geo_module.Coordinate(41.8781, -87.6298))],
            [scope_geo_module.GraphEdge("start", "missing", 1.0, True)],
        )

    with pytest.raises(ValueError):
        scope_geo_module.cluster_points_in_viewport(
            [
                scope_geo_module.SpatialPoint("dup", scope_geo_module.Coordinate(1.0, 1.0)),
                scope_geo_module.SpatialPoint("dup", scope_geo_module.Coordinate(2.0, 2.0)),
            ],
            scope_geo_module.Viewport(0.0, 0.0, 10.0, 10.0),
        )
