#pragma once

#include <string>

namespace atlas::geo {

struct Coordinate {
    double latitude {};
    double longitude {};
};

std::string version();
bool is_coordinate_valid(const Coordinate& coordinate);

}  // namespace atlas::geo
