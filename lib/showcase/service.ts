import { z } from 'zod';
import type {
  BookingStatus,
  Payment,
  Settings,
  OwnerOverview,
} from '@/lib/booking/types';
import {
  BookingError,
  availabilityReasons,
  calculateServerQuote,
  eventSchema,
  contactSchema,
  quantitiesSchema,
  eventTimes,
  reservationRange,
  assertStatusTransition,
  settingsSchema,
  generalSettingsPatchSchema,
  ownerBookingListSchema,
  nokToMinor,
  type EventDetails,
} from './validation';
import {
  scheduleSchema,
  schedulePreview,
  scheduleReasons,
  isRealDate,
  normalizeSchedule,
  osloTime,
} from './schedule';
import {
  allergens,
  assertTruck,
  assertMenu,
  bookingDTO,
  mutateSandbox,
  menuCategoriesFor,
  stable,
  saveReceipt,
  type ShowcaseDatabase,
  type SandboxState,
  type StoredBooking,
  type StoredQuote,
} from './store';

export { BookingError };
export function requireOwner(state: SandboxState) {
  if (!state.owner)
    throw new BookingError(
      'LOGIN_REQUIRED',
      'Åpne demoeier-visningen først.',
      401,
    );
}
export function assertBusiness(id: string) {
  if (id !== '1')
    throw new BookingError(
      'NOT_FOUND',
      'Bedriften finnes ikke i denne demoøkten.',
      404,
    );
}
export function findBooking(state: SandboxState, id: string): StoredBooking {
  const booking = state.bookings[id];
  if (!booking)
    throw new BookingError(
      'NOT_FOUND',
      'Forespørselen finnes ikke i denne demoøkten.',
      404,
    );
  return booking;
}
/** Only accepted bookings reserve time. Strict overlap checks allow adjacent boundaries. */
export function checkAvailability(
  state: SandboxState,
  truckId: string,
  event: EventDetails,
  portionCount: number,
  excludeId?: string,
) {
  const truck = assertTruck(state, truckId);
  const settings = state.settings[truckId];
  const times = eventTimes(event);
  const range = reservationRange(times.startsAt, times.endsAt, settings);
  const reasons = availabilityReasons(
    settings,
    event,
    portionCount,
    truck.coordinates,
    times.startsAt,
    times.endsAt,
  );
  if (
    Object.values(state.bookings).some(
      (x) =>
        x.id !== excludeId &&
        x.foodtruckId === truckId &&
        x.status === 'ACCEPTED' &&
        x.reservedStartsAt! < range.reservedEndsAt.toISOString() &&
        x.reservedEndsAt! > range.reservedStartsAt.toISOString(),
    )
  )
    reasons.push('BOOKING_CONFLICT');
  return { ...times, ...range, reasons };
}
function available(reasons: string[]) {
  if (reasons.length)
    throw new BookingError(
      reasons.includes('BOOKING_CONFLICT') ? 'BOOKING_CONFLICT' : 'UNAVAILABLE',
      'Demotrucken er ikke tilgjengelig for dette arrangementet.',
      409,
      { reasons },
    );
}
const quoteInput = z
  .object({
    foodtruckId: z.string().regex(/^\d+$/),
    event: eventSchema,
    quantities: quantitiesSchema,
  })
  .strict();
