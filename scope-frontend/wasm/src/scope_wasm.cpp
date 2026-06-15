#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <iomanip>
#include <initializer_list>
#include <limits>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "scope_ai_lexer.hpp"

namespace scope {
namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kMercatorMaxLatitude = 85.05112878;
constexpr double kTileSize = 512.0;
constexpr double kEarthRadiusKm = 6371.0088;
constexpr double kDefaultClusterRadiusPx = 64.0;
constexpr int kDefaultMinClusterPoints = 2;

struct ModuleInfo {
  std::string version;
  bool algorithmsReady;
  std::string status;
};

struct ViewportDefinition {
  double west;
  double south;
  double east;
  double north;
  double width;
  double height;
  double zoom;
};

struct ClusterOptions {
  double radiusPx;
  int minPoints;
  bool includeSingles;
};

struct ViewportProjectionContext {
  ViewportDefinition viewport;
  bool crossesAntimeridian;
  double adjustedEast;
  double westWorldX;
  double eastWorldX;
  double northWorldY;
  double southWorldY;
  double xSpan;
  double ySpan;
};

struct GeographicPoint {
  std::string id;
  double latitude;
  double longitude;
  bool valid;
};

struct ProjectedPoint {
  std::string id;
  double latitude;
  double longitude;
  double worldX;
  double worldY;
  double screenX;
  double screenY;
};

class DisjointSet {
 public:
  explicit DisjointSet(std::size_t size)
      : parent_(size), rank_(size, 0) {
    for (std::size_t index = 0; index < size; ++index) {
      parent_[index] = index;
    }
  }

  std::size_t find(std::size_t index) {
    if (parent_[index] == index) {
      return index;
    }

    parent_[index] = find(parent_[index]);
    return parent_[index];
  }

  void unite(std::size_t left, std::size_t right) {
    const auto leftRoot = find(left);
    const auto rightRoot = find(right);

    if (leftRoot == rightRoot) {
      return;
    }

    if (rank_[leftRoot] < rank_[rightRoot]) {
      parent_[leftRoot] = rightRoot;
      return;
    }

    if (rank_[leftRoot] > rank_[rightRoot]) {
      parent_[rightRoot] = leftRoot;
      return;
    }

    parent_[rightRoot] = leftRoot;
    ++rank_[leftRoot];
  }

