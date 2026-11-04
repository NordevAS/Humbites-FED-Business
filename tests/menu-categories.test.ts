import test from 'node:test';
import assert from 'node:assert/strict';
import type { FoodTruck, MenuCategory } from '../domain';
import { createTestDb } from './showcase/sqlite';
import {
  handleShowcaseRequest,
  type ShowcaseEnvironment,
} from '../lib/showcase/handler';
import {
  hashToken,
  mutateSandbox,
  type SandboxState,
} from '../lib/showcase/store';

const origin = 'https://categories.example.invalid';
const truckPath = (id = '1') => `owner/businesses/1/trucks/${id}`;
function harness() {
  const database = createTestDb();
  const env = { DB: database.db, BUCKET: {} } as ShowcaseEnvironment;
  async function visitor(owner = true) {
    const jar = new Map<string, string>();
    async function call<T = unknown>(
      path: string,
      method = 'GET',
      payload?: unknown,
      requestOrigin = origin,
    ) {
      const response = await handleShowcaseRequest(
        new Request(`${origin}/api/booking/${path}`, {
          method,
          headers: {
            Cookie: [...jar]
              .map(([key, value]) => `${key}=${value}`)
              .join('; '),
            ...(method === 'GET'
              ? {}
              : { Origin: requestOrigin, 'Content-Type': 'application/json' }),
          },
          ...(method === 'GET' ? {} : { body: JSON.stringify(payload ?? {}) }),
        }),
        env,
        path,
      );
      for (const cookie of response.headers.getSetCookie()) {
        const [key, value] = cookie.split(';')[0].split('=');
        jar.set(key, value);
      }
      const body =
        response.status === 204 ? null : ((await response.json()) as T);
      return { status: response.status, body };
    }
    await call('demo/session', 'POST');
    if (owner) await call('owner/login', 'POST');
    return {
      call,
      edit: async (change: (state: SandboxState) => void) =>
        mutateSandbox(
          database.db,
          await hashToken(jar.get('humbites_showcase')!),
          change,
        ),
    };
  }
  return { ...database, visitor };
}

