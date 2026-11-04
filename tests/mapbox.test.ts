import test from 'node:test';
import assert from 'node:assert/strict';
import { geocode, getDirections, getMatrix } from '../lib/mapbox/provider';
import {
  parseDirectionsInput,
  parseGeocodingInput,
  parseMatrixInput,
} from '../lib/mapbox/validation';
import {
  mapResponse,
  readBoundedJson,
  takeRequestBudget,
} from '../lib/mapbox/http';
import { foodTrucks } from '../data/demo';
import { mapboxRoute } from '../lib/mapbox/route';

const destination = { longitude: 10.76, latitude: 59.92 };
const token = 'test-only-token-not-a-credential';
function mock(
  body: unknown,
  inspect?: (url: URL, init: RequestInit | undefined) => void,
  status = 200,
): typeof fetch {
  return (async (input, init) => {
    inspect?.(new URL(String(input)), init);
    return Response.json(body, { status });
  }) as typeof fetch;
}

test('configured catalogue coordinates replace demo origins and unknown trucks fail closed', async () => {
  const live = {
    ...foodTrucks[0],
    id: '912',
    coordinates: { longitude: 8.123, latitude: 61.456 },
  };
  const result = await getMatrix(
    { truckIds: ['912'], destination },
    {
      token,
      trucks: [live],
      fetcher: mock(
        {
          code: 'Ok',
          durations: [
            [0, 10],
            [20, 0],
          ],
          distances: [
            [0, 100],
            [200, 0],
          ],
        },
        (url) => assert.ok(url.pathname.includes('8.123,61.456;')),
      ),
    },
  );
  assert.equal(result.status, 'ready');
  const unknown = await getDirections(
    { truckId: 'sol-salsa', destination },
    {
      token,
      trucks: [live],
      fetcher: async () => {
        throw new Error('Must not call provider');
      },
    },
  );
  assert.equal(unknown.status, 'error');
});
test('persistable geocoding explicitly sets permanent and marks provenance', async () => {
  const result = await geocode(
    { query: 'Example street' },
    {
      token,
      permanentGeocoding: true,
      fetcher: mock(
        {
          features: [
            {
              id: 'place',
              properties: { full_address: 'Example street' },
              geometry: { coordinates: [10.7, 59.9] },
            },
          ],
        },
        (url) => assert.equal(url.searchParams.get('permanent'), 'true'),
      ),
    },
  );
  assert.equal(result.status, 'ready');
  if (result.status === 'ready')
    assert.equal(result.suggestions[0].geocodingStorage, 'permanent');
});
test('live geocoding refuses temporary results before any provider request', async () => {
  const oldMode = process.env.HUMBITES_MODE,
    oldPermanent = process.env.MAPBOX_PERMANENT_GEOCODING;
  process.env.HUMBITES_MODE = 'live';
  delete process.env.MAPBOX_PERMANENT_GEOCODING;
  try {
    const result = await mapboxRoute(
      new Request('http://localhost/api/mapbox/geocoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Karl Johans gate' }),
      }),
      'geocoding',
    );
    assert.equal(result.status, 503);
    assert.equal(
      ((await result.json()) as { status?: string }).status,
      'unconfigured',
    );
  } finally {
    if (oldMode === undefined) delete process.env.HUMBITES_MODE;
    else process.env.HUMBITES_MODE = oldMode;
    if (oldPermanent === undefined)
      delete process.env.MAPBOX_PERMANENT_GEOCODING;
    else process.env.MAPBOX_PERMANENT_GEOCODING = oldPermanent;
  }
});

test('single truck uses a valid 2×2 matrix, longitude first, and reads the forward cell', async () => {
  const result = await getMatrix(
    { truckIds: ['sol-salsa'], destination },
    {
      token,
      fetcher: mock(
        {
          code: 'Ok',
          durations: [
            [0, 601],
            [999, 0],
          ],
          distances: [
            [0, 3210],
            [7777, 0],
          ],
        },
        (url, init) => {
          assert.ok(url.pathname.endsWith('/10.7522,59.9139;10.76,59.92'));
          assert.equal(url.searchParams.get('sources'), null);
          assert.equal(url.searchParams.get('destinations'), null);
          assert.equal(
            url.searchParams.get('annotations'),
            'duration,distance',
          );
          assert.equal(url.searchParams.has('fallback_speed'), false);
          assert.equal(url.searchParams.has('depart_at'), false);
          assert.equal(init?.cache, 'no-store');
          assert.ok(init?.signal);
        },
      ),
    },
  );
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') {
    const journey = result.journeys[0];
    assert.equal(journey.status, 'ready');
    if (journey.status === 'ready') {
      assert.equal(journey.durationSeconds, 601);
      assert.equal(journey.distanceMeters, 3210);
    }
  }
});

