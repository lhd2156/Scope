#include "atlas_geo/haversine.hpp"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace {

constexpr double kEarthRadiusKm = 6371.0088;

double degrees_to_radians(const double degrees) {
    return degrees * std::numbers::pi_v<double> / 180.0;
}

}  // namespace

namespace atlas::geo {

double haversine_distance_km(const Coordinate& from, const Coordinate& to) {
    const auto latitude_1 = degrees_to_radians(from.latitude);
    const auto latitude_2 = degrees_to_radians(to.latitude);
    const auto delta_latitude = degrees_to_radians(to.latitude - from.latitude);
    const auto delta_longitude = degrees_to_radians(to.longitude - from.longitude);

    const auto sin_half_delta_latitude = std::sin(delta_latitude / 2.0);
    const auto sin_half_delta_longitude = std::sin(delta_longitude / 2.0);

    const auto haversine = std::clamp(
        (sin_half_delta_latitude * sin_half_delta_latitude)
            + (std::cos(latitude_1) * std::cos(latitude_2)
                * sin_half_delta_longitude * sin_half_delta_longitude),
        0.0,
        1.0);

    const auto central_angle = 2.0 * std::atan2(std::sqrt(haversine), std::sqrt(1.0 - haversine));
    return kEarthRadiusKm * central_angle;
}

double haversine_distance_meters(const Coordinate& from, const Coordinate& to) {
    return haversine_distance_km(from, to) * 1000.0;
}

}  // namespace atlas::geo
