import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestDb } from './showcase/sqlite';
import { memoryBucket } from './showcase/media-bucket';
import {
  initializeSession,
  mutateSandbox,
  readSandbox,
  type ShowcaseSession,
} from '../lib/showcase/store';
import {
  handleMedia,
  handleMediaAsset,
  decorateCatalogue,
  cleanupMedia,
  deleteSandboxMedia,
} from '../lib/showcase-media/handler';

const origin = 'https://demo.example';
const base = 'owner/businesses/1/trucks/1/media';
const bytes = new Uint8Array(
  readFileSync(new URL('../public/humbites-mark.png', import.meta.url)),
);
type Upload = {
  uploadId: string;
  uploadToken: string;
  uploadUrl: string;
  headers: Record<string, string>;
};
async function setup(t: { after: (fn: () => void) => void }) {
  const fixture = createTestDb();
  t.after(fixture.close);
  const memory = memoryBucket();
  const env = { DB: fixture.db, BUCKET: memory.bucket };
  async function session(owner = true) {
    const initialized = await initializeSession(
      new Request(origin),
      fixture.db,
    );
    if (owner)
      await mutateSandbox(fixture.db, initialized.session.id, (state) => {
        state.owner = true;
      });
    return (await readSandbox(fixture.db, initialized.session.id))!;
  }
  return { ...fixture, ...memory, env, session, owner: await session() };
}
function control(
  method: string,
  path: string,
  body?: unknown,
  requestOrigin = origin,
) {
  return new Request(`${origin}/api/booking/${path}`, {
    method,
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function put(upload: Upload, content = bytes, token = upload.uploadToken) {
  return new Request(upload.uploadUrl, {
    method: 'PUT',
    headers: { origin, 'content-type': 'image/png', 'x-upload-token': token },
    body: content.slice().buffer,
  });
}
async function begin(
  f: Awaited<ReturnType<typeof setup>>,
  session = f.owner,
  path = base,
) {
  const suffix = path.endsWith('/images') ? '' : '/images';
  const response = await handleMedia(
    control('POST', path + suffix, {
      contentType: 'image/png',
      contentLength: bytes.length,
    }),
    f.env,
    session,
    path + suffix,
  );
  assert.equal(
    response.status,
    201,
    JSON.stringify(await response.clone().json()),
  );
  return ((await response.json()) as { data: Upload }).data;
}
async function complete(
  f: Awaited<ReturnType<typeof setup>>,
  upload: Upload,
  session = f.owner,
  path = base,
) {
  const action = `${path}/uploads/${upload.uploadId}/complete`;
  return handleMedia(
    control('POST', action, { uploadToken: upload.uploadToken }),
    f.env,
    session,
    action,
  );
}
async function publish(f: Awaited<ReturnType<typeof setup>>, upload: Upload) {
  assert.equal(
    (
      await handleMediaAsset(put(upload), f.env, f.owner, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    204,
  );
  assert.equal((await complete(f, upload)).status, 200);
}

test('upload is private until completion; display, repeat completion, catalogue update and removal work', async (t) => {
  const f = await setup(t),
    upload = await begin(f);
  assert.equal(new URL(upload.uploadUrl).origin, origin);
  assert.equal(new URL(upload.uploadUrl).search, '');
  const row = f.sqlite
    .prepare('SELECT token_hash FROM demo_media WHERE id=?')
    .get(upload.uploadId)!;
  assert.notEqual(row.token_hash, upload.uploadToken);
  assert.match(String(row.token_hash), /^[0-9a-f]{64}$/);
  assert.equal(
    (
      await handleMediaAsset(
        new Request(`${origin}/api/showcase-media/${upload.uploadId}`),
        f.env,
        f.owner,
        [upload.uploadId],
      )
    ).status,
    404,
  );
  await publish(f, upload);
  assert.equal((await complete(f, upload)).status, 200);
  const image = await handleMediaAsset(
    new Request(`${origin}/api/showcase-media/${upload.uploadId}`),
    f.env,
    f.owner,
    [upload.uploadId],
  );
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('cache-control'), 'private, no-store');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), bytes);
  const catalogue = await decorateCatalogue(
    f.db,
    f.owner.id,
    f.owner.state.trucks,
  );
  assert.equal(catalogue[0].image, `/api/showcase-media/${upload.uploadId}`);
  const list = await handleMedia(
    control('GET', base + '/images'),
    f.env,
    f.owner,
    base + '/images',
  );
  assert.equal(
    ((await list.json()) as { data: { status: string }[] }).data[0].status,
    'COMPLETED',
  );
  const path = base + '/images/' + upload.uploadId;
  assert.equal(
    (await handleMedia(control('DELETE', path), f.env, f.owner, path)).status,
    204,
  );
  assert.equal(f.objects.size, 0);
  assert.equal(
    (
      await handleMediaAsset(new Request(origin), f.env, f.owner, [
        upload.uploadId,
      ])
    ).status,
    404,
  );
  assert.equal(
    (await decorateCatalogue(f.db, f.owner.id, f.owner.state.trucks))[0].image,
    f.owner.state.trucks[0].image,
  );
});

test('session, owner role, origin, token and truck/menu scope are enforced', async (t) => {
  const f = await setup(t),
    other = await f.session(),
    guest = await f.session(false),
    upload = await begin(f);
  assert.equal(
    (
      await handleMediaAsset(put(upload), f.env, other, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    404,
  );
  assert.equal(
    (
      await handleMediaAsset(
        put(upload, bytes, 'a'.repeat(43)),
        f.env,
        f.owner,
        [upload.uploadId, 'upload'],
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleMediaAsset(put(upload), f.env, null, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    401,
  );
  assert.equal(
    (
      await handleMedia(
        control('GET', base + '/images'),
        f.env,
        guest,
        base + '/images',
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handleMedia(
        control('POST', base + '/images', {}, 'https://evil.example'),
        f.env,
        f.owner,
        base + '/images',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleMedia(
        control('POST', base + '/menu/999/images', {
          contentType: 'image/png',
          contentLength: bytes.length,
        }),
        f.env,
        f.owner,
        base + '/menu/999/images',
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handleMedia(
        control('POST', base.replace('/1/trucks', '/2/trucks') + '/images', {}),
        f.env,
        f.owner,
        base.replace('/1/trucks', '/2/trucks') + '/images',
      )
    ).status,
    404,
  );
  await publish(f, upload);
  assert.equal(
    (
      await handleMediaAsset(new Request(origin), f.env, other, [
        upload.uploadId,
      ])
    ).status,
    404,
  );
  assert.equal((await complete(f, upload, other)).status, 404);
  const wrong = base.replace('/trucks/1/', '/trucks/2/');
  assert.equal((await complete(f, upload, f.owner, wrong)).status, 404);
});

test('declared size, actual MIME, corrupt content and overwritten uploads are rejected', async (t) => {
  const f = await setup(t),
    upload = await begin(f);
  assert.equal(
    (
      await handleMediaAsset(put(upload, bytes.slice(0, -1)), f.env, f.owner, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    400,
  );
  const corrupt = bytes.slice();
  corrupt[0] = 60;
  assert.equal(
    (
      await handleMediaAsset(put(upload, corrupt), f.env, f.owner, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    400,
  );
  assert.equal(f.objects.size, 0);
  assert.equal((await complete(f, upload)).status, 409);
  await publish(f, upload);
  assert.equal(
    (
      await handleMediaAsset(put(upload), f.env, f.owner, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    409,
  );
  assert.equal(f.objects.size, 1);
});

test('concurrent admissions reserve five truck slots atomically, including pending uploads', async (t) => {
  const f = await setup(t),
    path = base + '/images';
  const responses = await Promise.all(
    Array.from({ length: 6 }, () =>
      handleMedia(
        control('POST', path, {
          contentType: 'image/png',
          contentLength: bytes.length,
        }),
        f.env,
        f.owner,
        path,
      ),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 201, 201, 201, 201, 409],
  );
  assert.equal(
    f.sqlite.prepare('SELECT COUNT(*) AS count FROM demo_media').get()!.count,
    5,
  );
  assert.equal(f.objects.size, 0);
});

test('menu images replace earlier versions, decorate menu items, and reject removed assignments', async (t) => {
  const f = await setup(t);
  const first = await begin(f, f.owner, base + '/menu/101/images');
  await publish(f, first);
  const second = await begin(f, f.owner, base + '/menu/101/images');
  await publish(f, second);
  assert.equal(
    (await decorateCatalogue(f.db, f.owner.id, f.owner.state.trucks))[0].menu[0]
      .image,
    `/api/showcase-media/${second.uploadId}`,
  );
  assert.equal(
    f.sqlite.prepare('SELECT COUNT(*) AS count FROM demo_media').get()!.count,
    1,
  );
  assert.equal(f.objects.size, 1);
  const pending = await begin(f, f.owner, base + '/menu/102/images');
  await mutateSandbox(f.db, f.owner.id, (state) => {
    state.trucks[0].menu = state.trucks[0].menu.filter(
      (item) => item.id !== '102',
    );
  });
  assert.equal(
    (
      await handleMediaAsset(put(pending), f.env, f.owner, [
        pending.uploadId,
        'upload',
      ])
    ).status,
    404,
  );
});

test('expiry denies access immediately; bounded cleanup removes metadata and orphan storage objects', async (t) => {
  const f = await setup(t),
    upload = await begin(f);
  await publish(f, upload);
  const past = Date.now() - 1000;
  f.sqlite.prepare('UPDATE demo_media SET expires_at=?').run(past);
  f.objects.set(`demo-staging/${past}-${crypto.randomUUID()}`, bytes);
  f.objects.set(`demo-images/${past}-${crypto.randomUUID()}`, bytes);
  assert.equal(
    (
      await handleMediaAsset(new Request(origin), f.env, f.owner, [
        upload.uploadId,
      ])
    ).status,
    404,
  );
  await cleanupMedia(f.env);
  assert.equal(f.objects.size, 0);
  assert.equal(
    f.sqlite.prepare('SELECT COUNT(*) AS count FROM demo_media').get()!.count,
    0,
  );
});

test('reset revokes completed images and a concurrently uploading object cannot reappear', async (t) => {
  const f = await setup(t),
    first = await begin(f);
  await publish(f, first);
  const upload = await begin(f);
  let release!: () => void, entered!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.hooks.beforePut = async (key) => {
    if (key.startsWith('demo-staging/')) {
      entered();
      await wait;
    }
  };
  const inFlight = handleMediaAsset(put(upload), f.env, f.owner, [
    upload.uploadId,
    'upload',
  ]);
  await reached;
  await deleteSandboxMedia(f.env, f.owner.id);
  release();
  assert.equal((await inFlight).status, 409);
  assert.equal(f.objects.size, 0);
  assert.equal(
    f.sqlite.prepare('SELECT COUNT(*) AS count FROM demo_media').get()!.count,
    0,
  );
});

test('failed object write remains safely retryable, and unsigned PUT with no Origin is rejected', async (t) => {
  const f = await setup(t),
    upload = await begin(f);
  f.hooks.beforePut = async () => {
    throw new Error('fixture storage outage');
  };
  assert.equal(
    (
      await handleMediaAsset(put(upload), f.env, f.owner, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    503,
  );
  assert.equal(
    f.sqlite.prepare('SELECT status FROM demo_media').get()!.status,
    'PENDING',
  );
  assert.equal(f.objects.size, 0);
  const request = put(upload);
  request.headers.delete('origin');
  assert.equal(
    (
      await handleMediaAsset(request, f.env, f.owner, [
        upload.uploadId,
        'upload',
      ])
    ).status,
    403,
  );
  delete f.hooks.beforePut;
  await publish(f, upload);
});

test('reset deletes only its own sandbox images and preserves failed deletion metadata for cleanup', async (t) => {
  const f = await setup(t),
    first = await begin(f);
  await publish(f, first);
  const other = await f.session(),
    second = await begin(f, other);
  assert.equal(
    (
      await handleMediaAsset(put(second), f.env, other, [
        second.uploadId,
        'upload',
      ])
    ).status,
    204,
  );
  assert.equal((await complete(f, second, other)).status, 200);
  f.hooks.beforeDelete = async () => {
    throw new Error('fixture deletion outage');
  };
  await assert.rejects(
    deleteSandboxMedia(f.env, f.owner.id),
    /fixture deletion outage/,
  );
  const retained = f.sqlite
    .prepare('SELECT status,expires_at FROM demo_media WHERE id=?')
    .get(first.uploadId)!;
  assert.equal(retained.status, 'DELETING');
  assert.ok(Number(retained.expires_at) <= Date.now());
  assert.equal(
    (
      await handleMediaAsset(new Request(origin), f.env, f.owner, [
        first.uploadId,
      ])
    ).status,
    404,
  );
  assert.equal(
    (
      await handleMediaAsset(new Request(origin), f.env, other, [
        second.uploadId,
      ])
    ).status,
    200,
  );
  delete f.hooks.beforeDelete;
  await cleanupMedia(f.env);
  assert.equal(f.objects.size, 1);
  assert.equal(
    f.sqlite.prepare('SELECT sandbox_id FROM demo_media').get()!.sandbox_id,
    other.id,
  );
});

test('overlapping PUTs never overwrite a completed object and expose no staging URL', async (t) => {
  const f = await setup(t),
    upload = await begin(f);
  const results = await Promise.all([
    handleMediaAsset(put(upload), f.env, f.owner, [upload.uploadId, 'upload']),
    handleMediaAsset(put(upload), f.env, f.owner, [upload.uploadId, 'upload']),
  ]);
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [204, 409],
  );
  const completed = await complete(f, upload);
  assert.equal(completed.status, 200);
  const text = await completed.text();
  assert.ok(!text.includes('demo-staging'));
  assert.ok(!text.includes('demo-images'));
  assert.equal(f.objects.size, 1);
});