 private:
  std::vector<std::size_t> parent_;
  std::vector<std::size_t> rank_;
};

bool isNullish(const emscripten::val& value) {
  return value.isUndefined() || value.isNull();
}

template <typename T>
T getFieldOr(const emscripten::val& object, std::initializer_list<const char*> fieldNames, const T& fallback) {
  for (const auto* fieldName : fieldNames) {
    const auto fieldValue = object[fieldName];
    if (!isNullish(fieldValue)) {
      return fieldValue.as<T>();
    }
  }

  return fallback;
}

emscripten::val createScopeAiLexTokenObject(const wasm::lexer::Token& token) {
  auto result = emscripten::val::object();
  result.set("type", token.type);
  result.set("value", token.value);
  result.set("normalized", token.normalized);
  result.set("start", token.start);
  result.set("end", token.end);
  return result;
}

double clamp(double value, double minimum, double maximum) {
  return std::min(std::max(value, minimum), maximum);
}

double roundToPrecision(double value, int digits = 2) {
  const auto factor = std::pow(10.0, digits);
  return std::round(value * factor) / factor;
}

double degreesToRadians(double value) {
  return (value * kPi) / 180.0;
}

double radiansToDegrees(double value) {
  return (value * 180.0) / kPi;
}

double wrapLongitude(double longitude) {
  while (longitude < -180.0) {
    longitude += 360.0;
  }

  while (longitude >= 180.0) {
    longitude -= 360.0;
  }

  return longitude;
}

double worldSizeForZoom(double zoom) {
  return kTileSize * std::pow(2.0, std::max(zoom, 0.0));
}

double mercatorWorldX(double longitude, double zoom) {
  const auto normalizedLongitude = longitude + 180.0;
  return (normalizedLongitude / 360.0) * worldSizeForZoom(zoom);
}

double mercatorWorldY(double latitude, double zoom) {
  const auto clampedLatitude = clamp(latitude, -kMercatorMaxLatitude, kMercatorMaxLatitude);
  const auto latitudeRadians = degreesToRadians(clampedLatitude);
  const auto mercatorProjection = std::log(std::tan((kPi / 4.0) + (latitudeRadians / 2.0)));
  return (0.5 - (mercatorProjection / (2.0 * kPi))) * worldSizeForZoom(zoom);
}

double worldXToLongitude(double worldX, double zoom) {
  const auto worldSize = worldSizeForZoom(zoom);
  return wrapLongitude(((worldX / worldSize) * 360.0) - 180.0);
}

double worldYToLatitude(double worldY, double zoom) {
  const auto worldSize = worldSizeForZoom(zoom);
  const auto normalized = 1.0 - ((2.0 * worldY) / worldSize);
  return radiansToDegrees(std::atan(std::sinh(kPi * normalized)));
}

double distanceSquared(const ProjectedPoint& left, const ProjectedPoint& right) {
  const auto deltaX = left.screenX - right.screenX;
  const auto deltaY = left.screenY - right.screenY;
  return (deltaX * deltaX) + (deltaY * deltaY);
}

std::int64_t hashCell(int x, int y) {
  return (static_cast<std::int64_t>(x) << 32) ^ static_cast<std::uint32_t>(y);
}

std::string buildClusterId(const std::vector<std::string>& pointIds) {
  std::uint64_t hash = 1469598103934665603ull;

  for (const auto& pointId : pointIds) {
    for (const auto character : pointId) {
      hash ^= static_cast<std::uint8_t>(character);
      hash *= 1099511628211ull;
    }

    hash ^= static_cast<std::uint8_t>(':');
    hash *= 1099511628211ull;
  }

  std::ostringstream stream;
  stream << "cluster-" << std::hex << hash << '-' << pointIds.size();
  return stream.str();
}

ViewportDefinition parseViewport(const emscripten::val& rawViewport) {
  const auto west = getFieldOr<double>(rawViewport, {"west", "left", "minLongitude"}, -180.0);
  auto south = getFieldOr<double>(rawViewport, {"south", "bottom", "minLatitude"}, -85.0);
  const auto east = getFieldOr<double>(rawViewport, {"east", "right", "maxLongitude"}, 180.0);
  auto north = getFieldOr<double>(rawViewport, {"north", "top", "maxLatitude"}, 85.0);
  const auto width = std::max(getFieldOr<double>(rawViewport, {"width"}, 0.0), 0.0);
  const auto height = std::max(getFieldOr<double>(rawViewport, {"height"}, 0.0), 0.0);
  const auto zoom = std::max(getFieldOr<double>(rawViewport, {"zoom"}, 0.0), 0.0);

  if (south > north) {
    std::swap(south, north);
  }

  return {
    west,
    south,
    east,
    north,
    width,
    height,
    zoom,
  };
}

ClusterOptions parseClusterOptions(const emscripten::val& rawOptions) {
  const auto radiusPx = getFieldOr<double>(rawOptions, {"radiusPx", "clusterRadiusPx", "radius"}, kDefaultClusterRadiusPx);
  const auto minPoints = getFieldOr<int>(rawOptions, {"minPoints", "minClusterSize", "minimumPoints"}, kDefaultMinClusterPoints);
  const auto includeSingles = getFieldOr<bool>(rawOptions, {"includeSingles", "includeSingletons"}, true);

  return {
    std::max(radiusPx, 1.0),
    std::max(minPoints, 2),
    includeSingles,
  };
}

ViewportProjectionContext buildProjectionContext(const ViewportDefinition& viewport) {
  const auto crossesAntimeridian = viewport.east < viewport.west;
  const auto adjustedEast = crossesAntimeridian ? viewport.east + 360.0 : viewport.east;
  const auto westWorldX = mercatorWorldX(viewport.west, viewport.zoom);
  const auto eastWorldX = mercatorWorldX(adjustedEast, viewport.zoom);
  const auto northWorldY = mercatorWorldY(viewport.north, viewport.zoom);
  const auto southWorldY = mercatorWorldY(viewport.south, viewport.zoom);

  return {
    viewport,
    crossesAntimeridian,
    adjustedEast,
    westWorldX,
    eastWorldX,
    northWorldY,
    southWorldY,
    std::max(std::abs(eastWorldX - westWorldX), 1e-9),
    std::max(std::abs(southWorldY - northWorldY), 1e-9),
  };
}

GeographicPoint parseGeographicPoint(const emscripten::val& rawPoint, const std::string& fallbackId) {
  if (isNullish(rawPoint)) {
    return {
      fallbackId,
      0.0,
      0.0,
      false,
    };
  }

  const auto latitude = getFieldOr<double>(rawPoint, {"latitude", "lat"}, std::numeric_limits<double>::quiet_NaN());
  const auto longitude = getFieldOr<double>(rawPoint, {"longitude", "lng", "lon"}, std::numeric_limits<double>::quiet_NaN());
  auto pointId = getFieldOr<std::string>(rawPoint, {"id"}, fallbackId);
  if (pointId.empty()) {
    pointId = fallbackId;
  }

  if (!std::isfinite(latitude) || !std::isfinite(longitude)) {
    return {
      pointId,
      0.0,
      0.0,
      false,
    };
  }

  return {
    pointId,
    clamp(latitude, -kMercatorMaxLatitude, kMercatorMaxLatitude),
    wrapLongitude(longitude),
    true,
  };
}

std::pair<double, double> screenToGeographic(const ViewportProjectionContext& projectionContext, double screenX, double screenY) {
  const auto clampedScreenX = clamp(screenX, 0.0, projectionContext.viewport.width);
  const auto clampedScreenY = clamp(screenY, 0.0, projectionContext.viewport.height);
  const auto worldX = projectionContext.westWorldX + ((clampedScreenX / projectionContext.viewport.width) * projectionContext.xSpan);
  const auto worldY = projectionContext.northWorldY + ((clampedScreenY / projectionContext.viewport.height) * projectionContext.ySpan);

  return {
    worldYToLatitude(worldY, projectionContext.viewport.zoom),
    worldXToLongitude(worldX, projectionContext.viewport.zoom),
  };
}

std::vector<ProjectedPoint> projectVisiblePoints(const emscripten::val& rawPoints, const ViewportProjectionContext& projectionContext) {
  const auto& viewport = projectionContext.viewport;
  if (viewport.width <= 0.0 || viewport.height <= 0.0) {
    return {};
  }

  std::vector<ProjectedPoint> projectedPoints;
  const auto pointCount = rawPoints["length"].as<unsigned>();
  projectedPoints.reserve(pointCount);

  for (unsigned index = 0; index < pointCount; ++index) {
    const auto rawPoint = rawPoints[index];
    if (isNullish(rawPoint)) {
      continue;
    }

    const auto latitude = getFieldOr<double>(rawPoint, {"latitude", "lat"}, std::numeric_limits<double>::quiet_NaN());
    const auto longitude = getFieldOr<double>(rawPoint, {"longitude", "lng", "lon"}, std::numeric_limits<double>::quiet_NaN());

    if (!std::isfinite(latitude) || !std::isfinite(longitude)) {
      continue;
    }

    auto adjustedLongitude = longitude;
    if (projectionContext.crossesAntimeridian) {
      while (adjustedLongitude < viewport.west) {
        adjustedLongitude += 360.0;
      }

      while (adjustedLongitude > projectionContext.adjustedEast) {
        adjustedLongitude -= 360.0;
      }
    }

    const auto worldX = mercatorWorldX(adjustedLongitude, viewport.zoom);
    const auto worldY = mercatorWorldY(latitude, viewport.zoom);
    const auto screenX = ((worldX - projectionContext.westWorldX) / projectionContext.xSpan) * viewport.width;
    const auto screenY = ((worldY - projectionContext.northWorldY) / projectionContext.ySpan) * viewport.height;

    if (screenX < 0.0 || screenX > viewport.width || screenY < 0.0 || screenY > viewport.height) {
      continue;
    }

    auto pointId = getFieldOr<std::string>(rawPoint, {"id"}, std::string{});
    if (pointId.empty()) {
      pointId = "point-" + std::to_string(index);
    }

    projectedPoints.push_back({
      pointId,
      latitude,
      wrapLongitude(longitude),
      worldX,
      worldY,
      roundToPrecision(screenX),
      roundToPrecision(screenY),
    });
  }

  std::sort(projectedPoints.begin(), projectedPoints.end(), [](const ProjectedPoint& left, const ProjectedPoint& right) {
    if (left.screenY != right.screenY) {
      return left.screenY < right.screenY;
    }

    if (left.screenX != right.screenX) {
      return left.screenX < right.screenX;
    }

    return left.id < right.id;
  });

  return projectedPoints;
}

double haversineDistanceKm(const GeographicPoint& start, const GeographicPoint& end) {
  if (!start.valid || !end.valid) {
    return 0.0;
  }

  const auto startLatitudeRadians = degreesToRadians(start.latitude);
  const auto endLatitudeRadians = degreesToRadians(end.latitude);
  const auto deltaLatitude = endLatitudeRadians - startLatitudeRadians;
  const auto deltaLongitude = degreesToRadians(wrapLongitude(end.longitude - start.longitude));
  const auto haversineComponent =
    std::pow(std::sin(deltaLatitude / 2.0), 2.0)
    + (std::cos(startLatitudeRadians) * std::cos(endLatitudeRadians) * std::pow(std::sin(deltaLongitude / 2.0), 2.0));

  return 2.0 * kEarthRadiusKm * std::asin(std::min(1.0, std::sqrt(haversineComponent)));
}

double screenCrossProduct(const ProjectedPoint& origin, const ProjectedPoint& left, const ProjectedPoint& right) {
  return ((left.screenX - origin.screenX) * (right.screenY - origin.screenY))
    - ((left.screenY - origin.screenY) * (right.screenX - origin.screenX));
}

bool hasSameScreenPosition(const ProjectedPoint& left, const ProjectedPoint& right) {
  return left.screenX == right.screenX && left.screenY == right.screenY;
}

std::vector<ProjectedPoint> buildConvexHull(std::vector<ProjectedPoint> projectedPoints) {
  std::sort(projectedPoints.begin(), projectedPoints.end(), [](const ProjectedPoint& left, const ProjectedPoint& right) {
    if (left.screenX != right.screenX) {
      return left.screenX < right.screenX;
    }

    if (left.screenY != right.screenY) {
      return left.screenY < right.screenY;
    }

    return left.id < right.id;
  });

  projectedPoints.erase(std::unique(projectedPoints.begin(), projectedPoints.end(), hasSameScreenPosition), projectedPoints.end());

  if (projectedPoints.size() <= 2) {
    return projectedPoints;
  }

  std::vector<ProjectedPoint> lowerHull;
  for (const auto& point : projectedPoints) {
    while (lowerHull.size() >= 2
      && screenCrossProduct(lowerHull[lowerHull.size() - 2], lowerHull.back(), point) <= 0.0) {
      lowerHull.pop_back();
    }

    lowerHull.push_back(point);
  }

  std::vector<ProjectedPoint> upperHull;
  for (auto iterator = projectedPoints.rbegin(); iterator != projectedPoints.rend(); ++iterator) {
    while (upperHull.size() >= 2
      && screenCrossProduct(upperHull[upperHull.size() - 2], upperHull.back(), *iterator) <= 0.0) {
      upperHull.pop_back();
    }

    upperHull.push_back(*iterator);
  }

  lowerHull.pop_back();
  upperHull.pop_back();
  lowerHull.insert(lowerHull.end(), upperHull.begin(), upperHull.end());
  return lowerHull;
}

std::pair<double, double> computeAverageScreenPoint(const std::vector<ProjectedPoint>& projectedPoints) {
  if (projectedPoints.empty()) {
    return {0.0, 0.0};
  }

  double accumulatedScreenX = 0.0;
  double accumulatedScreenY = 0.0;
  for (const auto& point : projectedPoints) {
    accumulatedScreenX += point.screenX;
    accumulatedScreenY += point.screenY;
  }

  const auto pointCount = static_cast<double>(projectedPoints.size());
  return {
    accumulatedScreenX / pointCount,
    accumulatedScreenY / pointCount,
  };
}

std::pair<double, double> computeHullCentroid(const std::vector<ProjectedPoint>& hullPoints) {
  if (hullPoints.size() <= 2) {
    return computeAverageScreenPoint(hullPoints);
  }

  double signedAreaTwice = 0.0;
  double centroidX = 0.0;
  double centroidY = 0.0;

  for (std::size_t index = 0; index < hullPoints.size(); ++index) {
    const auto& currentPoint = hullPoints[index];
    const auto& nextPoint = hullPoints[(index + 1) % hullPoints.size()];
    const auto cross = (currentPoint.screenX * nextPoint.screenY) - (nextPoint.screenX * currentPoint.screenY);
    signedAreaTwice += cross;
    centroidX += (currentPoint.screenX + nextPoint.screenX) * cross;
    centroidY += (currentPoint.screenY + nextPoint.screenY) * cross;
  }

  if (std::abs(signedAreaTwice) <= 1e-9) {
    return computeAverageScreenPoint(hullPoints);
  }

  return {
    centroidX / (3.0 * signedAreaTwice),
    centroidY / (3.0 * signedAreaTwice),
  };
}

double computeHullAreaSquarePx(const std::vector<ProjectedPoint>& hullPoints) {
  if (hullPoints.size() <= 2) {
    return 0.0;
  }

  double signedAreaTwice = 0.0;
  for (std::size_t index = 0; index < hullPoints.size(); ++index) {
    const auto& currentPoint = hullPoints[index];
    const auto& nextPoint = hullPoints[(index + 1) % hullPoints.size()];
    signedAreaTwice += (currentPoint.screenX * nextPoint.screenY) - (nextPoint.screenX * currentPoint.screenY);
  }

  return std::abs(signedAreaTwice) / 2.0;
}

double computeHullPerimeterPx(const std::vector<ProjectedPoint>& hullPoints) {
  if (hullPoints.size() <= 1) {
    return 0.0;
  }

  double perimeter = 0.0;
  for (std::size_t index = 0; index < hullPoints.size(); ++index) {
    const auto& currentPoint = hullPoints[index];
    const auto& nextPoint = hullPoints[(index + 1) % hullPoints.size()];
    perimeter += std::hypot(nextPoint.screenX - currentPoint.screenX, nextPoint.screenY - currentPoint.screenY);
    if (hullPoints.size() == 2) {
      break;
    }
  }

  return perimeter;
}

emscripten::val createPointIdsArray(const std::vector<std::string>& pointIds) {
  auto array = emscripten::val::array();
  for (std::size_t index = 0; index < pointIds.size(); ++index) {
    array.set(index, pointIds[index]);
  }

  return array;
}

emscripten::val createProjectedPointsArray(const std::vector<ProjectedPoint>& projectedPoints) {
  auto array = emscripten::val::array();
  for (std::size_t index = 0; index < projectedPoints.size(); ++index) {
    const auto& point = projectedPoints[index];
    auto result = emscripten::val::object();
    result.set("id", point.id);
    result.set("latitude", roundToPrecision(point.latitude, 6));
    result.set("longitude", roundToPrecision(point.longitude, 6));
    result.set("screenX", roundToPrecision(point.screenX));
    result.set("screenY", roundToPrecision(point.screenY));
    array.set(index, result);
  }

  return array;
}

emscripten::val createSingletonResult(const ProjectedPoint& point) {
  auto result = emscripten::val::object();
  result.set("id", point.id);
  result.set("clustered", false);
  result.set("pointCount", 1);
  result.set("latitude", roundToPrecision(point.latitude, 6));
  result.set("longitude", roundToPrecision(point.longitude, 6));
  result.set("screenX", point.screenX);
  result.set("screenY", point.screenY);
  result.set("minScreenX", point.screenX);
  result.set("minScreenY", point.screenY);
  result.set("maxScreenX", point.screenX);
  result.set("maxScreenY", point.screenY);
  result.set("pointIds", createPointIdsArray({point.id}));
  return result;
}

emscripten::val createClusterResult(const std::vector<std::size_t>& memberIndices, const std::vector<ProjectedPoint>& projectedPoints, double zoom) {
  std::vector<std::string> pointIds;
  pointIds.reserve(memberIndices.size());

  double accumulatedWorldX = 0.0;
  double accumulatedWorldY = 0.0;
  double accumulatedScreenX = 0.0;
  double accumulatedScreenY = 0.0;
  double minScreenX = std::numeric_limits<double>::max();
  double minScreenY = std::numeric_limits<double>::max();
  double maxScreenX = std::numeric_limits<double>::lowest();
  double maxScreenY = std::numeric_limits<double>::lowest();

  for (const auto memberIndex : memberIndices) {
    const auto& member = projectedPoints[memberIndex];
    pointIds.push_back(member.id);
    accumulatedWorldX += member.worldX;
    accumulatedWorldY += member.worldY;
    accumulatedScreenX += member.screenX;
    accumulatedScreenY += member.screenY;
    minScreenX = std::min(minScreenX, member.screenX);
    minScreenY = std::min(minScreenY, member.screenY);
    maxScreenX = std::max(maxScreenX, member.screenX);
    maxScreenY = std::max(maxScreenY, member.screenY);
  }

  std::sort(pointIds.begin(), pointIds.end());

  const auto memberCount = static_cast<double>(memberIndices.size());
  const auto centerWorldX = accumulatedWorldX / memberCount;
  const auto centerWorldY = accumulatedWorldY / memberCount;
  const auto centerScreenX = accumulatedScreenX / memberCount;
  const auto centerScreenY = accumulatedScreenY / memberCount;

  auto result = emscripten::val::object();
  result.set("id", buildClusterId(pointIds));
  result.set("clustered", true);
  result.set("pointCount", static_cast<int>(memberIndices.size()));
  result.set("latitude", roundToPrecision(worldYToLatitude(centerWorldY, zoom), 6));
  result.set("longitude", roundToPrecision(worldXToLongitude(centerWorldX, zoom), 6));
  result.set("screenX", roundToPrecision(centerScreenX));
  result.set("screenY", roundToPrecision(centerScreenY));
  result.set("minScreenX", roundToPrecision(minScreenX));
  result.set("minScreenY", roundToPrecision(minScreenY));
  result.set("maxScreenX", roundToPrecision(maxScreenX));
  result.set("maxScreenY", roundToPrecision(maxScreenY));
  result.set("pointIds", createPointIdsArray(pointIds));
  return result;
}

}  // namespace

