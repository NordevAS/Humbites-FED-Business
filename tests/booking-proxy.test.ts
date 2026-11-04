import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE, PUT } from '../lib/booking/native-route';
import {
  resolveTarget,
  sameOrigin,
  validToken,
  guestCookie,
} from '../lib/booking/proxy-policy';
import { getMode } from '../lib/booking/mode';
import { backendUrl, loadCatalogue, backendFetch } from '../lib/booking/server';
import { foodTrucks } from '../data/demo';

const origin = 'http://localhost:3001';
const context = (path: string) => ({
  params: Promise.resolve({ path: path.split('/') }),
});
function request(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`${origin}/api/booking/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function environment(run: () => Promise<void>) {
  const mode = process.env.HUMBITES_MODE,
    bed = process.env.BED_API_URL,
    site = process.env.SITE_URL,
    fetcher = globalThis.fetch;
  process.env.HUMBITES_MODE = 'live';
  process.env.BED_API_URL = 'http://backend.invalid';
  delete process.env.SITE_URL;
  try {
    await run();
  } finally {
    if (mode === undefined) delete process.env.HUMBITES_MODE;
    else process.env.HUMBITES_MODE = mode;
    if (bed === undefined) delete process.env.BED_API_URL;
    else process.env.BED_API_URL = bed;
    if (site === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = site;
    globalThis.fetch = fetcher;
  }
}
test('live is the default; only exact demo mode opts into examples', () => {
  assert.equal(getMode('demo'), 'demo');
  assert.equal(getMode('live'), 'live');
  assert.equal(getMode('typo'), 'live');
  assert.equal(getMode(''), 'live');
});
test('proxy policy rejects arbitrary URLs, traversal, wrong methods and undesired payment actions', () => {
  for (const path of [
    'https://evil.test',
    '../auth',
    'owner/businesses/1/trucks/2/bookings/a/delete',
    'requests/a/refund',
    'owner/businesses/1/trucks/2/menu/1/arbitrary',
  ])
    assert.equal(resolveTarget('POST', path), null);
  assert.deepEqual(
    resolveTarget('POST', 'owner/businesses/1/trucks/2/bookings/abc/accept'),
    { path: 'me/businesses/1/foodtrucks/2/bookings/abc/accept', auth: 'owner' },
  );
  assert.equal(
    resolveTarget('GET', 'owner/businesses/1/trucks/2/menu-options')?.auth,
    'owner',
  );
  assert.equal(
    resolveTarget('POST', 'requests/a/payment')?.path,
    'payments/bookings/a',
  );
});
test('browser mutations require same-origin and opaque guest tokens have a strict format', () => {
  assert.equal(
    sameOrigin(
      new Request(origin, { headers: { Origin: 'https://evil.test' } }),
    ),
    false,
  );
  assert.equal(sameOrigin(new Request(origin)), false);
  assert.equal(
    sameOrigin(new Request(origin, { headers: { Origin: origin } })),
    true,
  );
  assert.equal(validToken('a'.repeat(43)), true);
  assert.equal(validToken('a'.repeat(42)), false);
  assert.equal(validToken('a'.repeat(42) + '='), false);
});
test('missing or malformed backend config fails without demo fallback', async () =>
  environment(async () => {
    delete process.env.BED_API_URL;
    await assert.rejects(loadCatalogue(), /ikke satt opp/);
    for (const url of [
      'file:///tmp',
      'http://u:p@host',
      'http://host/path',
      'http://host?token=a',
    ]) {
      process.env.BED_API_URL = url;
      assert.throws(() => backendUrl('foodtrucks'));
    }
    process.env.HUMBITES_MODE = 'demo';
    assert.equal((await loadCatalogue()).length, 6);
  }));
test('live catalogue validates backend data and never substitutes examples on failure', async () =>
  environment(async () => {
    globalThis.fetch = async () =>
      Response.json({
        data: [
          {
            ...foodTrucks[0],
            id: '91',
            fixedFeeMinor: null,
            booking: { configured: false, enabled: false },
          },
        ],
        pagination: { totalPages: 1 },
      });
    assert.equal((await loadCatalogue())[0].id, '91');
    assert.equal((await loadCatalogue())[0].fixedFeeMinor, null);
    globalThis.fetch = async () =>
      Response.json({ data: [{ name: 'malformed' }] });
    await assert.rejects(loadCatalogue(), /leses/);
    globalThis.fetch = async () => {
      throw new Error('upstream private credentials');
    };
    await assert.rejects(
      loadCatalogue(),
      (error) =>
        error instanceof Error && !error.message.includes('credentials'),
    );
  }));
test('guest draft, authoritative quote, idempotent create and receipt restoration preserve credentials safely', async () =>
  environment(async () => {
    const draftId = '11111111-1111-4111-8111-111111111111',
      key = '22222222-2222-4222-8222-222222222222';
    const draft = await POST(request('drafts', { draftId }), context('drafts'));
    assert.equal(draft.status, 200);
    const name = `humbites_draft_${draftId}`,
      token = draft.cookies.get(name)?.value;
    assert.ok(validToken(token));
    assert.equal(draft.cookies.get(name)?.httpOnly, true);
    assert.equal(draft.cookies.get(name)?.sameSite, 'strict');
    const headers = {
      Cookie: `${name}=${token}`,
      'X-Draft-Id': draftId,
      'Idempotency-Key': key,
    };
    const calls: { url: string; headers: Headers; body: unknown }[] = [];
    globalThis.fetch = async (input, options) => {
      const url = String(input),
        head = new Headers(options?.headers);
      calls.push({
        url,
        headers: head,
        body: options?.body ? JSON.parse(String(options.body)) : null,
      });
      if (url.endsWith('/bookings/quote'))
        return Response.json({
          data: {
            quoteId: 'quote-one',
            expiresAt: '2099-01-01T00:00:00Z',
            quote: { totalMinor: 1200 },
          },
        });
      return Response.json(
        { data: { id: 'booking-one', status: 'PENDING' } },
        { status: url.endsWith('/bookings') ? 201 : 200 },
      );
    };
    const quote = await POST(
      request(
        'quotes',
        { foodtruckId: '91', event: {}, quantities: { item: 3 } },
        headers,
      ),
      context('quotes'),
    );
    assert.equal(quote.status, 200);
    const created = await POST(
      request(
        'requests',
        { quoteId: 'quote-one', contact: { name: 'Customer' } },
        headers,
      ),
      context('requests'),
    );
    assert.equal(created.status, 201);
    assert.equal(created.cookies.get(guestCookie('booking-one'))?.value, token);
    assert.equal(
      ((await created.json()) as { receiptToken?: string }).receiptToken,
      token,
    );
    assert.equal(calls[1].headers.get('X-Booking-Token'), token);
    assert.equal(calls[1].headers.get('Idempotency-Key'), key);
    assert.ok(calls.every((call) => !call.url.includes(token)));
    assert.ok(calls.every((call) => !call.headers.has('Cookie')));
    const restored = await POST(
      request('requests/booking-one/access', { token }),
      context('requests/booking-one/access'),
    );
    assert.equal(restored.status, 200);
    assert.equal(
      restored.cookies.get(guestCookie('booking-one'))?.httpOnly,
      true,
    );
    const unavailable = await GET(
      request('requests/booking-one'),
      context('requests/booking-one'),
    );
    assert.equal(unavailable.status, 401);
    const crossSite = await POST(
      request('drafts', { draftId }, { Origin: 'https://evil.test' }),
      context('drafts'),
    );
    assert.equal(crossSite.status, 403);
  }));
test('owner login captures rotated backend session and keeps it HttpOnly; mutations forward CSRF', async () =>
  environment(async () => {
    const calls: { url: string; headers: Headers }[] = [];
    let csrfCalls = 0;
    globalThis.fetch = async (input, options) => {
      const url = String(input),
        headers = new Headers(options?.headers);
      calls.push({ url, headers });
      if (url.endsWith('/auth/csrf')) {
        csrfCalls++;
        return Response.json(
          { csrfToken: `csrf-${csrfCalls}` },
          {
            headers:
              csrfCalls === 1
                ? { 'Set-Cookie': 'connect.sid=prelogin; Path=/; HttpOnly' }
                : {},
          },
        );
      }
      if (url.endsWith('/auth/login'))
        return new Response(null, {
          status: 302,
          headers: {
            Location: '/v1/auth/login-success',
            'Set-Cookie': 'connect.sid=rotated; Path=/; HttpOnly',
          },
        });
      if (url.endsWith('/auth/login-success'))
        return Response.json({ data: { id: 1, email: 'owner@example.test' } });
      return Response.json({ data: { status: 'ACCEPTED' } });
    };
    const logged = await POST(
      request('owner/login', {
        email: 'owner@example.test',
        password: 'test-only',
      }),
      context('owner/login'),
    );
    assert.equal(logged.status, 200);
    const session = logged.cookies.get('humbites_owner_session');
    assert.equal(session?.value, 'connect.sid=rotated');
    assert.equal(session?.httpOnly, true);
    assert.equal(
      ((await logged.json()) as { session?: string }).session,
      undefined,
    );
    assert.equal(calls[1].headers.get('X-CSRF-Token'), 'csrf-1');
    assert.equal(calls[2].headers.get('Cookie'), 'connect.sid=rotated');
    assert.equal(csrfCalls, 2);
    const path = 'owner/businesses/1/trucks/2/bookings/abc/accept';
    const decided = await POST(
      request(
        path,
        {},
        {
          Cookie: `humbites_owner_session=${encodeURIComponent(session!.value)}`,
        },
      ),
      context(path),
    );
    assert.equal(decided.status, 200);
    assert.equal(calls.at(-1)?.headers.get('X-CSRF-Token'), 'csrf-3');
  }));
test('successful bodyless menu/assignment/media mutations remain 204', async () =>
  environment(async () => {
    globalThis.fetch = async (input) =>
      String(input).endsWith('/auth/csrf')
        ? Response.json({ csrfToken: 'test-csrf' })
        : new Response(null, { status: 204 });
    for (const [method, path] of [
      ['DELETE', 'owner/businesses/1/trucks/2/menu/3'],
      ['PUT', 'owner/businesses/1/trucks/2/menu/3/assignment'],
      ['DELETE', 'owner/businesses/1/trucks/2/media/images/9'],
    ]) {
      const req = new NextRequest(`${origin}/api/booking/${path}`, {
        method,
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: 'humbites_owner_session=connect.sid%3Dtest',
        },
        body: '{}',
      });
      const result = await (method === 'DELETE' ? DELETE : PUT)(
        req,
        context(path),
      );
      assert.equal(result.status, 204);
      assert.equal(await result.text(), '');
    }
  }));
test('production live requires canonical HTTPS and forwards only configured protocol for secure sessions', async () =>
  environment(async () => {
    const previous = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: 'production' });
    try {
      await assert.rejects(() => backendFetch('auth/csrf'), /sikre adresse/);
      process.env.SITE_URL = 'http://example.test';
      await assert.rejects(() => backendFetch('auth/csrf'), /sikker adresse/);
      process.env.SITE_URL = 'https://food.example.test';
      let calls = 0;
      globalThis.fetch = async (input, options) => {
        calls++;
        const headers = new Headers(options?.headers);
        assert.equal(headers.get('X-Forwarded-Proto'), 'https');
        assert.equal(headers.get('X-Forwarded-Host'), 'food.example.test');
        assert.equal(headers.get('Origin'), 'https://food.example.test');
        assert.equal(headers.get('X-Forwarded-For'), null);
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/csrf'))
          return Response.json(
            { csrfToken: 'csrf' },
            {
              headers: {
                'Set-Cookie':
                  'connect.sid=secure-session; Secure; HttpOnly; Path=/',
              },
            },
          );
        if (path.endsWith('/login'))
          return new Response(null, {
            status: 302,
            headers: {
              Location: '/v1/auth/login-success',
              'Set-Cookie':
                'connect.sid=rotated-secure; Secure; HttpOnly; Path=/',
            },
          });
        return Response.json({ data: { id: 1, email: 'owner@example.test' } });
      };
      const logged = await POST(
        request('owner/login', {
          email: 'owner@example.test',
          password: 'test-only',
        }),
        context('owner/login'),
      );
      assert.equal(logged.status, 200);
      assert.equal(logged.cookies.get('humbites_owner_session')?.secure, true);
      assert.equal(calls, 4);
    } finally {
      if (previous === undefined)
        Reflect.deleteProperty(process.env, 'NODE_ENV');
      else Object.assign(process.env, { NODE_ENV: previous });
    }
  }));
