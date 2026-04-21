from __future__ import annotations

import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="module")
def atlas_geo_module():
    try:
        import atlas_geo
    except ModuleNotFoundError:
        pytest.skip(
            "Build the atlas_geo pybind11 extension before running Python integration tests.",
            allow_module_level=False,
        )
    return atlas_geo


def _coordinate_tuples(points):
    return [(point.latitude, point.longitude) for point in points]


def test_module_exposes_version_and_haversine_distance(atlas_geo_module):
    chicago = atlas_geo_module.Coordinate(41.8781, -87.6298)
    new_york = atlas_geo_module.Coordinate(40.7128, -74.0060)

    assert atlas_geo_module.version() == "0.1.0"
    assert atlas_geo_module.is_coordinate_valid(chicago) is True
    assert atlas_geo_module.haversine_distance_km(chicago, new_york) == pytest.approx(1144.291, abs=0.5)
    assert atlas_geo_module.haversine_distance_meters(chicago, chicago) == pytest.approx(0.0, abs=1e-6)


def test_rtree_bindings_support_nearest_neighbor_queries(atlas_geo_module):
    index = atlas_geo_module.RTreeIndex(
        [
            atlas_geo_module.SpatialPoint("chicago", atlas_geo_module.Coordinate(41.8781, -87.6298)),
            atlas_geo_module.SpatialPoint("milwaukee", atlas_geo_module.Coordinate(43.0389, -87.9065)),
            atlas_geo_module.SpatialPoint("new-york", atlas_geo_module.Coordinate(40.7128, -74.0060)),
        ],
        2,
    )

    nearest = index.nearest_neighbor(atlas_geo_module.Coordinate(42.0451, -87.6877))
    assert nearest is not None
    assert nearest.point.id == "chicago"

    neighbors = index.nearest_neighbors(atlas_geo_module.Coordinate(42.0451, -87.6877), 2)
    assert [neighbor.point.id for neighbor in neighbors] == ["chicago", "milwaukee"]


def test_path_graph_bindings_expose_dijkstra_and_a_star(atlas_geo_module):
    graph = atlas_geo_module.PathGraph(
        [
            atlas_geo_module.GraphNode("a", atlas_geo_module.Coordinate(0.0, 0.0)),
            atlas_geo_module.GraphNode("b", atlas_geo_module.Coordinate(0.0, 1.0)),
            atlas_geo_module.GraphNode("c", atlas_geo_module.Coordinate(0.0, 2.0)),
            atlas_geo_module.GraphNode("d", atlas_geo_module.Coordinate(0.0, 3.0)),
        ],
        [
            atlas_geo_module.GraphEdge("a", "b", 120.0, True),
            atlas_geo_module.GraphEdge("b", "c", 120.0, True),
            atlas_geo_module.GraphEdge("c", "d", 120.0, True),
            atlas_geo_module.GraphEdge("a", "d", 450.0, True),
        ],
    )

    dijkstra = graph.shortest_path_dijkstra("a", "d")
    a_star = graph.shortest_path_a_star("a", "d")

    assert dijkstra is not None
    assert a_star is not None
    assert dijkstra.node_ids == ["a", "b", "c", "d"]
    assert a_star.node_ids == dijkstra.node_ids
    assert a_star.total_cost_km == pytest.approx(360.0)


def test_hull_and_clustering_bindings_round_trip_python_objects(atlas_geo_module):
    hull = atlas_geo_module.convex_hull(
        [
            atlas_geo_module.Coordinate(0.0, 0.0),
            atlas_geo_module.Coordinate(0.0, 2.0),
            atlas_geo_module.Coordinate(2.0, 2.0),
            atlas_geo_module.Coordinate(2.0, 0.0),
            atlas_geo_module.Coordinate(1.0, 1.0),
        ]
    )

    assert _coordinate_tuples(hull) == [
        (0.0, 0.0),
        (0.0, 2.0),
        (2.0, 2.0),
        (2.0, 0.0),
    ]

    clusters = atlas_geo_module.cluster_points_in_viewport(
        [
            atlas_geo_module.SpatialPoint("alpha", atlas_geo_module.Coordinate(1.0, 1.0)),
            atlas_geo_module.SpatialPoint("beta", atlas_geo_module.Coordinate(2.0, 2.0)),
            atlas_geo_module.SpatialPoint("charlie", atlas_geo_module.Coordinate(6.0, 7.0)),
            atlas_geo_module.SpatialPoint("delta", atlas_geo_module.Coordinate(9.0, 9.0)),
        ],
        atlas_geo_module.Viewport(0.0, 0.0, 10.0, 10.0),
        atlas_geo_module.ViewportClusteringOptions(2, 2),
    )

    assert len(clusters) == 2
    assert clusters[0].point_ids == ["alpha", "beta"]
    assert clusters[1].point_ids == ["charlie", "delta"]
    assert clusters[1].centroid.latitude == pytest.approx(7.5)
    assert clusters[1].centroid.longitude == pytest.approx(8.0)


def test_invalid_native_inputs_surface_as_python_value_errors(atlas_geo_module):
    with pytest.raises(ValueError):
        atlas_geo_module.RTreeIndex([atlas_geo_module.SpatialPoint("bad", atlas_geo_module.Coordinate(120.0, 0.0))])

    with pytest.raises(ValueError):
        atlas_geo_module.PathGraph(
            [atlas_geo_module.GraphNode("start", atlas_geo_module.Coordinate(41.8781, -87.6298))],
            [atlas_geo_module.GraphEdge("start", "missing", 1.0, True)],
        )

    with pytest.raises(ValueError):
        atlas_geo_module.cluster_points_in_viewport(
            [
                atlas_geo_module.SpatialPoint("dup", atlas_geo_module.Coordinate(1.0, 1.0)),
                atlas_geo_module.SpatialPoint("dup", atlas_geo_module.Coordinate(2.0, 2.0)),
            ],
            atlas_geo_module.Viewport(0.0, 0.0, 10.0, 10.0),
        )
