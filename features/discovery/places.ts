import { foodTrucks } from '@/data/demo';
import type { EventLocation } from '@/domain';

/** Bundled city-center examples, not live address results or truck positions. */
export const discoveryPlaces = foodTrucks.map((truck) => ({
  city: truck.city,
  label: `${truck.city} sentrum (eksempelsted)`,
  coordinates: { ...truck.coordinates },
  source: 'preset' as const,
}));
const normalize = (value: string) => value.trim().toLocaleLowerCase('nb-NO');

export function suggestPlaces(query: string) {
  const term = normalize(query);
  return discoveryPlaces.filter(
    (place) => !term || normalize(place.label).includes(term),
  );
}

/** Only exact names in the bundled registry resolve; arbitrary address text never does. */
export function resolvePlace(query: string): EventLocation | undefined {
  const term = normalize(query);
  const place = discoveryPlaces.find((place) =>
    [place.city, `${place.city} sentrum`, place.label].some(
      (label) => normalize(label) === term,
    ),
  );
  return place
    ? {
        label: place.label,
        coordinates: { ...place.coordinates },
        source: 'preset',
      }
    : undefined;
}
