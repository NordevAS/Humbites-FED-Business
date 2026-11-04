import type { Coordinates, EventLocation } from '@/domain';
import type { ReversePlace } from './reverse';

export const pointLabel = (point: Coordinates) =>
  `Valgt kartpunkt (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`;

/** Only the latest selection may rename the point. Cancellation also covers typing,
 * choosing a preset and leaving the map while a request is still in flight. */
export function createMapSelection(fetcher: typeof fetch = fetch) {
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
  ) {
    cancel();
    const current = generation;
    const active = new AbortController();
    controller = active;
    update({ coordinates: point, label: pointLabel(point), source: 'map' });
    announce('Henter adressen til kartpunktet …');
    const timeout = setTimeout(() => active.abort(), 9000);
    try {
      const response = await fetcher('/api/places/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point),
        signal: active.signal,
      });
      const result: ReversePlace = await response.json();
      if (current !== generation) return;
      if (active.signal.aborted) throw new Error('Lookup timed out');
      if (
        response.ok &&
        result.status === 'ready' &&
        typeof result.label === 'string' &&
        result.label.length <= 300
      ) {
        // Naming the point never snaps the marker to the neighbouring address.
        update({ coordinates: point, label: result.label, source: 'map' });
        announce(
          `Nærmeste adresse er ${result.distanceMeters} meter unna. Ditt kartpunkt er beholdt.`,
        );
      } else
        announce(
          result.status === 'not-found'
            ? 'Ingen adresse innen 100 meter. Kartpunktet er valgt; skriv gjerne et beskrivende sted i arrangementsnotatet.'
            : 'Adressen kunne ikke hentes. Kartpunktet er fortsatt valgt.',
        );
    } catch {
      if (current === generation)
        announce('Adressen kunne ikke hentes. Kartpunktet er fortsatt valgt.');
    } finally {
      clearTimeout(timeout);
      if (controller === active) controller = null;
    }
  }
  return { select, cancel };
}
