import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  backendFetch,
  BackendError,
  loadCatalogue,
  canonicalOrigin,
} from '@/lib/booking/server';
import { getMode } from '@/lib/booking/mode';
import {
  resolveTarget,
  sameOrigin,
  guestCookie,
  validToken,
  permittedQuery,
} from '@/lib/booking/proxy-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ownerCookie = 'humbites_owner_session';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response = (body: unknown, status = 200) =>
  status === 204
    ? new NextResponse(null, {
        status,
        headers: { 'Cache-Control': 'no-store' },
      })
    : NextResponse.json(body, {
        status,
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      });
const failure = (status: number, code: string, message: string) =>
  response({ error: { code, message } }, status);
const cookieOptions = (request: Request) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: (canonicalOrigin() ?? new URL(request.url)).protocol === 'https:',
  path: '/api/booking',
  maxAge: 60 * 60 * 24 * 30,
});
function setCookie(
  result: NextResponse,
  request: Request,
  name: string,
  value: string,
  maxAge?: number,
) {
  result.cookies.set(name, value, {
    ...cookieOptions(request),
    ...(maxAge === undefined ? {} : { maxAge }),
  });
}
async function jsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new BackendError(
      400,
      'INVALID_INPUT',
      'Send opplysningene som JSON.',
    );
  const reader = request.body?.getReader();
  if (!reader) return {};
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 65536) {
        await reader.cancel();
        throw new BackendError(
          413,
          'BODY_TOO_LARGE',
          'Opplysningene er for lange.',
        );
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BackendError(400, 'INVALID_INPUT', 'Kontroller opplysningene.');
  }
}
function captureSession(upstream: Response, current = '') {
  for (const cookie of upstream.headers.getSetCookie()) {
    const pair = cookie.split(';')[0];
    if (pair.startsWith('connect.sid=')) return pair;
  }
  return current;
}
async function csrf(
  session: string,
): Promise<{ token: string; session: string }> {
  const result = await backendFetch('auth/csrf', {
    headers: session ? { Cookie: session } : {},
  });
  if (!result.ok)
    throw new BackendError(
      502,
      'AUTH_UNAVAILABLE',
      'Innlogging er ikke tilgjengelig akkurat nå.',
    );
  const data = (await result.json()) as { csrfToken: string };
  return { token: data.csrfToken, session: captureSession(result, session) };
}
async function upstreamJson(upstream: Response) {
  if (upstream.status === 204) return null;
  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    throw new BackendError(
      502,
      'INVALID_RESPONSE',
      'Tjenesten ga et svar vi ikke kunne bruke.',
    );
  }
  if (upstream.status >= 500)
    return {
      error: {
        code: upstream.status === 503 ? 'UNAVAILABLE' : 'UPSTREAM',
        message:
          'Tjenesten er ikke tilgjengelig akkurat nå. Prøv igjen senere.',
      },
    };
  return body;
}
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join('/');
  const method = request.method;
  const query = permittedQuery(method, path, request.nextUrl.searchParams);
  if (query === null)
    return failure(400, 'INVALID_INPUT', 'Ugyldige URL-parametere.');
  if (method !== 'GET' && !sameOrigin(request))
    return failure(403, 'ORIGIN_REJECTED', 'Last siden på nytt og prøv igjen.');
  try {
    if (method === 'GET' && path === 'catalogue')
      return response({ trucks: await loadCatalogue() });
    if (method === 'POST' && path === 'catalogue/search') {
      const body = await jsonBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return failure(400, 'INVALID_INPUT', 'Kontroller søket.');
      return response({
        trucks: await loadCatalogue(body as Record<string, unknown>),
      });
    }
    if (getMode() === 'demo')
      return failure(
        409,
        'DEMO_MODE',
        'Denne handlingen er ikke aktiv i demoen.',
      );
    if (method === 'POST' && path === 'drafts') {
      const body = (await jsonBody(request)) as { draftId?: unknown };
      if (typeof body.draftId !== 'string' || !uuid.test(body.draftId))
        return failure(400, 'INVALID_INPUT', 'Ugyldig forespørselsutkast.');
      const name = `humbites_draft_${body.draftId}`;
      const token = request.cookies.get(name)?.value;
      const result = response({ ready: true });
      if (!validToken(token))
        setCookie(
          result,
          request,
          name,
          randomBytes(32).toString('base64url'),
          86400,
        );
      return result;
    }
    const access = path.match(/^requests\/([A-Za-z0-9_-]{1,80})\/access$/);
    if (method === 'POST' && access) {
      const body = (await jsonBody(request)) as { token?: unknown };
      const token =
        body.token ?? request.cookies.get(guestCookie(access[1]))?.value;
      if (!validToken(token))
        return failure(
          401,
          'ACCESS_REQUIRED',
          'Åpne den private kvitteringslenken for å se forespørselen.',
        );
      const upstream = await backendFetch(`bookings/${access[1]}`, {
        headers: { 'X-Booking-Token': token },
      });
      const result = response(
        upstream.ok ? { token } : await upstreamJson(upstream),
        upstream.status,
      );
      if (upstream.ok)
        setCookie(result, request, guestCookie(access[1]), token);
      return result;
    }
    if (path === 'owner/login' && method === 'POST') {
      const body = await jsonBody(request);
      const initial = await csrf('');
      const login = await backendFetch('auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: initial.session,
          'X-CSRF-Token': initial.token,
        },
        body: JSON.stringify(body),
      });
      const session = captureSession(login, initial.session);
      if (
        ![200, 302, 303].includes(login.status) ||
        login.headers.get('location')?.includes('failure')
      )
        return failure(401, 'INVALID_LOGIN', 'E-post eller passord er feil.');
      const verified = await backendFetch('auth/login-success', {
        headers: { Cookie: session },
      });
      if (!verified.ok)
        return failure(401, 'INVALID_LOGIN', 'E-post eller passord er feil.');
      const refreshed = await csrf(session);
      const result = response(await upstreamJson(verified));
      setCookie(result, request, ownerCookie, refreshed.session, 60 * 60 * 8);
      return result;
    }
    const session = request.cookies.get(ownerCookie)?.value || '';
    if (path === 'owner/session' && method === 'GET') {
      if (!session)
        return failure(401, 'LOGIN_REQUIRED', 'Logg inn for å fortsette.');
      const upstream = await backendFetch('auth/login-success', {
        headers: { Cookie: session },
      });
      return response(await upstreamJson(upstream), upstream.status);
    }
    if (path === 'owner/logout' && method === 'POST') {
      if (session) {
        try {
          const security = await csrf(session);
          await backendFetch('auth/logout', {
            method: 'POST',
            headers: {
              Cookie: security.session,
              'X-CSRF-Token': security.token,
            },
          });
        } catch {
          /* Always clear this browser's credential, even if BED is unavailable. */
        }
      }
      const result = response({ ok: true });
      setCookie(result, request, ownerCookie, '', 0);
      return result;
    }
    const target = resolveTarget(method, path);
    if (!target) return failure(404, 'NOT_FOUND', 'Handlingen finnes ikke.');
    const headers: Record<string, string> = { Accept: 'application/json' };
    let token: string | undefined;
    if (target.auth === 'guest') {
      const draftId = request.headers.get('x-draft-id');
      token = target.bookingId
        ? request.cookies.get(guestCookie(target.bookingId))?.value
        : draftId && uuid.test(draftId)
          ? request.cookies.get(`humbites_draft_${draftId}`)?.value
          : undefined;
      if (!validToken(token))
        return failure(
          401,
          'ACCESS_REQUIRED',
          'Åpne den private lenken eller opprett et nytt forespørselsutkast.',
        );
      headers['X-Booking-Token'] = token;
    }
    let nextSession = session;
    if (target.auth === 'owner') {
      if (!session)
        return failure(401, 'LOGIN_REQUIRED', 'Logg inn for å fortsette.');
      if (method !== 'GET') {
        const security = await csrf(session);
        nextSession = security.session;
        headers['X-CSRF-Token'] = security.token;
      }
      headers.Cookie = nextSession;
    }
    const key = request.headers.get('idempotency-key');
    if (key) {
      if (!uuid.test(key))
        return failure(400, 'INVALID_INPUT', 'Ugyldig forespørselsnøkkel.');
      headers['Idempotency-Key'] = key;
    }
    let body: string | undefined;
    if (method !== 'GET') {
      body = JSON.stringify(await jsonBody(request));
      headers['Content-Type'] = 'application/json';
    }
    const upstream = await backendFetch(target.path + query, {
      method,
      headers,
      body,
    });
    const data = await upstreamJson(upstream);
    const result = response(data, upstream.status);
    if (target.auth === 'owner')
      setCookie(
        result,
        request,
        ownerCookie,
        captureSession(upstream, nextSession),
        60 * 60 * 8,
      );
    if (path === 'requests' && upstream.ok && validToken(token)) {
      const id = (data as { data?: { id?: unknown } })?.data?.id;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id))
        return failure(
          502,
          'INVALID_RESPONSE',
          'Kvitteringen kunne ikke leses. Prøv samme innsending igjen.',
        );
      const created = response(
        { ...(data as object), receiptToken: token },
        upstream.status,
      );
      setCookie(created, request, guestCookie(id), token);
      return created;
    }
    return result;
  } catch (error) {
    return error instanceof BackendError
      ? failure(error.status, error.code, error.message)
      : failure(
          502,
          'UPSTREAM',
          'Tjenesten er ikke tilgjengelig akkurat nå. Prøv igjen.',
        );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
