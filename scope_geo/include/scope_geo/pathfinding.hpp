#pragma once

#include "scope_geo/core.hpp"

#include <cstddef>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace scope::geo {

struct GraphNode {
    std::string id;
    Coordinate coordinate;
};

struct GraphEdge {
    std::string from_id;
    std::string to_id;
    double cost_km {};
    bool bidirectional {true};
};

struct PathResult {
    std::vector<std::string> node_ids;
    double total_cost_km {};
};

class PathGraph {
public:
    PathGraph();
    PathGraph(std::vector<GraphNode> nodes, std::vector<GraphEdge> edges);

    void rebuild(std::vector<GraphNode> nodes, std::vector<GraphEdge> edges);

    [[nodiscard]] std::optional<PathResult> shortest_path_dijkstra(
        const std::string& start_id,
        const std::string& goal_id) const;
    [[nodiscard]] std::optional<PathResult> shortest_path_a_star(
        const std::string& start_id,
        const std::string& goal_id) const;

    [[nodiscard]] std::size_t size() const noexcept;
    [[nodiscard]] bool empty() const noexcept;

private:
    struct EdgeRef {
        std::size_t target_index {};
        double cost_km {};
    };

    [[nodiscard]] std::optional<PathResult> shortest_path_impl(
        const std::string& start_id,
        const std::string& goal_id,
        bool use_heuristic) const;
    [[nodiscard]] double heuristic_cost_km(std::size_t from_index, std::size_t goal_index) const;

    std::vector<GraphNode> nodes_ {};
    std::unordered_map<std::string, std::size_t> node_indices_ {};
    std::vector<std::vector<EdgeRef>> adjacency_ {};
};

}  // namespace scope::geo