export async function makeShowcaseQuote(
  db: ShowcaseDatabase,
  sandboxId: string,
  input: unknown,
  guestTokenHash: string,
) {
  const data = quoteInput.parse(input);
  const id = crypto.randomUUID();
  return mutateSandbox(db, sandboxId, (state) => {
    const truck = assertTruck(state, data.foodtruckId);
    const settings = state.settings[truck.id];
    for (const [key, value] of Object.entries(state.quotes))
      if (value.expiresAt < Date.now()) delete state.quotes[key];
    if (Object.keys(state.quotes).length >= 200)
      throw new BookingError(
        'DEMO_LIMIT',
        'For mange prisutkast. Nullstill demoen eller vent litt.',
        409,
      );
    const quote = {
      ...calculateServerQuote(
        truck.menu.filter((x) => x.enabled),
        data.quantities,
        settings.fixedFeeMinor,
      ),
      isDemo: true,
    };
    available(
      checkAvailability(state, truck.id, data.event, quote.portionCount)
        .reasons,
    );
    const stored: StoredQuote = {
      id,
      truckId: truck.id,
      event: data.event,
      quantities: Object.fromEntries(
        quote.lines.map((line) => [line.itemId, 1]),
      ),
      quote,
      guestTokenHash,
      // Model revision prevents pre-rental price drafts from becoming new bookings.
      settingsFingerprint: stable({ pricingModel: 'rental-v1', settings }),
      expiresAt: Date.now() + 15 * 60000,
    };
    state.quotes[id] = stored;
    return {
      quoteId: id,
      expiresAt: new Date(stored.expiresAt).toISOString(),
      quote,
    };
  });
}
/** Replay the original result for the same guest/key/payload; reject conflicting reuse. */
export async function createShowcaseBooking(
  db: ShowcaseDatabase,
  sandboxId: string,
  input: unknown,
  key: string,
  guestTokenHash: string,
) {
  const data = z
    .object({ quoteId: z.string().uuid(), contact: contactSchema })
    .strict()
    .parse(input);
  z.string().uuid().parse(key);
  const id = crypto.randomUUID();
  const requestHash = stable(data);
  const result = await mutateSandbox(db, sandboxId, (state) => {
    const previous = Object.values(state.bookings).find(
      (x) => x.guestTokenHash === guestTokenHash && x.idempotencyKey === key,
    );
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new BookingError(
          'IDEMPOTENCY_CONFLICT',
          'Innsendingsnøkkelen er brukt med andre opplysninger.',
          409,
        );
      return { record: previous, created: false };
    }
    if (Object.keys(state.bookings).length >= 100)
      throw new BookingError(
        'DEMO_LIMIT',
        'Demoen har nå 100 forespørsler. Nullstill for å fortsette.',
        409,
      );
    const source = state.quotes[data.quoteId];
    if (!source || source.guestTokenHash !== guestTokenHash)
      throw new BookingError('NOT_FOUND', 'Prisutkastet finnes ikke.', 404);
    if (source.expiresAt <= Date.now())
      throw new BookingError(
        'REQUOTE_REQUIRED',
        'Prisutkastet er utløpt.',
        409,
      );
    if (Object.values(state.bookings).some((x) => x.quoteId === data.quoteId))
      throw new BookingError(
        'QUOTE_ALREADY_USED',
        'Prisutkastet har allerede en forespørsel.',
        409,
      );
    const truck = assertTruck(state, source.truckId);
    const settings = state.settings[truck.id];
    const quote = {
      ...calculateServerQuote(
        truck.menu.filter((x) => x.enabled),
        source.quantities,
        settings.fixedFeeMinor,
      ),
      isDemo: true,
    };
    if (
      stable(quote) !== stable(source.quote) ||
      stable({ pricingModel: 'rental-v1', settings }) !==
        source.settingsFingerprint
    )
      throw new BookingError(
        'REQUOTE_REQUIRED',
        'Meny, prismodell eller innstillinger er endret. Hent en ny leiepris.',
        409,
      );
    const checked = checkAvailability(
      state,
      truck.id,
      source.event,
      quote.portionCount,
    );
    available(checked.reasons);
    const now = new Date().toISOString();
    const record: StoredBooking = {
      id,
      quoteId: data.quoteId,
      foodtruckId: truck.id,
      businessId: '1',
      foodtruckName: truck.name,
      status: 'PENDING',
      event: source.event,
      contact: data.contact,
      quote,
      startsAt: checked.startsAt.toISOString(),
      endsAt: checked.endsAt.toISOString(),
      createdAt: now,
      updatedAt: now,
      guestTokenHash,
      idempotencyKey: key,
      requestHash,
    };
    state.bookings[id] = record;
    return { record, created: true };
  });
  await saveReceipt(db, sandboxId, result.record);
  return { data: bookingDTO(result.record), created: result.created };
}
/** Recheck availability and store reservation bounds in one optimistic transaction. */
export async function transitionShowcaseBooking(
  db: ShowcaseDatabase,
  sandboxId: string,
  id: string,
  status: BookingStatus,
  owner: boolean,
  truckId?: string,
) {
  return mutateSandbox(db, sandboxId, (state) => {
    if (owner) requireOwner(state);
    const booking = findBooking(state, id);
    if (truckId && booking.foodtruckId !== truckId)
      throw new BookingError(
        'NOT_FOUND',
        'Forespørselen hører til en annen truck.',
        404,
      );
    assertStatusTransition(booking.status, status, !owner);
    const payment = state.payments[id];
    if (
      status === 'CANCELLED' &&
      payment &&
      (payment.state === 'CREATED' ||
        payment.authorizedMinor >
          payment.capturedMinor + payment.cancelledMinor ||
        payment.capturedMinor > payment.refundedMinor)
    )
      throw new BookingError(
        'PAYMENT_ACTION_REQUIRED',
        'Frigi eller refunder demobetalingen først.',
        409,
      );
    if (status === 'ACCEPTED') {
      const checked = checkAvailability(
        state,
        booking.foodtruckId,
        eventSchema.parse(booking.event),
        booking.quote.portionCount,
        id,
      );
      available(checked.reasons);
      booking.reservedStartsAt = checked.reservedStartsAt.toISOString();
      booking.reservedEndsAt = checked.reservedEndsAt.toISOString();
    }
    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    return bookingDTO(booking);
  });
}
export function ownerPage(
  state: SandboxState,
  truckId: string,
  query: unknown,
) {
  requireOwner(state);
  assertTruck(state, truckId);
  const { page, limit, status, q } = ownerBookingListSchema.parse(query);
  const search = q?.toLocaleLowerCase('nb-NO');
  const list = Object.values(state.bookings)
    .filter(
      (x) =>
        x.foodtruckId === truckId &&
        (!status || x.status === status) &&
        (!search ||
          [
            x.id,
            x.contact.name,
            x.contact.email,
            x.contact.companyName,
            x.event.location?.label,
          ]
            .join(' ')
            .toLocaleLowerCase('nb-NO')
            .includes(search)),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
  return {
    data: list.slice((page - 1) * limit, page * limit).map(bookingDTO),
    pagination: {
      page,
      limit,
      total: list.length,
      totalPages: Math.ceil(list.length / limit),
    },
  };
}
export function ownerOverview(
  state: SandboxState,
  truckId: string,
  now = new Date(),
): OwnerOverview {
  requireOwner(state);
  assertTruck(state, truckId);
  const records = Object.values(state.bookings).filter(
    (x) => x.foodtruckId === truckId,
  );
  const counts: OwnerOverview['counts'] = {
    PENDING: 0,
    ACCEPTED: 0,
    DECLINED: 0,
    CANCELLED: 0,
  };
  for (const record of records) counts[record.status]++;
  return {
    counts,
    totalQuotedMinor: records.reduce(
      (total, x) => total + x.quote.totalMinor,
      0,
    ),
    acceptedQuotedMinor: records
      .filter((x) => x.status === 'ACCEPTED')
      .reduce((total, x) => total + x.quote.totalMinor, 0),
    upcoming: records
      .filter(
        (x) =>
          x.status === 'ACCEPTED' && Date.parse(x.startsAt) > now.getTime(),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 5)
      .map(bookingDTO),
    recent: [...records]
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      )
      .slice(0, 5)
      .map(bookingDTO),
  };
}
export async function setSettings(
  db: ShowcaseDatabase,
  sandboxId: string,
  truckId: string,
  input: unknown,
) {
  const settings = settingsSchema.parse(input);
  return mutateSandbox(db, sandboxId, (state) => {
    requireOwner(state);
    assertTruck(state, truckId);
    state.settings[truckId] = settings;
    return settings;
  });
}
/** Merge non-schedule fields without erasing changes from the calendar editor. */
export async function patchGeneralSettings(
  db: ShowcaseDatabase,
  sandboxId: string,
  truckId: string,
  input: unknown,
) {
  const patch = generalSettingsPatchSchema.parse(input);
  return mutateSandbox(db, sandboxId, (state) => {
    requireOwner(state);
    assertTruck(state, truckId);
    const settings = settingsSchema.parse({
      ...state.settings[truckId],
      ...patch,
    });
    state.settings[truckId] = settings;
    return settings;
  });
}
/** Replace calendar rules while preserving independently edited pricing fields. */
export async function setSchedule(
  db: ShowcaseDatabase,
  sandboxId: string,
  truckId: string,
  input: unknown,
) {
  const schedule = scheduleSchema.parse(input);
  return mutateSandbox(db, sandboxId, (state) => {
    requireOwner(state);
    assertTruck(state, truckId);
    const settings = settingsSchema.parse({
      ...state.settings[truckId],
      ...schedule,
    });
    state.settings[truckId] = settings;
    return settings;
  });
}
export function previewSchedule(
  state: SandboxState,
  truckId: string,
  input: unknown,
  now = new Date(),
) {
  requireOwner(state);
  assertTruck(state, truckId);
  const data = z
    .object({
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .refine((x) => isRealDate(`${x}-01`), 'Velg en gyldig måned.'),
      schedule: scheduleSchema.optional(),
    })
    .strict()
    .parse(input);
  const settings = state.settings[truckId];
  const proposed = data.schedule ?? normalizeSchedule(settings);
  const preview = schedulePreview(proposed, data.month, settings.enabled, now);
  // Warn about every future accepted booking, even when its date is outside the visible calendar month.
  for (const booking of Object.values(state.bookings))
    if (
      booking.foodtruckId === truckId &&
      booking.status === 'ACCEPTED' &&
      Date.parse(booking.endsAt) > now.getTime()
    ) {
      const reasons = scheduleReasons(
        proposed,
        new Date(booking.startsAt),
        new Date(booking.endsAt),
      );
      if (reasons.length)
        preview.conflicts.push({
          bookingId: booking.id,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          reasons,
        });
    }
  // Busy periods retain the buffers agreed at acceptance, even after settings change.
  for (const booking of Object.values(state.bookings))
    if (booking.foodtruckId === truckId && booking.status === 'ACCEPTED') {
      const reservedStartsAt = booking.reservedStartsAt ?? booking.startsAt;
      const reservedEndsAt = booking.reservedEndsAt ?? booking.endsAt;
      if (
        osloTime(new Date(reservedStartsAt)).date <=
          preview.days.at(-1)!.date &&
        osloTime(new Date(Date.parse(reservedEndsAt) - 1)).date >=
          preview.days[0].date
      )
        preview.reservations.push({
          bookingId: booking.id,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          reservedStartsAt,
          reservedEndsAt,
        });
    }
  preview.reservations.sort((a, b) =>
    a.reservedStartsAt.localeCompare(b.reservedStartsAt),
  );
  return preview;
}
const categorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine(
        (value) => !/[\u0000-\u001f\u007f]/.test(value),
        'Bruk et vanlig kategorinavn.',
      )
      .transform((value) => value.normalize('NFKC').replace(/\s+/g, ' '))
      .pipe(z.string().min(1).max(60)),
  })
  .strict();

