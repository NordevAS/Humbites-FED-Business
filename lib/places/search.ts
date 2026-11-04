import { z } from 'zod';

export interface AddressSuggestion {
  id: string;
  label: string;
  coordinates: { longitude: number; latitude: number };
}
export type AddressSearchResult =
  | {
      status: 'ready';
      suggestions: AddressSuggestion[];
      attribution: '© Kartverket (CC BY 4.0)';
    }
  | { status: 'error'; message: string };
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
const addressesSchema = z.object({
  adresser: z
    .array(
      z.object({
        adressetekst: z.string().trim().min(1).max(180),
        postnummer: z.string().regex(/^\d{4}$/),
        poststed: z.string().trim().min(1).max(80),
        representasjonspunkt: z.object({
          epsg: z.literal('EPSG:4326'),
          lat: z.number().finite().min(-90).max(90),
          lon: z.number().finite().min(-180).max(180),
        }),
      }),
    )
    .max(5),
});

async function boundedJson(
  input: Request | Response,
  limit: number,
): Promise<unknown> {
  const reader = input.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

/** Official address lookup; no Mapbox-derived geocoding data is stored or relabeled. */
export async function searchAddresses(
  query: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AddressSearchResult> {
  const parsed = querySchema.safeParse({ query });
  if (!parsed.success)
    return { status: 'error', message: 'Skriv mellom 3 og 180 tegn.' };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 7000);
  async function lookup(term: string) {
    const url = new URL('https://api.kartverket.no/adresser/v1/sok');
    url.search = new URLSearchParams({
      sok: term,
      treffPerSide: '5',
      side: '0',
      utkoordsys: '4326',
      filtrer:
        'adresser.adressetekst,adresser.postnummer,adresser.poststed,adresser.representasjonspunkt',
    }).toString();
    const response = await fetcher(url, {
      signal: controller.signal,
      // Workers supports manual/follow only. Reject 3xx below instead of following it.
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Address service unavailable');
    return addressesSchema.parse(await boundedJson(response, 32768)).adresser;
  }
  try {
    // Exact city queries should not first match streets with the same prefix elsewhere.
    // If no exact token matches, retry the final word as a bounded autocomplete prefix.
    let addresses = await lookup(parsed.data.query);
    if (!addresses.length && /[\p{L}]$/u.test(parsed.data.query))
      addresses = await lookup(`${parsed.data.query}*`);
    const suggestions = addresses.map((address) => {
      const label = `${address.adressetekst}, ${address.postnummer} ${address.poststed}`;
      const { lat, lon } = address.representasjonspunkt;
      return {
        id: `${lon}:${lat}:${label}`,
        label,
        coordinates: { longitude: lon, latitude: lat },
      };
    });
    return {
      status: 'ready',
      suggestions,
      attribution: '© Kartverket (CC BY 4.0)',
    };
  } catch {
    return {
      status: 'error',
      message:
        'Adressesøket er utilgjengelig akkurat nå. Bruk et eksempelsted eller velg et kartpunkt.',
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

/** Same-origin endpoint with bounded input and a fixed upstream; no arbitrary URL proxying. */
export async function searchAddressesRoute(
  request: Request,
  fetcher: typeof fetch = fetch,
) {
  const reply = (body: AddressSearchResult, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return reply({ status: 'error', message: 'Ugyldig forespørsel.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply({ status: 'error', message: 'Send søket som JSON.' }, 400);
  try {
    const parsed = querySchema.safeParse(await boundedJson(request, 1024));
    if (!parsed.success)
      return reply(
        { status: 'error', message: 'Skriv mellom 3 og 180 tegn.' },
        400,
      );
    const result = await searchAddresses(
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