test('multi-origin matrix maps source rows to trucks and preserves null as unreachable', async () => {
  const result = await getMatrix(
    { truckIds: ['sol-salsa', 'fjord-frites'], destination },
    {
      token,
      fetcher: mock(
        { code: 'Ok', durations: [[50], [null]], distances: [[200], [null]] },
        (url) => {
          assert.equal(url.searchParams.get('sources'), '0;1');
          assert.equal(url.searchParams.get('destinations'), '2');
        },
      ),
    },
  );
  assert.equal(result.status, 'ready');
  if (result.status === 'ready')
    assert.deepEqual(result.journeys[1], {
      status: 'unreachable',
      truckId: 'fjord-frites',
    });
});

test('NoRoute never becomes a made-up distance', async () => {
  const result = await getMatrix(
    { truckIds: ['sol-salsa'], destination },
    { token, fetcher: mock({ code: 'NoRoute' }) },
  );
  assert.deepEqual(result, {
    status: 'ready',
    journeys: [{ status: 'unreachable', truckId: 'sol-salsa' }],
  });
});

test('invalid matrix dimensions and negative or missing metrics fail closed', async () => {
  for (const body of [
    { code: 'Ok', durations: [[1]], distances: [[1]] },
    {
      code: 'Ok',
      durations: [
        [0, -1],
        [1, 0],
      ],
      distances: [
        [0, 1],
        [1, 0],
      ],
    },
    {
      code: 'Ok',
      durations: [
        [0, 1],
        [1, 0],
      ],
    },
    { code: 'InvalidInput' },
  ])
    assert.equal(
      (
        await getMatrix(
          { truckIds: ['sol-salsa'], destination },
          { token, fetcher: mock(body) },
        )
      ).status,
      'error',
    );
});

test('no configuration returns explicitly unconfigured without a network request', async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    throw new Error('should not call');
  }) as typeof fetch;
  assert.equal(
    (
      await getMatrix(
        { truckIds: ['sol-salsa'], destination },
        { token: '', fetcher },
      )
    ).status,
    'unconfigured',
  );
  assert.equal(
    (await geocode({ query: 'Oslo' }, { token: '', fetcher })).status,
    'unconfigured',
  );
  assert.equal(
    (
      await getDirections(
        { truckId: 'sol-salsa', destination },
        { token: '', fetcher },
      )
    ).status,
    'unconfigured',
  );
  assert.equal(calls, 0);
});

test('provider authorization/rate errors and thrown authenticated URLs never expose secrets', async () => {
  for (const [status, expected] of [
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate-limit'],
    [500, 'upstream'],
  ] as const) {
    const result = await getMatrix(
      { truckIds: ['sol-salsa'], destination },
      { token, fetcher: mock({ message: token }, undefined, status) },
    );
    assert.equal(result.status, 'error');
    if (result.status === 'error') assert.equal(result.code, expected);
    assert.equal(JSON.stringify(result).includes(token), false);
  }
  const result = await geocode(
    { query: 'Oslo' },
    {
      token,
      fetcher: (async () => {
        throw new Error(`https://api.mapbox.com/?access_token=${token}`);
      }) as typeof fetch,
    },
  );
  assert.equal(JSON.stringify(result).includes(token), false);
});

test('timeout has an honest error category', async () => {
  const result = await geocode(
    { query: 'Oslo' },
    {
      token,
      fetcher: (async () => {
        throw new DOMException('timeout', 'TimeoutError');
      }) as typeof fetch,
    },
  );
  assert.equal(result.status, 'error');
  if (result.status === 'error') assert.equal(result.code, 'timeout');
});

