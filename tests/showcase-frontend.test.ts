import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/mapbox/config/route';
import { ensureShowcaseSession } from '../lib/booking/showcase-client';
import { isShowcase } from '../lib/booking/showcase';

test('showcase mode is explicit and public map configuration never uses a server token', async () => {
  assert.equal(isShowcase(''), false);
  assert.equal(isShowcase('true'), true);
  assert.equal(isShowcase('false'), false);
  const publicValue = process.env.MAPBOX_PUBLIC_TOKEN,
    serverValue = process.env.MAPBOX_ACCESS_TOKEN;
  try {
    delete process.env.MAPBOX_PUBLIC_TOKEN;
    process.env.MAPBOX_ACCESS_TOKEN = 'pk.server-fixture';
    assert.deepEqual(await GET().json(), { publicToken: '' });
    process.env.MAPBOX_PUBLIC_TOKEN = 'sk.never-public';
    assert.deepEqual(await GET().json(), { publicToken: '' });
    process.env.MAPBOX_PUBLIC_TOKEN = 'pk.browser-fixture';
    assert.deepEqual(await GET().json(), { publicToken: 'pk.browser-fixture' });
    assert.equal(GET().headers.get('cache-control'), 'no-store');
  } finally {
    if (publicValue === undefined) delete process.env.MAPBOX_PUBLIC_TOKEN;
    else process.env.MAPBOX_PUBLIC_TOKEN = publicValue;
    if (serverValue === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
    else process.env.MAPBOX_ACCESS_TOKEN = serverValue;
  }
});

test('concurrent showcase initialization reuses one request and failed initialization can retry', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let release: () => void = () => {};
  try {
    globalThis.fetch = async () => {
      calls++;
      throw new Error('fixture offline');
    };
    await assert.rejects(ensureShowcaseSession());
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = async (input, options) => {
      calls++;
      assert.equal(input, '/api/booking/demo/session');
      assert.equal(options?.credentials, 'same-origin');
      await gate;
      return Response.json({ showcase: true });
    };
    const first = ensureShowcaseSession();
    const second = ensureShowcaseSession();
    assert.equal(first, second);
    release();
    await Promise.all([first, second]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
