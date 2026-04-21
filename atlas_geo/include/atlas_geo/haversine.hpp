#pragma once

#include "atlas_geo/core.hpp"

namespace atlas::geo {

double haversine_distance_km(const Coordinate& from, const Coordinate& to);
double haversine_distance_meters(const Coordinate& from, const Coordinate& to);

}  // namespace atlas::geo
