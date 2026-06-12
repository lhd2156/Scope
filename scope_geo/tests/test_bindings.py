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

    assert repr(chicago) == "Coordinate(latitude=41.8781, longitude=-87.6298)"
    assert scope_geo_module.version() == "0.1.0"
    assert scope_geo_module.is_coordinate_valid(chicago) is True
    assert scope_geo_module.haversine_distance_km(chicago, new_york) == pytest.approx(1144.291, abs=0.5)
    assert scope_geo_module.haversine_distance_meters(chicago, chicago) == pytest.approx(0.0, abs=1e-6)


def test_binding_default_constructors_repr_len_and_bool(scope_geo_module):
    origin = scope_geo_module.Coordinate()
    assert origin.latitude == 0.0
    assert origin.longitude == 0.0
    assert repr(origin) == "Coordinate(latitude=0, longitude=0)"

    point = scope_geo_module.SpatialPoint("origin", origin)
    assert repr(point) == "SpatialPoint(id='origin', coordinate=Coordinate(latitude=0, longitude=0))"

    neighbor = scope_geo_module.NearestNeighbor(point, 12.5)
    assert neighbor.point.id == "origin"
    assert neighbor.distance_km == pytest.approx(12.5)
    assert scope_geo_module.NearestNeighbor().distance_km == pytest.approx(0.0)

    empty_index = scope_geo_module.RTreeIndex()
    assert len(empty_index) == 0
    assert bool(empty_index) is False

    node = scope_geo_module.GraphNode("node", origin)
    assert repr(node) == "GraphNode(id='node', coordinate=Coordinate(latitude=0, longitude=0))"
    edge = scope_geo_module.GraphEdge("node", "node", 0.0, False)
    assert repr(edge) == "GraphEdge(from_id='node', to_id='node', cost_km=0, bidirectional=False)"

    path = scope_geo_module.PathResult(["node"], 0.0)
    assert path.node_ids == ["node"]
    assert path.total_cost_km == pytest.approx(0.0)

    empty_graph = scope_geo_module.PathGraph()
    assert len(empty_graph) == 0
    assert bool(empty_graph) is False
    empty_graph.rebuild([node], [])
    assert len(empty_graph) == 1
    assert bool(empty_graph) is True

    viewport = scope_geo_module.Viewport()
    assert repr(viewport) == (
        "Viewport(min_latitude=0, min_longitude=0, max_latitude=0, max_longitude=0)"
    )

    options = scope_geo_module.ViewportClusteringOptions()
    assert options.latitude_buckets == 8
    assert options.longitude_buckets == 8

    cluster = scope_geo_module.ViewportCluster()
    cluster.latitude_bucket = 2
    cluster.longitude_bucket = 3
    cluster.centroid = origin
    cluster.bounds = viewport
    cluster.point_ids = ["origin"]
    cluster.point_count = 1
    assert cluster.latitude_bucket == 2
    assert cluster.longitude_bucket == 3
    assert cluster.point_ids == ["origin"]
    assert cluster.point_count == 1

    for exported_name in [
        "Coordinate",
        "SpatialPoint",
        "NearestNeighbor",
        "RTreeIndex",
        "PathGraph",
        "ViewportCluster",
        "cluster_points_in_viewport",
    ]:
        assert exported_name in scope_geo_module.__all__


def test_rtree_bindings_support_nearest_neighbor_queries(scope_geo_module):
    index = scope_geo_module.RTreeIndex(
        [
            scope_geo_module.SpatialPoint("chicago", scope_geo_module.Coordinate(41.8781, -87.6298)),
            scope_geo_module.SpatialPoint("milwaukee", scope_geo_module.Coordinate(43.0389, -87.9065)),
            scope_geo_module.SpatialPoint("new-york", scope_geo_module.Coordinate(40.7128, -74.0060)),
        ],
        2,
    )

    assert len(index) == 3
    assert bool(index) is True

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


