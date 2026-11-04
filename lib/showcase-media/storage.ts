import type { FoodTruck } from '@/domain';
import type { ShowcaseDatabase, ShowcaseSession } from '@/lib/showcase/store';
import { hashToken, opaqueToken, readSandbox } from '@/lib/showcase/store';
import {
  IMAGE_MIMES,
  inspectImage,
  MAX_IMAGE_BYTES,
  MediaError,
  readBounded,
} from './format';

export interface MediaEnvironment {
  DB: ShowcaseDatabase;
  BUCKET: Pick<R2Bucket, 'get' | 'put' | 'delete' | 'list'>;
}
export type MediaSession = Pick<
  ShowcaseSession,
  'id' | 'owner' | 'expiresAt' | 'state'
>;
type MediaRow = {
  id: string;
  sandbox_id: string;
  truck_id: string;
  item_id: string | null;
  staging_key: string;
  published_key: string;
  mime: string;
  size: number;
  status: string;
  token_hash: string;
  expires_at: number;
  retain_until: number;
  created_at: number;
  updated_at: number;
  width: number | null;
  height: number | null;
};
const PENDING_TTL = 10 * 60 * 1000;
const SESSION_MAX_BYTES = 50 * 1024 * 1024;
const ASSET_PATH = '/api/showcase-media/';
const uuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
const notFound = () =>
  new MediaError(404, 'NOT_FOUND', 'Bildet finnes ikke i denne demoøkten.');
const busy = () =>
  new MediaError(
    409,
    'UPLOAD_BUSY',
    'En bildehandling pågår allerede. Prøv igjen om litt.',
  );

export function assertMediaScope(
  session: MediaSession,
  truckId: string,
  itemId?: string | null,
) {
  if (!session.owner || session.expiresAt <= Date.now())
    throw new MediaError(
      401,
      'OWNER_REQUIRED',
      'Åpne eierdemoen for å endre bilder.',
    );
  const truck = session.state.trucks.find((x) => x.id === truckId);
  if (!truck || (itemId && !truck.menu.some((x) => x.id === itemId)))
    throw notFound();
}
async function record(
  env: MediaEnvironment,
  session: MediaSession,
  id: string,
) {
  if (!uuid(id)) throw notFound();
  const row = await env.DB.prepare(
    'SELECT * FROM demo_media WHERE id=? AND sandbox_id=? AND expires_at>?',
  )
    .bind(id, session.id, Date.now())
    .first<MediaRow>();
  if (!row) throw notFound();
  return row;
}
async function currentOwner(
  env: MediaEnvironment,
  session: MediaSession,
  row: MediaRow,
) {
  const current = await readSandbox(env.DB, session.id);
  if (!current) throw notFound();
  assertMediaScope(current, row.truck_id, row.item_id);
}
async function verifyToken(row: MediaRow, value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(value) ||
    (await hashToken(value)) !== row.token_hash
  )
    throw new MediaError(
      403,
      'INVALID_UPLOAD_TOKEN',
      'Opplastingen kunne ikke bekreftes. Start på nytt.',
    );
}
async function transition(
  env: MediaEnvironment,
  row: MediaRow,
  from: string,
  to: string,
) {
  const result = await env.DB.prepare(
    'UPDATE demo_media SET status=?,updated_at=? WHERE id=? AND sandbox_id=? AND status=? AND expires_at>?',
  )
    .bind(to, Date.now(), row.id, row.sandbox_id, from, Date.now())
    .run();
  if (result.meta.changes !== 1) throw busy();
}