/** Categories belong to this truck; deleting an assigned category is never implicit. */
export async function editMenuCategory(
  db: ShowcaseDatabase,
  sandboxId: string,
  truckId: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  input: unknown,
  categoryId?: number,
) {
  const data = method === 'DELETE' ? null : categorySchema.parse(input);
  return mutateSandbox(db, sandboxId, (state) => {
    requireOwner(state);
    const truck = assertTruck(state, truckId);
    const categories = menuCategoriesFor(truck);
    const existing = categories.find((category) => category.id === categoryId);
    if (method !== 'POST' && !existing)
      throw new BookingError(
        'NOT_FOUND',
        'Kategorien finnes ikke på denne trucken.',
        404,
      );
    if (method === 'DELETE') {
      if (truck.menu.some((item) => item.categoryIds.includes(categoryId!)))
        throw new BookingError(
          'CATEGORY_IN_USE',
          'Flytt rettene til en annen kategori eller fjern kategorien fra dem først.',
          409,
        );
      truck.menuCategories = categories.filter(
        (category) => category.id !== categoryId,
      );
      return null;
    }
    // Normalize Unicode and case so visually identical names cannot create ambiguous groups.
    const name = data!.name;
    const key = name.toLocaleLowerCase('nb-NO');
    if (
      categories.some(
        (category) =>
          category.id !== categoryId &&
          category.name
            .normalize('NFKC')
            .replace(/\s+/g, ' ')
            .toLocaleLowerCase('nb-NO') === key,
      )
    )
      throw new BookingError(
        'CATEGORY_EXISTS',
        'Trucken har allerede en kategori med dette navnet.',
        409,
      );
    if (method === 'PATCH') {
      truck.menuCategories = categories.map((category) =>
        category.id === categoryId ? { ...category, name } : category,
      );
      return { id: categoryId!, name };
    }
    if (categories.length >= 30)
      throw new BookingError(
        'CATEGORY_LIMIT',
        'Du kan ha opptil 30 kategorier per truck.',
        409,
      );
    const nextId = Math.max(
      state.nextCategoryId ?? 2,
      ...state.trucks.flatMap((candidate) =>
        menuCategoriesFor(candidate).map((category) => category.id + 1),
      ),
    );
    state.nextCategoryId = nextId + 1;
    const category = { id: nextId, name };
    truck.menuCategories = [...categories, category];
    return category;
  });
}

