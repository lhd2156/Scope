import { getMapboxToken } from '@/services/mapboxLoader';
import type { MapPoint } from '@/types';
import { calculateHaversineDistanceMeters } from '@/utils/geoDistance';

export type RouteCoordinate = [number, number];

export type RoadRouteProvider = 'mapbox-optimization' | 'mapbox-directions' | 'local-estimate';
export type RoadRouteProfile = 'mapbox/driving-traffic' | 'mapbox/driving' | 'local';
export type RoadRouteQuality = 'mapbox' | 'unavailable' | 'visual-fallback';

export interface RoadRouteSummary {
  geometry: RouteCoordinate[];
  orderedPoints: MapPoint[];
  distanceMeters: number;
  durationSeconds: number;
  provider: RoadRouteProvider;
  profile: RoadRouteProfile;
  routeQuality?: RoadRouteQuality;
  routeError?: string;
}

export interface RoadRouteOptions {
  optimizeOrder?: boolean;
}

interface MapboxWaypoint {
  waypoint_index?: number;
}

interface MapboxRouteLike {
  geometry?: {
    coordinates?: unknown;
  };
  distance?: number;
  duration?: number;
}

interface MapboxOptimizationResponse {
  code?: string;
  message?: string;
  trips?: MapboxRouteLike[];
  waypoints?: MapboxWaypoint[];
}

interface MapboxDirectionsResponse {
  code?: string;
  message?: string;
  routes?: MapboxRouteLike[];
}

const MAPBOX_OPTIMIZATION_URL = 'https://api.mapbox.com/optimized-trips/v1';
const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5';
const MAPBOX_OPTIMIZATION_MAX_WAYPOINTS = 12;
const MAPBOX_DIRECTIONS_MAX_WAYPOINTS = 25;
const ROUTE_CACHE_LIMIT = 24;
const ROAD_CIRCUITY_FACTOR = 1.24;
const LOCAL_URBAN_SPEED_METERS_PER_SECOND = 12.5;
const DRIVING_PROFILES: readonly Exclude<RoadRouteProfile, 'local'>[] = ['mapbox/driving-traffic', 'mapbox/driving'];

