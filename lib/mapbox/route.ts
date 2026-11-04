import { loadCatalogue } from '@/lib/booking/server';
import { getMode } from '@/lib/booking/mode';
import { isShowcase } from '@/lib/booking/showcase';
import { getDirections, getMatrix, geocode, unconfigured } from './provider';
import {
  parseDirectionsInput,
  parseMatrixInput,
  parseGeocodingInput,
} from './validation';
import {
  readBoundedJson,
  mapResponse,
  invalidInput,
  rateLimited,
  takeRequestBudget,
} from './http';
export async function mapboxRoute(
  request: Request,
  operation: 'matrix' | 'directions' | 'geocoding',
) {
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return mapResponse(invalidInput(), 400);
  }
  try {
    if (!takeRequestBudget(operation)) return mapResponse(rateLimited());
    const token = process.env.MAPBOX_ACCESS_TOKEN ?? '';
    if (operation === 'geocoding') {
      const input = parseGeocodingInput(body);
      if (!input) return mapResponse(invalidInput(), 400);
      const permanent = process.env.MAPBOX_PERMANENT_GEOCODING === 'true';
      if (getMode() === 'live' && !permanent)
        return mapResponse({
          status: 'unconfigured',
          message:
            'Adressesøk er ikke aktivert for lagring. Skriv adressen selv og velg sted på kartet eller oppgi koordinater.',
        });
      return mapResponse(
        await geocode(input, { token, permanentGeocoding: permanent }),
      );
    }
    const input =
      operation === 'matrix'
        ? parseMatrixInput(body, () => true)
        : parseDirectionsInput(body, () => true);
    if (!input) return mapResponse(invalidInput(), 400);
    if (!token.trim()) return mapResponse(unconfigured());
    const trucks = isShowcase()
      ? await (
          await import('@/lib/showcase/runtime')
        ).getShowcaseCatalogue(request)
      : await loadCatalogue();
    return mapResponse(
      operation === 'matrix'
        ? await getMatrix(input as Parameters<typeof getMatrix>[0], {
            token,
            trucks,
          })
        : await getDirections(input as Parameters<typeof getDirections>[0], {
            token,
            trucks,
          }),
    );
  } catch {
    return mapResponse(
      {
        status: 'error',
        code: 'upstream',
        message:
          'Kartinformasjonen kunne ikke hentes. Kontroller stedet og prøv igjen.',
      },
      502,
    );
  }
}
