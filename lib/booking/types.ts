import type { ContactDetails, EventDetails, FoodTruck, Quote } from '@/domain';
export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export interface BookingRecord {
  id: string;
  foodtruckId: string;
  businessId: string;
  foodtruckName: string;
  status: BookingStatus;
  event: EventDetails;
  contact: ContactDetails;
  quote: Quote;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}
export interface ServerQuote {
  quoteId: string;
  expiresAt: string;
  quote: Quote;
}
/** Minutes are local Europe/Oslo wall time. End > 1440 continues into the next day. */
export interface OpeningInterval {
  startMinute: number;
  endMinute: number;
}
export interface WeeklyOpeningInterval extends OpeningInterval {
  weekday: number;
}
export interface DateOverride {
  date: string;
  closed: boolean;
  intervals: OpeningInterval[];
  label?: string;
}
export interface VacationRange {
  from: string;
  to: string;
  label?: string;
}
export interface ScheduleInput {
  openingHours: WeeklyOpeningInterval[];
  closedDates: string[];
  dateOverrides: DateOverride[];
  vacationRanges: VacationRange[];
  minimumNoticeHours: number;
  maximumAdvanceDays: number | null;
}
export interface ScheduleDay {
  date: string;
  weekday: number;
  intervals: OpeningInterval[];
  closed: boolean;
  source: 'weekly' | 'override' | 'vacation' | 'closed-date';
  label: string | null;
}
export interface SchedulePreview {
  timeZone: 'Europe/Oslo';
  month: string;
  generatedAt: string;
  enabled: boolean;
  days: ScheduleDay[];
  now: { date: string; minute: number; open: boolean };
  nextOpening: { date: string; minute: number; startsAt: string } | null;
  nextOpeningSearchThrough: string;
  bookingWindow: { earliestStartAt: string; latestStartDate: string | null };
  conflicts: {
    bookingId: string;
    startsAt: string;
    endsAt: string;
    reasons: string[];
  }[];
  reservations: {
    bookingId: string;
    startsAt: string;
    endsAt: string;
    reservedStartsAt: string;
    reservedEndsAt: string;
  }[];
}
export interface Settings {
  enabled: boolean;
  fixedFeeMinor: number;
  maxGuests: number;
  maxPortions: number;
  serviceRadiusKm: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  openingHours: WeeklyOpeningInterval[];
  closedDates: string[];
  cuisine: string;
  tags: string[];
  practicalInfo: string[];
  dateOverrides?: DateOverride[];
  vacationRanges?: VacationRange[];
  minimumNoticeHours?: number;
  maximumAdvanceDays?: number | null;
}
export interface OwnerOverview {
  counts: Record<BookingStatus, number>;
  totalQuotedMinor: number;
  acceptedQuotedMinor: number;
  upcoming: BookingRecord[];
  recent: BookingRecord[];
}
export interface Payment {
  id: string;
  bookingId: string;
  reference: string;
  state: string;
  amountMinor: number;
  currency: string;
  authorizedMinor: number;
  capturedMinor: number;
  cancelledMinor: number;
  refundedMinor: number;
  redirectUrl: string | null;
}
export const statusLabel: Record<BookingStatus, string> = {
  PENDING: 'Venter på eieren',
  ACCEPTED: 'Godkjent av eieren',
  DECLINED: 'Avslått av eieren',
  CANCELLED: 'Avlyst',
};
export type CatalogueResponse = { trucks: FoodTruck[] };
