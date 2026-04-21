#pragma once

#include "atlas_geo/core.hpp"

#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace atlas::geo {

struct SpatialPoint {
    std::string id;
    Coordinate coordinate;
};

struct NearestNeighbor {
    SpatialPoint point;
    double distance_km {};
};

class RTreeIndex {
public:
    static constexpr std::size_t kDefaultNodeCapacity = 8;

    RTreeIndex();
    explicit RTreeIndex(std::vector<SpatialPoint> points, std::size_t node_capacity = kDefaultNodeCapacity);

    void rebuild(std::vector<SpatialPoint> points);

    [[nodiscard]] std::optional<NearestNeighbor> nearest_neighbor(const Coordinate& query) const;
    [[nodiscard]] std::vector<NearestNeighbor> nearest_neighbors(const Coordinate& query, std::size_t limit) const;

    [[nodiscard]] std::size_t size() const noexcept;
    [[nodiscard]] bool empty() const noexcept;

private:
    struct BoundingBox {
        double min_latitude {};
        double min_longitude {};
        double max_latitude {};
        double max_longitude {};
    };

    struct Node {
        BoundingBox box {};
        bool leaf {true};
        std::vector<SpatialPoint> points {};
        std::vector<std::unique_ptr<Node>> children {};
    };

    [[nodiscard]] BoundingBox coordinate_box(const Coordinate& coordinate) const;
    [[nodiscard]] BoundingBox merge_boxes(const BoundingBox& left, const BoundingBox& right) const;
    [[nodiscard]] BoundingBox compute_box(const std::vector<SpatialPoint>& points) const;
    [[nodiscard]] BoundingBox compute_box(const std::vector<std::unique_ptr<Node>>& children) const;
    [[nodiscard]] Coordinate box_center(const BoundingBox& box) const;
    [[nodiscard]] double min_distance_to_box_km(const Coordinate& query, const BoundingBox& box) const;
    void rebuild_tree();

    std::size_t node_capacity_ {kDefaultNodeCapacity};
    std::vector<SpatialPoint> points_ {};
    std::unique_ptr<Node> root_ {};
};

}  // namespace atlas::geo
