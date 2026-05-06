#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include "scope_geo/cluster.hpp"
#include "scope_geo/core.hpp"
#include "scope_geo/haversine.hpp"
#include "scope_geo/hull.hpp"
#include "scope_geo/pathfinding.hpp"
#include "scope_geo/rtree.hpp"

#include <sstream>
#include <string>
#include <vector>

namespace py = pybind11;

namespace {

std::string coordinate_repr(const scope::geo::Coordinate& coordinate) {
    std::ostringstream stream;
    stream << "Coordinate(latitude=" << coordinate.latitude << ", longitude=" << coordinate.longitude << ")";
    return stream.str();
}

std::string spatial_point_repr(const scope::geo::SpatialPoint& point) {
    std::ostringstream stream;
    stream << "SpatialPoint(id='" << point.id << "', coordinate=" << coordinate_repr(point.coordinate) << ")";
    return stream.str();
}

std::string graph_node_repr(const scope::geo::GraphNode& node) {
    std::ostringstream stream;
    stream << "GraphNode(id='" << node.id << "', coordinate=" << coordinate_repr(node.coordinate) << ")";
    return stream.str();
}

std::string graph_edge_repr(const scope::geo::GraphEdge& edge) {
    std::ostringstream stream;
    stream << "GraphEdge(from_id='" << edge.from_id << "', to_id='" << edge.to_id << "', cost_km=" << edge.cost_km
           << ", bidirectional=" << (edge.bidirectional ? "True" : "False") << ")";
    return stream.str();
}

std::string viewport_repr(const scope::geo::Viewport& viewport) {
    std::ostringstream stream;
    stream << "Viewport(min_latitude=" << viewport.min_latitude << ", min_longitude=" << viewport.min_longitude
           << ", max_latitude=" << viewport.max_latitude << ", max_longitude=" << viewport.max_longitude << ")";
    return stream.str();
}

}  // namespace

