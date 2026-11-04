import type { Coordinates } from '@/domain';

export type MapboxErrorCode =
  | 'invalid-input'
  | 'unauthorized'
  | 'rate-limit'
  | 'timeout'
  | 'upstream'
  | 'invalid-response';
export type MapboxFailure =
  | { status: 'unconfigured'; message: string }
  | { status: 'error'; code: MapboxErrorCode; message: string };
export type MatrixJourney =
  | {
      status: 'ready';
      truckId: string;
      durationSeconds: number;
      distanceMeters: number;
      calculatedAt: string;
      source: 'mapbox';
      profile: 'mapbox/driving';
    }
  | { status: 'unreachable'; truckId: string };
export type MatrixResponse =
  | { status: 'ready'; journeys: MatrixJourney[] }
  | MapboxFailure;
export type LineGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};
export type DirectionsResponse =
  | { status: 'ready'; geometry: LineGeometry; source: 'mapbox' }
  | { status: 'unreachable' }
  | MapboxFailure;
export interface AddressSuggestion {
  id: string;
  label: string;
  coordinates: Coordinates;
  geocodingStorage?: 'permanent';
}
export type GeocodingResponse =
  | { status: 'ready'; suggestions: AddressSuggestion[] }
  | MapboxFailure;
export interface MatrixInput {
  truckIds: string[];
  destination: Coordinates;
}
export interface DirectionsInput {
  truckId: string;
  destination: Coordinates;
}
export interface GeocodingInput {
  query: string;
}
