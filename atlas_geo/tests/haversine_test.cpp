#include "atlas_geo/haversine.hpp"

#include <gtest/gtest.h>

namespace atlas::geo {
namespace {

TEST(HaversineDistanceTest, ReturnsZeroForIdenticalCoordinates) {
    const Coordinate chicago {41.8781, -87.6298};

    EXPECT_NEAR(haversine_distance_km(chicago, chicago), 0.0, 1e-9);
    EXPECT_NEAR(haversine_distance_meters(chicago, chicago), 0.0, 1e-6);
}

TEST(HaversineDistanceTest, MatchesKnownDistanceForOneEquatorialDegree) {
    const Coordinate point_a {0.0, 0.0};
    const Coordinate point_b {0.0, 1.0};

    EXPECT_NEAR(haversine_distance_km(point_a, point_b), 111.195, 0.05);
}

TEST(HaversineDistanceTest, MatchesKnownIntercityDistance) {
    const Coordinate chicago {41.8781, -87.6298};
    const Coordinate new_york {40.7128, -74.0060};

    EXPECT_NEAR(haversine_distance_km(chicago, new_york), 1144.291, 0.5);
    EXPECT_NEAR(haversine_distance_meters(chicago, new_york), 1144291.0, 500.0);
}

}  // namespace
}  // namespace atlas::geo
