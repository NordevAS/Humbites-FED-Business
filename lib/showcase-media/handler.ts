import { MediaError, readBounded } from './format';
import {
  completeUpload,
  deleteImage,
  getImage,
  listImages,
  putUpload,
  startUpload,
  type MediaEnvironment,
  type MediaSession,
} from './storage';
export { decorateCatalogue, deleteSandboxMedia, cleanupMedia } from './storage';
export type { MediaEnvironment } from './storage';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers });
export function mediaError(error: unknown) {
  return error instanceof MediaError
    ? json(
        { error: { code: error.code, message: error.message } },
        error.status,
      )
    : json(
        {
          error: {
            code: 'MEDIA_UNAVAILABLE',
            message: 'Bildelagringen er midlertidig utilgjengelig. Prøv igjen.',
          },
        },
        503,
      );
}
export function sameOrigin(request: Request) {
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new MediaError(
      403,
      'INVALID_ORIGIN',
      'Handlingen må utføres fra denne nettsiden.',
    );
}
async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = JSON.parse(
      new TextDecoder().decode(await readBounded(request, 4096)),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof MediaError) throw error;
    throw new MediaError(400, 'INVALID_BODY', 'Forespørselen er ugyldig.');
  }
}
export async function handleMedia(
  request: Request,
  env: MediaEnvironment,
  session: MediaSession,
  path: string,
): Promise<Response> {
  try {
    if (!env.DB || !env.BUCKET)
      throw new MediaError(
        503,
        'MEDIA_UNAVAILABLE',
        'Bildelagring er ikke konfigurert.',
      );
    const match =
      /^owner\/businesses\/1\/trucks\/([A-Za-z0-9_-]{1,80})\/media\/(.+)$/.exec(
        path,
      );
    if (!match)
      throw new MediaError(404, 'NOT_FOUND', 'Bildehandlingen finnes ikke.');
    const [, truckId, action] = match;
    if (request.method !== 'GET') sameOrigin(request);
    if (action === 'images' && request.method === 'GET')
      return json({ data: await listImages(env, session, truckId) });
    const menu = /^menu\/([A-Za-z0-9_-]{1,80})\/images$/.exec(action);
    if (request.method === 'POST' && (action === 'images' || menu))
      return json(
        {
          data: await startUpload(
            env,
            session,
            truckId,
            menu?.[1] ?? null,
            await body(request),
            new URL(request.url).origin,
          ),
        },
        201,
      );
    const complete = /^uploads\/([a-f0-9-]{36})\/complete$/.exec(action);
    if (request.method === 'POST' && complete)
      return json({
        data: await completeUpload(
          env,
          session,
          complete[1],
          (await body(request)).uploadToken,
          truckId,
        ),
      });
    const remove = /^images\/([a-f0-9-]{36})$/.exec(action);
    if (request.method === 'DELETE' && remove) {
      await deleteImage(env, session, truckId, remove[1]);
      return new Response(null, { status: 204, headers });
    }
    throw new MediaError(404, 'NOT_FOUND', 'Bildehandlingen finnes ikke.');
  } catch (error) {
    return mediaError(error);
  }
}
export async function handleMediaAsset(
  request: Request,
  env: MediaEnvironment,
  session: MediaSession | null,
  path: string[],
): Promise<Response> {
  try {
    if (!session)
      throw new MediaError(
        401,
        'SESSION_REQUIRED',
        'Start demoen for å åpne dette bildet.',
      );
    if (path.length === 1 && request.method === 'GET')
      return await getImage(env, session, path[0]);
    if (path.length === 2 && path[1] === 'upload' && request.method === 'PUT') {
      sameOrigin(request);
      await putUpload(env, session, path[0], request);
      return new Response(null, { status: 204, headers });
    }
    throw new MediaError(404, 'NOT_FOUND', 'Bildehandlingen finnes ikke.');
  } catch (error) {
    return mediaError(error);
  }
}
