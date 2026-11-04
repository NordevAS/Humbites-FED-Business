import { z, ZodError } from 'zod';
import type { Payment } from '@/lib/booking/types';
import {
  handleMedia,
  decorateCatalogue,
  deleteSandboxMedia,
} from '@/lib/showcase-media/handler';
import {
  BookingError,
  eventSchema,
  ownerBookingListSchema,
} from './validation';
import {
  makeShowcaseQuote,
  createShowcaseBooking,
  transitionShowcaseBooking,
  requireOwner,
  assertBusiness,
  findBooking,
  ownerPage,
  ownerOverview,
  setSettings,
  patchGeneralSettings,
  setSchedule,
  previewSchedule,
  editMenu,
  editMenuCategory,
  paymentAction,
  checkAvailability,
} from './service';
import { normalizeSchedule } from './schedule';
import {
  SESSION_COOKIE,
  TTL_SECONDS,
  allergens,
  opaqueToken,
  validToken,
  hashToken,
  cookieValue,
  initializeSession,
  resolveShowcaseSession,
  readSandbox,
  mutateSandbox,
  fixtureState,
  publicTrucks,
  menuCategoriesFor,
  bookingDTO,
  receiptSession,
  saveReceipt,
  assertTruck,
  assertMenu,
  type ShowcaseDatabase,
  type ShowcaseSession,
  type StoredBooking,
} from './store';

export interface ShowcaseEnvironment {
  DB: ShowcaseDatabase;
  BUCKET: R2Bucket;
}
const response = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Humbites-Mode': 'showcase',
    },
  });
