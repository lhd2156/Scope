#include "scope_geo/haversine.hpp"
#include "scope_geo/rtree.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <string>
#include <vector>

namespace scope::geo {
namespace {

std::vector<NearestNeighbor> brute_force_neighbors(
    const std::vector<SpatialPoint>& points,
    const Coordinate& query,
    const std::size_t limit) {
    std::vector<NearestNeighbor> matches;
    matches.reserve(points.size());

    for (const auto& point : points) {
        matches.push_back(NearestNeighbor {point, haversine_distance_km(query, point.coordinate)});
    }

    std::sort(matches.begin(), matches.end(), [](const NearestNeighbor& left, const NearestNeighbor& right) {
        if (left.distance_km != right.distance_km) {
            return left.distance_km < right.distance_km;
        }

        return left.point.id < right.point.id;
    });

    if (matches.size() > limit) {
        matches.resize(limit);
    }

    return matches;
}

TEST(RTreeIndexTest, ReturnsNoNeighborsForAnEmptyIndex) {
    const RTreeIndex index;
    const Coordinate query {41.8781, -87.6298};

    EXPECT_TRUE(index.empty());
    EXPECT_EQ(index.size(), 0U);
    EXPECT_FALSE(index.nearest_neighbor(query).has_value());
    EXPECT_TRUE(index.nearest_neighbors(query, 3).empty());
}

TEST(RTreeIndexTest, ReturnsTheSingleNearestSpot) {
    const std::vector<SpatialPoint> spots {
        {"chicago", {41.8781, -87.6298}},
        {"milwaukee", {43.0389, -87.9065}},
        {"new-york", {40.7128, -74.0060}},
    };

    const RTreeIndex index(spots, 2);
    const Coordinate query {42.0451, -87.6877};  // Evanston

    const auto result = index.nearest_neighbor(query);
    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->point.id, "chicago");
    EXPECT_NEAR(result->distance_km, haversine_distance_km(query, spots.front().coordinate), 1e-6);
}

TEST(RTreeIndexTest, ReturnsKNearestNeighborsInDistanceOrderAcrossBranches) {
    const std::vector<SpatialPoint> spots {
        {"seattle", {47.6062, -122.3321}},
        {"portland", {45.5152, -122.6784}},
        {"san-francisco", {37.7749, -122.4194}},
        {"los-angeles", {34.0522, -118.2437}},
        {"las-vegas", {36.1699, -115.1398}},
        {"denver", {39.7392, -104.9903}},
        {"chicago", {41.8781, -87.6298}},
        {"boston", {42.3601, -71.0589}},
        {"miami", {25.7617, -80.1918}},
    };

    const Coordinate query {36.1147, -115.1728};  // Las Vegas Strip
    const auto expected = brute_force_neighbors(spots, query, 4);

    const RTreeIndex index(spots, 2);
    const auto actual = index.nearest_neighbors(query, 4);

    ASSERT_EQ(actual.size(), expected.size());
    for (std::size_t index_value = 0; index_value < expected.size(); ++index_value) {
        EXPECT_EQ(actual[index_value].point.id, expected[index_value].point.id);
        EXPECT_NEAR(actual[index_value].distance_km, expected[index_value].distance_km, 1e-6);
    }
}

TEST(RTreeIndexTest, RebuildReplacesIndexedSpots) {
    RTreeIndex index({{"chicago", {41.8781, -87.6298}}});
    index.rebuild({
        {"austin", {30.2672, -97.7431}},
        {"houston", {29.7604, -95.3698}},
        {"dallas", {32.7767, -96.7970}},
    });

    const auto neighbors = index.nearest_neighbors({29.4241, -98.4936}, 2);  // San Antonio

    ASSERT_EQ(neighbors.size(), 2U);
    EXPECT_EQ(neighbors[0].point.id, "austin");
    EXPECT_EQ(neighbors[1].point.id, "houston");
}

}  // namespace
}  // namespace scope::geo