PYBIND11_MODULE(_scope_geo, module) {
    using scope::geo::Coordinate;
    using scope::geo::GraphEdge;
    using scope::geo::GraphNode;
    using scope::geo::NearestNeighbor;
    using scope::geo::PathGraph;
    using scope::geo::PathResult;
    using scope::geo::RTreeIndex;
    using scope::geo::SpatialPoint;
    using scope::geo::Viewport;
    using scope::geo::ViewportCluster;
    using scope::geo::ViewportClusteringOptions;

    module.doc() = "pybind11 bindings for the scope_geo native geospatial engine";
    module.attr("__version__") = py::str(scope::geo::version());

    py::class_<Coordinate>(module, "Coordinate")
        .def(py::init<>())
        .def(py::init<double, double>(), py::arg("latitude") = 0.0, py::arg("longitude") = 0.0)
        .def_readwrite("latitude", &Coordinate::latitude)
        .def_readwrite("longitude", &Coordinate::longitude)
        .def("__repr__", &coordinate_repr);

    py::class_<SpatialPoint>(module, "SpatialPoint")
        .def(py::init<>())
        .def(py::init<std::string, Coordinate>(), py::arg("id"), py::arg("coordinate"))
        .def_readwrite("id", &SpatialPoint::id)
        .def_readwrite("coordinate", &SpatialPoint::coordinate)
        .def("__repr__", &spatial_point_repr);

    py::class_<NearestNeighbor>(module, "NearestNeighbor")
        .def(py::init<>())
        .def(py::init<SpatialPoint, double>(), py::arg("point"), py::arg("distance_km") = 0.0)
        .def_readwrite("point", &NearestNeighbor::point)
        .def_readwrite("distance_km", &NearestNeighbor::distance_km);

    py::class_<RTreeIndex>(module, "RTreeIndex")
        .def(py::init<>())
        .def(
            py::init<std::vector<SpatialPoint>, std::size_t>(),
            py::arg("points"),
            py::arg("node_capacity") = RTreeIndex::kDefaultNodeCapacity)
        .def("rebuild", &RTreeIndex::rebuild, py::arg("points"))
        .def("nearest_neighbor", &RTreeIndex::nearest_neighbor, py::arg("query"))
        .def("nearest_neighbors", &RTreeIndex::nearest_neighbors, py::arg("query"), py::arg("limit"))
        .def("size", &RTreeIndex::size)
        .def("empty", &RTreeIndex::empty)
        .def("__len__", &RTreeIndex::size)
        .def("__bool__", [](const RTreeIndex& index) { return !index.empty(); });

    py::class_<GraphNode>(module, "GraphNode")
        .def(py::init<>())
        .def(py::init<std::string, Coordinate>(), py::arg("id"), py::arg("coordinate"))
        .def_readwrite("id", &GraphNode::id)
        .def_readwrite("coordinate", &GraphNode::coordinate)
        .def("__repr__", &graph_node_repr);

    py::class_<GraphEdge>(module, "GraphEdge")
        .def(py::init<>())
        .def(
            py::init<std::string, std::string, double, bool>(),
            py::arg("from_id"),
            py::arg("to_id"),
            py::arg("cost_km") = 0.0,
            py::arg("bidirectional") = true)
        .def_readwrite("from_id", &GraphEdge::from_id)
        .def_readwrite("to_id", &GraphEdge::to_id)
        .def_readwrite("cost_km", &GraphEdge::cost_km)
        .def_readwrite("bidirectional", &GraphEdge::bidirectional)
        .def("__repr__", &graph_edge_repr);

    py::class_<PathResult>(module, "PathResult")
        .def(py::init<>())
        .def(py::init<std::vector<std::string>, double>(), py::arg("node_ids"), py::arg("total_cost_km") = 0.0)
        .def_readwrite("node_ids", &PathResult::node_ids)
        .def_readwrite("total_cost_km", &PathResult::total_cost_km);

    py::class_<PathGraph>(module, "PathGraph")
        .def(py::init<>())
        .def(py::init<std::vector<GraphNode>, std::vector<GraphEdge>>(), py::arg("nodes"), py::arg("edges"))
        .def("rebuild", &PathGraph::rebuild, py::arg("nodes"), py::arg("edges"))
        .def("shortest_path_dijkstra", &PathGraph::shortest_path_dijkstra, py::arg("start_id"), py::arg("goal_id"))
        .def("shortest_path_a_star", &PathGraph::shortest_path_a_star, py::arg("start_id"), py::arg("goal_id"))
        .def("size", &PathGraph::size)
        .def("empty", &PathGraph::empty)
        .def("__len__", &PathGraph::size)
        .def("__bool__", [](const PathGraph& graph) { return !graph.empty(); });

    py::class_<Viewport>(module, "Viewport")
        .def(py::init<>())
        .def(
            py::init<double, double, double, double>(),
            py::arg("min_latitude") = 0.0,
            py::arg("min_longitude") = 0.0,
            py::arg("max_latitude") = 0.0,
            py::arg("max_longitude") = 0.0)
        .def_readwrite("min_latitude", &Viewport::min_latitude)
        .def_readwrite("min_longitude", &Viewport::min_longitude)
        .def_readwrite("max_latitude", &Viewport::max_latitude)
        .def_readwrite("max_longitude", &Viewport::max_longitude)
        .def("__repr__", &viewport_repr);

    py::class_<ViewportClusteringOptions>(module, "ViewportClusteringOptions")
        .def(py::init<>())
        .def(
            py::init<std::size_t, std::size_t>(),
            py::arg("latitude_buckets") = 8,
            py::arg("longitude_buckets") = 8)
        .def_readwrite("latitude_buckets", &ViewportClusteringOptions::latitude_buckets)
        .def_readwrite("longitude_buckets", &ViewportClusteringOptions::longitude_buckets);

    py::class_<ViewportCluster>(module, "ViewportCluster")
        .def(py::init<>())
        .def_readwrite("latitude_bucket", &ViewportCluster::latitude_bucket)
        .def_readwrite("longitude_bucket", &ViewportCluster::longitude_bucket)
        .def_readwrite("centroid", &ViewportCluster::centroid)
        .def_readwrite("bounds", &ViewportCluster::bounds)
        .def_readwrite("point_ids", &ViewportCluster::point_ids)
        .def_readwrite("point_count", &ViewportCluster::point_count);

    module.def("version", &scope::geo::version);
    module.def("is_coordinate_valid", &scope::geo::is_coordinate_valid, py::arg("coordinate"));
    module.def("haversine_distance_km", &scope::geo::haversine_distance_km, py::arg("from_coordinate"), py::arg("to_coordinate"));
    module.def(
        "haversine_distance_meters",
        &scope::geo::haversine_distance_meters,
        py::arg("from_coordinate"),
        py::arg("to_coordinate"));
    module.def("convex_hull", &scope::geo::convex_hull, py::arg("points"));
    module.def("is_viewport_valid", &scope::geo::is_viewport_valid, py::arg("viewport"));
    module.def("viewport_contains", &scope::geo::viewport_contains, py::arg("viewport"), py::arg("coordinate"));
    module.def(
        "cluster_points_in_viewport",
        &scope::geo::cluster_points_in_viewport,
        py::arg("points"),
        py::arg("viewport"),
        py::arg("options") = ViewportClusteringOptions {});

    module.attr("__all__") = py::make_tuple(
        "Coordinate",
        "SpatialPoint",
        "NearestNeighbor",
        "RTreeIndex",
        "GraphNode",
        "GraphEdge",
        "PathResult",
        "PathGraph",
        "Viewport",
        "ViewportClusteringOptions",
        "ViewportCluster",
        "version",
        "is_coordinate_valid",
        "haversine_distance_km",
        "haversine_distance_meters",
        "convex_hull",
        "is_viewport_valid",
        "viewport_contains",
        "cluster_points_in_viewport");
}
