import { isCoordinates } from '@/domain';
import { getFoodTruck } from '@/data/demo';
import type { DirectionsInput, GeocodingInput, MatrixInput } from './types';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function coordinate(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, ['longitude', 'latitude']) &&
    isCoordinates(value)
  );
}

export function parseMatrixInput(
  value: unknown,
  knownTruck: (id: string) => boolean = (id) => !!getFoodTruck(id),
): MatrixInput | null {
  if (
    !record(value) ||
    !keys(value, ['truckIds', 'destination']) ||
    !coordinate(value.destination) ||
    !Array.isArray(value.truckIds)
  )
    return null;
  const truckIds = value.truckIds;
  if (
    truckIds.length < 1 ||
    truckIds.length > 24 ||
    new Set(truckIds).size !== truckIds.length ||
    truckIds.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
        !knownTruck(id),
    )
  )
    return null;
  return {
    truckIds: truckIds as string[],
    destination: value.destination as MatrixInput['destination'],
  };
}

export function parseDirectionsInput(
  value: unknown,
  knownTruck: (id: string) => boolean = (id) => !!getFoodTruck(id),
): DirectionsInput | null {
  if (
    !record(value) ||
    !keys(value, ['truckId', 'destination']) ||
    typeof value.truckId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(value.truckId) ||
    !knownTruck(value.truckId) ||
    !coordinate(value.destination)
  )
    return null;
  return {
    truckId: value.truckId,
    destination: value.destination as DirectionsInput['destination'],
  };
}

export function parseGeocodingInput(value: unknown): GeocodingInput | null {
  if (
    !record(value) ||
    !keys(value, ['query']) ||
    typeof value.query !== 'string'
  )
    return null;
  const query = value.query.trim();
  if (
    query.length < 3 ||
    query.length > 256 ||
    /[;\u0000-\u001f]/.test(query) ||
    query.split(/\s+/).length > 20
  )
    return null;
  return { query };
}