std::string ping() {
  return "scope-wasm-ready";
}

ModuleInfo getModuleInfo() {
  return {
    "0.4.0",
    true,
    "Phase 23.4 clustering, haversine, convex hull, and Scope AI lexer helpers ready",
  };
}

emscripten::val lexScopeAiCommandText(const std::string& input) {
  const auto tokens = wasm::lexer::tokenize(input);
  auto results = emscripten::val::array();
  for (std::size_t index = 0; index < tokens.size(); ++index) {
    results.set(index, createScopeAiLexTokenObject(tokens[index]));
  }

  return results;
}

emscripten::val calculateHaversineDistance(const emscripten::val& rawStart, const emscripten::val& rawEnd) {
  const auto start = parseGeographicPoint(rawStart, "origin");
  const auto end = parseGeographicPoint(rawEnd, "target");
  auto result = emscripten::val::object();
  result.set("fromId", start.id);
  result.set("toId", end.id);
  result.set("valid", start.valid && end.valid);

  if (!start.valid || !end.valid) {
    result.set("kilometers", 0.0);
    result.set("miles", 0.0);
    result.set("meters", 0.0);
    return result;
  }

  const auto distanceKm = haversineDistanceKm(start, end);
  result.set("kilometers", roundToPrecision(distanceKm, 3));
  result.set("miles", roundToPrecision(distanceKm * 0.621371, 3));
  result.set("meters", roundToPrecision(distanceKm * 1000.0, 0));
  return result;
}

