import type { Coordinates, FoodTruck } from '@/domain';
import { isCoordinates } from '@/domain';
import { getFoodTruck } from '@/data/demo';
import type {
  AddressSuggestion,
  DirectionsInput,
  DirectionsResponse,
  GeocodingInput,
  GeocodingResponse,
  LineGeometry,
  MapboxFailure,
  MatrixInput,
  MatrixJourney,
  MatrixResponse,
} from './types';

export interface ProviderOptions {
  token: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  trucks?: FoodTruck[];
  permanentGeocoding?: boolean;
}
type RawObject = Record<string, unknown>;
const object = (value: unknown): value is RawObject =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const pair = (point: Coordinates) => `${point.longitude},${point.latitude}`;
const failure = (
  code: Extract<MapboxFailure, { status: 'error' }>['code'],
  message: string,
): MapboxFailure => ({ status: 'error', code, message });
export const unconfigured = (): MapboxFailure => ({
  status: 'unconfigured',
  message: 'Karttjenesten er ikke tilgjengelig i denne demoen ennå.',
});

async function request(
  url: URL,
  options: ProviderOptions,
): Promise<
  { ok: true; body: RawObject } | { ok: false; result: MapboxFailure }
> {
  if (!options.token.trim()) return { ok: false, result: unconfigured() };
  url.searchParams.set('access_token', options.token);
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403)
      return {
        ok: false,
        result: failure(
          'unauthorized',
          'Karttjenesten er ikke tilgjengelig akkurat nå.',
        ),
      };
    if (response.status === 429)
      return {
        ok: false,
        result: failure(
          'rate-limit',
          'Karttjenesten har mange forespørsler. Prøv igjen om litt.',
        ),
      };
    if (!response.ok)
      return {
        ok: false,
        result: failure(
          'upstream',
          'Vi kunne ikke hente kartinformasjonen. Prøv igjen.',
        ),
      };
    const body: unknown = await response.json();
    if (!object(body))
      return {
        ok: false,
        result: failure(
          'invalid-response',
          'Karttjenesten ga et svar vi ikke kunne bruke.',
        ),
      };
    return { ok: true, body };
  } catch (error) {
    const timeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    // Never expose an exception message: fetch errors can contain authenticated URLs.
    return {
      ok: false,
      result: failure(
        timeout ? 'timeout' : 'upstream',
        timeout
          ? 'Karttjenesten brukte for lang tid. Prøv igjen.'
          : 'Kartinformasjonen kunne ikke hentes. Prøv igjen.',
      ),
    };
  }
}

