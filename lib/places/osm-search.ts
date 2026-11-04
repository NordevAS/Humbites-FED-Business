import { z } from 'zod';

const querySchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  })
  .strict();

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
  }),
  properties: z.object({
    osm_id: z.union([z.string(), z.number()]).optional(),
    osm_type: z.string().optional(),
    name: z.string().optional(),
    housenumber: z.string().optional(),
    street: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    municipality: z.string().optional(),
    locality: z.string().optional(),
    district: z.string().optional(),
    suburb: z.string().optional(),
    neighbourhood: z.string().optional(),
    quarter: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }),
});

const responseSchema = z.object({ features: z.array(featureSchema).max(10) });

export interface OsmAddressSuggestion {
  id: string;
  label: string;
  coordinates: { longitude: number; latitude: number };
  addressDetails: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export type OsmAddressSearchResult =
  | { status: 'ready'; suggestions: OsmAddressSuggestion[] }
  | { status: 'error'; message: string };

function suggestionFromFeature(
  feature: z.infer<typeof featureSchema>,
): OsmAddressSuggestion | undefined {
  const properties = feature.properties;
  const address = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(' ');
  const city =
    properties.city ||
    properties.town ||
    properties.village ||
    properties.municipality ||
    properties.locality ||
    properties.district ||
    properties.suburb ||
    properties.neighbourhood ||
    properties.quarter ||
    properties.county ||
    '';
  const postalCity = [properties.postcode, city].filter(Boolean).join(' ');
  const label = [
    address || properties.name,
    postalCity,
    properties.state,
    properties.country,
  ]
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(', ');
  if (!label || !properties.country) return undefined;
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    id: `${properties.osm_type ?? 'osm'}:${properties.osm_id ?? `${longitude}:${latitude}`}`,
    label,
    coordinates: { longitude, latitude },
    addressDetails: {
      address: address || properties.name || '',
      city,
      state: properties.state ?? '',
      postalCode: properties.postcode ?? '',
      country: properties.country,
    },
  };
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response body');
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw new Error('Response too large');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function searchOsmAddresses(
  query: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<OsmAddressSearchResult> {
  const parsed = querySchema.safeParse({ query });
  if (!parsed.success)
    return { status: 'error', message: 'Skriv mellom 3 og 180 tegn.' };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 8000);
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.search = new URLSearchParams({
      q: parsed.data.query,
      limit: '6',
    }).toString();
    const response = await fetcher(url, {
      signal: controller.signal,
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('OSM search unavailable');
    const result = responseSchema.parse(await boundedJson(response));
    const suggestions = result.features.flatMap((feature) => {
      const suggestion = suggestionFromFeature(feature);
      return suggestion ? [suggestion] : [];
    });
    return { status: 'ready', suggestions };
  } catch {
    return {
      status: 'error',
      message: 'OpenStreetMap-adressesøket er utilgjengelig akkurat nå.',
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function reverseOsmAddress(
  coordinates: { latitude: number; longitude: number },
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  if (
    !Number.isFinite(coordinates.latitude) ||
    Math.abs(coordinates.latitude) > 90 ||
    !Number.isFinite(coordinates.longitude) ||
    Math.abs(coordinates.longitude) > 180
  )
    return { status: 'error' as const, message: 'Ugyldig kartpunkt.' };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 8000);
  try {
    const url = new URL('https://photon.komoot.io/reverse');
    url.search = new URLSearchParams({
      lat: String(coordinates.latitude),
      lon: String(coordinates.longitude),
      limit: '1',
    }).toString();
    const response = await fetcher(url, {
      signal: controller.signal,
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('OSM reverse lookup unavailable');
    const result = responseSchema.parse(await boundedJson(response));
    const feature = result.features[0];
    const suggestion = feature ? suggestionFromFeature(feature) : undefined;
    if (!suggestion) return { status: 'not-found' as const };
    return {
      status: 'ready' as const,
      label: suggestion.label,
      distanceMeters: 0,
      attribution: 'OpenStreetMap',
      addressDetails: suggestion.addressDetails,
    };
  } catch {
    return {
      status: 'error' as const,
      message: 'Adressen kunne ikke hentes. Kartpunktet er fortsatt valgt.',
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function searchOsmAddressesRoute(
  request: Request,
  fetcher: typeof fetch = fetch,
) {
  const reply = (body: OsmAddressSearchResult, status = 200) =>
    Response.json(body, {
      status,
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=120' },
    });
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return reply({ status: 'error', message: 'Ugyldig forespørsel.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply({ status: 'error', message: 'Send søket som JSON.' }, 400);
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return reply({ status: 'error', message: 'Mangler søketekst.' }, 400);
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
            { status: 'error', message: 'Søket er for stort.' },
            413,
          );
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const body: unknown = JSON.parse(raw);
    const parsed = querySchema.safeParse(body);
    if (!parsed.success)
      return reply(
        { status: 'error', message: 'Skriv mellom 3 og 180 tegn.' },
        400,
      );
    const result = await searchOsmAddresses(
      parsed.data.query,
      fetcher,
      request.signal,
    );
    return reply(result, result.status === 'error' ? 502 : 200);
  } catch {
    return reply(
      { status: 'error', message: 'Ugyldig eller for langt søk.' },
      400,
    );
  }
}

export async function reverseOsmAddressRoute(
  request: Request,
  fetcher: typeof fetch = fetch,
) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=120' },
    });
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return reply({ status: 'error', message: 'Ugyldig forespørsel.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply(
      { status: 'error', message: 'Send kartpunktet som JSON.' },
      400,
    );
  try {
    const body: unknown = await request.json();
    const parsed = z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success)
      return reply({ status: 'error', message: 'Ugyldig kartpunkt.' }, 400);
    const result = await reverseOsmAddress(
      parsed.data,
      fetcher,
      request.signal,
    );
    return reply(result, result.status === 'error' ? 502 : 200);
  } catch {
    return reply({ status: 'error', message: 'Ugyldig kartpunkt.' }, 400);
  }
}
