import type { EventDetails } from '@/domain';
import { resolvePlace } from './places';

/** Only discovery fields belong in a shareable URL, never notes or contact details. */
export function discoveryHref(event: EventDetails): string {
  const params = new URLSearchParams({
    place: event.location.label.trim(),
    date: event.date,
    guests: String(event.guestCount),
  });
  // Typing alone is not selection. Distinguish submitted text from old city-only links.
  if (!event.location.coordinates) params.set('unresolved', '1');
  return `/foodtrucks?${params}`;
}

export function eventFromQuery(
  params: URLSearchParams,
  current: EventDetails,
): EventDetails {
  const place = params.get('place') ?? current.location.label;
  const date = params.get('date');
  const guests = Number(params.get('guests'));
  // Known city links resolve to explicit bundled center points. Unknown addresses
  // remain unresolved; only an unchanged, already-selected point is retained.
  const location =
    place === current.location.label && current.location.coordinates
      ? current.location
      : ((params.get('unresolved') !== '1'
          ? resolvePlace(place)
          : undefined) ?? {
          label: place.slice(0, 300),
          source: 'manual' as const,
        });
  const validDate =
    date === '' ||
    (date !== null &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date);
  return {
    ...current,
    location,
    date: validDate ? date! : current.date,
    guestCount:
      Number.isSafeInteger(guests) && guests > 0 ? guests : current.guestCount,
  };
}
