#pragma once

#include "scope_geo/core.hpp"

#include <vector>

namespace scope::geo {

[[nodiscard]] std::vector<Coordinate> convex_hull(std::vector<Coordinate> points);

}  // namespace scope::geo
