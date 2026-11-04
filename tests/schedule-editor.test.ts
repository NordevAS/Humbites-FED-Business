import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addHolidayClosures,
  clockInput,
  dayMode,
  emptySchedule,
  monthShift,
  norwegianHolidays,
  parseClock,
  replaceDays,
} from '../features/owner/schedule-helpers';

test('clock helpers preserve midnight and overnight, and reject incomplete or invalid time input', () => {
  assert.equal(clockInput(1560), '02:00');
  assert.equal(clockInput(1440), '00:00');
  assert.equal(parseClock('22:30'), 1350);
  for (const value of ['', '24:00', '13:70', '1:20'])
    assert.equal(parseClock(value), -1);
  assert.equal(dayMode([]), 'closed');
  assert.equal(dayMode([{ startMinute: 0, endMinute: 1440 }]), 'all-day');
});
test('copying weekday hours replaces only selected days and preserves overnight duration', () => {
  const source = [
    { weekday: 1, startMinute: 1320, endMinute: 1560 },
    { weekday: 6, startMinute: 720, endMinute: 1200 },
  ];
  const result = replaceDays(
    source,
    [1, 2, 3, 4, 5],
    [{ startMinute: 1320, endMinute: 1560 }],
  );
  assert.equal(result.length, 6);
  assert.equal(result[4].weekday, 5);
  assert.deepEqual(result[5], source[1]);
  assert.equal(source.length, 2);
});
test('Norwegian holiday suggestions calculate known Easter/Ascension dates and year-boundary months', () => {
  const dates = (year: number) =>
    Object.fromEntries(
      norwegianHolidays(year).map((row) => [row.label, row.date]),
    );
  assert.equal(dates(2026)['Første påskedag'], '2026-04-05');
  assert.equal(dates(2026)['Kristi himmelfartsdag'], '2026-05-14');
  assert.equal(dates(2027)['Første påskedag'], '2027-03-28');
  assert.match(
    norwegianHolidays(2027).find((row) => row.date === '2027-05-17')!.label,
    /Andre pinsedag/,
  );
  assert.equal(norwegianHolidays(2026).length, 12);
  assert.equal(monthShift('2026-12', 1), '2027-01');
  assert.equal(monthShift('2027-01', -1), '2026-12');
});
test('holiday shortcut never overwrites custom hours or existing closed dates', () => {
  const schedule = {
    ...emptySchedule,
    closedDates: ['2026-01-01'],
    dateOverrides: [
      {
        date: '2026-05-17',
        closed: false,
        intervals: [{ startMinute: 600, endMinute: 900 }],
        label: 'Åpent på nasjonaldagen',
      },
    ],
  };
  const result = addHolidayClosures(schedule, norwegianHolidays(2026));
  assert.deepEqual(
    result.dateOverrides.find((row) => row.date === '2026-05-17'),
    schedule.dateOverrides[0],
  );
  assert.equal(
    result.dateOverrides.some((row) => row.date === '2026-01-01'),
    false,
  );
  assert.equal(schedule.dateOverrides.length, 1);
});
