export type Coordinates = { longitude: number; latitude: number };

export interface MenuCategory {
  id: number;
  name: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  dietaryTags: string[];
  allergens: string[];
  image?: string | null;
  categoryIds?: number[];
}

export interface FoodTruck {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  city: string;
  region: string;
  description: string;
  shortDescription: string;
  image: string;
  imageAlt: string;
  menu: MenuItem[];
  menuCategories?: MenuCategory[];
  fixedFeeMinor: number | null;
  coordinates: Coordinates;
  tags: string[];
  serviceAreaLabel: string;
  practicalInfo: string[];
  booking?: {
    configured: boolean;
    enabled: boolean;
    maxGuests: number | null;
    maxPortions: number | null;
    serviceRadiusKm: number | null;
  };
}

export interface EventLocation {
  label: string;
  coordinates?: Coordinates;
  source: 'manual' | 'mapbox' | 'preset' | 'map';
  geocodingStorage?: 'permanent';
}

export interface EventDetails {
  location: EventLocation;
  date: string;
  startTime: string;
  durationHours: number;
  guestCount: number;
  notes: string;
  utcOffsetMinutes?: 60 | 120;
}

export interface ContactDetails {
  name: string;
  email: string;
  phone: string;
  customerType: 'private' | 'business';
  companyName?: string;
}

/** Legacy field name: event values are dish selection flags (0/1), not food quantities. */
export type PortionSelection = Record<string, number>;
export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};
export interface QuoteLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}
export interface Quote {
  /** Absent only on historical quotes, whose original amounts remain immutable. */
  pricingModel?: 'rental-v1';
  rentalFeeMinor?: number;
  selectedDishCount?: number;
  currency: 'NOK';
  lines: QuoteLine[];
  subtotalMinor: number;
  transportFeeMinor: number;
  totalMinor: number;
  portionCount: number;
  isDemo: boolean;
}
export interface BookingRequestInput {
  event: EventDetails;
  quantities: PortionSelection;
  contact: ContactDetails;
}
export interface DemoRequest extends BookingRequestInput {
  kind: 'demo-request';
  truckId: string;
  quote: Quote;
  status: 'awaiting-owner-approval';
  sendState: 'not-sent';
}

export function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.longitude === 'number' &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90
  );
}

function money(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Beløpet er ugyldig.');
  return value;
}

export function calculateQuote(
  truck: FoodTruck,
  quantities: PortionSelection,
): Quote {
  if (truck.fixedFeeMinor === null)
    throw new RangeError('Leieprisen er ikke konfigurert.');
  for (const [itemId, quantity] of Object.entries(quantities)) {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100000)
      throw new RangeError(
        'Menyvalget må være et heltall mellom 0 og 100 000.',
      );
    if (!truck.menu.some((item) => item.id === itemId))
      throw new RangeError('Retten finnes ikke på denne menyen.');
  }
  const lines = truck.menu.flatMap((item) => {
    const quantity = quantities[item.id] ?? 0;
    if (quantity === 0) return [];
    return [
      {
        itemId: item.id,
        name: item.name,
        quantity: 1,
        unitPriceMinor: money(item.priceMinor),
        lineTotalMinor: 0,
      },
    ];
  });
  // The organizer rents the truck; guests buy their own food at the event.
  const subtotalMinor = 0;
  const transportFeeMinor = money(truck.fixedFeeMinor);
  const portionCount = 0;
  return {
    currency: 'NOK',
    pricingModel: 'rental-v1',
    rentalFeeMinor: transportFeeMinor,
    selectedDishCount: lines.length,
    lines,
    subtotalMinor,
    transportFeeMinor,
    totalMinor: money(subtotalMinor + transportFeeMinor),
    portionCount,
    isDemo: true,
  };
}