emscripten::val clusterViewportPoints(const emscripten::val& rawPoints, const emscripten::val& rawViewport, const emscripten::val& rawOptions) {
  const auto viewport = parseViewport(rawViewport);
  const auto projectionContext = buildProjectionContext(viewport);
  const auto options = parseClusterOptions(rawOptions);
  const auto projectedPoints = projectVisiblePoints(rawPoints, projectionContext);
  auto results = emscripten::val::array();

  if (projectedPoints.empty()) {
    return results;
  }

  std::unordered_map<std::int64_t, std::vector<std::size_t>> grid;
  grid.reserve(projectedPoints.size());

  for (std::size_t index = 0; index < projectedPoints.size(); ++index) {
    const auto cellX = static_cast<int>(std::floor(projectedPoints[index].screenX / options.radiusPx));
    const auto cellY = static_cast<int>(std::floor(projectedPoints[index].screenY / options.radiusPx));
    grid[hashCell(cellX, cellY)].push_back(index);
  }

  DisjointSet disjointSet(projectedPoints.size());
  const auto radiusSquared = options.radiusPx * options.radiusPx;

  for (std::size_t index = 0; index < projectedPoints.size(); ++index) {
    const auto cellX = static_cast<int>(std::floor(projectedPoints[index].screenX / options.radiusPx));
    const auto cellY = static_cast<int>(std::floor(projectedPoints[index].screenY / options.radiusPx));

    for (int offsetX = -1; offsetX <= 1; ++offsetX) {
      for (int offsetY = -1; offsetY <= 1; ++offsetY) {
        const auto cellIterator = grid.find(hashCell(cellX + offsetX, cellY + offsetY));
        if (cellIterator == grid.end()) {
          continue;
        }

        for (const auto neighborIndex : cellIterator->second) {
          if (neighborIndex <= index) {
            continue;
          }

          if (distanceSquared(projectedPoints[index], projectedPoints[neighborIndex]) <= radiusSquared) {
            disjointSet.unite(index, neighborIndex);
          }
        }
      }
    }
  }

  std::unordered_map<std::size_t, std::size_t> groupPositions;
  std::vector<std::vector<std::size_t>> groupedIndices;
  groupedIndices.reserve(projectedPoints.size());

  for (std::size_t index = 0; index < projectedPoints.size(); ++index) {
    const auto root = disjointSet.find(index);
    const auto existingGroup = groupPositions.find(root);

    if (existingGroup == groupPositions.end()) {
      groupPositions.emplace(root, groupedIndices.size());
      groupedIndices.push_back({index});
      continue;
    }

    groupedIndices[existingGroup->second].push_back(index);
  }

  std::size_t resultIndex = 0;
  for (const auto& group : groupedIndices) {
    if (static_cast<int>(group.size()) < options.minPoints) {
      if (!options.includeSingles) {
        continue;
      }

      for (const auto memberIndex : group) {
        results.set(resultIndex++, createSingletonResult(projectedPoints[memberIndex]));
      }

      continue;
    }

    results.set(resultIndex++, createClusterResult(group, projectedPoints, viewport.zoom));
  }

  return results;
}

