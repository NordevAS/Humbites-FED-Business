import { getMode } from './mode';
import { foodTrucks } from '@/data/demo';
import { isCoordinates, type FoodTruck } from '@/domain';

export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function canonicalOrigin(): URL | undefined {
  const raw = process.env.SITE_URL;
  const required =
    process.env.NODE_ENV === 'production' && getMode() === 'live';
  if (!raw) {
    if (required)
      throw new BackendError(
        503,
        'UNCONFIGURED',
        'Nettstedets sikre adresse er ikke konfigurert.',
      );
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BackendError(
      503,
      'UNCONFIGURED',
      'Nettstedets adresse er ugyldig.',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '') ||
    (required && url.protocol !== 'https:')
  )
    throw new BackendError(
      503,
      'UNCONFIGURED',
      'Nettstedet trenger en gyldig sikker adresse.',
    );
  return url;
}
export function backendUrl(path: string): URL {
  const raw = process.env.BED_API_URL;
  if (!raw)
    throw new BackendError(
      503,
      'UNCONFIGURED',
      'Bestillingstjenesten er ikke satt opp ennå. Prøv igjen senere.',
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BackendError(
      503,
      'UNCONFIGURED',
      'Bestillingstjenesten er ikke tilgjengelig.',
    );
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  )
    throw new BackendError(
      503,
      'UNCONFIGURED',
      'Bestillingstjenesten er ikke tilgjengelig.',
    );
  return new URL(`/v1/${path}`, url);
}
export async function backendFetch(path: string, options: RequestInit = {}) {
  try {
    const publicUrl = canonicalOrigin();
    const headers = new Headers(options.headers);
    if (publicUrl) {
      headers.set('Origin', publicUrl.origin);
      headers.set('X-Forwarded-Proto', publicUrl.protocol.slice(0, -1));
      headers.set('X-Forwarded-Host', publicUrl.host);
    }
    return await fetch(backendUrl(path), {
      ...options,
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError(
      502,
      'UPSTREAM',
      'Vi får ikke kontakt med bestillingstjenesten. Prøv igjen.',
    );
  }
}
function normalizeTruck(value: unknown): FoodTruck {
  if (!value || typeof value !== 'object')
    throw new BackendError(
      502,
      'INVALID_RESPONSE',
      'Utvalget kunne ikke leses.',
    );
  const truck = value as FoodTruck;
  const strings = [
    'id',
    'slug',
    'name',
    'cuisine',
    'city',
    'region',
    'description',
    'shortDescription',
    'serviceAreaLabel',
  ] as const;
  const lists = ['tags', 'practicalInfo'] as const;
  if (
    strings.some((key) => typeof truck[key] !== 'string') ||
    lists.some(
      (key) =>
        !Array.isArray(truck[key]) ||
        truck[key].some((x) => typeof x !== 'string'),
    ) ||
    !isCoordinates(truck.coordinates) ||
    (truck.fixedFeeMinor !== null &&
      (!Number.isSafeInteger(truck.fixedFeeMinor) ||
        truck.fixedFeeMinor < 0)) ||
    !Array.isArray(truck.menu) ||
    truck.menu.some(
      (item) =>
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.description !== 'string' ||
        !Number.isSafeInteger(item.priceMinor) ||
        item.priceMinor < 0 ||
        !Array.isArray(item.allergens) ||
        !Array.isArray(item.dietaryTags),
    )
  )
    throw new BackendError(
      502,
      'INVALID_RESPONSE',
      'Utvalget kunne ikke leses.',
    );
  return {
    ...truck,
    image: truck.image || '/humbites-mark.png',
    imageAlt: truck.imageAlt || truck.name,
  };
}
export async function loadCatalogue(
  search?: Record<string, unknown>,
): Promise<FoodTruck[]> {
  if (getMode() === 'demo') return foodTrucks;
  const trucks: FoodTruck[] = [];
  // Bounded pagination: fetch complete pages without exposing an arbitrary upstream proxy.
  for (let page = 1; page <= 20; page++) {
    const response = search
      ? await backendFetch('foodtrucks/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...search, page, limit: 100 }),
        })
      : await backendFetch(`foodtrucks?page=${page}&limit=100`);
    if (!response.ok) {
      if (response.status < 500) {
        const body = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        throw new BackendError(
          response.status,
          body.error?.code ?? 'INVALID_INPUT',
          body.error?.message ?? 'Kontroller søket.',
        );
      }
      throw new BackendError(
        response.status === 503 ? 503 : 502,
        'UPSTREAM',
        'Vi får ikke hentet foodtruckene akkurat nå.',
      );
    }
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { totalPages: number };
    };
    if (!Array.isArray(body.data))
      throw new BackendError(
        502,
        'INVALID_RESPONSE',
        'Utvalget kunne ikke leses.',
      );
    trucks.push(...body.data.map(normalizeTruck));
    if (!body.pagination || page >= body.pagination.totalPages) return trucks;
  }
  throw new BackendError(
    502,
    'CATALOGUE_LIMIT',
    'Utvalget er for stort til å hentes akkurat nå. Prøv igjen senere.',
  );
}
