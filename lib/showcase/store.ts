import { foodTrucks } from '@/data/demo';
import type { FoodTruck, MenuCategory, MenuItem, Quote } from '@/domain';
import type { BookingRecord, Payment, Settings } from '@/lib/booking/types';
import {
  BookingError,
  calculateServerQuote,
  eventTimes,
  type EventDetails,
} from './validation';

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes?: number } }>;
}
export interface ShowcaseDatabase {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
export type DemoMenuItem = MenuItem & {
  enabled: boolean;
  imageUrl?: string;
  allergenIds: number[];
  categoryIds: number[];
};
export type DemoTruck = Omit<FoodTruck, 'menu'> & { menu: DemoMenuItem[] };
export type StoredBooking = BookingRecord & {
  quoteId: string;
  guestTokenHash: string;
  idempotencyKey: string;
  requestHash: string;
  reservedStartsAt?: string;
  reservedEndsAt?: string;
};
export interface StoredQuote {
  id: string;
  truckId: string;
  event: EventDetails;
  quantities: Record<string, number>;
  quote: Quote;
  guestTokenHash: string;
  settingsFingerprint: string;
  expiresAt: number;
}
export interface SandboxState {
  owner: boolean;
  trucks: DemoTruck[];
  settings: Record<string, Settings>;
  quotes: Record<string, StoredQuote>;
  bookings: Record<string, StoredBooking>;
  payments: Record<string, Payment>;
  nextItemId: number;
  nextCategoryId?: number;
}
export interface ShowcaseSession {
  id: string;
  revision: number;
  owner: boolean;
  expiresAt: number;
  state: SandboxState;
}
export const SESSION_COOKIE = 'humbites_showcase';
export const TTL_SECONDS = 86400;
export const allergens = [
  'Melk',
  'Gluten',
  'Egg',
  'Fisk',
  'Sennep',
  'Soya',
  'Sesam',
];
export function opaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export const validToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export async function hashToken(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
}
export function cookieValue(
  request: Request,
  name: string,
): string | undefined {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (part.slice(0, index).trim() === name)
      return part.slice(index + 1).trim();
  }
  return undefined;
}
export function stable(value: unknown): string {
  const normalize = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(normalize)
      : x && typeof x === 'object'
        ? Object.fromEntries(
            Object.entries(x)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, normalize(v)]),
          )
        : x;
  return JSON.stringify(normalize(value));
}
export function fixtureState(now = Date.now()): SandboxState {
  const trucks: DemoTruck[] = structuredClone(foodTrucks).map((truck, i) => ({
    ...truck,
    id: String(i + 1),
    menuCategories: [{ id: 1, name: 'Hovedrett' }],
    serviceAreaLabel: `Demo: 150 km radius fra ${truck.city}`,
    menu: truck.menu.map((item, j) => ({
      ...item,
      id: String((i + 1) * 100 + j + 1),
      enabled: true,
      allergenIds: item.allergens.flatMap((name) =>
        allergens.includes(name) ? [allergens.indexOf(name) + 1] : [],
      ),
      categoryIds: [1],
    })),
  }));
  const settings: Record<string, Settings> = {};
  for (const truck of trucks)
    settings[truck.id] = {
      enabled: true,
      fixedFeeMinor: truck.fixedFeeMinor!,
      maxGuests: 250,
      maxPortions: 500,
      serviceRadiusKm: 150,
      bufferBeforeMinutes: 30,
      bufferAfterMinutes: 30,
      openingHours: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        startMinute: 0,
        endMinute: 1440,
      })),
      closedDates: [],
      dateOverrides: [],
      vacationRanges: [],
      minimumNoticeHours: 0,
      maximumAdvanceDays: null,
      cuisine: truck.cuisine,
      tags: truck.tags,
      practicalInfo: [
        ...truck.practicalInfo,
        'Alle kapasitetstall og priser er demoeksempler.',
      ],
    };
  return {
    owner: false,
    trucks,
    settings,
    quotes: {},
    bookings: {},
    payments: {},
    nextItemId: 1000,
    nextCategoryId: 2,
  };
}
export function assertTruck(state: SandboxState, truckId: string): DemoTruck {
  const truck = state.trucks.find((x) => x.id === truckId);
  if (!truck)
    throw new BookingError(
      'NOT_FOUND',
      'Foodtrucken finnes ikke i denne demoen.',
      404,
    );
  return truck;
}
export function assertMenu(
  state: SandboxState,
  truckId: string,
  itemId: string,
): DemoMenuItem {
  const item = assertTruck(state, truckId).menu.find((x) => x.id === itemId);
  if (!item)
    throw new BookingError(
      'NOT_FOUND',
      'Retten finnes ikke på denne menyen.',
      404,
    );
  return item;
}
export function publicTrucks(state: SandboxState): FoodTruck[] {
  return state.trucks.map((truck) => {
    const settings = state.settings[truck.id];
    return {
      ...truck,
      menuCategories: menuCategoriesFor(truck),
      menu: truck.menu
        .filter((x) => x.enabled)
        .map((item) => ({
          ...item,
          allergens: item.allergenIds.map((id) => allergens[id - 1]),
        })),
      fixedFeeMinor: settings.fixedFeeMinor,
      // Describe the saved radius, including older/customized demo sessions.
      serviceAreaLabel: `Demo: ${settings.serviceRadiusKm} km radius fra ${truck.city}`,
      cuisine: settings.cuisine,
      tags: settings.tags,
      practicalInfo: settings.practicalInfo,
      booking: {
        configured: true,
        enabled: settings.enabled,
        maxGuests: settings.maxGuests,
        maxPortions: settings.maxPortions,
        serviceRadiusKm: settings.serviceRadiusKm,
      },
    };
  });
}
/** Older saved sessions had one implicit category. An explicit empty list stays empty. */
export function menuCategoriesFor(truck: DemoTruck): MenuCategory[] {
  return truck.menuCategories ?? [{ id: 1, name: 'Hovedrett' }];
}
export async function readSandbox(
  db: ShowcaseDatabase,
  id: string,
): Promise<ShowcaseSession | null> {
  const row = await db
    .prepare(
      'SELECT id,revision,state,expires_at FROM demo_sandboxes WHERE id=? AND expires_at>?',
    )
    .bind(id, Date.now())
    .first<{
      id: string;
      revision: number;
      state: string;
      expires_at: number;
    }>();
  if (!row) return null;
  const state = JSON.parse(row.state) as SandboxState;
  return {
    id: row.id,
    revision: row.revision,
    expiresAt: row.expires_at,
    owner: state.owner,
    state,
  };
}
export async function resolveShowcaseSession(
  request: Request,
  db: ShowcaseDatabase,
): Promise<ShowcaseSession | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  return validToken(token) ? readSandbox(db, await hashToken(token)) : null;
}
export async function initializeSession(
  request: Request,
  db: ShowcaseDatabase,
) {
  const existing = await resolveShowcaseSession(request, db);
  if (existing) return { session: existing };
  const token = opaqueToken();
  const id = await hashToken(token);
  const now = Date.now();
  await db
    .prepare(
      'DELETE FROM demo_receipts WHERE sandbox_id IN (SELECT id FROM demo_sandboxes WHERE expires_at<=? LIMIT 20)',
    )
    .bind(now)
    .run();
  await db
    .prepare(
      'DELETE FROM demo_sandboxes WHERE id IN (SELECT id FROM demo_sandboxes WHERE expires_at<=? LIMIT 20)',
    )
    .bind(now)
    .run();
  await db
    .prepare(
      'INSERT INTO demo_sandboxes(id,revision,state,expires_at,created_at) VALUES(?,0,?,?,?)',
    )
    .bind(id, JSON.stringify(fixtureState(now)), now + TTL_SECONDS * 1000, now)
    .run();
  return { session: (await readSandbox(db, id))!, token };
}
/**
 * Optimistic transaction scoped to one visitor. A competing write reruns the
 * callback against fresh state, up to eight attempts. Keep the callback free of
 * external side effects; perform uploads or provider calls only after success.
 */
