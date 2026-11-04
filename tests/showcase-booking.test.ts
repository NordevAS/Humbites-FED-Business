import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDb } from './showcase/sqlite';
import {
  handleShowcaseRequest,
  type ShowcaseEnvironment,
} from '../lib/showcase/handler';
import {
  readSandbox,
  hashToken,
  stable,
  resolveShowcaseSession,
  mutateSandbox,
  publicTrucks,
} from '../lib/showcase/store';

const origin = 'https://showcase.example.invalid';
function harness() {
  const database = createTestDb();
  const env = { DB: database.db, BUCKET: {} } as ShowcaseEnvironment;
  function visitor() {
    const jar = new Map<string, string>();
    return {
      jar,
      async call(
        path: string,
        method = 'GET',
        payload?: unknown,
        headers: Record<string, string> = {},
      ) {
        const result = await handleShowcaseRequest(
          new Request(`${origin}/api/booking/${path}`, {
            method,
            headers: {
              Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
              ...(method !== 'GET'
                ? { Origin: origin, 'Content-Type': 'application/json' }
                : {}),
              ...headers,
            },
            ...(method !== 'GET'
              ? { body: JSON.stringify(payload ?? {}) }
              : {}),
          }),
          env,
          path.split('?')[0],
        );
        for (const line of result.headers.getSetCookie()) {
          const pair = line.split(';')[0];
          const index = pair.indexOf('=');
          jar.set(pair.slice(0, index), pair.slice(index + 1));
        }
        const body =
          result.status === 204 ? null : ((await result.json()) as any);
        return { status: result.status, body, result };
      },
    };
  }
  return { ...database, env, visitor };
}
const event = {
  date: '2040-06-01',
  startTime: '12:00',
  durationHours: 2,
  guestCount: 30,
  notes: 'Kun syntetiske testopplysninger',
  location: {
    label: 'Oslo sentrum (demo)',
    coordinates: { longitude: 10.7522, latitude: 59.9139 },
    source: 'preset',
  },
};
const contact = {
  name: 'Demo Kunde',
  email: 'demo@example.invalid',
  phone: '00000000',
  customerType: 'private',
};
test('owner demo login initializes a missing session and returns its cookie', async () => {
  const h = harness();
  try {
    const visitor = h.visitor();
    const login = await visitor.call('owner/login', 'POST');
    assert.equal(login.status, 200);
    assert.equal(login.body.data.showcase, true);
    assert.ok(visitor.jar.has('humbites_showcase'));
    assert.equal((await visitor.call('owner/session')).status, 200);
    assert.equal((await visitor.call('owner/businesses')).status, 200);
  } finally {
    h.close();
  }
});
async function create(
  visitor: ReturnType<ReturnType<typeof harness>['visitor']>,
  when = event,
) {
  const draftId = randomUUID();
  assert.equal((await visitor.call('drafts', 'POST', { draftId })).status, 200);
  const headers = { 'x-draft-id': draftId };
  const quoted = await visitor.call(
    'quotes',
    'POST',
    { foodtruckId: '1', event: when, quantities: { 101: 3 } },
    headers,
  );
  assert.equal(quoted.status, 201, JSON.stringify(quoted.body));
  const key = randomUUID();
  const created = await visitor.call(
    'requests',
    'POST',
    { quoteId: quoted.body.data.quoteId, contact },
    { ...headers, 'idempotency-key': key },
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return { created, quote: quoted.body.data, draftId, key, headers };
}

test('sandbox catalogue, server quote, idempotency and filtered owner inbox work end to end', async () => {
  const h = harness();
  try {
    const v = h.visitor();
    assert.equal((await v.call('demo/session', 'POST')).status, 200);
    const catalogue = await v.call('catalogue');
    assert.equal(catalogue.body.trucks.length, 6);
    assert.equal(catalogue.body.trucks[0].id, '1');
    const { created, quote, key, headers } = await create(v);
    assert.equal(quote.quote.isDemo, true);
    assert.equal(quote.quote.totalMinor, 190000);
    assert.equal(created.body.data.event.guestCount, 30);
    assert.equal(created.body.data.quote.portionCount, 0);
    assert.ok(!('guestTokenHash' in created.body.data));
    const repeated = await v.call(
      'requests',
      'POST',
      { quoteId: quote.quoteId, contact },
      { ...headers, 'idempotency-key': key },
    );
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data.id, created.body.data.id);
    assert.equal(
      (
        await v.call(
          'requests',
          'POST',
          { quoteId: quote.quoteId, contact: { ...contact, name: 'Other' } },
          { ...headers, 'idempotency-key': key },
        )
      ).status,
      409,
    );
    assert.equal((await v.call('owner/businesses')).status, 401);
    await v.call('owner/login', 'POST');
    const inbox = await v.call(
      'owner/businesses/1/trucks/1/bookings?page=1&limit=1&status=PENDING',
    );
    assert.equal(inbox.body.pagination.total, 1);
    assert.equal(inbox.body.data[0].id, created.body.data.id);
    assert.equal(
      (await v.call('owner/businesses/2/trucks/1/bookings')).status,
      404,
    );
  } finally {
    h.close();
  }
});