export async function startUpload(
  env: MediaEnvironment,
  session: MediaSession,
  truckId: string,
  itemId: string | null,
  body: Record<string, unknown>,
  origin: string,
) {
  assertMediaScope(session, truckId, itemId);
  if (
    !IMAGE_MIMES.includes(body.contentType as (typeof IMAGE_MIMES)[number]) ||
    !Number.isSafeInteger(body.contentLength) ||
    (body.contentLength as number) < 1 ||
    (body.contentLength as number) > MAX_IMAGE_BYTES
  )
    throw new MediaError(
      400,
      'INVALID_UPLOAD',
      'Velg JPEG, PNG eller WebP på maksimalt 5 MiB.',
    );
  await cleanupMedia(env);
  const id = crypto.randomUUID(),
    token = opaqueToken(),
    now = Date.now();
  const expires = Math.min(now + PENDING_TTL, session.expiresAt);
  const stagingKey = `demo-staging/${expires}-${id}`;
  const publishedKey = `demo-images/${session.expiresAt}-${id}`;
  // One atomic admission query reserves quota before any bytes enter R2.
  const inserted = await env.DB.prepare(
    `INSERT INTO demo_media
    (id,sandbox_id,truck_id,item_id,staging_key,published_key,mime,size,status,token_hash,expires_at,retain_until,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,'PENDING',?,?,?,?,?
    WHERE (SELECT COUNT(*) FROM demo_media)<500
      AND (SELECT COUNT(*) FROM demo_media WHERE sandbox_id=?)<60
      AND (SELECT COUNT(*) FROM demo_media WHERE sandbox_id=? AND status<>'COMPLETED')<8
      AND COALESCE((SELECT SUM(size) FROM demo_media WHERE sandbox_id=?),0)+?<=?
      AND (SELECT COUNT(*) FROM demo_media WHERE sandbox_id=? AND truck_id=? AND item_id IS ?)<?`,
  )
    .bind(
      id,
      session.id,
      truckId,
      itemId,
      stagingKey,
      publishedKey,
      body.contentType,
      body.contentLength,
      await hashToken(token),
      expires,
      session.expiresAt,
      now,
      now,
      session.id,
      session.id,
      session.id,
      body.contentLength,
      SESSION_MAX_BYTES,
      session.id,
      truckId,
      itemId,
      itemId ? 2 : 5,
    )
    .run();
  if (inserted.meta.changes !== 1)
    throw new MediaError(
      409,
      'IMAGE_LIMIT',
      'Bildegrensen er nådd. Fjern et bilde eller nullstill demoen før du fortsetter.',
    );
  return {
    id,
    uploadId: id,
    uploadToken: token,
    uploadUrl: new URL(`${ASSET_PATH}${id}/upload`, origin).href,
    headers: {
      'Content-Type': body.contentType as string,
      'X-Upload-Token': token,
    },
    expiresAt: new Date(expires).toISOString(),
    status: 'PENDING',
  };
}

export async function putUpload(
  env: MediaEnvironment,
  session: MediaSession,
  id: string,
  request: Request,
) {
  const row = await record(env, session, id);
  assertMediaScope(session, row.truck_id, row.item_id);
  await verifyToken(row, request.headers.get('x-upload-token'));
  if (row.status !== 'PENDING') throw busy();
  if (request.headers.get('content-type')?.split(';')[0].trim() !== row.mime)
    throw new MediaError(
      400,
      'INVALID_IMAGE',
      'Filtypen stemmer ikke med opplastingen.',
    );
  await transition(env, row, 'PENDING', 'UPLOADING');
  try {
    const bytes = await readBounded(request, MAX_IMAGE_BYTES);
    if (bytes.length !== row.size)
      throw new MediaError(
        400,
        'IMAGE_SIZE',
        'Bildestørrelsen stemmer ikke med opplastingen.',
      );
    const info = inspectImage(bytes, row.mime);
    await currentOwner(env, session, row);
    await env.BUCKET.put(row.staging_key, bytes, {
      httpMetadata: { contentType: row.mime },
      customMetadata: { expiresAt: String(row.expires_at) },
    });
    const result = await env.DB.prepare(
      `UPDATE demo_media SET status='UPLOADED',width=?,height=?,updated_at=? WHERE id=? AND sandbox_id=? AND status='UPLOADING' AND expires_at>?`,
    )
      .bind(info.width, info.height, Date.now(), row.id, session.id, Date.now())
      .run();
    if (result.meta.changes !== 1) {
      await env.BUCKET.delete(row.staging_key);
      throw busy();
    }
  } catch (error) {
    await env.BUCKET.delete(row.staging_key);
    await env.DB.prepare(
      `UPDATE demo_media SET status='PENDING',updated_at=? WHERE id=? AND sandbox_id=? AND status='UPLOADING'`,
    )
      .bind(Date.now(), row.id, session.id)
      .run();
    throw error;
  }
}

