from pathlib import Path
from textwrap import dedent

WORKTREE = Path(r"C:\Users\dongu\atlas-native-geo-wt")


def replace_in_file(relative_path: str, old: str, new: str) -> None:
    path = WORKTREE / relative_path
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def write_file(relative_path: str, content: str) -> None:
    path = WORKTREE / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dedent(content).lstrip("\n"), encoding="utf-8")


replace_in_file(
    "atlas_geo/include/atlas_geo/core.hpp",
    "struct Coordinate {\n    double latitude {};\n    double longitude {};\n};\n",
    "struct Coordinate {\n    double latitude {};\n    double longitude {};\n\n    constexpr bool operator==(const Coordinate&) const noexcept = default;\n};\n",
)

replace_in_file(
    "atlas_geo/CMakeLists.txt",
    "add_library(atlas_geo STATIC\n    src/core.cpp\n    src/haversine.cpp\n    src/rtree.cpp\n    src/pathfinding.cpp\n)\n",
    "add_library(atlas_geo STATIC\n    src/core.cpp\n    src/haversine.cpp\n    src/rtree.cpp\n    src/pathfinding.cpp\n    src/hull.cpp\n    src/cluster.cpp\n)\n",
)

replace_in_file(
    "atlas_geo/CMakeLists.txt",
    'message(STATUS "atlas_geo configured with the scaffold, haversine primitive, packed R-tree spatial index, native pathfinding engine, and initial GoogleTest coverage. Future phases will expand the native engine and pybind11 module.")\n',
    'message(STATUS "atlas_geo configured with the scaffold, haversine primitive, packed R-tree spatial index, native pathfinding engine, convex hull utilities, viewport clustering, and initial GoogleTest coverage. Future phases will expand the native engine and pybind11 module.")\n',
)

write_file(
    "atlas_geo/README.md",
    """
    # atlas_geo

    Native geospatial engine scaffold for Atlas Intel, now with haversine distance utilities, a packed R-tree spatial index for nearest-neighbor lookups, native Dijkstra/A* pathfinding, convex hull construction, viewport-aware clustering, and GoogleTest coverage.

    ## Layout
    - `CMakeLists.txt` configures the C++20 library target, fetches `pybind11` with `FetchContent`, and wires the `python/` and `tests/` subdirectories.
    - `include/atlas_geo/` holds public headers, including `haversine.hpp`, `rtree.hpp`, `pathfinding.hpp`, `hull.hpp`, and `cluster.hpp`.
    - `src/` holds the native implementation, now covering `core.cpp`, `haversine.cpp`, `rtree.cpp`, `pathfinding.cpp`, `hull.cpp`, and `cluster.cpp`.
    - `tests/` fetches GoogleTest and builds unit coverage for haversine math, R-tree nearest-neighbor queries, shortest-path routing, convex hull generation, and viewport clustering behavior.
    - `python/` is reserved for upcoming pybind11 bindings and currently exposes a placeholder interface target that links `pybind11::headers`.

    Phase 21.1 created the build skeleton. Phase 21.2 adds haversine math plus GoogleTest coverage. Phase 21.3 adds a packed in-memory R-tree for nearest-neighbor spot queries. Phase 21.4 adds reusable Dijkstra and A* pathfinding over a weighted graph of geospatial nodes. Phase 21.5 adds monotonic-chain convex hull generation plus deterministic viewport-grid clustering for map-ready aggregation. Later Phase 21 tasks will add concrete Python bindings and Intel service integration.
    """,
)

replace_in_file(
    "atlas_geo/tests/CMakeLists.txt",
    "add_executable(atlas_geo_unit_tests\n    haversine_test.cpp\n    rtree_test.cpp\n    pathfinding_test.cpp\n)\n",
    "add_executable(atlas_geo_unit_tests\n    haversine_test.cpp\n    rtree_test.cpp\n    pathfinding_test.cpp\n    hull_test.cpp\n    cluster_test.cpp\n)\n",
)

write_file(
    "atlas_geo/include/atlas_geo/hull.hpp",
    """
    #pragma once

    #include \"atlas_geo/core.hpp\"

    #include <vector>

    namespace atlas::geo {

    [[nodiscard]] std::vector<Coordinate> convex_hull(std::vector<Coordinate> points);

    }  // namespace atlas::geo
    """,
)

write_file(
    "atlas_geo/include/atlas_geo/cluster.hpp",
    """
    #pragma once

    #include \"atlas_geo/core.hpp\"
    #include \"atlas_geo/rtree.hpp\"

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
    """,
)

