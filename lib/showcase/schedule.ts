import { z } from 'zod';
import type {
  OpeningInterval,
  ScheduleDay,
  ScheduleInput,
  SchedulePreview,
  Settings,
} from '@/lib/booking/types';

const DAY = 1440;
const WEEK = 7 * DAY;
const oslo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function osloTime(date: Date) {
  const p = Object.fromEntries(
    oslo.formatToParts(date).map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minute: Number(p.hour) * 60 + Number(p.minute),
  };
}
export function isRealDate(value: string) {
  const time = Date.parse(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}
export function addCalendarDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const realDateSchema = z
  .string()
  .refine(isRealDate, 'Velg en gyldig kalenderdato (ÅÅÅÅ-MM-DD).');
const intervalShape = {
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(2879),
};
const validInterval = (x: OpeningInterval) =>
  x.endMinute > x.startMinute && x.endMinute - x.startMinute <= DAY;
export const intervalSchema = z
  .object(intervalShape)
  .strict()
  .refine(
    validInterval,
    'Slutt må være etter start, og intervallet kan ikke vare over 24 timer.',
  );
export const scheduleShape = {
  openingHours: z
    .array(
      z
        .object({ ...intervalShape, weekday: z.number().int().min(0).max(6) })
        .strict()
        .refine(
          validInterval,
          'Slutt må være etter start, og intervallet kan ikke vare over 24 timer.',
        ),
    )
    .max(70),
  closedDates: z.array(realDateSchema).max(1000),
  dateOverrides: z
    .array(
      z
        .object({
          date: realDateSchema,
          closed: z.boolean(),
          intervals: z.array(intervalSchema).max(10),
          label: z.string().trim().max(120).optional(),
        })
        .strict(),
    )
    .max(366)
    .default([]),
  vacationRanges: z
    .array(
      z
        .object({
          from: realDateSchema,
          to: realDateSchema,
          label: z.string().trim().max(120).optional(),
        })
        .strict(),
    )
    .max(100)
    .default([]),
  minimumNoticeHours: z.number().int().min(0).max(8760).default(0),
  maximumAdvanceDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .default(null),
};
type ScheduleLike = Pick<
  Settings,
  | 'openingHours'
  | 'closedDates'
  | 'dateOverrides'
  | 'vacationRanges'
  | 'minimumNoticeHours'
  | 'maximumAdvanceDays'
>;
/** Defaults preserve behavior for persisted demos created before optional rules existed. */
export function normalizeSchedule(settings: ScheduleLike): ScheduleInput {
  return {
    openingHours: settings.openingHours,
    closedDates: settings.closedDates,
    dateOverrides: settings.dateOverrides ?? [],
    vacationRanges: settings.vacationRanges ?? [],
    minimumNoticeHours: settings.minimumNoticeHours ?? 0,
    maximumAdvanceDays: settings.maximumAdvanceDays ?? null,
  };
}
const overlaps = (a: OpeningInterval, b: OpeningInterval) =>
  a.startMinute < b.endMinute && b.startMinute < a.endMinute;
/** Precedence is deliberate: vacation > legacy closure > dated rule > weekly hours. */
function sourceForDay(settings: ScheduleInput, date: string) {
  const vacation = settings.vacationRanges.find(
    (x) => x.from <= date && x.to >= date,
  );
  if (vacation)
    return {
      source: 'vacation' as const,
      label: vacation.label || null,
      intervals: [],
    };
  if (settings.closedDates.includes(date))
    return { source: 'closed-date' as const, label: null, intervals: [] };
  const override = settings.dateOverrides.find((x) => x.date === date);
  if (override)
    return {
      source: 'override' as const,
      label: override.label || null,
      intervals: override.closed ? [] : override.intervals,
    };
  return {
    source: 'weekly' as const,
    label: null,
    intervals: settings.openingHours.filter((x) => x.weekday === weekday(date)),
  };
}
function rawDay(settings: ScheduleInput, date: string) {
  const today = sourceForDay(settings, date);
  const intervals = today.intervals.map((x) => ({
    startMinute: x.startMinute,
    endMinute: Math.min(DAY, x.endMinute),
  }));
  // A dated rule replaces the entire date, including an incoming overnight shift.
  if (today.source === 'weekly')
    for (const interval of sourceForDay(settings, addCalendarDays(date, -1))
      .intervals)
      if (interval.endMinute > DAY)
        intervals.push({ startMinute: 0, endMinute: interval.endMinute - DAY });
  return {
    ...today,
    intervals: intervals.sort((a, b) => a.startMinute - b.startMinute),
  };
}
function mergeIntervals(intervals: OpeningInterval[]) {
  const result: OpeningInterval[] = [];
  for (const interval of intervals) {
    const previous = result.at(-1);
    if (previous && interval.startMinute <= previous.endMinute)
      previous.endMinute = Math.max(previous.endMinute, interval.endMinute);
    else result.push({ ...interval });
  }
  return result;
}
export function effectiveScheduleDay(
  input: ScheduleLike,
  date: string,
): ScheduleDay {
  const raw = rawDay(normalizeSchedule(input), date);
  return {
    date,
    weekday: weekday(date),
    source: raw.source,
    label: raw.label,
    intervals: mergeIntervals(raw.intervals),
    closed: raw.intervals.length === 0,
  };
}
export function validateScheduleRules(
  settings: ScheduleInput,
  ctx: z.RefinementCtx,
) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  for (let day = 0; day < 7; day++)
    if (settings.openingHours.filter((x) => x.weekday === day).length > 10)
      issue(
        ['openingHours'],
        'Maksimalt 10 intervaller kan starte på samme ukedag.',
      );
  const spans = settings.openingHours.map((x) => ({
    startMinute: x.weekday * DAY + x.startMinute,
    endMinute: x.weekday * DAY + x.endMinute,
  }));
  for (let i = 0; i < spans.length; i++)
    for (let j = i + 1; j < spans.length; j++)
      if (
        [-WEEK, 0, WEEK].some((shift) =>
          overlaps(spans[i], {
            startMinute: spans[j].startMinute + shift,
            endMinute: spans[j].endMinute + shift,
          }),
        )
      )
        issue(
          ['openingHours', j],
          'Åpningstidene overlapper, også når et intervall fortsetter neste dag.',
        );
  if (new Set(settings.closedDates).size !== settings.closedDates.length)
    issue(['closedDates'], 'En stengt dato kan bare legges inn én gang.');
  const seen = new Set<string>();
  settings.dateOverrides.forEach((rule, index) => {
    if (seen.has(rule.date))
      issue(['dateOverrides', index, 'date'], 'Datoen har allerede et unntak.');
    seen.add(rule.date);
    if (
      (rule.closed && rule.intervals.length) ||
      (!rule.closed && !rule.intervals.length)
    )
      issue(
        ['dateOverrides', index, 'intervals'],
        rule.closed
          ? 'En stengt dato kan ikke ha åpne intervaller.'
          : 'Legg til et intervall eller marker datoen som stengt.',
      );
    for (let i = 0; i < rule.intervals.length; i++)
      for (let j = i + 1; j < rule.intervals.length; j++)
        if (overlaps(rule.intervals[i], rule.intervals[j]))
          issue(
            ['dateOverrides', index, 'intervals', j],
            'Intervallene overlapper.',
          );
    if (isRealDate(rule.date)) {
      const following = rawDay(
        settings,
        addCalendarDays(rule.date, 1),
      ).intervals;
      for (let i = 1; i < following.length; i++)
        if (overlaps(following[i - 1], following[i]))
          issue(
            ['dateOverrides', index, 'intervals'],
            'Nattåpningen overlapper neste dags åpningstider.',
          );
    }
  });
  settings.vacationRanges.forEach((range, index) => {
    if (range.from > range.to)
      issue(
        ['vacationRanges', index, 'to'],
        'Sluttdato må være samme dag som eller etter startdato.',
      );
    for (let j = 0; j < index; j++)
      if (
        range.from <= settings.vacationRanges[j].to &&
        settings.vacationRanges[j].from <= range.to
      )
        issue(['vacationRanges', index], 'Ferieperiodene overlapper.');
  });
  if (
    settings.maximumAdvanceDays !== null &&
    settings.minimumNoticeHours > settings.maximumAdvanceDays * 24
  )
    issue(
      ['minimumNoticeHours'],
      'Minste varsel kan ikke være lengre enn bestillingshorisonten.',
    );
}
export const scheduleSchema = z
  .object(scheduleShape)
  .strict()
  .superRefine(validateScheduleRules);
