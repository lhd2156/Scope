#include "scope_geo/rtree.hpp"

#include "scope_geo/haversine.hpp"

#include <algorithm>
#include <queue>
#include <stdexcept>
#include <tuple>
#include <utility>

namespace {

constexpr double kDistanceEpsilon = 1e-9;

bool neighbor_less(const scope::geo::NearestNeighbor& left, const scope::geo::NearestNeighbor& right) {
    if (left.distance_km != right.distance_km) {
        return left.distance_km < right.distance_km;
    }

    return left.point.id < right.point.id;
}

bool point_less(const scope::geo::SpatialPoint& left, const scope::geo::SpatialPoint& right) {
    return std::tie(left.coordinate.longitude, left.coordinate.latitude, left.id)
        < std::tie(right.coordinate.longitude, right.coordinate.latitude, right.id);
}

}  // namespace

namespace scope::geo {

RTreeIndex::RTreeIndex() = default;

RTreeIndex::RTreeIndex(std::vector<SpatialPoint> points, const std::size_t node_capacity)
    : node_capacity_(std::max<std::size_t>(2, node_capacity)), points_(std::move(points)) {
    rebuild_tree();
}

void RTreeIndex::rebuild(std::vector<SpatialPoint> points) {
    points_ = std::move(points);
    rebuild_tree();
}

std::optional<NearestNeighbor> RTreeIndex::nearest_neighbor(const Coordinate& query) const {
    const auto neighbors = nearest_neighbors(query, 1);
    if (neighbors.empty()) {
        return std::nullopt;
    }

    return neighbors.front();
}

std::vector<NearestNeighbor> RTreeIndex::nearest_neighbors(const Coordinate& query, const std::size_t limit) const {
    if (limit == 0 || root_ == nullptr) {
        return {};
    }

    if (!is_coordinate_valid(query)) {
        throw std::invalid_argument("Query coordinate is outside valid latitude/longitude bounds");
    }

    struct NodeCandidate {
        const Node* node;
        double min_distance_km;
    };

    auto node_more_distant = [](const NodeCandidate& left, const NodeCandidate& right) {
        return left.min_distance_km > right.min_distance_km;
    };

    std::priority_queue<NodeCandidate, std::vector<NodeCandidate>, decltype(node_more_distant)> frontier(node_more_distant);
    std::priority_queue<NearestNeighbor, std::vector<NearestNeighbor>, decltype(&neighbor_less)> best_matches(&neighbor_less);

    frontier.push(NodeCandidate {root_.get(), min_distance_to_box_km(query, root_->box)});

    while (!frontier.empty()) {
        const auto current = frontier.top();
        frontier.pop();

        if (best_matches.size() == limit && current.min_distance_km > (best_matches.top().distance_km + kDistanceEpsilon)) {
            break;
        }

        if (current.node->leaf) {
            for (const auto& point : current.node->points) {
                NearestNeighbor candidate {point, haversine_distance_km(query, point.coordinate)};

                if (best_matches.size() < limit) {
                    best_matches.push(std::move(candidate));
                    continue;
                }

                if (neighbor_less(candidate, best_matches.top())) {
                    best_matches.pop();
                    best_matches.push(std::move(candidate));
                }
            }

            continue;
        }

        for (const auto& child : current.node->children) {
            const auto bound_distance = min_distance_to_box_km(query, child->box);
            if (best_matches.size() < limit || bound_distance <= (best_matches.top().distance_km + kDistanceEpsilon)) {
                frontier.push(NodeCandidate {child.get(), bound_distance});
            }
        }
    }

    std::vector<NearestNeighbor> matches;
    matches.reserve(best_matches.size());
    while (!best_matches.empty()) {
        matches.push_back(best_matches.top());
        best_matches.pop();
    }

    std::sort(matches.begin(), matches.end(), neighbor_less);
    return matches;
}

std::size_t RTreeIndex::size() const noexcept {
    return points_.size();
}

bool RTreeIndex::empty() const noexcept {
    return points_.empty();
}

RTreeIndex::BoundingBox RTreeIndex::coordinate_box(const Coordinate& coordinate) const {
    return BoundingBox {coordinate.latitude, coordinate.longitude, coordinate.latitude, coordinate.longitude};
}

RTreeIndex::BoundingBox RTreeIndex::merge_boxes(const BoundingBox& left, const BoundingBox& right) const {
    return BoundingBox {
        std::min(left.min_latitude, right.min_latitude),
        std::min(left.min_longitude, right.min_longitude),
        std::max(left.max_latitude, right.max_latitude),
        std::max(left.max_longitude, right.max_longitude),
    };
}

RTreeIndex::BoundingBox RTreeIndex::compute_box(const std::vector<SpatialPoint>& points) const {
    auto bounds = coordinate_box(points.front().coordinate);
    for (std::size_t index = 1; index < points.size(); ++index) {
        bounds = merge_boxes(bounds, coordinate_box(points[index].coordinate));
    }

    return bounds;
}

RTreeIndex::BoundingBox RTreeIndex::compute_box(const std::vector<std::unique_ptr<Node>>& children) const {
    auto bounds = children.front()->box;
    for (std::size_t index = 1; index < children.size(); ++index) {
        bounds = merge_boxes(bounds, children[index]->box);
    }

    return bounds;
}

Coordinate RTreeIndex::box_center(const BoundingBox& box) const {
    return Coordinate {
        (box.min_latitude + box.max_latitude) / 2.0,
        (box.min_longitude + box.max_longitude) / 2.0,
    };
}

double RTreeIndex::min_distance_to_box_km(const Coordinate& query, const BoundingBox& box) const {
    const Coordinate closest {
        std::clamp(query.latitude, box.min_latitude, box.max_latitude),
        std::clamp(query.longitude, box.min_longitude, box.max_longitude),
    };

    return haversine_distance_km(query, closest);
}

void RTreeIndex::rebuild_tree() {
    root_.reset();
    node_capacity_ = std::max<std::size_t>(2, node_capacity_);

    for (const auto& point : points_) {
        if (!is_coordinate_valid(point.coordinate)) {
            throw std::invalid_argument("Spatial point '" + point.id + "' is outside valid latitude/longitude bounds");
        }
    }

    if (points_.empty()) {
        return;
    }

    auto sorted_points = points_;
    std::sort(sorted_points.begin(), sorted_points.end(), point_less);

    std::vector<std::unique_ptr<Node>> level;
    level.reserve((sorted_points.size() + node_capacity_ - 1) / node_capacity_);

    for (std::size_t index = 0; index < sorted_points.size(); index += node_capacity_) {
        const auto end = std::min(sorted_points.size(), index + node_capacity_);

        auto leaf = std::make_unique<Node>();
        leaf->leaf = true;
        leaf->points.assign(sorted_points.begin() + static_cast<std::ptrdiff_t>(index), sorted_points.begin() + static_cast<std::ptrdiff_t>(end));
        leaf->box = compute_box(leaf->points);
        level.push_back(std::move(leaf));
    }

    while (level.size() > 1) {
        std::sort(level.begin(), level.end(), [this](const auto& left, const auto& right) {
            const auto left_center = box_center(left->box);
            const auto right_center = box_center(right->box);
            return std::tie(left_center.longitude, left_center.latitude)
                < std::tie(right_center.longitude, right_center.latitude);
        });

        std::vector<std::unique_ptr<Node>> next_level;
        next_level.reserve((level.size() + node_capacity_ - 1) / node_capacity_);

        for (std::size_t index = 0; index < level.size(); index += node_capacity_) {
            const auto end = std::min(level.size(), index + node_capacity_);

            auto parent = std::make_unique<Node>();
            parent->leaf = false;
            for (std::size_t child_index = index; child_index < end; ++child_index) {
                parent->children.push_back(std::move(level[child_index]));
            }
            parent->box = compute_box(parent->children);
            next_level.push_back(std::move(parent));
        }

        level = std::move(next_level);
    }

    root_ = std::move(level.front());
}

}  // namespace scope::geo