const routeCache = new Map<string, Promise<RoadRouteSummary>>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasValidCoordinates(point: MapPoint): boolean {
  return isFiniteNumber(point.latitude)
    && isFiniteNumber(point.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180;
}

function normalizeRoutePoints(points: MapPoint[]): MapPoint[] {
  const seenIds = new Set<string>();
  return points.filter((point) => {
    if (!hasValidCoordinates(point) || seenIds.has(point.id)) {
      return false;
    }

    seenIds.add(point.id);
    return true;
  });
}

function buildCoordinateString(points: MapPoint[]): string {
  return points
    .map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`)
    .join(';');
}

function buildRouteSignature(points: MapPoint[], token: string, optimizeOrder: boolean): string {
  return [
    token ? 'mapbox' : 'local',
    optimizeOrder ? 'optimized' : 'fixed-order',
    points.map((point) => `${point.id}:${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`).join('|'),
  ].join(':');
}

function readCoordinates(value: unknown): RouteCoordinate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((coordinate): RouteCoordinate | null => {
      if (!Array.isArray(coordinate) || !isFiniteNumber(coordinate[0]) || !isFiniteNumber(coordinate[1])) {
        return null;
      }

      const longitude = coordinate[0];
      const latitude = coordinate[1];
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return null;
      }

      return [longitude, latitude];
    })
    .filter((coordinate): coordinate is RouteCoordinate => Boolean(coordinate));
}

function getRouteNumber(value: unknown, fallback: number): number {
  return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

function buildRouteUrl(baseUrl: string, profile: Exclude<RoadRouteProfile, 'local'>, points: MapPoint[], accessToken: string): URL {
  const url = new URL(`${baseUrl}/${profile}/${buildCoordinateString(points)}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'false');
  return url;
}

async function fetchJson<TResponse>(url: URL): Promise<TResponse> {
  const response = await fetch(url.toString());
  const body = await response.json().catch(() => null) as TResponse | null;
  if (!response.ok || !body) {
    throw new Error(`Route request failed with status ${response.status}.`);
  }

  return body;
}

function ensureMapboxOk(code: string | undefined, message: string | undefined): void {
  if (code && code !== 'Ok') {
    throw new Error(message || `Mapbox route request returned ${code}.`);
  }
}

function keepRouteEndpoints(points: MapPoint[], orderedPoints: MapPoint[]): MapPoint[] {
  if (points.length <= 2 || orderedPoints.length !== points.length) {
    return orderedPoints;
  }

  const startPoint = points[0]!;
  const endPoint = points[points.length - 1]!;
  const middlePoints = orderedPoints.filter((point) => point.id !== startPoint.id && point.id !== endPoint.id);
  return [startPoint, ...middlePoints, endPoint];
}

function orderPointsFromOptimization(points: MapPoint[], waypoints: MapboxWaypoint[] | undefined): MapPoint[] {
  if (!waypoints?.length) {
    return points;
  }

  const ordered: Array<MapPoint | undefined> = [];
  waypoints.forEach((waypoint, inputIndex) => {
    const routeIndex = waypoint.waypoint_index;
    const point = points[inputIndex];
    if (isFiniteNumber(routeIndex) && point) {
      ordered[routeIndex] = point;
    }
  });

  const resolvedOrder = ordered.filter((point): point is MapPoint => Boolean(point));
  return resolvedOrder.length === points.length ? keepRouteEndpoints(points, resolvedOrder) : points;
}

function calculateHaversineMeters(first: MapPoint, second: MapPoint): number {
  return calculateHaversineDistanceMeters(first, second);
}

function calculateCoordinateDistanceMeters(first: RouteCoordinate, second: RouteCoordinate): number {
  return calculateHaversineDistanceMeters(
    { latitude: first[1], longitude: first[0] },
    { latitude: second[1], longitude: second[0] },
  );
}

function calculateRouteDistanceMeters(points: MapPoint[]): number {
  return points.reduce((totalDistance, point, index) => {
    const previousPoint = points[index - 1];
    return previousPoint ? totalDistance + calculateHaversineMeters(previousPoint, point) : totalDistance;
  }, 0);
}

function calculateGeometryDistanceMeters(geometry: RouteCoordinate[]): number {
  return geometry.reduce((totalDistance, coordinate, index) => {
    const previousCoordinate = geometry[index - 1];
    return previousCoordinate ? totalDistance + calculateCoordinateDistanceMeters(previousCoordinate, coordinate) : totalDistance;
  }, 0);
}

function buildRoadLikeFallbackGeometry(points: MapPoint[]): RouteCoordinate[] {
  return points.flatMap((point, index) => {
    const coordinate: RouteCoordinate = [point.longitude, point.latitude];
    const nextPoint = points[index + 1];
    if (!nextPoint) {
      return [coordinate];
    }

    const longitudeDelta = Math.abs(nextPoint.longitude - point.longitude);
    const latitudeDelta = Math.abs(nextPoint.latitude - point.latitude);
    const corner: RouteCoordinate = longitudeDelta > latitudeDelta
      ? [nextPoint.longitude, point.latitude]
      : [point.longitude, nextPoint.latitude];
    return [coordinate, corner];
  });
}

function optimizeLocalPointOrder(points: MapPoint[]): MapPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const startPoint = points[0]!;
  const endPoint = points[points.length - 1]!;
  const remainingPoints = points.slice(1, -1);
  const orderedPoints = [startPoint];
  let currentPoint = startPoint;

  while (remainingPoints.length) {
    const nextIndex = remainingPoints.reduce((bestIndex, point, index) => (
      calculateHaversineMeters(currentPoint, point) < calculateHaversineMeters(currentPoint, remainingPoints[bestIndex]!)
        ? index
        : bestIndex
    ), 0);
    const nextPoint = remainingPoints.splice(nextIndex, 1)[0]!;
    orderedPoints.push(nextPoint);
    currentPoint = nextPoint;
  }

  orderedPoints.push(endPoint);
  return orderedPoints;
}

function buildLocalRoute(points: MapPoint[], optimizeOrder = true): RoadRouteSummary {
  const orderedPoints = optimizeOrder ? optimizeLocalPointOrder(points) : points;
  const directDistanceMeters = calculateRouteDistanceMeters(orderedPoints);
  const distanceMeters = directDistanceMeters * ROAD_CIRCUITY_FACTOR;

  return {
    geometry: buildRoadLikeFallbackGeometry(orderedPoints),
    orderedPoints,
    distanceMeters,
    durationSeconds: distanceMeters / LOCAL_URBAN_SPEED_METERS_PER_SECOND,
    provider: 'local-estimate',
    profile: 'local',
    routeQuality: 'visual-fallback',
    routeError: 'Mapbox route unavailable.',
  };
}

function buildUnavailableLocalRoute(points: MapPoint[], optimizeOrder: boolean, routeError: string): RoadRouteSummary {
  return {
    ...buildLocalRoute(points, optimizeOrder),
    routeError,
  };
}

function getSafeRouteError(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return 'Mapbox route unavailable.';
  }

  return error.message
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
    .slice(0, 160);
}