def test_native_branch_edges_are_visible_through_python_bindings(scope_geo_module):
    valid_viewport = scope_geo_module.Viewport(0.0, 0.0, 10.0, 10.0)
    invalid_viewport = scope_geo_module.Viewport(10.0, 0.0, 0.0, 10.0)
    invalid_max_coordinate_viewport = scope_geo_module.Viewport(0.0, 0.0, 95.0, 10.0)
    inverted_longitude_viewport = scope_geo_module.Viewport(0.0, 10.0, 10.0, 0.0)
    inside = scope_geo_module.Coordinate(5.0, 5.0)
    below_latitude = scope_geo_module.Coordinate(-1.0, 5.0)
    below_longitude = scope_geo_module.Coordinate(5.0, -1.0)
    outside = scope_geo_module.Coordinate(11.0, 5.0)
    invalid_coordinate = scope_geo_module.Coordinate(95.0, 0.0)

    assert scope_geo_module.is_coordinate_valid(invalid_coordinate) is False
    assert scope_geo_module.is_coordinate_valid(scope_geo_module.Coordinate(0.0, -181.0)) is False
    assert scope_geo_module.is_coordinate_valid(scope_geo_module.Coordinate(0.0, 181.0)) is False
    assert scope_geo_module.is_viewport_valid(valid_viewport) is True
    assert scope_geo_module.is_viewport_valid(invalid_viewport) is False
    assert scope_geo_module.is_viewport_valid(invalid_max_coordinate_viewport) is False
    assert scope_geo_module.is_viewport_valid(inverted_longitude_viewport) is False
    assert scope_geo_module.viewport_contains(valid_viewport, inside) is True
    assert scope_geo_module.viewport_contains(valid_viewport, outside) is False
    assert scope_geo_module.viewport_contains(valid_viewport, below_latitude) is False
    assert scope_geo_module.viewport_contains(valid_viewport, below_longitude) is False
    assert scope_geo_module.viewport_contains(valid_viewport, invalid_coordinate) is False
    assert scope_geo_module.viewport_contains(invalid_viewport, inside) is False

    assert scope_geo_module.cluster_points_in_viewport([], valid_viewport) == []
    assert scope_geo_module.cluster_points_in_viewport(
        [scope_geo_module.SpatialPoint("outside", outside)],
        valid_viewport,
    ) == []

    with pytest.raises(ValueError, match="valid viewport"):
        scope_geo_module.cluster_points_in_viewport([], invalid_viewport)
    with pytest.raises(ValueError, match="bucket counts"):
        scope_geo_module.cluster_points_in_viewport(
            [scope_geo_module.SpatialPoint("inside", inside)],
            valid_viewport,
            scope_geo_module.ViewportClusteringOptions(0, 2),
        )
    with pytest.raises(ValueError, match="non-empty point ids"):
        scope_geo_module.cluster_points_in_viewport(
            [scope_geo_module.SpatialPoint("", inside)],
            valid_viewport,
        )


def test_rtree_and_path_graph_branch_edges_are_visible_through_python_bindings(scope_geo_module):
    points = [
        scope_geo_module.SpatialPoint("east", scope_geo_module.Coordinate(0.0, 1.0)),
        scope_geo_module.SpatialPoint("west", scope_geo_module.Coordinate(0.0, -1.0)),
        scope_geo_module.SpatialPoint("north", scope_geo_module.Coordinate(1.0, 0.0)),
        scope_geo_module.SpatialPoint("south", scope_geo_module.Coordinate(-1.0, 0.0)),
        scope_geo_module.SpatialPoint("far", scope_geo_module.Coordinate(5.0, 5.0)),
    ]
    index = scope_geo_module.RTreeIndex(points, 1)

    assert scope_geo_module.RTreeIndex([], 1).nearest_neighbors(scope_geo_module.Coordinate(0.0, 0.0), 1) == []
    assert index.nearest_neighbors(scope_geo_module.Coordinate(0.0, 0.0), 0) == []
    assert [neighbor.point.id for neighbor in index.nearest_neighbors(scope_geo_module.Coordinate(0.0, 0.0), 4)] == [
        "east",
        "north",
        "south",
        "west",
    ]
    assert [neighbor.point.id for neighbor in index.nearest_neighbors(scope_geo_module.Coordinate(5.0, 5.0), 2)] == [
        "far",
        "north",
    ]
    with pytest.raises(ValueError, match="Query coordinate"):
        index.nearest_neighbor(scope_geo_module.Coordinate(91.0, 0.0))

    assert "bidirectional=True" in repr(scope_geo_module.GraphEdge("a", "b", 1.0, True))

    nodes = [
        scope_geo_module.GraphNode("a", scope_geo_module.Coordinate(0.0, 0.0)),
        scope_geo_module.GraphNode("b", scope_geo_module.Coordinate(0.0, 1.0)),
        scope_geo_module.GraphNode("c", scope_geo_module.Coordinate(0.0, 2.0)),
    ]
    directed_graph = scope_geo_module.PathGraph(
        nodes,
        [scope_geo_module.GraphEdge("a", "b", 1.0, False)],
    )

    assert directed_graph.shortest_path_dijkstra("b", "a") is None
    assert directed_graph.shortest_path_a_star("a", "a").node_ids == ["a"]
    with pytest.raises(ValueError, match="unknown graph node"):
        directed_graph.shortest_path_dijkstra("a", "missing")
    with pytest.raises(ValueError, match="must be non-empty"):
        scope_geo_module.PathGraph([scope_geo_module.GraphNode("", scope_geo_module.Coordinate(0.0, 0.0))], [])
    with pytest.raises(ValueError, match="Duplicate graph node"):
        scope_geo_module.PathGraph([nodes[0], nodes[0]], [])
    with pytest.raises(ValueError, match="finite non-negative cost"):
        scope_geo_module.PathGraph(nodes, [scope_geo_module.GraphEdge("a", "b", -1.0, True)])
    with pytest.raises(ValueError, match="finite non-negative cost"):
        scope_geo_module.PathGraph(nodes, [scope_geo_module.GraphEdge("a", "b", float("nan"), True)])
    with pytest.raises(ValueError, match="non-empty node ids"):
        scope_geo_module.PathGraph(nodes, [scope_geo_module.GraphEdge("", "b", 1.0, True)])
    with pytest.raises(ValueError, match="non-empty node ids"):
        scope_geo_module.PathGraph(nodes, [scope_geo_module.GraphEdge("a", "", 1.0, True)])
    with pytest.raises(ValueError, match="unknown node id"):
        scope_geo_module.PathGraph(nodes, [scope_geo_module.GraphEdge("missing", "b", 1.0, True)])