export async function completeUpload(
  env: MediaEnvironment,
  session: MediaSession,
  id: string,
  token: unknown,
  truckId: string,
) {
  const row = await record(env, session, id);
  if (row.truck_id !== truckId) throw notFound();
  assertMediaScope(session, row.truck_id, row.item_id);
  await verifyToken(row, token);
  if (row.status === 'COMPLETED')
    return { url: `${ASSET_PATH}${id}`, status: 'COMPLETED' };
  if (row.status !== 'UPLOADED')
    throw new MediaError(
      409,
      'UPLOAD_NOT_READY',
      'Last opp bildefilen før du bekrefter den.',
    );
  await transition(env, row, 'UPLOADED', 'COMPLETING');
  let completed = false;
  try {
    const staged = await env.BUCKET.get(row.staging_key);
    if (!staged || staged.size !== row.size || staged.size > MAX_IMAGE_BYTES)
      throw new MediaError(
        400,
        'INVALID_IMAGE',
        'Bildefilen mangler eller har feil størrelse.',
      );
    const bytes = new Uint8Array(await staged.arrayBuffer());
    inspectImage(bytes, row.mime);
    await currentOwner(env, session, row);
    await env.BUCKET.put(row.published_key, bytes, {
      httpMetadata: { contentType: row.mime },
      customMetadata: { expiresAt: String(row.retain_until) },
    });
    const result = await env.DB.prepare(
      `UPDATE demo_media SET status='COMPLETED',expires_at=retain_until,updated_at=? WHERE id=? AND sandbox_id=? AND status='COMPLETING' AND expires_at>?`,
    )
      .bind(Date.now(), row.id, session.id, Date.now())
      .run();
    if (result.meta.changes !== 1) throw busy();
    completed = true;
  } finally {
    if (!completed) {
      await env.BUCKET.delete(row.published_key);
      await env.DB.prepare(
        `UPDATE demo_media SET status='UPLOADED',updated_at=? WHERE id=? AND sandbox_id=? AND status='COMPLETING'`,
      )
        .bind(Date.now(), row.id, session.id)
        .run();
    }
  }
  // Visibility already committed. Failed staging cleanup is harmless and retryable by TTL cleanup.
  await env.BUCKET.delete(row.staging_key).catch(() => undefined);
  if (row.item_id) {
    const previous = await env.DB.prepare(
      `SELECT * FROM demo_media WHERE sandbox_id=? AND truck_id=? AND item_id=? AND id<>? AND status='COMPLETED' AND (created_at<? OR (created_at=? AND id<?))`,
    )
      .bind(
        session.id,
        row.truck_id,
        row.item_id,
        id,
        row.created_at,
        row.created_at,
        id,
      )
      .all<MediaRow>();
    for (const old of previous.results)
      await removeRow(env, old).catch(() => undefined);
  }
  return { url: `${ASSET_PATH}${id}`, status: 'COMPLETED' };
}

export async function listImages(
  env: MediaEnvironment,
  session: MediaSession,
  truckId: string,
) {
  assertMediaScope(session, truckId);
  await cleanupMedia(env);
  const rows = await env.DB.prepare(
    'SELECT * FROM demo_media WHERE sandbox_id=? AND truck_id=? AND item_id IS NULL AND expires_at>? ORDER BY created_at,id',
  )
    .bind(session.id, truckId, Date.now())
    .all<MediaRow>();
  return rows.results.map((row, index) => ({
    id: row.id,
    status: row.status,
    sortOrder: index,
    url: row.status === 'COMPLETED' ? `${ASSET_PATH}${row.id}` : null,
  }));
}

async function removeRow(env: MediaEnvironment, row: MediaRow) {
  const result = await env.DB.prepare(
    `UPDATE demo_media SET status='DELETING',updated_at=? WHERE id=? AND sandbox_id=? AND status NOT IN ('UPLOADING','COMPLETING')`,
  )
    .bind(Date.now(), row.id, row.sandbox_id)
    .run();
  if (result.meta.changes !== 1) throw busy();
  await env.BUCKET.delete([row.staging_key, row.published_key]);
  await env.DB.prepare(
    `DELETE FROM demo_media WHERE id=? AND sandbox_id=? AND status='DELETING'`,
  )
    .bind(row.id, row.sandbox_id)
    .run();
}
export async function deleteImage(
  env: MediaEnvironment,
  session: MediaSession,
  truckId: string,
  id: string,
) {
  const row = await record(env, session, id);
  if (row.truck_id !== truckId) throw notFound();
  assertMediaScope(session, truckId, row.item_id);
  await removeRow(env, row);
}

