import { z } from 'zod';
import type { Settings } from '@/lib/booking/types';
import {
  scheduleShape,
  validateScheduleRules,
  realDateSchema,
  scheduleReasons,
  bookingWindowReasons,
} from './schedule';

export class BookingError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const coordinatesSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  })
  .strict();
export const eventSchema = z
  .object({
    location: z
      .object({
        label: z.string().trim().min(3).max(500),
        coordinates: coordinatesSchema,
        source: z.enum(['manual', 'map', 'preset', 'mapbox']),
        geocodingStorage: z.literal('permanent').optional(),
      })
      .strict()
      .refine(
        (x) => x.source !== 'mapbox' || x.geocodingStorage === 'permanent',
        'Temporary geocoding cannot be stored.',
      ),
    date: realDateSchema,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationHours: z
      .number()
      .positive()
      .max(24)
      .refine((x) => Number.isInteger(x * 60), 'Use whole minutes.'),
    guestCount: z.number().int().min(1).max(100000),
    notes: z.string().trim().max(4000).default(''),
    utcOffsetMinutes: z.union([z.literal(60), z.literal(120)]).optional(),
  })
  .strict();
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    email: z.string().email().max(254),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[+\d\s()-]+$/),
    customerType: z.enum(['private', 'business']),
    companyName: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine(
    (x) => x.customerType !== 'business' || !!x.companyName?.trim(),
    'Company name is required.',
  );
export const quantitiesSchema = z
  .record(z.string().regex(/^[1-9]\d*$/), z.number().int().min(0).max(100000))
  .refine((x) => Object.keys(x).length <= 100, 'Maximum 100 menu lines.');
export const generalSettingsShape = {
  enabled: z.boolean(),
  fixedFeeMinor: z.number().int().min(0).max(100000000),
  maxGuests: z.number().int().min(1).max(100000),
  maxPortions: z.number().int().min(1).max(100000),
  serviceRadiusKm: z.number().positive().max(3000),
  bufferBeforeMinutes: z.number().int().min(0).max(1440),
  bufferAfterMinutes: z.number().int().min(0).max(1440),
  cuisine: z.string().trim().max(100),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  practicalInfo: z.array(z.string().trim().min(1).max(500)).max(20),
};
export const settingsSchema = z
  .object({ ...generalSettingsShape, ...scheduleShape })
  .strict()
  .superRefine(validateScheduleRules);
export const generalSettingsPatchSchema = z
  .object(generalSettingsShape)
  .partial()
  .strict();
export type EventDetails = z.infer<typeof eventSchema>;
export type ContactDetails = z.infer<typeof contactSchema>;
export type BookingSettingsData = Settings;
export type QuoteLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};
export type Quote = {
  pricingModel?: 'rental-v1';
  rentalFeeMinor?: number;
  selectedDishCount?: number;
  currency: 'NOK';
  lines: QuoteLine[];
  subtotalMinor: number;
  transportFeeMinor: number;
  totalMinor: number;
  portionCount: number;
  isDemo: true;
};
export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export const ownerBookingListSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']).optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();
export type OwnerBookingListQuery = z.infer<typeof ownerBookingListSchema>;

export function nokToMinor(value: string | number): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match)
    throw new BookingError(
      'INVALID_PRICE',
      'A menu price must be nonnegative NOK with at most two decimals.',
      422,
    );
  const decimals = (match[2] ?? '').replace(/0+$/, '');
  if (decimals.length > 2)
    throw new BookingError(
      'INVALID_PRICE',
      'Menu prices cannot contain fractions of an øre.',
      422,
    );
  const result = Number(match[1]) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 100000000)
    throw new BookingError(
      'INVALID_PRICE',
      'Menu price is outside the supported range.',
      422,
    );
  return result;
}
export function calculateServerQuote(
  menu: { id: string; name: string; priceMinor: number }[],
  quantities: Record<string, number>,
  fixedFeeMinor: number,
): Quote {
  quantitiesSchema.parse(quantities);
  const lines: QuoteLine[] = [];
  for (const [itemId, quantity] of Object.entries(quantities).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!quantity) continue;
    const item = menu.find((x) => x.id === itemId);
    if (!item)
      throw new BookingError(
        'INVALID_MENU_ITEM',
        'A selected item is no longer available.',
        409,
      );
    lines.push({
      itemId,
      name: item.name,
      quantity: 1,
      unitPriceMinor: item.priceMinor,
      lineTotalMinor: 0,
    });
  }
  if (!lines.length)
    throw new BookingError(
      'EMPTY_MENU',
      'Velg minst én rett trucken skal tilby.',
    );
  // Menu prices are information for attendees, never an organizer food charge.
  const subtotalMinor = 0;
  const totalMinor = subtotalMinor + fixedFeeMinor;
  if (
    !Number.isSafeInteger(totalMinor) ||
    totalMinor < 0 ||
    totalMinor > 2000000000
  )
    throw new BookingError(
      'QUOTE_TOO_LARGE',
      'Quote exceeds the supported amount.',
    );
  return {
    currency: 'NOK',
    pricingModel: 'rental-v1',
    rentalFeeMinor: fixedFeeMinor,
    selectedDishCount: lines.length,
    lines,
    subtotalMinor,
    transportFeeMinor: fixedFeeMinor,
    totalMinor,
    portionCount: 0,
    isDemo: true,
  };
}

