#include "atlas_geo/hull.hpp"

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
            throw std::invalid_argument("Convex hull input contains an invalid latitude/longitude coordinate");
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