test('category CRUD changes the public menu while preserving dish assignments on rename', async (t) => {
  const h = harness();
  t.after(h.close);
  const owner = await h.visitor();
  const path = `${truckPath()}/menu-categories`;
  const created = await owner.call<{ data: MenuCategory }>(path, 'POST', {
    name: '  Dessert  ',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body?.data.name, 'Dessert');
  const id = created.body!.data.id;
  assert.equal(
    (
      await owner.call(`${truckPath()}/menu/101`, 'PATCH', {
        categoryIds: [id],
      })
    ).status,
    200,
  );
  assert.equal(
    (await owner.call(`${path}/${id}`, 'PATCH', { name: 'Søtt' })).status,
    200,
  );
  const catalogue = await owner.call<{ trucks: FoodTruck[] }>('catalogue');
  assert.deepEqual(
    catalogue.body!.trucks[0].menuCategories?.find(
      (category) => category.id === id,
    ),
    { id, name: 'Søtt' },
  );
  assert.deepEqual(catalogue.body!.trucks[0].menu[0].categoryIds, [id]);
  assert.equal((await owner.call(`${path}/${id}`, 'DELETE')).status, 409);
  await owner.call(`${truckPath()}/menu/101`, 'PATCH', { enabled: false });
  assert.equal(
    (await owner.call(`${path}/${id}`, 'DELETE')).status,
    409,
    'Hidden dishes still retain their category',
  );
  await owner.call(`${truckPath()}/menu/101`, 'PATCH', { categoryIds: [] });
  assert.equal((await owner.call(`${path}/${id}`, 'DELETE')).status, 204);
});

test('categories enforce owner, business, truck, visitor and origin boundaries', async (t) => {
  const h = harness();
  t.after(h.close);
  const owner = await h.visitor();
  const guest = await h.visitor(false);
  const other = await h.visitor();
  const path = `${truckPath()}/menu-categories`;
  assert.equal((await guest.call(path)).status, 401);
  assert.equal(
    (await guest.call(path, 'POST', { name: 'Dessert' })).status,
    401,
  );
  assert.equal(
    (
      await owner.call(
        path,
        'POST',
        { name: 'Dessert' },
        'https://other.invalid',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.call('owner/businesses/2/trucks/1/menu-categories', 'POST', {
        name: 'Dessert',
      })
    ).status,
    404,
  );
  const created = await owner.call<{ data: MenuCategory }>(path, 'POST', {
    name: 'Dessert',
  });
  const id = created.body!.data.id;
  assert.equal(
    (
      await owner.call(`${truckPath('2')}/menu/201`, 'PATCH', {
        categoryIds: [id],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call(`${truckPath('2')}/menu-categories/${id}`, 'PATCH', {
        name: 'Stolen',
      })
    ).status,
    404,
  );
  assert.equal(
    (await other.call(`${path}/${id}`, 'PATCH', { name: 'Stolen' })).status,
    404,
  );
  const isolated = await other.call<{ data: MenuCategory[] }>(path);
  assert.deepEqual(isolated.body!.data, [{ id: 1, name: 'Hovedrett' }]);
});

test('category validation rejects duplicates, ambiguous IDs and unbounded input, including concurrent writes', async (t) => {
  const h = harness();
  t.after(h.close);
  const owner = await h.visitor();
  const path = `${truckPath()}/menu-categories`;
  const concurrent = await Promise.all([
    owner.call(path, 'POST', { name: 'Dessert' }),
    owner.call(path, 'POST', { name: 'DESSERT' }),
  ]);
  assert.deepEqual(
    concurrent.map((result) => result.status).sort(),
    [201, 409],
  );
  for (const name of ['', 'x'.repeat(61), 'a\nb', '\uFB03'.repeat(21)])
    assert.equal((await owner.call(path, 'POST', { name })).status, 400);
  assert.equal(
    (await owner.call(path, 'POST', { name: 'ＨＯＶＥＤＲＥＴＴ' })).status,
    409,
  );
  for (const categoryIds of [[1, 1], [0], [-1], [1.5], ['1'], [999999]])
    assert.equal(
      (await owner.call(`${truckPath()}/menu/101`, 'PATCH', { categoryIds }))
        .status,
      400,
    );
  assert.equal(
    (await owner.call(path, 'POST', { name: 'Drikke', truckId: '2' })).status,
    400,
  );
});

test('legacy sessions retain Hovedrett and an explicitly empty category list does not resurrect it', async (t) => {
  const h = harness();
  t.after(h.close);
  const owner = await h.visitor();
  const path = `${truckPath()}/menu-categories`;
  await owner.edit((state) => {
    delete state.nextCategoryId;
    for (const truck of state.trucks) delete truck.menuCategories;
  });
  const legacy = await owner.call<{ data: MenuCategory[] }>(path);
  assert.deepEqual(legacy.body!.data, [{ id: 1, name: 'Hovedrett' }]);
  await owner.edit((state) => {
    for (const item of state.trucks[0].menu) item.categoryIds = [];
  });
  assert.equal((await owner.call(`${path}/1`, 'DELETE')).status, 204);
  assert.deepEqual(
    (await owner.call<{ data: MenuCategory[] }>(path)).body!.data,
    [],
  );
  const created = await owner.call<{ data: { categoryIds: number[] } }>(
    `${truckPath()}/menu`,
    'POST',
    {
      name: 'Kaffe',
      description: 'Nybrygget kaffe',
      basePrice: 35,
    },
  );
  assert.equal(created.status, 201);
  assert.deepEqual(created.body!.data.categoryIds, []);
});

test('shared dish assignments do not copy or overwrite another truck category IDs', async (t) => {
  const h = harness();
  t.after(h.close);
  const owner = await h.visitor();
  const first = await owner.call<{ data: MenuCategory }>(
    `${truckPath()}/menu-categories`,
    'POST',
    { name: 'Dessert' },
  );
  const second = await owner.call<{ data: MenuCategory }>(
    `${truckPath('2')}/menu-categories`,
    'POST',
    { name: 'Ekstra' },
  );
  assert.notEqual(first.body!.data.id, second.body!.data.id);
  await owner.call(`${truckPath()}/menu/101`, 'PATCH', {
    categoryIds: [first.body!.data.id],
  });
  assert.equal(
    (await owner.call(`${truckPath('2')}/menu/101/assignment`, 'PUT')).status,
    204,
  );
  const before = await owner.call<{ trucks: FoodTruck[] }>('catalogue');
  assert.deepEqual(
    before.body!.trucks[1].menu.find((item) => item.id === '101')?.categoryIds,
    [],
  );
  await owner.call(`${truckPath('2')}/menu/101`, 'PATCH', {
    categoryIds: [second.body!.data.id],
  });
  const after = await owner.call<{ trucks: FoodTruck[] }>('catalogue');
  assert.deepEqual(after.body!.trucks[0].menu[0].categoryIds, [
    first.body!.data.id,
  ]);
  assert.deepEqual(
    after.body!.trucks[1].menu.find((item) => item.id === '101')?.categoryIds,
    [second.body!.data.id],
  );
});
