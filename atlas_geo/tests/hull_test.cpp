#include "atlas_geo/hull.hpp"

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