function cookie(
  result: Response,
  request: Request,
  name: string,
  value: string,
  maxAge = TTL_SECONDS,
) {
  result.headers.append(
    'Set-Cookie',
    `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
  );
}
const guestName = (id: string) => `humbites_guest_${id}`;
const ownerUser = {
  id: 'demo-owner',
  firstName: 'Demo',
  lastName: 'Eier',
  email: 'demoeier@example.invalid',
  showcase: true,
};
async function body(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new BookingError('INVALID_INPUT', 'Send opplysningene som JSON.');
  const reader = request.body?.getReader();
  if (!reader) return {};
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 65536) {
        await reader.cancel();
        throw new BookingError(
          'BODY_TOO_LARGE',
          'Opplysningene er for lange.',
          413,
        );
      }
      parts.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BookingError('INVALID_INPUT', 'Kontroller JSON-opplysningene.');
  }
}
async function guestTarget(
  request: Request,
  db: ShowcaseDatabase,
  current: ShowcaseSession | null,
  id: string,
) {
  if (current?.state.bookings[id]) return current;
  const token = cookieValue(request, guestName(id));
  const restored = token ? await receiptSession(db, id, token) : null;
  if (!restored?.state.bookings[id])
    throw new BookingError(
      'NOT_FOUND',
      'Forespørselen finnes ikke, eller tilgangen er utløpt.',
      404,
    );
  return restored;
}
const publicMenu = (session: ShowcaseSession, truckId: string) =>
  assertTruck(session.state, truckId).menu.map((item) => ({
    ...item,
    basePrice: item.priceMinor / 100,
    imageUrl: item.imageUrl || item.image || '',
    allergens: item.allergenIds.map((id) => allergens[id - 1]),
  }));
export async function handleShowcaseRequest(
  request: Request,
  env: ShowcaseEnvironment,
  path: string,
): Promise<Response> {
  try {
    const method = request.method;
    const url = new URL(request.url);
    const query = url.searchParams;
    if (
      method !== 'GET' &&
      (request.headers.get('origin') !== url.origin ||
        request.headers.get('sec-fetch-site') === 'cross-site')
    )
      throw new BookingError(
        'ORIGIN_REJECTED',
        'Last siden på nytt og prøv igjen.',
        403,
      );
    if (
      query.size &&
      !(
        /^owner\/businesses\/\d+\/trucks\/\d+\/bookings$/.test(path) &&
        method === 'GET'
      )
    )
      throw new BookingError('INVALID_INPUT', 'Ugyldige URL-parametere.');
    if (path === 'demo/session' && method === 'POST') {
      const initialized = await initializeSession(request, env.DB);
      const result = response({
        showcase: true,
        owner: initialized.session.owner,
        expiresAt: initialized.session.expiresAt,
      });
      if (initialized.token)
        cookie(result, request, SESSION_COOKIE, initialized.token);
      return result;
    }
    let session = await resolveShowcaseSession(request, env.DB);
    if (!session && path === 'owner/login' && method === 'POST') {
      const initialized = await initializeSession(request, env.DB);
      await mutateSandbox(env.DB, initialized.session.id, (state) => {
        state.owner = true;
      });
      const result = response({ data: ownerUser, showcase: true });
      if (initialized.token)
        cookie(result, request, SESSION_COOKIE, initialized.token);
      return result;
    }
    const receiptAccess = path.match(/^requests\/([0-9a-f-]{36})\/access$/i);
    if (receiptAccess && method === 'POST') {
      const input = z
        .object({ token: z.string().optional() })
        .strict()
        .parse(await body(request));
      const id = receiptAccess[1];
      let token = input.token || cookieValue(request, guestName(id));
      let target = token ? await receiptSession(env.DB, id, token) : null;
      if (!target && session?.state.bookings[id] && !input.token) {
        token = opaqueToken();
        const tokenHash = await hashToken(token);
        const record = await mutateSandbox(env.DB, session.id, (state) => {
          const record = findBooking(state, id);
          record.guestTokenHash = tokenHash;
          return record;
        });
        await saveReceipt(env.DB, session.id, record);
        target = await readSandbox(env.DB, session.id);
      }
      if (!target || !validToken(token))
        throw new BookingError(
          'ACCESS_REQUIRED',
          'Åpne den private kvitteringslenken eller din egen demoøkt.',
          401,
        );
      const result = response({ token, showcase: true });
      cookie(result, request, guestName(id), token);
      return result;
    }
    const receipt = path.match(
      /^requests\/([0-9a-f-]{36})(?:\/(cancel|payment))?$/i,
    );
    if (receipt) {
      const target = await guestTarget(request, env.DB, session, receipt[1]);
      const booking = findBooking(target.state, receipt[1]);
      if (method === 'GET' && !receipt[2])
        return response({ data: bookingDTO(booking) });
      if (method === 'POST' && receipt[2] === 'cancel')
        return response({
          data: await transitionShowcaseBooking(
            env.DB,
            target.id,
            booking.id,
            'CANCELLED',
            false,
          ),
        });
      if (receipt[2] === 'payment' && method === 'GET')
        return response({
          data: target.state.payments[booking.id] || null,
          showcase: true,
        });
      if (receipt[2] === 'payment' && method === 'POST')
        return response({
          data: await paymentAction(
            env.DB,
            target.id,
            booking.id,
            'start',
            url.origin,
          ),
          showcase: true,
        });
    }
    if (!session)
      throw new BookingError(
        'SESSION_EXPIRED',
        'Start demoøkten for å fortsette.',
        401,
      );
    if (path === 'demo/session' && method === 'GET')
      return response({
        showcase: true,
        owner: session.owner,
        expiresAt: session.expiresAt,
      });
    if (path === 'demo/reset' && method === 'POST') {
      await deleteSandboxMedia(env, session.id);
      await env.DB.prepare('DELETE FROM demo_receipts WHERE sandbox_id=?')
        .bind(session.id)
        .run();
      await env.DB.prepare('DELETE FROM demo_sandboxes WHERE id=?')
        .bind(session.id)
        .run();
      const fresh = await initializeSession(
        new Request(request.url, { method: 'POST' }),
        env.DB,
      );
      const result = response({ ok: true, showcase: true });
      cookie(result, request, SESSION_COOKIE, fresh.token!);
      return result;
    }
    if (path === 'demo/requests' && method === 'GET')
      return response({
        data: Object.values(session.state.bookings)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(bookingDTO),
      });
    if (path === 'catalogue' && method === 'GET')
      return response({
        trucks: await decorateCatalogue(
          env.DB,
          session.id,
          publicTrucks(session.state),
        ),
        showcase: true,
      });
    if (path === 'catalogue/search' && method === 'POST') {
      const input = z
        .object({
          event: eventSchema,
          portionCount: z.number().int().min(0).max(100000).default(0),
          q: z.string().max(100).optional(),
          city: z.string().max(100).optional(),
        })
        .strict()
        .parse(await body(request));
      const list = publicTrucks(session.state).filter(
        (truck) =>
          (!input.q ||
            `${truck.name} ${truck.cuisine}`
              .toLowerCase()
              .includes(input.q.toLowerCase())) &&
          (!input.city ||
            truck.city.toLowerCase().includes(input.city.toLowerCase())) &&
          checkAvailability(
            session!.state,
            truck.id,
            input.event,
            input.portionCount,
          ).reasons.length === 0,
      );
      return response({
        trucks: await decorateCatalogue(env.DB, session.id, list),
      });
    }
    if (path === 'drafts' && method === 'POST') {
      const input = z
        .object({ draftId: z.string().uuid() })
        .strict()
        .parse(await body(request));
      const result = response({ ready: true });
      const name = `humbites_draft_${input.draftId}`;
      if (!validToken(cookieValue(request, name)))
        cookie(result, request, name, opaqueToken());
      return result;
    }
    if (
      (path === 'quotes' && method === 'POST') ||
      (path === 'requests' && method === 'POST')
    ) {
      const draft = z.string().uuid().parse(request.headers.get('x-draft-id'));
      const token = cookieValue(request, `humbites_draft_${draft}`);
      if (!validToken(token))
        throw new BookingError(
          'ACCESS_REQUIRED',
          'Opprett et nytt forespørselsutkast.',
          401,
        );
      const hash = await hashToken(token);
      const input = await body(request);
      if (path === 'quotes')
        return response(
          { data: await makeShowcaseQuote(env.DB, session.id, input, hash) },
          201,
        );
      const created = await createShowcaseBooking(
        env.DB,
        session.id,
        input,
        request.headers.get('idempotency-key') || '',
        hash,
      );
      const result = response(
        { data: created.data, receiptToken: token, showcase: true },
        created.created ? 201 : 200,
      );
      cookie(result, request, guestName(created.data.id), token);
      return result;
    }
    if (path === 'payment-config' && method === 'GET')
      return response({ enabled: true, showcase: true });
    const checkout = path.match(
      /^demo\/payments\/([0-9a-f-]{36})\/(authorize|abort)$/i,
    );
    if (checkout && method === 'POST') {
      const target = await guestTarget(request, env.DB, session, checkout[1]);
      return response({
        data: await paymentAction(
          env.DB,
          target.id,
          checkout[1],
          checkout[2] as 'authorize' | 'abort',
          url.origin,
        ),
        showcase: true,
      });
    }
    if (path === 'owner/login' && method === 'POST') {
      await mutateSandbox(env.DB, session.id, (state) => {
        state.owner = true;
      });
      return response({ data: ownerUser, showcase: true });
    }
    if (path === 'owner/logout' && method === 'POST') {
      await mutateSandbox(env.DB, session.id, (state) => {
        state.owner = false;
      });
      return response({ ok: true });
    }
    if (path === 'owner/session' && method === 'GET') {
      requireOwner(session.state);
      return response({ data: ownerUser });
    }
    if (path.startsWith('owner/')) requireOwner(session.state);
    if (/^owner\/businesses\/\d+\/trucks\/\d+\/media\//.test(path))
      return handleMedia(request, env, session, path);
    if (path === 'owner/businesses' && method === 'GET')
      return response({
        data: [{ id: '1', name: 'Din Humbites-demobedrift' }],
      });
    const ownerPayment = path.match(
      /^owner\/payments\/([0-9a-f-]{36})(?:\/(capture|cancel|refund))?$/i,
    );
    if (ownerPayment) {
      findBooking(session.state, ownerPayment[1]);
      if (method === 'GET' && !ownerPayment[2])
        return response({
          data: session.state.payments[ownerPayment[1]] || null,
        });
      if (method === 'POST' && ownerPayment[2])
        return response({
          data: await paymentAction(
            env.DB,
            session.id,
            ownerPayment[1],
            ownerPayment[2] as 'capture' | 'cancel' | 'refund',
            url.origin,
          ),
          showcase: true,
        });
    }
    const owner = path.match(
      /^owner\/businesses\/(\d+)\/trucks(?:\/(\d+)(?:\/(bookings|booking-settings|schedule-preview|overview|menu|menu-options|menu-categories)(?:\/([A-Za-z0-9_-]+)(?:\/(accept|decline|cancel|assignment))?)?)?)?$/,
    );
    if (owner) {
      const [, businessId, truckId, section, itemId, action] = owner;
      assertBusiness(businessId);
      if (!truckId && method === 'GET')
        return response({
          data: session.state.trucks.map((x) => ({
            id: x.id,
            name: x.name,
            slug: x.slug,
          })),
        });
      assertTruck(session.state, truckId);
      if (section === 'booking-settings' && !itemId) {
        if (method === 'GET')
          return response({
            data: {
              ...session.state.settings[truckId],
              ...normalizeSchedule(session.state.settings[truckId]),
            },
          });
        if (method === 'PUT')
          return response({
            data: await setSettings(
              env.DB,
              session.id,
              truckId,
              await body(request),
            ),
          });
        if (method === 'PATCH')
          return response({
            data: await patchGeneralSettings(
              env.DB,
              session.id,
              truckId,
              await body(request),
            ),
          });
      }
      if (
        section === 'booking-settings' &&
        itemId === 'schedule' &&
        method === 'PUT'
      )
        return response({
          data: await setSchedule(
            env.DB,
            session.id,
            truckId,
            await body(request),
          ),
        });
      if (section === 'schedule-preview' && !itemId && method === 'POST')
        return response({
          data: previewSchedule(session.state, truckId, await body(request)),
        });
      if (section === 'overview' && !itemId && method === 'GET')
        return response({ data: ownerOverview(session.state, truckId) });
      if (section === 'bookings') {
        if (method === 'GET' && !itemId) {
          for (const key of query.keys())
            if (query.getAll(key).length > 1)
              throw new BookingError(
                'INVALID_INPUT',
                'Duplisert URL-parameter.',
              );
          return response(
            ownerPage(session.state, truckId, Object.fromEntries(query)),
          );
        }
        if (method === 'GET' && itemId) {
          const record = findBooking(session.state, itemId);
          if (record.foodtruckId !== truckId)
            throw new BookingError(
              'NOT_FOUND',
              'Forespørselen finnes ikke.',
              404,
            );
          return response({ data: bookingDTO(record) });
        }
        if (method === 'POST' && itemId && action) {
          const status = {
            accept: 'ACCEPTED',
            decline: 'DECLINED',
            cancel: 'CANCELLED',
          }[action] as 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | undefined;
          if (status)
            return response({
              data: await transitionShowcaseBooking(
                env.DB,
                session.id,
                itemId,
                status,
                true,
                truckId,
              ),
            });
        }
      }
      if (section === 'menu-options' && method === 'GET')
        return response({
          data: {
            allergens: allergens.map((name, i) => ({ id: i + 1, name })),
            categories: menuCategoriesFor(assertTruck(session.state, truckId)),
          },
        });
      if (section === 'menu-categories' && !action) {
        if (method === 'GET' && !itemId)
          return response({
            data: menuCategoriesFor(assertTruck(session.state, truckId)),
          });
        if (
          (method === 'POST' && !itemId) ||
          ((method === 'PATCH' || method === 'DELETE') &&
            itemId &&
            /^[1-9]\d*$/.test(itemId) &&
            Number.isSafeInteger(Number(itemId)))
        ) {
          const result = await editMenuCategory(
            env.DB,
            session.id,
            truckId,
            method as 'POST' | 'PATCH' | 'DELETE',
            method === 'DELETE' ? {} : await body(request),
            itemId ? Number(itemId) : undefined,
          );
          return response(
            result ? { data: result } : null,
            result ? (method === 'POST' ? 201 : 200) : 204,
          );
        }
      }
      if (section === 'menu') {
        if (method === 'GET' && !itemId) {
          const decorated = await decorateCatalogue(env.DB, session.id, [
            {
              ...assertTruck(session.state, truckId),
              menu: publicMenu(session, truckId),
            },
          ]);
          return response({
            data: decorated[0].menu.map((item) => ({
              ...item,
              basePrice: item.priceMinor / 100,
              imageUrl: item.image || '',
            })),
          });
        }
        if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
          const result = await editMenu(
            env.DB,
            session.id,
            truckId,
            method,
            method === 'POST' || method === 'PATCH' ? await body(request) : {},
            itemId,
            action === 'assignment',
          );
          return response(
            result
              ? { data: { ...result, basePrice: result.priceMinor / 100 } }
              : null,
            result ? (method === 'POST' ? 201 : 200) : 204,
          );
        }
      }
    }
    return response(
      { error: { code: 'NOT_FOUND', message: 'Handlingen finnes ikke.' } },
      404,
    );
  } catch (error) {
    if (error instanceof BookingError)
      return response(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        error.status,
      );
    if (error instanceof ZodError)
      return response(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Kontroller opplysningene.',
            details: error.issues.map((x) => ({
              path: x.path,
              message: x.message,
            })),
          },
        },
        400,
      );
    return response(
      {
        error: {
          code: 'UNAVAILABLE',
          message: 'Demoen kunne ikke lagre handlingen. Prøv igjen.',
        },
      },
      503,
    );
  }
}
