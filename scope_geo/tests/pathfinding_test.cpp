#include "scope_geo/pathfinding.hpp"

#include <gtest/gtest.h>

#include <stdexcept>
#include <string>
#include <vector>

namespace scope::geo {
namespace {

std::vector<GraphNode> sample_nodes() {
    return {
        {"a", {0.0, 0.0}},
        {"b", {0.0, 1.0}},
        {"c", {0.0, 2.0}},
        {"d", {0.0, 3.0}},
        {"e", {1.0, 1.0}},
        {"isolated", {5.0, 5.0}},
    };
}

std::vector<GraphEdge> sample_edges() {
    return {
        {"a", "b", 120.0, true},
        {"b", "c", 120.0, true},
        {"c", "d", 120.0, true},
        {"a", "d", 450.0, true},
        {"b", "d", 350.0, true},
        {"a", "e", 260.0, true},
        {"e", "d", 250.0, true},
    };
}

TEST(PathGraphTest, FindsTheCheapestPathWithDijkstra) {
    const PathGraph graph(sample_nodes(), sample_edges());

    const auto result = graph.shortest_path_dijkstra("a", "d");
    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->node_ids, (std::vector<std::string> {"a", "b", "c", "d"}));
    EXPECT_DOUBLE_EQ(result->total_cost_km, 360.0);
}

TEST(PathGraphTest, AStarMatchesTheOptimalPathCost) {
    const PathGraph graph(sample_nodes(), sample_edges());

    const auto dijkstra = graph.shortest_path_dijkstra("a", "d");
    const auto a_star = graph.shortest_path_a_star("a", "d");

    ASSERT_TRUE(dijkstra.has_value());
    ASSERT_TRUE(a_star.has_value());
    EXPECT_EQ(a_star->node_ids, dijkstra->node_ids);
    EXPECT_DOUBLE_EQ(a_star->total_cost_km, dijkstra->total_cost_km);
}

TEST(PathGraphTest, ReturnsNoPathForDisconnectedNodes) {
    const PathGraph graph(sample_nodes(), sample_edges());

    EXPECT_FALSE(graph.shortest_path_dijkstra("a", "isolated").has_value());
    EXPECT_FALSE(graph.shortest_path_a_star("a", "isolated").has_value());
}

TEST(PathGraphTest, ReturnsImmediateZeroCostPathWhenStartEqualsGoal) {
    const PathGraph graph(sample_nodes(), sample_edges());

    const auto dijkstra = graph.shortest_path_dijkstra("c", "c");
    const auto a_star = graph.shortest_path_a_star("c", "c");

    ASSERT_TRUE(dijkstra.has_value());
    ASSERT_TRUE(a_star.has_value());
    EXPECT_EQ(dijkstra->node_ids, (std::vector<std::string> {"c"}));
    EXPECT_EQ(a_star->node_ids, (std::vector<std::string> {"c"}));
    EXPECT_DOUBLE_EQ(dijkstra->total_cost_km, 0.0);
    EXPECT_DOUBLE_EQ(a_star->total_cost_km, 0.0);
}

TEST(PathGraphTest, RespectsDirectedEdgesWhenBidirectionalIsDisabled) {
    const PathGraph graph(
        {
            {"start", {41.8781, -87.6298}},
            {"mid", {41.8810, -87.6231}},
            {"goal", {41.8853, -87.6216}},
        },
        {
            {"start", "mid", 0.8, false},
            {"mid", "goal", 0.7, false},
        });

    const auto forward = graph.shortest_path_dijkstra("start", "goal");
    ASSERT_TRUE(forward.has_value());
    EXPECT_EQ(forward->node_ids, (std::vector<std::string> {"start", "mid", "goal"}));
    EXPECT_DOUBLE_EQ(forward->total_cost_km, 1.5);

    EXPECT_FALSE(graph.shortest_path_dijkstra("goal", "start").has_value());
    EXPECT_FALSE(graph.shortest_path_a_star("goal", "start").has_value());
}

TEST(PathGraphTest, RebuildReplacesTheGraphTopology) {
    PathGraph graph(sample_nodes(), sample_edges());

    graph.rebuild(
        {
            {"start", {41.8781, -87.6298}},
            {"mid", {41.8810, -87.6231}},
            {"goal", {41.8853, -87.6216}},
        },
        {
            {"start", "mid", 0.8, true},
            {"mid", "goal", 0.7, true},
            {"start", "goal", 2.5, true},
        });

    const auto result = graph.shortest_path_dijkstra("start", "goal");
    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->node_ids, (std::vector<std::string> {"start", "mid", "goal"}));
    EXPECT_DOUBLE_EQ(result->total_cost_km, 1.5);
}

TEST(PathGraphTest, RejectsInvalidGraphDefinitions) {
    EXPECT_THROW(
        [] {
            const PathGraph graph(
                {
                    {"dup", {41.8781, -87.6298}},
                    {"dup", {41.8810, -87.6231}},
                },
                {});
        }(),
        std::invalid_argument);

    EXPECT_THROW(
        [] {
            const PathGraph graph(
                {
                    {"start", {41.8781, -87.6298}},
                    {"goal", {41.8853, -87.6216}},
                },
                {
                    {"start", "goal", -1.0, true},
                });
        }(),
        std::invalid_argument);

    const PathGraph graph(
        {
            {"start", {41.8781, -87.6298}},
            {"goal", {41.8853, -87.6216}},
        },
        {
            {"start", "goal", 1.2, true},
        });

    EXPECT_THROW(graph.shortest_path_dijkstra("missing", "goal"), std::invalid_argument);

    EXPECT_THROW(
        [] {
            const PathGraph graph(
                {
                    {"bad", {120.0, -87.6298}},
                },
                {});
        }(),
        std::invalid_argument);
}

}  // namespace
}  // namespace scope::geo