write_file(
    "atlas_geo/src/hull.cpp",
    """
    #include \"atlas_geo/hull.hpp\"

    #include <algorithm>
    #include <stdexcept>
    #include <tuple>
    #include <vector>

    namespace {

    constexpr double kCrossEpsilon = 1e-12;

    bool coordinate_less(const atlas::geo::Coordinate& left, const atlas::geo::Coordinate& right) {
        return std::tie(left.longitude, left.latitude) < std::tie(right.longitude, right.latitude);
    }

    double cross_product(
        const atlas::geo::Coordinate& origin,
        const atlas::geo::Coordinate& point_a,
        const atlas::geo::Coordinate& point_b) {
        const auto ax = point_a.longitude - origin.longitude;
        const auto ay = point_a.latitude - origin.latitude;
        const auto bx = point_b.longitude - origin.longitude;
        const auto by = point_b.latitude - origin.latitude;
        return (ax * by) - (ay * bx);
    }

    void append_hull_point(std::vector<atlas::geo::Coordinate>& chain, const atlas::geo::Coordinate& point) {
        while (chain.size() >= 2
            && cross_product(chain[chain.size() - 2], chain.back(), point) <= kCrossEpsilon) {
            chain.pop_back();
        }

        chain.push_back(point);
    }

    }  // namespace

    namespace atlas::geo {

    std::vector<Coordinate> convex_hull(std::vector<Coordinate> points) {
        for (const auto& point : points) {
            if (!is_coordinate_valid(point)) {
                throw std::invalid_argument(\"Convex hull input contains an invalid latitude/longitude coordinate\");
            }
        }

        std::sort(points.begin(), points.end(), coordinate_less);
        points.erase(std::unique(points.begin(), points.end()), points.end());

        if (points.size() <= 1) {
            return points;
        }

        std::vector<Coordinate> lower_hull;
        lower_hull.reserve(points.size());
        for (const auto& point : points) {
            append_hull_point(lower_hull, point);
        }

        std::vector<Coordinate> upper_hull;
        upper_hull.reserve(points.size());
        for (auto point_it = points.rbegin(); point_it != points.rend(); ++point_it) {
            append_hull_point(upper_hull, *point_it);
        }

        lower_hull.pop_back();
        upper_hull.pop_back();
        lower_hull.insert(lower_hull.end(), upper_hull.begin(), upper_hull.end());
        return lower_hull;
    }

    }  // namespace atlas::geo
    """,
)

write_file(
    "atlas_geo/src/cluster.cpp",
    """
    #include \"atlas_geo/cluster.hpp\"

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
            throw std::invalid_argument(\"Viewport clustering bucket counts must be positive\");
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
            throw std::invalid_argument(\"Viewport clustering requires a valid viewport bounds definition\");
        }

        if (options.latitude_buckets == 0 || options.longitude_buckets == 0) {
            throw std::invalid_argument(\"Viewport clustering bucket counts must be positive\");
        }

        std::unordered_set<std::string> seen_ids;
        seen_ids.reserve(points.size());
        std::map<std::pair<std::size_t, std::size_t>, ClusterAccumulator> grouped_points;

        for (const auto& point : points) {
            if (point.id.empty()) {
                throw std::invalid_argument(\"Viewport clustering requires non-empty point ids\");
            }

            if (!is_coordinate_valid(point.coordinate)) {
                throw std::invalid_argument(\"Viewport clustering input contains an invalid latitude/longitude coordinate\");
            }

            const auto insert_result = seen_ids.insert(point.id);
            if (!insert_result.second) {
                throw std::invalid_argument(\"Viewport clustering input contains duplicate point id '\" + point.id + \"'\");
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
    """,
)

write_file(
    "atlas_geo/tests/hull_test.cpp",
    """
    #include \"atlas_geo/hull.hpp\"

    #include <gtest/gtest.h>

    #include <stdexcept>
    #include <vector>

    namespace atlas::geo {
    namespace {

    TEST(ConvexHullTest, ReturnsAnEmptyHullForEmptyInput) {
        EXPECT_TRUE(convex_hull({}).empty());
    }

    TEST(ConvexHullTest, RemovesDuplicatesAndInteriorPoints) {
        const auto hull = convex_hull({
            {0.0, 0.0},
            {0.0, 2.0},
            {2.0, 2.0},
            {2.0, 0.0},
            {1.0, 1.0},
            {0.5, 0.5},
            {0.0, 0.0},
            {2.0, 2.0},
        });

        const std::vector<Coordinate> expected {
            {0.0, 0.0},
            {0.0, 2.0},
            {2.0, 2.0},
            {2.0, 0.0},
        };

        EXPECT_EQ(hull, expected);
    }

    TEST(ConvexHullTest, CollapsesCollinearPointsToTheExtremeEndpoints) {
        const auto hull = convex_hull({
            {0.0, 0.0},
            {1.0, 1.0},
            {2.0, 2.0},
            {3.0, 3.0},
        });

        const std::vector<Coordinate> expected {
            {0.0, 0.0},
            {3.0, 3.0},
        };

        EXPECT_EQ(hull, expected);
    }

    TEST(ConvexHullTest, RejectsInvalidCoordinates) {
        EXPECT_THROW(convex_hull({{95.0, 0.0}}), std::invalid_argument);
    }

    }  // namespace
    }  // namespace atlas::geo
    """,
)

