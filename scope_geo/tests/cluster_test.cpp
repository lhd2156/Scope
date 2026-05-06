#include "scope_geo/cluster.hpp"

#include <gtest/gtest.h>

#include <stdexcept>
#include <string>
#include <vector>

namespace scope::geo {
namespace {

TEST(ViewportClusteringTest, ReturnsNoClustersForEmptyInput) {
    const auto clusters = cluster_points_in_viewport({}, {0.0, 0.0, 10.0, 10.0});
    EXPECT_TRUE(clusters.empty());
}

TEST(ViewportClusteringTest, GroupsVisiblePointsIntoDeterministicViewportBuckets) {
    const std::vector<SpatialPoint> points {
        {"alpha", {1.0, 1.0}},
        {"beta", {2.0, 2.0}},
        {"charlie", {6.0, 7.0}},
        {"delta", {9.0, 9.0}},
        {"outside", {12.0, 12.0}},
    };

    const auto clusters = cluster_points_in_viewport(
        points,
        {0.0, 0.0, 10.0, 10.0},
        {2, 2});

    ASSERT_EQ(clusters.size(), 2U);

    EXPECT_EQ(clusters[0].latitude_bucket, 0U);
    EXPECT_EQ(clusters[0].longitude_bucket, 0U);
    EXPECT_EQ(clusters[0].point_ids, (std::vector<std::string> {"alpha", "beta"}));
    EXPECT_EQ(clusters[0].point_count, 2U);
    EXPECT_DOUBLE_EQ(clusters[0].centroid.latitude, 1.5);
    EXPECT_DOUBLE_EQ(clusters[0].centroid.longitude, 1.5);
    EXPECT_DOUBLE_EQ(clusters[0].bounds.min_latitude, 1.0);
    EXPECT_DOUBLE_EQ(clusters[0].bounds.min_longitude, 1.0);
    EXPECT_DOUBLE_EQ(clusters[0].bounds.max_latitude, 2.0);
    EXPECT_DOUBLE_EQ(clusters[0].bounds.max_longitude, 2.0);

    EXPECT_EQ(clusters[1].latitude_bucket, 1U);
    EXPECT_EQ(clusters[1].longitude_bucket, 1U);
    EXPECT_EQ(clusters[1].point_ids, (std::vector<std::string> {"charlie", "delta"}));
    EXPECT_EQ(clusters[1].point_count, 2U);
    EXPECT_DOUBLE_EQ(clusters[1].centroid.latitude, 7.5);
    EXPECT_DOUBLE_EQ(clusters[1].centroid.longitude, 8.0);
}

TEST(ViewportClusteringTest, TreatsTheMaximumViewportEdgeAsInclusive) {
    const auto clusters = cluster_points_in_viewport(
        {{"edge", {10.0, 10.0}}},
        {0.0, 0.0, 10.0, 10.0},
        {2, 2});

    ASSERT_EQ(clusters.size(), 1U);
    EXPECT_EQ(clusters.front().latitude_bucket, 1U);
    EXPECT_EQ(clusters.front().longitude_bucket, 1U);
    EXPECT_EQ(clusters.front().point_ids, (std::vector<std::string> {"edge"}));
}

TEST(ViewportClusteringTest, RejectsInvalidViewportDefinitionsAndPointSets) {
    EXPECT_THROW(cluster_points_in_viewport({}, {8.0, 0.0, 2.0, 10.0}), std::invalid_argument);
    EXPECT_THROW(cluster_points_in_viewport({}, {0.0, 0.0, 10.0, 10.0}, {0, 2}), std::invalid_argument);
    EXPECT_THROW(
        cluster_points_in_viewport({{"", {1.0, 1.0}}}, {0.0, 0.0, 10.0, 10.0}),
        std::invalid_argument);
    EXPECT_THROW(
        cluster_points_in_viewport({{"bad", {95.0, 1.0}}}, {0.0, 0.0, 10.0, 10.0}),
        std::invalid_argument);
    EXPECT_THROW(
        cluster_points_in_viewport(
            {{"dup", {1.0, 1.0}}, {"dup", {2.0, 2.0}}},
            {0.0, 0.0, 10.0, 10.0}),
        std::invalid_argument);
}

}  // namespace
}  // namespace scope::geo
