#include "atlas_geo/core.hpp"

namespace atlas::geo {

std::string version() {
    return "0.1.0";
}

bool is_coordinate_valid(const Coordinate& coordinate) {
    return coordinate.latitude >= -90.0 && coordinate.latitude <= 90.0
        && coordinate.longitude >= -180.0 && coordinate.longitude <= 180.0;
}

}  // namespace atlas::geo
