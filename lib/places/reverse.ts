import type { Coordinates } from '@/domain';

export type ReversePlace =
  | {
      status: 'ready';
      label: string;
      distanceMeters: number;
      attribution: 'Kartverket (CC BY 4.0)';
    }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export function validPoint(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return (
    Object.keys(point).length === 2 &&
    typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    typeof point.longitude === 'number' &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}

/** Read at most 32 KiB, even when an upstream server omits Content-Length. */
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 32768) {
        await reader.cancel();
        throw new Error('Response too large');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const content = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(content));
}
const text = (value: unknown, limit = 180): string =>
  typeof value === 'string' && value.trim().length <= limit ? value.trim() : '';

/** Official nearby-address lookup. Never changes the selected coordinate or invents an address.
 * Source: https://api.kartverket.no/adresser/v1/openapi.json
 * Licence: https://data.norge.no/nn/data-services/e329a3ba-ba66-3012-b518-ff45f089aeac/adresse-rest-api
 */
export async function reversePlace(
  point: Coordinates,
  fetcher: typeof fetch = fetch,
): Promise<ReversePlace> {
  if (!validPoint(point))
    return { status: 'error', message: 'Ugyldig kartpunkt.' };
  const url = new URL('https://api.kartverket.no/adresser/v1/punktsok');
  url.search = new URLSearchParams({
    lat: String(point.latitude),
    lon: String(point.longitude),
    radius: '100',
    treffPerSide: '1',
    side: '0',
    koordsys: '4326',
    utkoordsys: '4326',
    filtrer:
      'adresser.adressetekst,adresser.postnummer,adresser.poststed,adresser.meterDistanseTilPunkt',
  }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      cache: 'no-store',
      // Workers supports manual/follow only. Reject 3xx below instead of following it.
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Address service unavailable');
    const result = await boundedJson(response);
    if (
      !result ||
      typeof result !== 'object' ||
      !('adresser' in result) ||
      !Array.isArray(result.adresser) ||
      result.adresser.length > 1
    )
      throw new Error('Unexpected response');
    if (!result.adresser.length) return { status: 'not-found' };
    const address: unknown = result.adresser[0];
    if (!address || typeof address !== 'object')
      throw new Error('Unexpected address');
    const row = address as Record<string, unknown>;
    const street = text(row.adressetekst);
    const city = text(row.poststed, 80);
    const postalCode = text(row.postnummer, 4);
    const distance = row.meterDistanseTilPunkt;
    if (
      !street ||
      !city ||
      !/^\d{4}$/.test(postalCode) ||
      typeof distance !== 'number' ||
      !Number.isFinite(distance) ||
      distance < 0 ||
      distance > 100
    )
      throw new Error('Invalid nearby address');
    return {
      status: 'ready',
      label: `Ved ${street}, ${postalCode} ${city}`,
      distanceMeters: Math.round(distance),
      attribution: 'Kartverket (CC BY 4.0)',
    };
  } catch {
    return {
      status: 'error',
      message: 'Adressen kunne ikke hentes. Kartpunktet er fortsatt valgt.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Same-origin route with bounded input; provider URL and search radius are server-owned. */
export async function reversePlaceRoute(
  request: Request,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return reply({ status: 'error', message: 'Ugyldig forespørsel.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply(
      { status: 'error', message: 'Send koordinater som JSON.' },
      400,
    );
  try {
    // Coordinate bodies are tiny; reject both declared and actual oversized input.
    if (Number(request.headers.get('content-length')) > 1024)
      return reply({ status: 'error', message: 'For stor forespørsel.' }, 413);
    const reader = request.body?.getReader();
    if (!reader)
      return reply({ status: 'error', message: 'Mangler kartpunkt.' }, 400);
    const decoder = new TextDecoder();
    let raw = '';
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1024) {
          await reader.cancel();
          return reply(
            { status: 'error', message: 'For stor forespørsel.' },
            413,
          );
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const point: unknown = JSON.parse(raw);
    if (!validPoint(point))
      return reply({ status: 'error', message: 'Ugyldig kartpunkt.' }, 400);
    return reply(await reversePlace(point, fetcher));
  } catch {
    return reply({ status: 'error', message: 'Ugyldig kartpunkt.' }, 400);
  }
}