test('per-visitor isolation and private receipt recovery never grant another sandbox or owner rights', async () => {
  const h = harness();
  try {
    const a = h.visitor(),
      b = h.visitor();
    await a.call('demo/session', 'POST');
    await b.call('demo/session', 'POST');
    const { created } = await create(a);
    const id = created.body.data.id;
    assert.equal((await b.call(`requests/${id}`)).status, 404);
    assert.equal(
      (await b.call(`requests/${id}/access`, 'POST', { token: 'A'.repeat(43) }))
        .status,
      401,
    );
    assert.equal(
      (
        await b.call(`requests/${id}/access`, 'POST', {
          token: created.body.receiptToken,
        })
      ).status,
      200,
    );
    assert.equal((await b.call(`requests/${id}`)).status, 200);
    assert.deepEqual((await b.call('demo/requests')).body.data, []);
    assert.equal((await b.call('owner/session')).status, 401);
    await b.call('owner/login', 'POST');
    assert.equal(
      (
        await b.call(
          `owner/businesses/1/trucks/1/bookings/${id}/accept`,
          'POST',
        )
      ).status,
      404,
    );
    assert.equal((await a.call('demo/requests')).body.data.length, 1);
    const reset = await a.call('demo/reset', 'POST');
    assert.equal(reset.status, 200);
    assert.deepEqual((await a.call('demo/requests')).body.data, []);
    assert.equal((await b.call(`requests/${id}`)).status, 404);
    assert.equal(
      (
        await b.call(`requests/${id}/access`, 'POST', {
          token: created.body.receiptToken,
        })
      ).status,
      401,
    );
  } finally {
    h.close();
  }
});

test('CAS serialization prevents concurrent overlapping approvals and stale quotes after menu edits', async () => {
  const h = harness();
  try {
    const v = h.visitor();
    await v.call('demo/session', 'POST');
    const first = await create(v),
      second = await create(v);
    await v.call('owner/login', 'POST');
    const results = await Promise.all(
      [first, second].map((x) =>
        v.call(
          `owner/businesses/1/trucks/1/bookings/${x.created.body.data.id}/accept`,
          'POST',
        ),
      ),
    );
    assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
    assert.equal(
      results.find((x) => x.status === 409)?.body.error.code,
      'BOOKING_CONFLICT',
    );
    const future = { ...event, date: '2040-06-03' };
    const draftId = randomUUID();
    await v.call('drafts', 'POST', { draftId });
    const q = await v.call(
      'quotes',
      'POST',
      { foodtruckId: '1', event: future, quantities: { 101: 2 } },
      { 'x-draft-id': draftId },
    );
    assert.equal(q.status, 201);
    assert.equal(
      (
        await v.call('owner/businesses/1/trucks/1/menu/101', 'PATCH', {
          basePrice: 199,
          allergenIds: [2, 3],
        })
      ).status,
      200,
    );
    const failed = await v.call(
      'requests',
      'POST',
      { quoteId: q.body.data.quoteId, contact },
      { 'x-draft-id': draftId, 'idempotency-key': randomUUID() },
    );
    assert.equal(failed.body.error.code, 'REQUOTE_REQUIRED');
    const catalogue = await v.call('catalogue');
    assert.deepEqual(catalogue.body.trucks[0].menu[0].allergens, [
      'Gluten',
      'Egg',
    ]);
  } finally {
    h.close();
  }
});

