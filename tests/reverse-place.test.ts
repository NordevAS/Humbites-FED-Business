import test from 'node:test';
import assert from 'node:assert/strict';
import { reversePlace, reversePlaceRoute } from '../lib/places/reverse';
import { createMapSelection } from '../lib/places/map-selection';
import type { EventLocation } from '../domain';

const point = { longitude: 10.7522, latitude: 59.9139 };
const address = {
  adressetekst: 'Storgata 28B',
  postnummer: '0184',
  poststed: 'OSLO',
  meterDistanseTilPunkt: 4.9,
};
test('reverse lookup uses one nearby official address without returning replacement coordinates', async () => {
  const result = await reversePlace(point, async (url, init) => {
    const request = new URL(String(url));
    assert.equal(request.origin, 'https://api.kartverket.no');
    assert.equal(init?.redirect, 'manual');
    assert.equal(request.searchParams.get('radius'), '100');
    assert.equal(request.searchParams.get('treffPerSide'), '1');
    assert.equal(request.searchParams.get('koordsys'), '4326');
    return Response.json({ adresser: [address] });
  });
  assert.deepEqual(result, {
    status: 'ready',
    label: 'Ved Storgata 28B, 0184 OSLO',
    distanceMeters: 5,
    attribution: 'Kartverket (CC BY 4.0)',
  });
});
test('reverse lookup preserves missing addresses and rejects malformed, distant and oversized responses', async () => {
  assert.equal(
    (await reversePlace(point, async () => Response.json({ adresser: [] })))
      .status,
    'not-found',
  );
  for (const raw of [
    { adresser: [{ ...address, meterDistanseTilPunkt: 101 }] },
    { adresser: [{ ...address, poststed: '' }] },
    { addresses: [address] },
    { adresser: [address, address] },
  ]) {
    assert.equal(
      (await reversePlace(point, async () => Response.json(raw))).status,
      'error',
    );
  }
  assert.equal(
    (await reversePlace(point, async () => new Response('x'.repeat(32769))))
      .status,
    'error',
  );
});
test('network and provider failures return a factual fallback', async () => {
  assert.equal(
    (
      await reversePlace(
        point,
        async () =>
          new Response('', {
            status: 302,
            headers: { Location: 'https://other.invalid' },
          }),
      )
    ).status,
    'error',
  );
  assert.equal(
    (
      await reversePlace(point, async () => {
        throw new Error('Network unavailable');
      })
    ).status,
    'error',
  );
  assert.equal(
    (await reversePlace(point, async () => new Response('', { status: 503 })))
      .status,
    'error',
  );
});
test('reverse route validates coordinates and origin before contacting the provider', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({ adresser: [] });
  };
  const make = (body: unknown, origin = 'https://demo.invalid') =>
    new Request('https://demo.invalid/api/places/reverse', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  for (const bad of [
    {},
    { longitude: 200, latitude: 60 },
    { longitude: '10', latitude: 60 },
    { ...point, url: 'https://elsewhere.invalid' },
  ])
    assert.equal((await reversePlaceRoute(make(bad), fetcher)).status, 400);
  assert.equal(
    (await reversePlaceRoute(make(point, 'https://other.invalid'), fetcher))
      .status,
    403,
  );
  assert.equal(
    (await reversePlaceRoute(make({ long: 'a'.repeat(1100) }), fetcher)).status,
    413,
  );
  assert.equal(calls, 0);
  assert.equal((await reversePlaceRoute(make(point), fetcher)).status, 200);
  assert.equal(calls, 1);
});
test('latest map click wins even if the older network request ignores abort', async () => {
  const responses: Array<(response: Response) => void> = [];
  const selection = createMapSelection(
    () => new Promise((resolve) => responses.push(resolve)),
  );
  const updates: EventLocation[] = [];
  const messages: string[] = [];
  const next = { longitude: 5.32, latitude: 60.39 };
  const first = selection.select(
    point,
    (value) => updates.push(value),
    (value) => messages.push(value),
  );
  const second = selection.select(
    next,
    (value) => updates.push(value),
    (value) => messages.push(value),
  );
  responses[1](
    Response.json({
      status: 'ready',
      label: 'Ved Bryggen 1, 5003 BERGEN',
      distanceMeters: 12,
    }),
  );
  await second;
  responses[0](
    Response.json({
      status: 'ready',
      label: 'Wrong older label',
      distanceMeters: 1,
    }),
  );
  await first;
  assert.equal(updates.length, 3);
  assert.deepEqual(updates[2].coordinates, next);
  assert.equal(updates[2].label, 'Ved Bryggen 1, 5003 BERGEN');
  assert.ok(!messages.some((message) => message.includes('Wrong')));
});
test('typing, preset choice or unmount cancellation cannot receive a late reverse label', async () => {
  let respond: ((response: Response) => void) | undefined;
  const selection = createMapSelection(
    () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  );
  const updates: EventLocation[] = [];
  const pending = selection.select(
    point,
    (value) => updates.push(value),
    () => {},
  );
  selection.cancel();
  respond!(
    Response.json({ status: 'ready', label: 'Stale', distanceMeters: 5 }),
  );
  await pending;
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].coordinates, point);
  assert.equal(updates[0].source, 'map');
});