test('Directions returns only verified provider LineString geometry', async () => {
  const geometry = {
    type: 'LineString',
    coordinates: [
      [10.75, 59.91],
      [10.76, 59.92],
    ],
  };
  const result = await getDirections(
    { truckId: 'sol-salsa', destination },
    {
      token,
      fetcher: mock({ code: 'Ok', routes: [{ geometry }] }, (url) => {
        assert.equal(url.searchParams.get('geometries'), 'geojson');
        assert.equal(url.searchParams.get('overview'), 'full');
      }),
    },
  );
  assert.deepEqual(result, { status: 'ready', geometry, source: 'mapbox' });
  assert.equal(
    (
      await getDirections(
        { truckId: 'sol-salsa', destination },
        { token, fetcher: mock({ code: 'NoRoute' }) },
      )
    ).status,
    'unreachable',
  );
  assert.equal(
    (
      await getDirections(
        { truckId: 'sol-salsa', destination },
        {
          token,
          fetcher: mock({
            code: 'Ok',
            routes: [
              {
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [10, 95],
                    [11, 96],
                  ],
                },
              },
            ],
          }),
        },
      )
    ).status,
    'error',
  );
});

test('Norwegian address lookup requests temporary results and preserves genuine feature coordinates', async () => {
  const result = await geocode(
    { query: 'En adresse i Tromsø' },
    {
      token,
      fetcher: mock(
        {
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [18.95, 69.65] },
              properties: {
                mapbox_id: 'sample-feature',
                full_address: 'Eksempeladresse, Tromsø',
              },
            },
          ],
        },
        (url) => {
          assert.equal(url.searchParams.get('country'), 'no');
          assert.equal(url.searchParams.get('language'), 'nb');
          assert.equal(url.searchParams.get('permanent'), 'false');
          assert.equal(url.searchParams.get('autocomplete'), 'false');
        },
      ),
    },
  );
  assert.deepEqual(result, {
    status: 'ready',
    suggestions: [
      {
        id: 'sample-feature',
        label: 'Eksempeladresse, Tromsø',
        coordinates: { longitude: 18.95, latitude: 69.65 },
      },
    ],
  });
});

test('route inputs accept known trucks and bounded coordinates, never arbitrary URL/profiles', () => {
  assert.ok(parseMatrixInput({ truckIds: ['sol-salsa'], destination }));
  for (const input of [
    { truckIds: [], destination },
    { truckIds: ['sol-salsa', 'sol-salsa'], destination },
    { truckIds: ['unknown'], destination },
    { truckIds: ['sol-salsa'], destination: { longitude: 181, latitude: 60 } },
    { truckIds: ['sol-salsa'], destination, url: 'http://internal.invalid' },
    { truckIds: ['sol-salsa'], destination: { ...destination, token: 'x' } },
  ])
    assert.equal(parseMatrixInput(input), null);
  assert.equal(parseDirectionsInput({ truckId: 'unknown', destination }), null);
  assert.equal(parseGeocodingInput({ query: 'ab' }), null);
  assert.equal(parseGeocodingInput({ query: 'Oslo;Bergen' }), null);
  assert.equal(parseGeocodingInput({ query: 'a'.repeat(257) }), null);
});

test('server bodies are bounded in bytes even without content-length and no-store covers errors', async () => {
  const request = (body: string) =>
    new Request('http://localhost/api/mapbox/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  assert.deepEqual(await readBoundedJson(request('{"query":"Oslo"}')), {
    query: 'Oslo',
  });
  await assert.rejects(() =>
    readBoundedJson(request(JSON.stringify({ query: 'ø'.repeat(3000) }))),
  );
  await assert.rejects(() => readBoundedJson(request('not-json')));
  assert.equal(mapResponse({ status: 'unconfigured' }).status, 503);
  assert.equal(
    mapResponse({ status: 'error', code: 'rate-limit' }).headers.get(
      'Cache-Control',
    ),
    'no-store',
  );
  for (let i = 0; i < 25; i++)
    assert.equal(takeRequestBudget('test-operation', 1000), true);
  assert.equal(takeRequestBudget('test-operation', 1000), false);
  assert.equal(takeRequestBudget('test-operation', 61000), true);
});
