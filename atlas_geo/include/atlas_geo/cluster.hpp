#pragma once

#include "atlas_geo/core.hpp"
#include "atlas_geo/rtree.hpp"

#include <cstddef>
#include <string>
#include <vector>

namespace atlas::geo {

struct Viewport {
    double min_latitude {};
    double min_longitude {};
    double max_latitude {};
    double max_longitude {};
};

struct ViewportClusteringOptions {
    std::size_t latitude_buckets {8};
    std::size_t longitude_buckets {8};
};

struct ViewportCluster {
    std::size_t latitude_bucket {};
    std::size_t longitude_bucket {};
    Coordinate centroid {};
    Viewport bounds {};
    std::vector<std::string> point_ids {};
    std::size_t point_count {};
};

[[nodiscard]] bool is_viewport_valid(const Viewport& viewport);
[[nodiscard]] bool viewport_contains(const Viewport& viewport, const Coordinate& coordinate);
[[nodiscard]] std::vector<ViewportCluster> cluster_points_in_viewport(
    const std::vector<SpatialPoint>& points,
    const Viewport& viewport,
    ViewportClusteringOptions options = {});

}  // namespace atlas::geo
