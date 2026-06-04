export interface CoordinateLike {
  latitude: number;
  longitude: number;
}

export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_METERS = 6_371_008.8;

export function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateHaversineDistanceKm(
  origin: CoordinateLike,
  destination: CoordinateLike,
  earthRadiusKm = EARTH_RADIUS_KM,
): number {
  const latitudeDelta = degreesToRadians(destination.latitude - origin.latitude);
  const longitudeDelta = degreesToRadians(destination.longitude - origin.longitude);
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function calculateHaversineDistanceMeters(origin: CoordinateLike, destination: CoordinateLike): number {
  return calculateHaversineDistanceKm(origin, destination, EARTH_RADIUS_METERS / 1000) * 1000;
}