test('mock authorization, capture, refund, release and duplicate clicks never transfer real money', async () => {
  const h = harness();
  try {
    const v = h.visitor();
    await v.call('demo/session', 'POST');
    const { created } = await create(v);
    const id = created.body.data.id;
    assert.equal((await v.call(`requests/${id}/payment`, 'POST')).status, 409);
    await v.call('owner/login', 'POST');
    await v.call(`owner/businesses/1/trucks/1/bookings/${id}/accept`, 'POST');
    const started = await v.call(`requests/${id}/payment`, 'POST');
    assert.equal(started.body.data.state, 'CREATED');
    assert.equal(started.body.data.redirectUrl, `${origin}/demobetaling/${id}`);
    assert.equal(
      (
        await v.call(
          `owner/businesses/1/trucks/1/bookings/${id}/cancel`,
          'POST',
        )
      ).body.error.code,
      'PAYMENT_ACTION_REQUIRED',
    );
    const authorized = await Promise.all([
      v.call(`demo/payments/${id}/authorize`, 'POST'),
      v.call(`demo/payments/${id}/authorize`, 'POST'),
    ]);
    assert.ok(authorized.every((x) => x.status === 200));
    const captures = await Promise.all([
      v.call(`owner/payments/${id}/capture`, 'POST'),
      v.call(`owner/payments/${id}/capture`, 'POST'),
    ]);
    assert.ok(
      captures.every(
        (x) => x.body.data.capturedMinor === created.body.data.quote.totalMinor,
      ),
    );
    assert.equal(
      (
        await v.call(
          `owner/businesses/1/trucks/1/bookings/${id}/cancel`,
          'POST',
        )
      ).status,
      409,
    );
    const refunds = await Promise.all([
      v.call(`owner/payments/${id}/refund`, 'POST'),
      v.call(`owner/payments/${id}/refund`, 'POST'),
    ]);
    assert.ok(
      refunds.every(
        (x) => x.body.data.refundedMinor === created.body.data.quote.totalMinor,
      ),
    );
    assert.equal(
      (
        await v.call(
          `owner/businesses/1/trucks/1/bookings/${id}/cancel`,
          'POST',
        )
      ).status,
      200,
    );
    const next = (await create(v, { ...event, date: '2040-06-05' })).created
      .body.data.id;
    await v.call(`owner/businesses/1/trucks/1/bookings/${next}/accept`, 'POST');
    await v.call(`requests/${next}/payment`, 'POST');
    assert.equal(
      (await v.call(`owner/payments/${next}/cancel`, 'POST')).body.data.state,
      'TERMINATED',
    );
    assert.equal(
      (
        await v.call(
          `owner/businesses/1/trucks/1/bookings/${next}/cancel`,
          'POST',
        )
      ).status,
      200,
    );
  } finally {
    h.close();
  }
});

test('expired sessions and cross-origin mutations fail closed', async () => {
  const h = harness();
  try {
    const v = h.visitor();
    assert.equal(
      (
        await v.call(
          'demo/session',
          'POST',
          {},
          { Origin: 'https://other.example.invalid' },
        )
      ).status,
      403,
    );
    await v.call('demo/session', 'POST');
    const sessionToken = v.jar.get('humbites_showcase')!;
    await h.db
      .prepare('UPDATE demo_sandboxes SET expires_at=? WHERE id=?')
      .bind(Date.now() - 1, await hashToken(sessionToken))
      .run();
    assert.equal((await v.call('catalogue')).status, 401);
    await v.call('demo/session', 'POST');
    assert.notEqual(v.jar.get('humbites_showcase'), sessionToken);
    assert.equal((await v.call('catalogue')).body.trucks.length, 6);
  } finally {
    h.close();
  }
});