const oslo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function osloParts(date: Date) {
  return Object.fromEntries(
    oslo.formatToParts(date).map((x) => [x.type, x.value]),
  );
}
export function eventTimes(
  event: EventDetails,
  now = new Date(),
): { startsAt: Date; endsAt: Date } {
  const desired = `${event.date}T${event.startTime}`;
  const wall = Date.parse(`${desired}:00Z`);
  if (
    !Number.isFinite(wall) ||
    new Date(wall).toISOString().slice(0, 16) !== desired
  )
    throw new BookingError('INVALID_DATE', 'The event date is invalid.');
  const candidates = [60, 120]
    .filter(
      (offset) =>
        event.utcOffsetMinutes === undefined ||
        offset === event.utcOffsetMinutes,
    )
    .map((offset) => new Date(wall - offset * 60000))
    .filter((date) => {
      const p = osloParts(date);
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === desired;
    });
  if (!candidates.length)
    throw new BookingError(
      'INVALID_LOCAL_TIME',
      'This time does not exist in Europe/Oslo.',
    );
  if (candidates.length > 1)
    throw new BookingError(
      'AMBIGUOUS_LOCAL_TIME',
      'Choose UTC offset 60 or 120 minutes for this repeated local time.',
      400,
      { utcOffsetMinutes: [60, 120] },
    );
  const startsAt = candidates[0];
  if (startsAt <= now)
    throw new BookingError(
      'EVENT_IN_PAST',
      'The event must start in the future.',
    );
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + event.durationHours * 3600000),
  };
}
export function distanceKm(
  a: { longitude: number; latitude: number },
  b: { longitude: number; latitude: number },
): number {
  const radians = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function reservationRange(
  startsAt: Date,
  endsAt: Date,
  settings: BookingSettingsData,
) {
  return {
    reservedStartsAt: new Date(
      startsAt.getTime() - settings.bufferBeforeMinutes * 60000,
    ),
    reservedEndsAt: new Date(
      endsAt.getTime() + settings.bufferAfterMinutes * 60000,
    ),
  };
}
export function localEventMinutes(
  startsAt: Date,
  endsAt: Date,
): { date: string; weekday: number; minute: number }[] {
  const minutes = [];
  for (let time = startsAt.getTime(); time < endsAt.getTime(); time += 60000) {
    const p = osloParts(new Date(time));
    const date = `${p.year}-${p.month}-${p.day}`;
    minutes.push({
      date,
      weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
      minute: Number(p.hour) * 60 + Number(p.minute),
    });
  }
  return minutes;
}
export function availabilityReasons(
  settings: BookingSettingsData | null,
  event: EventDetails,
  _legacyPortionCount: number,
  origin: { longitude: number; latitude: number },
  startsAt: Date,
  endsAt: Date,
  localMinutes?: ReturnType<typeof localEventMinutes>,
  now = new Date(),
): string[] {
  if (!settings) return ['BOOKING_NOT_CONFIGURED'];
  const reasons: string[] = [];
  if (!settings.enabled) reasons.push('BOOKING_DISABLED');
  if (event.guestCount > settings.maxGuests)
    reasons.push('GUEST_CAPACITY_EXCEEDED');

  if (distanceKm(origin, event.location.coordinates) > settings.serviceRadiusKm)
    reasons.push('OUTSIDE_SERVICE_AREA');
  reasons.push(
    ...scheduleReasons(settings, startsAt, endsAt),
    ...bookingWindowReasons(settings, startsAt, now),
  );
  return reasons;
}
export function assertStatusTransition(
  from: BookingStatus,
  to: BookingStatus,
  guest = false,
) {
  const allowed = guest
    ? from === 'PENDING' && to === 'CANCELLED'
    : (from === 'PENDING' &&
        ['ACCEPTED', 'DECLINED', 'CANCELLED'].includes(to)) ||
      (from === 'ACCEPTED' && to === 'CANCELLED');
  if (!allowed)
    throw new BookingError(
      'INVALID_STATUS_TRANSITION',
      'This booking cannot transition to the requested status.',
      409,
    );
}