export async function mutateSandbox<T>(
  db: ShowcaseDatabase,
  id: string,
  change: (state: SandboxState) => T | Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const session = await readSandbox(db, id);
    if (!session)
      throw new BookingError(
        'SESSION_EXPIRED',
        'Demoøkten er utløpt. Start demoen på nytt.',
        401,
      );
    const result = await change(session.state);
    const encoded = JSON.stringify(session.state);
    if (encoded.length > 1000000)
      throw new BookingError(
        'DEMO_LIMIT',
        'Demoen er full. Nullstill den for å fortsette.',
        409,
      );
    const updated = await db
      .prepare(
        'UPDATE demo_sandboxes SET state=?,revision=revision+1 WHERE id=? AND revision=? AND expires_at>?',
      )
      .bind(encoded, id, session.revision, Date.now())
      .run();
    if (updated.meta.changes === 1) return result;
  }
  throw new BookingError(
    'BUSY',
    'En annen handling ble lagret samtidig. Prøv igjen.',
    409,
  );
}
/** Remove internal ownership, replay and reservation metadata from public DTOs. */
export function bookingDTO(record: StoredBooking): BookingRecord {
  const {
    quoteId,
    guestTokenHash,
    idempotencyKey,
    requestHash,
    reservedStartsAt,
    reservedEndsAt,
    ...dto
  } = record;
  return dto;
}
export async function saveReceipt(
  db: ShowcaseDatabase,
  sessionId: string,
  booking: StoredBooking,
) {
  await db
    .prepare(
      'INSERT INTO demo_receipts(booking_id,sandbox_id,token_hash) VALUES(?,?,?) ON CONFLICT(booking_id) DO UPDATE SET token_hash=excluded.token_hash WHERE sandbox_id=excluded.sandbox_id',
    )
    .bind(booking.id, sessionId, booking.guestTokenHash)
    .run();
}
export async function receiptSession(
  db: ShowcaseDatabase,
  bookingId: string,
  token: string,
) {
  if (!validToken(token)) return null;
  const mapping = await db
    .prepare(
      'SELECT sandbox_id FROM demo_receipts WHERE booking_id=? AND token_hash=?',
    )
    .bind(bookingId, await hashToken(token))
    .first<{ sandbox_id: string }>();
  return mapping ? readSandbox(db, mapping.sandbox_id) : null;
}