export async function getImage(
  env: MediaEnvironment,
  session: MediaSession,
  id: string,
): Promise<Response> {
  const row = await record(env, session, id);
  if (
    row.status !== 'COMPLETED' ||
    !session.state.trucks.some(
      (truck) =>
        truck.id === row.truck_id &&
        (!row.item_id || truck.menu.some((item) => item.id === row.item_id)),
    )
  )
    throw notFound();
  const object = await env.BUCKET.get(row.published_key);
  if (!object) throw notFound();
  return new Response(object.body, {
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(row.size),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Disposition': 'inline',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function decorateCatalogue(
  db: ShowcaseDatabase,
  sandboxId: string,
  trucks: FoodTruck[],
): Promise<FoodTruck[]> {
  const rows = await db
    .prepare(
      `SELECT id,truck_id,item_id FROM demo_media WHERE sandbox_id=? AND status='COMPLETED' AND expires_at>? ORDER BY created_at DESC,id DESC`,
    )
    .bind(sandboxId, Date.now())
    .all<Pick<MediaRow, 'id' | 'truck_id' | 'item_id'>>();
  return trucks.map((truck) => {
    const image = rows.results.find(
      (row) => row.truck_id === truck.id && !row.item_id,
    );
    return {
      ...truck,
      ...(image
        ? {
            image: `${ASSET_PATH}${image.id}`,
            imageAlt: `Eget demobilde for ${truck.name}`,
          }
        : {}),
      menu: truck.menu.map((item) => {
        const photo = rows.results.find(
          (row) => row.truck_id === truck.id && row.item_id === item.id,
        );
        return photo
          ? { ...item, image: `${ASSET_PATH}${photo.id}` }
          : { ...item };
      }),
    };
  });
}

/** Bounded, opportunistic cleanup; expiration blocks reads even when no traffic runs cleanup. */
export async function cleanupMedia(env: MediaEnvironment, now = Date.now()) {
  const rows = await env.DB.prepare(
    'SELECT * FROM demo_media WHERE expires_at<=? ORDER BY expires_at LIMIT 20',
  )
    .bind(now)
    .all<MediaRow>();
  for (const row of rows.results) {
    await env.BUCKET.delete([row.staging_key, row.published_key]);
    await env.DB.prepare('DELETE FROM demo_media WHERE id=? AND expires_at<=?')
      .bind(row.id, now)
      .run();
  }
  // Timestamp-ordered keys also reclaim orphan objects after a process dies between R2 and D1 writes.
  for (const prefix of ['demo-staging/', 'demo-images/']) {
    const objects = await env.BUCKET.list({ prefix, limit: 25 });
    const expired = objects.objects
      .filter((object) => {
        const match = /^demo-(?:staging|images)\/(\d{13})-/.exec(object.key);
        return match && Number(match[1]) <= now;
      })
      .map((object) => object.key);
    if (expired.length) await env.BUCKET.delete(expired);
  }
}

export async function deleteSandboxMedia(
  env: MediaEnvironment,
  sandboxId: string,
) {
  const rows = await env.DB.prepare(
    'SELECT * FROM demo_media WHERE sandbox_id=? LIMIT 60',
  )
    .bind(sandboxId)
    .all<MediaRow>();
  if (!rows.results.length) return;
  const ids = rows.results.map((row) => row.id),
    placeholders = ids.map(() => '?').join(',');
  // Revoke visibility first; preserve expired tombstones if R2 deletion fails so cleanup can retry.
  // In-flight writes fail their conditional commit and remove their own object.
  await env.DB.prepare(
    `UPDATE demo_media SET status='DELETING',expires_at=?,updated_at=? WHERE sandbox_id=? AND id IN (${placeholders})`,
  )
    .bind(Date.now(), Date.now(), sandboxId, ...ids)
    .run();
  await env.BUCKET.delete(
    rows.results.flatMap((row) => [row.staging_key, row.published_key]),
  );
  await env.DB.prepare(
    `DELETE FROM demo_media WHERE sandbox_id=? AND id IN (${placeholders}) AND status='DELETING'`,
  )
    .bind(sandboxId, ...ids)
    .run();
}
