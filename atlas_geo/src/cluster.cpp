#include "atlas_geo/cluster.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <map>
#include <stdexcept>
#include <unordered_set>
#include <utility>

namespace {

std::size_t bucket_index(
    const double value,
    const double minimum,
    const double maximum,
    const std::size_t bucket_count) {
    if (bucket_count == 0) {
        throw std::invalid_argument("Viewport clustering bucket counts must be positive");
    }

    if (maximum <= minimum) {
        return 0;
    }

    const auto normalized = std::clamp((value - minimum) / (maximum - minimum), 0.0, 1.0);
    const auto scaled = normalized * static_cast<double>(bucket_count);
    return std::min<std::size_t>(bucket_count - 1, static_cast<std::size_t>(std::floor(scaled)));
}

struct ClusterAccumulator {
    double latitude_sum {};
    double longitude_sum {};
    atlas::geo::Viewport bounds {
        std::numeric_limits<double>::infinity(),
        std::numeric_limits<double>::infinity(),
        -std::numeric_limits<double>::infinity(),
        -std::numeric_limits<double>::infinity(),
    };
    std::vector<std::string> point_ids {};
    std::size_t point_count {};
};

void merge_point_into_cluster(ClusterAccumulator& cluster, const atlas::geo::SpatialPoint& point) {
    cluster.latitude_sum += point.coordinate.latitude;
    cluster.longitude_sum += point.coordinate.longitude;
    cluster.bounds.min_latitude = std::min(cluster.bounds.min_latitude, point.coordinate.latitude);
    cluster.bounds.min_longitude = std::min(cluster.bounds.min_longitude, point.coordinate.longitude);
    cluster.bounds.max_latitude = std::max(cluster.bounds.max_latitude, point.coordinate.latitude);
    cluster.bounds.max_longitude = std::max(cluster.bounds.max_longitude, point.coordinate.longitude);
    cluster.point_ids.push_back(point.id);
    ++cluster.point_count;
}

}  // namespace

namespace atlas::geo {

bool is_viewport_valid(const Viewport& viewport) {
    if (!is_coordinate_valid({viewport.min_latitude, viewport.min_longitude})) {
        return false;
    }

    if (!is_coordinate_valid({viewport.max_latitude, viewport.max_longitude})) {
        return false;
    }

    return viewport.min_latitude <= viewport.max_latitude
        && viewport.min_longitude <= viewport.max_longitude;
}

bool viewport_contains(const Viewport& viewport, const Coordinate& coordinate) {
    if (!is_viewport_valid(viewport) || !is_coordinate_valid(coordinate)) {
        return false;
    }

    return coordinate.latitude >= viewport.min_latitude
        && coordinate.latitude <= viewport.max_latitude
        && coordinate.longitude >= viewport.min_longitude
        && coordinate.longitude <= viewport.max_longitude;
}

std::vector<ViewportCluster> cluster_points_in_viewport(
    const std::vector<SpatialPoint>& points,
    const Viewport& viewport,
    ViewportClusteringOptions options) {
    if (!is_viewport_valid(viewport)) {
        throw std::invalid_argument("Viewport clustering requires a valid viewport bounds definition");
    }

    if (options.latitude_buckets == 0 || options.longitude_buckets == 0) {
        throw std::invalid_argument("Viewport clustering bucket counts must be positive");
    }

    std::unordered_set<std::string> seen_ids;
    seen_ids.reserve(points.size());
    std::map<std::pair<std::size_t, std::size_t>, ClusterAccumulator> grouped_points;

    for (const auto& point : points) {
        if (point.id.empty()) {
            throw std::invalid_argument("Viewport clustering requires non-empty point ids");
        }

        if (!is_coordinate_valid(point.coordinate)) {
            throw std::invalid_argument("Viewport clustering input contains an invalid latitude/longitude coordinate");
        }

        const auto insert_result = seen_ids.insert(point.id);
        if (!insert_result.second) {
            throw std::invalid_argument("Viewport clustering input contains duplicate point id '" + point.id + "'");
        }

        if (!viewport_contains(viewport, point.coordinate)) {
            continue;
        }

        const auto latitude_bucket = bucket_index(
            point.coordinate.latitude,
            viewport.min_latitude,
            viewport.max_latitude,
            options.latitude_buckets);
        const auto longitude_bucket = bucket_index(
            point.coordinate.longitude,
            viewport.min_longitude,
            viewport.max_longitude,
            options.longitude_buckets);

        merge_point_into_cluster(grouped_points[{latitude_bucket, longitude_bucket}], point);
    }

    std::vector<ViewportCluster> clusters;
    clusters.reserve(grouped_points.size());

    for (auto& [bucket_key, grouped_cluster] : grouped_points) {
        std::sort(grouped_cluster.point_ids.begin(), grouped_cluster.point_ids.end());
        clusters.push_back(ViewportCluster {
            bucket_key.first,
            bucket_key.second,
            {
                grouped_cluster.latitude_sum / static_cast<double>(grouped_cluster.point_count),
                grouped_cluster.longitude_sum / static_cast<double>(grouped_cluster.point_count),
            },
            grouped_cluster.bounds,
            std::move(grouped_cluster.point_ids),
            grouped_cluster.point_count,
        });
    }

    return clusters;
}

}  // namespace atlas::geo