async function fetchOptimizationRoute(
  points: MapPoint[],
  accessToken: string,
  profile: Exclude<RoadRouteProfile, 'local'>,
): Promise<RoadRouteSummary> {
  if (points.length > MAPBOX_OPTIMIZATION_MAX_WAYPOINTS) {
    throw new Error('Too many points for Mapbox Optimization API.');
  }

  const url = buildRouteUrl(MAPBOX_OPTIMIZATION_URL, profile, points, accessToken);
  url.searchParams.set('roundtrip', 'false');
  url.searchParams.set('source', 'first');
  url.searchParams.set('destination', 'last');

  const data = await fetchJson<MapboxOptimizationResponse>(url);
  ensureMapboxOk(data.code, data.message);
  const trip = data.trips?.[0];
  const geometry = readCoordinates(trip?.geometry?.coordinates);
  if (geometry.length < 2) {
    throw new Error('Mapbox optimization did not return usable route geometry.');
  }

  const orderedPoints = orderPointsFromOptimization(points, data.waypoints);
  const fallbackDistance = calculateGeometryDistanceMeters(geometry) || calculateRouteDistanceMeters(orderedPoints);
  return {
    geometry,
    orderedPoints,
    distanceMeters: getRouteNumber(trip?.distance, fallbackDistance),
    durationSeconds: getRouteNumber(trip?.duration, fallbackDistance / LOCAL_URBAN_SPEED_METERS_PER_SECOND),
    provider: 'mapbox-optimization',
    profile,
    routeQuality: 'mapbox',
  };
}

async function fetchDirectionsRoute(
  points: MapPoint[],
  accessToken: string,
  profile: Exclude<RoadRouteProfile, 'local'>,
): Promise<RoadRouteSummary> {
  if (points.length > MAPBOX_DIRECTIONS_MAX_WAYPOINTS) {
    throw new Error('Too many points for Mapbox Directions API.');
  }

  const url = buildRouteUrl(MAPBOX_DIRECTIONS_URL, profile, points, accessToken);
  const data = await fetchJson<MapboxDirectionsResponse>(url);
  ensureMapboxOk(data.code, data.message);
  const route = data.routes?.[0];
  const geometry = readCoordinates(route?.geometry?.coordinates);
  if (geometry.length < 2) {
    throw new Error('Mapbox directions did not return usable route geometry.');
  }

  const fallbackDistance = calculateGeometryDistanceMeters(geometry) || calculateRouteDistanceMeters(points);
  return {
    geometry,
    orderedPoints: points,
    distanceMeters: getRouteNumber(route?.distance, fallbackDistance),
    durationSeconds: getRouteNumber(route?.duration, fallbackDistance / LOCAL_URBAN_SPEED_METERS_PER_SECOND),
    provider: 'mapbox-directions',
    profile,
    routeQuality: 'mapbox',
  };
}

async function resolveRemoteRoute(points: MapPoint[], accessToken: string, optimizeOrder: boolean): Promise<RoadRouteSummary> {
  let lastRouteError = 'Mapbox route unavailable.';
  if (optimizeOrder) {
    for (const profile of DRIVING_PROFILES) {
      try {
        return await fetchOptimizationRoute(points, accessToken, profile);
      } catch (error) {
        lastRouteError = getSafeRouteError(error);
        // Try the next road-aware strategy before falling back to local math.
      }
    }
  }

  const localOrder = optimizeOrder ? optimizeLocalPointOrder(points) : points;
  for (const profile of DRIVING_PROFILES) {
    try {
      return await fetchDirectionsRoute(localOrder, accessToken, profile);
    } catch (error) {
      lastRouteError = getSafeRouteError(error);
      // The local route keeps the map stable if Mapbox cannot route these coordinates.
    }
  }

  return buildUnavailableLocalRoute(points, optimizeOrder, lastRouteError);
}

function rememberRoute(signature: string, routePromise: Promise<RoadRouteSummary>): Promise<RoadRouteSummary> {
  routeCache.set(signature, routePromise);
  if (routeCache.size > ROUTE_CACHE_LIMIT) {
    const oldestSignature = routeCache.keys().next().value;
    if (oldestSignature) {
      routeCache.delete(oldestSignature);
    }
  }

  return routePromise;
}

export function clearRoadRouteCache(): void {
  routeCache.clear();
}

export async function resolveRoadRoute(points: MapPoint[], options: RoadRouteOptions = {}): Promise<RoadRouteSummary> {
  const routePoints = normalizeRoutePoints(points);
  const optimizeOrder = options.optimizeOrder ?? true;
  if (routePoints.length < 2 || typeof fetch !== 'function') {
    return buildUnavailableLocalRoute(routePoints, optimizeOrder, 'Mapbox route unavailable in this runtime.');
  }

  const accessToken = getMapboxToken();
  const signature = buildRouteSignature(routePoints, accessToken, optimizeOrder);
  const cachedRoute = routeCache.get(signature);
  if (cachedRoute) {
    return cachedRoute;
  }

  const routePromise = accessToken
    ? resolveRemoteRoute(routePoints, accessToken, optimizeOrder)
    : Promise.resolve(buildUnavailableLocalRoute(routePoints, optimizeOrder, 'Mapbox token unavailable.'));
  return rememberRoute(signature, routePromise);
}