write_file(
    "atlas_geo/tests/cluster_test.cpp",
    """
    #include \"atlas_geo/cluster.hpp\"

    #include <gtest/gtest.h>

    #include <stdexcept>
    #include <string>
    #include <vector>

    namespace atlas::geo {
    namespace {

    TEST(ViewportClusteringTest, ReturnsNoClustersForEmptyInput) {
        const auto clusters = cluster_points_in_viewport({}, {0.0, 0.0, 10.0, 10.0});
        EXPECT_TRUE(clusters.empty());
    }

    TEST(ViewportClusteringTest, GroupsVisiblePointsIntoDeterministicViewportBuckets) {
        const std::vector<SpatialPoint> points {
            {\"alpha\", {1.0, 1.0}},
            {\"beta\", {2.0, 2.0}},
            {\"charlie\", {6.0, 7.0}},
            {\"delta\", {9.0, 9.0}},
            {\"outside\", {12.0, 12.0}},
        };

        const auto clusters = cluster_points_in_viewport(
            points,
            {0.0, 0.0, 10.0, 10.0},
            {2, 2});

        ASSERT_EQ(clusters.size(), 2U);

        EXPECT_EQ(clusters[0].latitude_bucket, 0U);
        EXPECT_EQ(clusters[0].longitude_bucket, 0U);
        EXPECT_EQ(clusters[0].point_ids, (std::vector<std::string> {\"alpha\", \"beta\"}));
        EXPECT_EQ(clusters[0].point_count, 2U);
        EXPECT_DOUBLE_EQ(clusters[0].centroid.latitude, 1.5);
        EXPECT_DOUBLE_EQ(clusters[0].centroid.longitude, 1.5);
        EXPECT_DOUBLE_EQ(clusters[0].bounds.min_latitude, 1.0);
        EXPECT_DOUBLE_EQ(clusters[0].bounds.min_longitude, 1.0);
        EXPECT_DOUBLE_EQ(clusters[0].bounds.max_latitude, 2.0);
        EXPECT_DOUBLE_EQ(clusters[0].bounds.max_longitude, 2.0);

        EXPECT_EQ(clusters[1].latitude_bucket, 1U);
        EXPECT_EQ(clusters[1].longitude_bucket, 1U);
        EXPECT_EQ(clusters[1].point_ids, (std::vector<std::string> {\"charlie\", \"delta\"}));
        EXPECT_EQ(clusters[1].point_count, 2U);
        EXPECT_DOUBLE_EQ(clusters[1].centroid.latitude, 7.5);
        EXPECT_DOUBLE_EQ(clusters[1].centroid.longitude, 8.0);
    }

    TEST(ViewportClusteringTest, TreatsTheMaximumViewportEdgeAsInclusive) {
        const auto clusters = cluster_points_in_viewport(
            {{\"edge\", {10.0, 10.0}}},
            {0.0, 0.0, 10.0, 10.0},
            {2, 2});

        ASSERT_EQ(clusters.size(), 1U);
        EXPECT_EQ(clusters.front().latitude_bucket, 1U);
        EXPECT_EQ(clusters.front().longitude_bucket, 1U);
        EXPECT_EQ(clusters.front().point_ids, (std::vector<std::string> {\"edge\"}));
    }

    TEST(ViewportClusteringTest, RejectsInvalidViewportDefinitionsAndPointSets) {
        EXPECT_THROW(cluster_points_in_viewport({}, {8.0, 0.0, 2.0, 10.0}), std::invalid_argument);
        EXPECT_THROW(cluster_points_in_viewport({}, {0.0, 0.0, 10.0, 10.0}, {0, 2}), std::invalid_argument);
        EXPECT_THROW(
            cluster_points_in_viewport({{\"\", {1.0, 1.0}}}, {0.0, 0.0, 10.0, 10.0}),
            std::invalid_argument);
        EXPECT_THROW(
            cluster_points_in_viewport({{\"bad\", {95.0, 1.0}}}, {0.0, 0.0, 10.0, 10.0}),
            std::invalid_argument);
        EXPECT_THROW(
            cluster_points_in_viewport(
                {{\"dup\", {1.0, 1.0}}, {\"dup\", {2.0, 2.0}}},
                {0.0, 0.0, 10.0, 10.0}),
            std::invalid_argument);
    }

    }  // namespace
    }  // namespace atlas::geo
    """,
)

print("Applied native geo Phase 21.5 file updates.")
