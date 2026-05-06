#pragma once

#include "scope_geo/core.hpp"

namespace scope::geo {

double haversine_distance_km(const Coordinate& from, const Coordinate& to);
double haversine_distance_meters(const Coordinate& from, const Coordinate& to);

}  // namespace scope::geo
