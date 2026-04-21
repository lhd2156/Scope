#include "atlas_geo/pathfinding.hpp"

#include "atlas_geo/haversine.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <queue>
#include <stdexcept>
#include <utility>

namespace {

constexpr double kDistanceEpsilon = 1e-9;
constexpr std::size_t kNoParent = std::numeric_limits<std::size_t>::max();

}  // namespace

namespace atlas::geo {

PathGraph::PathGraph() = default;

PathGraph::PathGraph(std::vector<GraphNode> nodes, std::vector<GraphEdge> edges) {
    rebuild(std::move(nodes), std::move(edges));
}

void PathGraph::rebuild(std::vector<GraphNode> nodes, std::vector<GraphEdge> edges) {
    auto validated_nodes = std::move(nodes);
    std::unordered_map<std::string, std::size_t> validated_indices;
    validated_indices.reserve(validated_nodes.size());
    std::vector<std::vector<EdgeRef>> validated_adjacency(validated_nodes.size());

    for (std::size_t index = 0; index < validated_nodes.size(); ++index) {
        const auto& node = validated_nodes[index];

        if (node.id.empty()) {
            throw std::invalid_argument("Graph node ids must be non-empty");
        }

        if (!is_coordinate_valid(node.coordinate)) {
            throw std::invalid_argument("Graph node '" + node.id + "' is outside valid latitude/longitude bounds");
        }

        const auto insert_result = validated_indices.emplace(node.id, index);
        if (!insert_result.second) {
            throw std::invalid_argument("Duplicate graph node id '" + node.id + "'");
        }
    }

    for (const auto& edge : edges) {
        if (edge.from_id.empty() || edge.to_id.empty()) {
            throw std::invalid_argument("Graph edges must reference non-empty node ids");
        }

        if (!std::isfinite(edge.cost_km) || edge.cost_km < 0.0) {
            throw std::invalid_argument(
                "Graph edge '" + edge.from_id + "' -> '" + edge.to_id + "' must have a finite non-negative cost");
        }

        const auto from_it = validated_indices.find(edge.from_id);
        const auto to_it = validated_indices.find(edge.to_id);
        if (from_it == validated_indices.end() || to_it == validated_indices.end()) {
            throw std::invalid_argument(
                "Graph edge '" + edge.from_id + "' -> '" + edge.to_id + "' references an unknown node id");
        }

        validated_adjacency[from_it->second].push_back(EdgeRef {to_it->second, edge.cost_km});
        if (edge.bidirectional && from_it->second != to_it->second) {
            validated_adjacency[to_it->second].push_back(EdgeRef {from_it->second, edge.cost_km});
        }
    }

    nodes_ = std::move(validated_nodes);
    node_indices_ = std::move(validated_indices);
    adjacency_ = std::move(validated_adjacency);
}

std::optional<PathResult> PathGraph::shortest_path_dijkstra(const std::string& start_id, const std::string& goal_id) const {
    return shortest_path_impl(start_id, goal_id, false);
}

std::optional<PathResult> PathGraph::shortest_path_a_star(const std::string& start_id, const std::string& goal_id) const {
    return shortest_path_impl(start_id, goal_id, true);
}

std::size_t PathGraph::size() const noexcept {
    return nodes_.size();
}

bool PathGraph::empty() const noexcept {
    return nodes_.empty();
}

std::optional<PathResult> PathGraph::shortest_path_impl(
    const std::string& start_id,
    const std::string& goal_id,
    const bool use_heuristic) const {
    const auto start_it = node_indices_.find(start_id);
    const auto goal_it = node_indices_.find(goal_id);
    if (start_it == node_indices_.end() || goal_it == node_indices_.end()) {
        throw std::invalid_argument("Path query references an unknown graph node id");
    }

    const auto start_index = start_it->second;
    const auto goal_index = goal_it->second;

    if (start_index == goal_index) {
        return PathResult {{start_id}, 0.0};
    }

    struct SearchState {
        std::size_t node_index {};
        double cost_km {};
        double priority_km {};
    };

    auto state_more_expensive = [](const SearchState& left, const SearchState& right) {
        if (left.priority_km != right.priority_km) {
            return left.priority_km > right.priority_km;
        }

        if (left.cost_km != right.cost_km) {
            return left.cost_km > right.cost_km;
        }

        return left.node_index > right.node_index;
    };

    const auto infinity = std::numeric_limits<double>::infinity();
    std::vector<double> best_cost(nodes_.size(), infinity);
    std::vector<std::size_t> parents(nodes_.size(), kNoParent);
    std::priority_queue<SearchState, std::vector<SearchState>, decltype(state_more_expensive)> frontier(
        state_more_expensive);

    best_cost[start_index] = 0.0;
    frontier.push(SearchState {
        start_index,
        0.0,
        use_heuristic ? heuristic_cost_km(start_index, goal_index) : 0.0,
    });

    while (!frontier.empty()) {
        const auto current = frontier.top();
        frontier.pop();

        if (current.cost_km > (best_cost[current.node_index] + kDistanceEpsilon)) {
            continue;
        }

        for (const auto& edge : adjacency_[current.node_index]) {
            const auto next_cost = current.cost_km + edge.cost_km;
            if (next_cost + kDistanceEpsilon >= best_cost[edge.target_index]) {
                continue;
            }

            best_cost[edge.target_index] = next_cost;
            parents[edge.target_index] = current.node_index;
            frontier.push(SearchState {
                edge.target_index,
                next_cost,
                next_cost + (use_heuristic ? heuristic_cost_km(edge.target_index, goal_index) : 0.0),
            });
        }
    }

    if (!std::isfinite(best_cost[goal_index])) {
        return std::nullopt;
    }

    std::vector<std::string> node_ids;
    for (auto index = goal_index; index != kNoParent; index = parents[index]) {
        node_ids.push_back(nodes_[index].id);
        if (index == start_index) {
            break;
        }
    }

    if (node_ids.empty() || node_ids.back() != start_id) {
        return std::nullopt;
    }

    std::reverse(node_ids.begin(), node_ids.end());
    return PathResult {std::move(node_ids), best_cost[goal_index]};
}

double PathGraph::heuristic_cost_km(const std::size_t from_index, const std::size_t goal_index) const {
    return haversine_distance_km(nodes_[from_index].coordinate, nodes_[goal_index].coordinate);
}

}  // namespace atlas::geo