export const menuSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(500),
    basePrice: z.union([z.number(), z.string()]).refine((x) => {
      try {
        nokToMinor(x);
        return true;
      } catch {
        return false;
      }
    }),
    imageUrl: z.union([z.string().url(), z.literal('')]).optional(),
    enabled: z.boolean().optional(),
    allergenIds: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    categoryIds: z
      .array(z.number().int().positive().safe())
      .max(30)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Velg hver kategori én gang.',
      )
      .optional(),
  })
  .strict();
export async function editMenu(
  db: ShowcaseDatabase,
  sandboxId: string,
  truckId: string,
  method: string,
  input: unknown,
  itemId?: string,
  assignment = false,
) {
  const data =
    method === 'POST'
      ? menuSchema.parse(input)
      : method === 'PATCH'
        ? menuSchema.partial().parse(input)
        : {};
  return mutateSandbox(db, sandboxId, (state) => {
    requireOwner(state);
    const truck = assertTruck(state, truckId);
    const categoryIds = new Set(
      menuCategoriesFor(truck).map((category) => category.id),
    );
    if (data.categoryIds?.some((id) => !categoryIds.has(id)))
      throw new BookingError(
        'INVALID_CATEGORY',
        'Velg kategorier som tilhører denne trucken.',
      );
    if (method === 'DELETE') {
      assertMenu(state, truckId, itemId!);
      truck.menu = truck.menu.filter((x) => x.id !== itemId);
      return null;
    }
    if (assignment) {
      const source = state.trucks
        .flatMap((x) => x.menu)
        .find((x) => x.id === itemId);
      if (!source)
        throw new BookingError('NOT_FOUND', 'Retten finnes ikke.', 404);
      if (!truck.menu.some((x) => x.id === itemId))
        // Assignment copies the dish, but category IDs are local to the destination truck.
        truck.menu.push({ ...structuredClone(source), categoryIds: [] });
      return null;
    }
    if (method === 'POST') {
      const item = {
        id: String(state.nextItemId++),
        name: data.name!,
        description: data.description!,
        priceMinor: nokToMinor(data.basePrice!),
        enabled: data.enabled ?? true,
        imageUrl: data.imageUrl || '',
        image: data.imageUrl || null,
        dietaryTags: [],
        allergens: (data.allergenIds || []).map((id) => allergens[id - 1]),
        allergenIds: data.allergenIds || [],
        categoryIds: data.categoryIds ?? (categoryIds.has(1) ? [1] : []),
      };
      truck.menu.push(item);
      return item;
    }
    const target = assertMenu(state, truckId, itemId!);
    for (const item of state.trucks
      .flatMap((x) => x.menu)
      .filter((x) => x.id === itemId)) {
      if (data.name !== undefined) item.name = data.name;
      if (data.description !== undefined) item.description = data.description;
      if (data.basePrice !== undefined)
        item.priceMinor = nokToMinor(data.basePrice);
      if (data.enabled !== undefined) item.enabled = data.enabled;
      if (data.imageUrl !== undefined) {
        item.imageUrl = data.imageUrl;
        item.image = data.imageUrl;
      }
      if (data.allergenIds !== undefined) item.allergenIds = data.allergenIds;
    }
    // Shared dish edits keep their historical behavior; grouping is truck-specific.
    if (data.categoryIds !== undefined) target.categoryIds = data.categoryIds;
    for (const item of state.trucks
      .flatMap((x) => x.menu)
      .filter((x) => x.id === itemId))
      item.allergens = item.allergenIds.map((id) => allergens[id - 1]);
    return target;
  });
}
/** Simulated ledger only: these transitions must never invoke a real payment provider. */
export async function paymentAction(
  db: ShowcaseDatabase,
  sandboxId: string,
  id: string,
  action: 'start' | 'authorize' | 'abort' | 'capture' | 'cancel' | 'refund',
  origin: string,
) {
  return mutateSandbox(db, sandboxId, (state) => {
    const booking = findBooking(state, id);
    if (['capture', 'cancel', 'refund'].includes(action)) requireOwner(state);
    if (action === 'start') {
      if (booking.status !== 'ACCEPTED')
        throw new BookingError(
          'NOT_ACCEPTED',
          'Demoeieren må godkjenne forespørselen først.',
          409,
        );
      const existing = state.payments[id];
      if (existing && !['ABORTED', 'TERMINATED'].includes(existing.state))
        return existing;
      const payment: Payment = {
        id: crypto.randomUUID(),
        bookingId: id,
        reference: `demo-${id}`,
        state: 'CREATED',
        amountMinor: booking.quote.totalMinor,
        currency: 'NOK',
        authorizedMinor: 0,
        capturedMinor: 0,
        cancelledMinor: 0,
        refundedMinor: 0,
        redirectUrl: new URL(`/demobetaling/${id}`, origin).href,
      };
      state.payments[id] = payment;
      return payment;
    }
    const payment = state.payments[id];
    if (!payment)
      throw new BookingError('NOT_FOUND', 'Ingen demobetaling finnes.', 404);
    if (action === 'authorize') {
      if (payment.state === 'AUTHORIZED') return payment;
      if (payment.state !== 'CREATED' || booking.status !== 'ACCEPTED')
        throw new BookingError(
          'INVALID_PAYMENT_STATE',
          'Betalingen kan ikke autoriseres.',
          409,
        );
      payment.state = 'AUTHORIZED';
      payment.authorizedMinor = payment.amountMinor;
    }
    if (action === 'abort') {
      if (payment.state === 'ABORTED') return payment;
      if (payment.state !== 'CREATED')
        throw new BookingError(
          'INVALID_PAYMENT_STATE',
          'Betalingen kan ikke avbrytes her.',
          409,
        );
      payment.state = 'ABORTED';
    }
    if (action === 'capture') {
      if (payment.capturedMinor === payment.amountMinor) return payment;
      if (
        payment.state !== 'AUTHORIZED' ||
        booking.status !== 'ACCEPTED' ||
        payment.authorizedMinor <=
          payment.capturedMinor + payment.cancelledMinor
      )
        throw new BookingError(
          'INVALID_PAYMENT_STATE',
          'Ingen reservasjon kan trekkes.',
          409,
        );
      payment.capturedMinor = payment.authorizedMinor - payment.cancelledMinor;
    }
    if (action === 'cancel') {
      if (
        payment.state === 'TERMINATED' ||
        (payment.cancelledMinor === payment.authorizedMinor &&
          payment.authorizedMinor > 0)
      )
        return payment;
      if (payment.state === 'CREATED') payment.state = 'TERMINATED';
      else if (
        payment.authorizedMinor >
        payment.capturedMinor + payment.cancelledMinor
      )
        payment.cancelledMinor =
          payment.authorizedMinor - payment.capturedMinor;
      else
        throw new BookingError(
          'INVALID_PAYMENT_STATE',
          'Ingen reservasjon kan frigis.',
          409,
        );
    }
    if (action === 'refund') {
      if (
        payment.refundedMinor === payment.capturedMinor &&
        payment.capturedMinor > 0
      )
        return payment;
      if (payment.capturedMinor <= payment.refundedMinor)
        throw new BookingError(
          'INVALID_PAYMENT_STATE',
          'Ingen trukket sum kan refunderes.',
          409,
        );
      payment.refundedMinor = payment.capturedMinor;
    }
    return payment;
  });
}
