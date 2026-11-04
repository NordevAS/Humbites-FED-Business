import type {
  OpeningInterval,
  ScheduleInput,
  WeeklyOpeningInterval,
} from '@/lib/booking/types';

export const weekDays = [
  { id: 1, name: 'Mandag', short: 'Man' },
  { id: 2, name: 'Tirsdag', short: 'Tir' },
  { id: 3, name: 'Onsdag', short: 'Ons' },
  { id: 4, name: 'Torsdag', short: 'Tor' },
  { id: 5, name: 'Fredag', short: 'Fre' },
  { id: 6, name: 'Lørdag', short: 'Lør' },
  { id: 0, name: 'Søndag', short: 'Søn' },
];
export const emptySchedule: ScheduleInput = {
  openingHours: [],
  closedDates: [],
  dateOverrides: [],
  vacationRanges: [],
  minimumNoticeHours: 0,
  maximumAdvanceDays: null,
};
export function clockInput(minute: number) {
  return minute < 0 || !Number.isFinite(minute)
    ? ''
    : `${Math.floor((minute % 1440) / 60)
        .toString()
        .padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
}
export function parseClock(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return -1;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
export const clockLabel = (minute: number) =>
  minute === 1440 ? '24:00' : clockInput(minute);
export const intervalLabel = (row: OpeningInterval) =>
  `${clockLabel(row.startMinute)}–${clockLabel(row.endMinute)}${row.endMinute > 1440 ? ' neste dag' : ''}`;
export function dayIntervals(rows: WeeklyOpeningInterval[], weekday: number) {
  return rows
    .filter((row) => row.weekday === weekday)
    .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));
}
export function dayMode(rows: OpeningInterval[]) {
  return !rows.length
    ? 'closed'
    : rows.length === 1 &&
        rows[0].startMinute === 0 &&
        rows[0].endMinute === 1440
      ? 'all-day'
      : 'open';
}
export function replaceDays(
  rows: WeeklyOpeningInterval[],
  days: number[],
  intervals: OpeningInterval[],
) {
  return [
    ...rows.filter((row) => !days.includes(row.weekday)),
    ...days.flatMap((weekday) => intervals.map((row) => ({ ...row, weekday }))),
  ].sort(
    (a, b) =>
      ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) ||
      a.startMinute - b.startMinute,
  );
}
export function monthShift(month: string, amount: number) {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index - 1 + amount, 1, 12))
    .toISOString()
    .slice(0, 7);
}
export function displayDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return date || 'Ugyldig dato';
  }
  return new Intl.DateTimeFormat('nb-NO', {
    ...options,
    timeZone: 'Europe/Oslo',
  }).format(parsed);
}

/** Gregorian Easter (Meeus/Jones/Butcher), used only to suggest optional owner-defined closures. */
export function norwegianHolidays(
  year: number,
): { date: string; label: string }[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2199) return [];
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = Date.UTC(year, month - 1, day, 12);
  const relative = (offset: number) =>
    new Date(easter + offset * 86400000).toISOString().slice(0, 10);
  const named = [
    { date: `${year}-01-01`, label: 'Første nyttårsdag' },
    { date: relative(-3), label: 'Skjærtorsdag' },
    { date: relative(-2), label: 'Langfredag' },
    { date: relative(0), label: 'Første påskedag' },
    { date: relative(1), label: 'Andre påskedag' },
    { date: `${year}-05-01`, label: '1. mai' },
    { date: `${year}-05-17`, label: '17. mai' },
    { date: relative(39), label: 'Kristi himmelfartsdag' },
    { date: relative(49), label: 'Første pinsedag' },
    { date: relative(50), label: 'Andre pinsedag' },
    { date: `${year}-12-25`, label: 'Første juledag' },
    { date: `${year}-12-26`, label: 'Andre juledag' },
  ];
  return [...new Set(named.map((row) => row.date))].sort().map((date) => ({
    date,
    label: named
      .filter((row) => row.date === date)
      .map((row) => row.label)
      .join(' / '),
  }));
}
export function addHolidayClosures(
  schedule: ScheduleInput,
  dates: { date: string; label: string }[],
): ScheduleInput {
  const exists = new Set([
    ...schedule.closedDates,
    ...schedule.dateOverrides.map((row) => row.date),
  ]);
  const additions = dates.filter((row) => {
    if (exists.has(row.date)) return false;
    exists.add(row.date);
    return true;
  });
  return {
    ...schedule,
    dateOverrides: [
      ...schedule.dateOverrides,
      ...additions.map((row) => ({ ...row, closed: true, intervals: [] })),
    ].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
