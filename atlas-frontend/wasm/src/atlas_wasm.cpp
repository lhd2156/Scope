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

namespace atlas {
namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kMercatorMaxLatitude = 85.05112878;
constexpr double kTileSize = 512.0;
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

std::vector<ProjectedPoint> projectVisiblePoints(const emscripten::val& rawPoints, const ViewportDefinition& viewport) {
  if (viewport.width <= 0.0 || viewport.height <= 0.0) {
    return {};
  }

  const auto crossesAntimeridian = viewport.east < viewport.west;
  const auto adjustedEast = crossesAntimeridian ? viewport.east + 360.0 : viewport.east;
  const auto westWorldX = mercatorWorldX(viewport.west, viewport.zoom);
  const auto eastWorldX = mercatorWorldX(adjustedEast, viewport.zoom);
  const auto northWorldY = mercatorWorldY(viewport.north, viewport.zoom);
  const auto southWorldY = mercatorWorldY(viewport.south, viewport.zoom);
  const auto xSpan = std::max(std::abs(eastWorldX - westWorldX), 1e-9);
  const auto ySpan = std::max(std::abs(southWorldY - northWorldY), 1e-9);

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
    if (crossesAntimeridian) {
      while (adjustedLongitude < viewport.west) {
        adjustedLongitude += 360.0;
      }

      while (adjustedLongitude > adjustedEast) {
        adjustedLongitude -= 360.0;
      }
    }

    const auto worldX = mercatorWorldX(adjustedLongitude, viewport.zoom);
    const auto worldY = mercatorWorldY(latitude, viewport.zoom);
    const auto screenX = ((worldX - westWorldX) / xSpan) * viewport.width;
    const auto screenY = ((worldY - northWorldY) / ySpan) * viewport.height;

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

emscripten::val createPointIdsArray(const std::vector<std::string>& pointIds) {
  auto array = emscripten::val::array();
  for (std::size_t index = 0; index < pointIds.size(); ++index) {
    array.set(index, pointIds[index]);
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
  return "atlas-wasm-ready";
}

ModuleInfo getModuleInfo() {
  return {
    "0.2.0",
    true,
    "Phase 23.2 viewport clustering ready",
  };
}

emscripten::val clusterViewportPoints(const emscripten::val& rawPoints, const emscripten::val& rawViewport, const emscripten::val& rawOptions) {
  const auto viewport = parseViewport(rawViewport);
  const auto options = parseClusterOptions(rawOptions);
  const auto projectedPoints = projectVisiblePoints(rawPoints, viewport);
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

}  // namespace atlas

EMSCRIPTEN_BINDINGS(atlas_wasm_module) {
  using namespace emscripten;

  value_object<atlas::ModuleInfo>("ModuleInfo")
    .field("version", &atlas::ModuleInfo::version)
    .field("algorithmsReady", &atlas::ModuleInfo::algorithmsReady)
    .field("status", &atlas::ModuleInfo::status);

  function("ping", &atlas::ping);
  function("getModuleInfo", &atlas::getModuleInfo);
  function("clusterViewportPoints", &atlas::clusterViewportPoints);
}
