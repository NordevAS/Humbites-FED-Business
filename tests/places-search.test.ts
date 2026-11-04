import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAddresses, searchAddressesRoute } from '../lib/places/search';

const address = {
  adressetekst: 'Eksempelveien 1',
  postnummer: '8006',
  poststed: 'BODØ',
  representasjonspunkt: { epsg: 'EPSG:4326', lat: 67.28, lon: 14.38 },
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
test('address search sends a bounded official Norwegian lookup and maps actual labels and points', async () => {
  const result = await searchAddresses('Bodø', async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.kartverket.no');
    assert.equal(url.pathname, '/adresser/v1/sok');
    assert.equal(url.searchParams.get('sok'), 'Bodø');
    assert.equal(url.searchParams.get('treffPerSide'), '5');
    assert.equal(url.searchParams.get('utkoordsys'), '4326');
    assert.equal(init?.redirect, 'manual');
    assert.ok(init?.signal);
    return json({ adresser: [address] });
  });
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.equal(result.suggestions[0].label, 'Eksempelveien 1, 8006 BODØ');
  assert.deepEqual(result.suggestions[0].coordinates, {
    longitude: 14.38,
    latitude: 67.28,
  });
  assert.equal(result.attribution, '© Kartverket (CC BY 4.0)');
});
test('empty exact-token match retries a prefix and never fabricates an address', async () => {
  const terms: string[] = [];
  const result = await searchAddresses('Bod', async (input) => {
    terms.push(new URL(String(input)).searchParams.get('sok')!);
    return json({ adresser: [] });
  });
  assert.deepEqual(terms, ['Bod', 'Bod*']);
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.deepEqual(result.suggestions, []);
});
test('provider failures, invalid geometry and oversized results remain explicit errors', async () => {
  const cases = [
    new Response('', {
      status: 302,
      headers: { Location: 'https://other.invalid' },
    }),
    new Response('', { status: 503 }),
    json({
      adresser: [
        {
          ...address,
          representasjonspunkt: { epsg: 'EPSG:25833', lat: 67, lon: 14 },
        },
      ],
    }),
    json({
      adresser: [
        {
          ...address,
          representasjonspunkt: { epsg: 'EPSG:4326', lat: NaN, lon: 14 },
        },
      ],
    }),
    json({ adresser: Array(6).fill(address) }),
    json({ adresser: [], padding: 'x'.repeat(33000) }),
  ];
  for (const response of cases)
    assert.equal(
      (await searchAddresses('Bodø', async () => response)).status,
      'error',
    );
  assert.equal(
    (
      await searchAddresses('Bodø', async () => {
        throw new Error('offline');
      })
    ).status,
    'error',
  );
});
test('invalid search input and cross-origin requests never call the upstream provider', async () => {
  let called = 0;
  const fetcher: typeof fetch = async () => {
    called++;
    return json({ adresser: [] });
  };
  for (const query of ['ab', 'x'.repeat(181), 'Bo\ndø']) {
    assert.equal((await searchAddresses(query, fetcher)).status, 'error');
  }
  const request = (body: string, origin = 'https://demo.invalid') =>
    new Request('https://demo.invalid/api/places/search', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body,
    });
  assert.equal(
    (
      await searchAddressesRoute(
        request('{"query":"Bodø"}', 'https://other.invalid'),
        fetcher,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await searchAddressesRoute(
        request(
          JSON.stringify({ query: 'Bodø', url: 'https://other.invalid' }),
        ),
        fetcher,
      )
    ).status,
    400,
  );
  assert.equal(
    (await searchAddressesRoute(request('x'.repeat(1025)), fetcher)).status,
    400,
  );
  assert.equal(called, 0);
});
test('address route uses no-store and reports provider errors as 502', async () => {
  const request = new Request('https://demo.invalid/api/places/search', {
    method: 'POST',
    headers: {
      Origin: 'https://demo.invalid',
      'Content-Type': 'application/json',
    },
    body: '{"query":"Bodø"}',
  });
  const response = await searchAddressesRoute(
    request,
    async () => new Response('', { status: 503 }),
  );
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.ok(body && typeof body === 'object' && 'status' in body);
  assert.equal(body.status, 'error');
});