test('event rental ignores portion quantities while preserving selected dishes and guest capacity', async () => {
  const h = harness();
  try {
    const v = h.visitor();
    await v.call('demo/session', 'POST');
    const sandboxId = await hashToken(v.jar.get('humbites_showcase')!);
    // A legacy portion setting cannot limit an event with no prepaid food quantity.
    await mutateSandbox(h.db, sandboxId, (state) => {
      state.settings['1'].maxPortions = 1;
    });
    const draftId = randomUUID();
    await v.call('drafts', 'POST', { draftId });
    const headers = { 'x-draft-id': draftId };
    const response = await v.call(
      'quotes',
      'POST',
      { foodtruckId: '1', event, quantities: { 101: 100000, 102: 3, 103: 0 } },
      headers,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const { quoteId, quote } = response.body.data;
    assert.equal(quote.pricingModel, 'rental-v1');
    assert.equal(quote.totalMinor, 190000);
    assert.equal(quote.subtotalMinor, 0);
    assert.equal(quote.portionCount, 0);
    assert.equal(quote.selectedDishCount, 2);
    assert.deepEqual(
      quote.lines.map(
        (line: {
          itemId: string;
          quantity: number;
          lineTotalMinor: number;
        }) => [line.itemId, line.quantity, line.lineTotalMinor],
      ),
      [
        ['101', 1, 0],
        ['102', 1, 0],
      ],
    );
    const saved = await readSandbox(h.db, sandboxId);
    assert.deepEqual(saved!.state.quotes[quoteId].quantities, {
      '101': 1,
      '102': 1,
    });
    const created = await v.call(
      'requests',
      'POST',
      { quoteId, contact },
      { ...headers, 'idempotency-key': randomUUID() },
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(created.body.data.quote, quote);
    const oversized = await v.call(
      'quotes',
      'POST',
      {
        foodtruckId: '1',
        event: { ...event, guestCount: 100000 },
        quantities: { 101: 1 },
      },
      headers,
    );
    assert.equal(oversized.status, 409);
    assert.ok(
      oversized.body.error.details.reasons.includes('GUEST_CAPACITY_EXCEEDED'),
    );
  } finally {
    h.close();
  }
});

test('pre-rental quote drafts require a fresh quote and historical bookings retain their original prices', async () => {
  const h = harness();
  try {
    const v = h.visitor();
    await v.call('demo/session', 'POST');
    const sandboxId = await hashToken(v.jar.get('humbites_showcase')!);
    const draftId = randomUUID();
    await v.call('drafts', 'POST', { draftId });
    const headers = { 'x-draft-id': draftId };
    const response = await v.call(
      'quotes',
      'POST',
      { foodtruckId: '1', event, quantities: { 101: 3 } },
      headers,
    );
    const quoteId = response.body.data.quoteId;
    await mutateSandbox(h.db, sandboxId, (state) => {
      const saved = state.quotes[quoteId];
      // Simulate an unsubmitted quote from the previous deployment, including its old fingerprint.
      saved.settingsFingerprint = stable(state.settings['1']);
      delete saved.quote.pricingModel;
      delete saved.quote.rentalFeeMinor;
      delete saved.quote.selectedDishCount;
      saved.quote.portionCount = 3;
      saved.quote.subtotalMinor = 3 * 16900;
      saved.quote.totalMinor = 190000 + 3 * 16900;
      saved.quote.lines[0].quantity = 3;
      saved.quote.lines[0].lineTotalMinor = 3 * 16900;
      saved.quantities = { '101': 3 };
    });
    const refused = await v.call(
      'requests',
      'POST',
      { quoteId, contact },
      { ...headers, 'idempotency-key': randomUUID() },
    );
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.code, 'REQUOTE_REQUIRED');
    const fresh = await create(v);
    const historical = await mutateSandbox(h.db, sandboxId, (state) => {
      const booking = state.bookings[fresh.created.body.data.id];
      booking.quote = structuredClone(state.quotes[quoteId].quote);
      return structuredClone(booking.quote);
    });
    await v.call('owner/login', 'POST');
    const accepted = await v.call(
      'owner/businesses/1/trucks/1/bookings/' +
        fresh.created.body.data.id +
        '/accept',
      'POST',
    );
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    const receipt = await v.call('requests/' + fresh.created.body.data.id);
    assert.deepEqual(receipt.body.data.quote, historical);
    assert.equal(receipt.body.data.quote.totalMinor, 240700);
  } finally {
    h.close();
  }
});
