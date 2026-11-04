import type { Coordinates, EventLocation } from '@/domain';
import type { ReversePlace } from './reverse';

export const pointLabel = (point: Coordinates) =>
  `Valgt kartpunkt (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`;

type MapReversePlace = ReversePlace & {
  addressDetails?: EventLocation['addressDetails'];
};

/** Only the latest selection may rename the point. Cancellation also covers typing,
 * choosing a preset and leaving the map while a request is still in flight. */
export function createMapSelection(
  fetcher: typeof fetch = fetch,
  reverseEndpoint = '/api/places/reverse',
) {
  let controller: AbortController | null = null;
  let generation = 0;
  function cancel() {
    generation++;
    controller?.abort();
    controller = null;
  }
  async function select(
    point: Coordinates,
    update: (location: EventLocation) => void,
    announce: (message: string) => void,
    onPending?: (pending: boolean) => void,
  ) {
    cancel();
    const current = generation;
    const active = new AbortController();
    controller = active;
    const deferSelection = reverseEndpoint === '/api/places/osm-reverse';
    if (!deferSelection)
      update({ coordinates: point, label: pointLabel(point), source: 'map' });
    onPending?.(true);
    announce('Henter adressen til kartpunktet …');
    const timeout = setTimeout(() => active.abort(), 9000);
    try {
      const response = await fetcher(reverseEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point),
        signal: active.signal,
      });
      const result: MapReversePlace = await response.json();
      if (current !== generation) return;
      if (active.signal.aborted) throw new Error('Lookup timed out');
      if (
        response.ok &&
        result.status === 'ready' &&
        typeof result.label === 'string' &&
        result.label.length <= 300
      ) {
        // Naming the point never snaps the marker to the neighbouring address.
        update({
          coordinates: point,
          label: result.label,
          source: 'map',
          addressDetails: result.addressDetails,
        });
        announce(
          reverseEndpoint === '/api/places/osm-reverse'
            ? 'Adressen fra OpenStreetMap er hentet. Kartpunktet er beholdt.'
            : `Nærmeste adresse er ${result.distanceMeters} meter unna. Ditt kartpunkt er beholdt.`,
        );
      } else
        announce(
          result.status === 'not-found'
            ? deferSelection
              ? 'Fant ingen adresse ved kartpunktet. Den forrige posisjonen er beholdt; søk etter en adresse i stedet.'
              : 'Ingen adresse innen 100 meter. Kartpunktet er valgt; skriv gjerne et beskrivende sted i arrangementsnotatet.'
            : deferSelection
              ? 'Adressen kunne ikke hentes. Den forrige posisjonen er beholdt.'
              : 'Adressen kunne ikke hentes. Kartpunktet er fortsatt valgt.',
        );
    } catch {
      if (current === generation)
        announce(
          deferSelection
            ? 'Adressen kunne ikke hentes. Den forrige posisjonen er beholdt.'
            : 'Adressen kunne ikke hentes. Kartpunktet er fortsatt valgt.',
        );
    } finally {
      clearTimeout(timeout);
      if (current === generation) onPending?.(false);
      if (controller === active) controller = null;
    }
  }
  return { select, cancel };
}