export function formatNok(minor: number): string {
  money(minor);
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function getOsloToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateEventDetails(
  event: EventDetails,
  now = new Date(),
): ValidationResult {
  const errors: Record<string, string> = {};
  if (!event.location.label.trim())
    errors.location = 'Oppgi hvor arrangementet skal være.';
  if (event.location.coordinates && !isCoordinates(event.location.coordinates))
    errors.location = 'Velg stedet på nytt.';
  if (!validDate(event.date)) errors.date = 'Velg en gyldig dato.';
  else if (event.date < getOsloToday(now))
    errors.date = 'Velg i dag eller en senere dato.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime))
    errors.startTime = 'Oppgi et gyldig starttidspunkt.';
  if (
    !Number.isFinite(event.durationHours) ||
    event.durationHours <= 0 ||
    !Number.isSafeInteger(event.durationHours * 60)
  )
    errors.durationHours =
      'Oppgi en varighet større enn null, i hele minutter.';
  if (!Number.isSafeInteger(event.guestCount) || event.guestCount <= 0)
    errors.guestCount = 'Oppgi antall gjester som et heltall større enn null.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateContactDetails(
  contact: ContactDetails,
): ValidationResult {
  const errors: Record<string, string> = {};
  if (contact.name.trim().length < 2) errors.name = 'Oppgi navnet ditt.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))
    errors.email = 'Oppgi en gyldig e-postadresse.';
  const digits = contact.phone.replace(/[\s()+-]/g, '');
  if (!/^\d{8,15}$/.test(digits))
    errors.phone = 'Oppgi et gyldig telefonnummer.';
  if (!['private', 'business'].includes(contact.customerType))
    errors.customerType = 'Velg privatperson eller bedrift.';
  if (contact.customerType === 'business' && !contact.companyName?.trim())
    errors.companyName = 'Oppgi bedriftens navn.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validatePortions(
  truck: FoodTruck,
  quantities: PortionSelection,
): ValidationResult {
  const errors: Record<string, string> = {};
  try {
    if (calculateQuote(truck, quantities).lines.length === 0)
      errors.portions = 'Velg minst én rett trucken skal tilby.';
  } catch {
    errors.portions = 'Kontroller rettene trucken skal tilby.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateBookingRequest(
  truck: FoodTruck,
  input: BookingRequestInput,
  now = new Date(),
): ValidationResult {
  const errors = {
    ...validateEventDetails(input.event, now).errors,
    ...validatePortions(truck, input.quantities).errors,
    ...validateContactDetails(input.contact).errors,
  };
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Pure, memory-only simulation. It does not create an ID, save, send or charge. */
export function createDemoRequest(
  truck: FoodTruck,
  input: BookingRequestInput,
  now = new Date(),
): DemoRequest {
  if (!validateBookingRequest(truck, input, now).valid)
    throw new Error('Kontroller opplysningene før du prøver forespørselen.');
  return {
    ...structuredClone(input),
    quantities: Object.fromEntries(
      Object.entries(input.quantities)
        .filter(([, value]) => value > 0)
        .map(([id]) => [id, 1]),
    ),
    kind: 'demo-request',
    truckId: truck.id,
    quote: calculateQuote(truck, input.quantities),
    status: 'awaiting-owner-approval',
    sendState: 'not-sent',
  };
}

/** Wall-clock summary in the event's Norwegian local calendar, not a UTC booking instant. */
export function eventEndLabel(
  event: Pick<EventDetails, 'date' | 'startTime' | 'durationHours'>,
): string {
  if (
    !validDate(event.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime) ||
    !Number.isFinite(event.durationHours) ||
    event.durationHours <= 0
  )
    return '';
  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.startTime.split(':').map(Number);
  const end = new Date(
    Date.UTC(year, month - 1, day, hours, minutes + event.durationHours * 60),
  );
  if (!Number.isFinite(end.getTime())) return '';
  const clock = `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;
  return end.toISOString().slice(0, 10) === event.date
    ? clock
    : `${clock} (${String(end.getUTCDate()).padStart(2, '0')}.${String(end.getUTCMonth() + 1).padStart(2, '0')})`;
}
