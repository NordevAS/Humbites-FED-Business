import { isCoordinates, type EventLocation, type FoodTruck } from '@/domain';

/** Fail closed: only configured delivery areas containing a selected point qualify. */
export function servesLocation(
  truck: FoodTruck,
  location: EventLocation,
): boolean {
  const point = location.coordinates;
  const radius = truck.booking?.serviceRadiusKm;
  if (
    !truck.booking?.configured ||
    !truck.booking.enabled ||
    !isCoordinates(point) ||
    !isCoordinates(truck.coordinates) ||
    radius == null ||
    !Number.isFinite(radius) ||
    radius <= 0
  )
    return false;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(point.latitude - truck.coordinates.latitude);
  const dLon = radians(point.longitude - truck.coordinates.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(truck.coordinates.latitude)) *
      Math.cos(radians(point.latitude)) *
      Math.sin(dLon / 2) ** 2;
  // Keep the same mean Earth radius as the server's availability calculation.
  const distanceKm = 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  return distanceKm <= radius;
}