emscripten::val buildViewportConvexHull(const emscripten::val& rawPoints, const emscripten::val& rawViewport) {
  const auto viewport = parseViewport(rawViewport);
  const auto projectionContext = buildProjectionContext(viewport);
  const auto projectedPoints = projectVisiblePoints(rawPoints, projectionContext);
  auto result = emscripten::val::object();

  result.set("valid", !projectedPoints.empty());
  result.set("pointCount", static_cast<int>(projectedPoints.size()));
  result.set("hullPointCount", 0);
  result.set("latitude", 0.0);
  result.set("longitude", 0.0);
  result.set("screenX", 0.0);
  result.set("screenY", 0.0);
  result.set("minScreenX", 0.0);
  result.set("minScreenY", 0.0);
  result.set("maxScreenX", 0.0);
  result.set("maxScreenY", 0.0);
  result.set("areaSquarePx", 0.0);
  result.set("perimeterPx", 0.0);
  result.set("pointIds", createPointIdsArray(std::vector<std::string>{}));
  result.set("hullPointIds", createPointIdsArray(std::vector<std::string>{}));
  result.set("hull", createProjectedPointsArray(std::vector<ProjectedPoint>{}));

  if (projectedPoints.empty()) {
    return result;
  }

  std::vector<std::string> pointIds;
  pointIds.reserve(projectedPoints.size());
  double minScreenX = std::numeric_limits<double>::max();
  double minScreenY = std::numeric_limits<double>::max();
  double maxScreenX = std::numeric_limits<double>::lowest();
  double maxScreenY = std::numeric_limits<double>::lowest();

  for (const auto& point : projectedPoints) {
    pointIds.push_back(point.id);
    minScreenX = std::min(minScreenX, point.screenX);
    minScreenY = std::min(minScreenY, point.screenY);
    maxScreenX = std::max(maxScreenX, point.screenX);
    maxScreenY = std::max(maxScreenY, point.screenY);
  }

  std::sort(pointIds.begin(), pointIds.end());
  const auto hullPoints = buildConvexHull(projectedPoints);
  std::vector<std::string> hullPointIds;
  hullPointIds.reserve(hullPoints.size());
  for (const auto& point : hullPoints) {
    hullPointIds.push_back(point.id);
  }

  const auto centroid = computeHullCentroid(hullPoints);
  const auto geographicCentroid = screenToGeographic(projectionContext, centroid.first, centroid.second);

  result.set("hullPointCount", static_cast<int>(hullPoints.size()));
  result.set("latitude", roundToPrecision(geographicCentroid.first, 6));
  result.set("longitude", roundToPrecision(geographicCentroid.second, 6));
  result.set("screenX", roundToPrecision(centroid.first));
  result.set("screenY", roundToPrecision(centroid.second));
  result.set("minScreenX", roundToPrecision(minScreenX));
  result.set("minScreenY", roundToPrecision(minScreenY));
  result.set("maxScreenX", roundToPrecision(maxScreenX));
  result.set("maxScreenY", roundToPrecision(maxScreenY));
  result.set("areaSquarePx", roundToPrecision(computeHullAreaSquarePx(hullPoints)));
  result.set("perimeterPx", roundToPrecision(computeHullPerimeterPx(hullPoints)));
  result.set("pointIds", createPointIdsArray(pointIds));
  result.set("hullPointIds", createPointIdsArray(hullPointIds));
  result.set("hull", createProjectedPointsArray(hullPoints));
  return result;
}

}  // namespace scope

EMSCRIPTEN_BINDINGS(scope_wasm_module) {
  using namespace emscripten;

  value_object<scope::ModuleInfo>("ModuleInfo")
    .field("version", &scope::ModuleInfo::version)
    .field("algorithmsReady", &scope::ModuleInfo::algorithmsReady)
    .field("status", &scope::ModuleInfo::status);

  function("ping", &scope::ping);
  function("getModuleInfo", &scope::getModuleInfo);
  function("lexScopeAiCommandText", &scope::lexScopeAiCommandText);
  function("calculateHaversineDistance", &scope::calculateHaversineDistance);
  function("clusterViewportPoints", &scope::clusterViewportPoints);
  function("buildViewportConvexHull", &scope::buildViewportConvexHull);
}