export function scheduleReasons(
  input: ScheduleLike,
  startsAt: Date,
  endsAt: Date,
): string[] {
  const cache = new Map<string, ScheduleDay>();
  // Actual elapsed minutes preserve both repeated autumn minutes and the missing spring hour.
  for (let time = startsAt.getTime(); time < endsAt.getTime(); time += 60000) {
    const local = osloTime(new Date(time));
    let day = cache.get(local.date);
    if (!day) {
      day = effectiveScheduleDay(input, local.date);
      cache.set(local.date, day);
    }
    if (
      !day.intervals.some(
        (x) => local.minute >= x.startMinute && local.minute < x.endMinute,
      )
    )
      return [
        day.source === 'vacation'
          ? 'VACATION'
          : day.source === 'closed-date' ||
              (day.source === 'override' && day.closed)
            ? 'CLOSED_DATE'
            : 'OUTSIDE_OPENING_HOURS',
      ];
  }
  return [];
}
/** Notice is elapsed hours; the horizon is an inclusive Oslo calendar date. */
export function bookingWindow(input: ScheduleLike, now: Date) {
  const schedule = normalizeSchedule(input);
  return {
    earliestStartAt: new Date(
      now.getTime() + schedule.minimumNoticeHours * 3600000,
    ).toISOString(),
    latestStartDate:
      schedule.maximumAdvanceDays === null
        ? null
        : addCalendarDays(osloTime(now).date, schedule.maximumAdvanceDays),
  };
}
export function bookingWindowReasons(
  input: ScheduleLike,
  startsAt: Date,
  now: Date,
) {
  const window = bookingWindow(input, now);
  const reasons: string[] = [];
  if (startsAt.getTime() < Date.parse(window.earliestStartAt))
    reasons.push('MINIMUM_NOTICE');
  if (
    window.latestStartDate &&
    osloTime(startsAt).date > window.latestStartDate
  )
    reasons.push('MAXIMUM_ADVANCE');
  return reasons;
}
// Round-tripping Oslo UTC+1/+2 rejects missing spring times and retains both autumn instants.
function localInstants(date: string, minute: number) {
  const wall = Date.parse(`${date}T00:00:00Z`) + minute * 60000;
  return [120, 60]
    .map((offset) => new Date(wall - offset * 60000))
    .filter((instant) => {
      const local = osloTime(instant);
      return local.date === date && local.minute === minute;
    });
}
export function schedulePreview(
  input: ScheduleLike,
  month: string,
  enabled: boolean,
  now = new Date(),
): SchedulePreview {
  if (!/^\d{4}-\d{2}$/.test(month) || !isRealDate(`${month}-01`))
    throw new Error('Invalid preview month');
  const current = osloTime(now);
  const today = effectiveScheduleDay(input, current.date);
  const open =
    enabled &&
    today.intervals.some(
      (x) => current.minute >= x.startMinute && current.minute < x.endMinute,
    );
  const days: ScheduleDay[] = [];
  for (
    let date = `${month}-01`;
    date.startsWith(`${month}-`);
    date = addCalendarDays(date, 1)
  )
    days.push(effectiveScheduleDay(input, date));
  const through = addCalendarDays(current.date, 366);
  let nextOpening: SchedulePreview['nextOpening'] = open
    ? { ...current, startsAt: now.toISOString() }
    : null;
  if (enabled && !nextOpening)
    for (
      let date = current.date;
      date <= through;
      date = addCalendarDays(date, 1)
    ) {
      let earliest: Date | null = null;
      for (const interval of effectiveScheduleDay(input, date).intervals) {
        // Usually only the boundary is checked. The extra candidates cover a boundary inside a DST gap/repeated hour.
        const points = new Set([interval.startMinute]);
        if (date === current.date)
          points.add(Math.max(interval.startMinute, current.minute));
        if (!localInstants(date, interval.startMinute).length)
          for (
            let minute = interval.startMinute + 1;
            minute < Math.min(interval.endMinute, interval.startMinute + 181);
            minute++
          )
            points.add(minute);
        for (const minute of points)
          if (minute < interval.endMinute)
            for (const instant of localInstants(date, minute))
              if (instant > now && (!earliest || instant < earliest))
                earliest = instant;
      }
      if (earliest) {
        const local = osloTime(earliest);
        nextOpening = { ...local, startsAt: earliest.toISOString() };
        break;
      }
    }
  return {
    timeZone: 'Europe/Oslo',
    month,
    generatedAt: now.toISOString(),
    enabled,
    days,
    now: { ...current, open },
    nextOpening,
    nextOpeningSearchThrough: through,
    bookingWindow: bookingWindow(input, now),
    conflicts: [],
    reservations: [],
  };
}
