#pragma once

#include "atlas_geo/core.hpp"

#include <vector>

namespace atlas::geo {

[[nodiscard]] std::vector<Coordinate> convex_hull(std::vector<Coordinate> points);

}  // namespace atlas::geo