export async function getMatrix(
  input: MatrixInput,
  options: ProviderOptions,
): Promise<MatrixResponse> {
  const trucks = input.truckIds.map((id) =>
    options.trucks
      ? options.trucks.find((truck) => truck.id === id)
      : getFoodTruck(id),
  );
  if (
    trucks.some((truck) => !truck) ||
    trucks.length < 1 ||
    trucks.length > 24 ||
    !isCoordinates(input.destination)
  )
    return failure('invalid-input', 'Velg truck og sted på nytt.');
  const coordinates = [
    ...trucks.map((truck) => pair(truck!.coordinates)),
    pair(input.destination),
  ].join(';');
  const url = new URL(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}`,
  );
  url.searchParams.set('annotations', 'duration,distance');
  // Matrix explicitly disallows 1×1. For one truck use its 2×2 default matrix.
  if (trucks.length > 1) {
    url.searchParams.set('sources', trucks.map((_, index) => index).join(';'));
    url.searchParams.set('destinations', String(trucks.length));
  }
  const result = await request(url, options);
  if (!result.ok) return result.result;
  if (result.body.code === 'NoRoute')
    return {
      status: 'ready',
      journeys: input.truckIds.map((truckId) => ({
        status: 'unreachable',
        truckId,
      })),
    };
  const { durations, distances } = result.body;
  const rows = trucks.length === 1 ? 2 : trucks.length;
  const columns = trucks.length === 1 ? 2 : 1;
  const validMatrix = (value: unknown): value is (number | null)[][] =>
    Array.isArray(value) &&
    value.length === rows &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === columns &&
        row.every(
          (cell) =>
            cell === null ||
            (typeof cell === 'number' && Number.isFinite(cell) && cell >= 0),
        ),
    );
  if (
    result.body.code !== 'Ok' ||
    !validMatrix(durations) ||
    !validMatrix(distances)
  )
    return failure('invalid-response', 'Kjøreavstanden kunne ikke beregnes.');
  const calculatedAt = new Date().toISOString();
  const journeys: MatrixJourney[] = input.truckIds.map((truckId, row) => {
    const column = trucks.length === 1 ? 1 : 0;
    const durationSeconds = durations[row][column];
    const distanceMeters = distances[row][column];
    return durationSeconds === null || distanceMeters === null
      ? { status: 'unreachable', truckId }
      : {
          status: 'ready',
          truckId,
          durationSeconds,
          distanceMeters,
          calculatedAt,
          source: 'mapbox',
          profile: 'mapbox/driving',
        };
  });
  return { status: 'ready', journeys };
}

export async function getDirections(
  input: DirectionsInput,
  options: ProviderOptions,
): Promise<DirectionsResponse> {
  const truck = options.trucks
    ? options.trucks.find((truck) => truck.id === input.truckId)
    : getFoodTruck(input.truckId);
  if (!truck || !isCoordinates(input.destination))
    return failure('invalid-input', 'Velg truck og sted på nytt.');
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${pair(truck.coordinates)};${pair(input.destination)}`,
  );
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'false');
  const result = await request(url, options);
  if (!result.ok) return result.result;
  if (result.body.code === 'NoRoute') return { status: 'unreachable' };
  const routes = result.body.routes;
  if (
    result.body.code !== 'Ok' ||
    !Array.isArray(routes) ||
    routes.length === 0 ||
    !object(routes[0]) ||
    !object(routes[0].geometry)
  )
    return failure('invalid-response', 'Kjøreruten kunne ikke hentes.');
  const geometry = routes[0].geometry;
  if (
    geometry.type !== 'LineString' ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 ||
    geometry.coordinates.length > 100000 ||
    !geometry.coordinates.every(
      (value) =>
        Array.isArray(value) &&
        value.length === 2 &&
        isCoordinates({ longitude: value[0], latitude: value[1] }),
    )
  )
    return failure('invalid-response', 'Kjøreruten kunne ikke vises.');
  return {
    status: 'ready',
    source: 'mapbox',
    geometry: geometry as LineGeometry,
  };
}

export async function geocode(
  input: GeocodingInput,
  options: ProviderOptions,
): Promise<GeocodingResponse> {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', input.query);
  url.searchParams.set('country', 'no');
  url.searchParams.set('language', 'nb');
  url.searchParams.set('types', 'address,street,place');
  url.searchParams.set('limit', '5');
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set(
    'permanent',
    options.permanentGeocoding ? 'true' : 'false',
  );
  const result = await request(url, options);
  if (!result.ok) return result.result;
  if (!Array.isArray(result.body.features))
    return failure('invalid-response', 'Adressesøket kunne ikke fullføres.');
  const suggestions: AddressSuggestion[] = [];
  for (const feature of result.body.features.slice(0, 5)) {
    if (
      !object(feature) ||
      !object(feature.properties) ||
      !object(feature.geometry)
    )
      continue;
    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    if (
      !Array.isArray(coords) ||
      !isCoordinates({ longitude: coords[0], latitude: coords[1] })
    )
      continue;
    const label =
      typeof props.full_address === 'string'
        ? props.full_address
        : [props.name, props.place_formatted]
            .filter((value) => typeof value === 'string')
            .join(', ');
    const id =
      typeof props.mapbox_id === 'string' ? props.mapbox_id : feature.id;
    if (typeof id !== 'string' || !label || label.length > 500) continue;
    suggestions.push({
      id,
      label,
      coordinates: { longitude: coords[0], latitude: coords[1] },
      ...(options.permanentGeocoding
        ? { geocodingStorage: 'permanent' as const }
        : {}),
    });
  }
  return { status: 'ready', suggestions };
}
