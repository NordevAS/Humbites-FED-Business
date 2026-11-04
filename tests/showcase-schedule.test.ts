import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDb } from './showcase/sqlite';
import { fixtureState } from '../lib/showcase/store';
import {
  scheduleSchema,
  normalizeSchedule,
  effectiveScheduleDay,
  scheduleReasons,
  schedulePreview,
  bookingWindowReasons,
  isRealDate,
} from '../lib/showcase/schedule';
import {
  eventSchema,
  eventTimes,
  settingsSchema,
} from '../lib/showcase/validation';
import {
  handleShowcaseRequest,
  type ShowcaseEnvironment,
} from '../lib/showcase/handler';
import type { ScheduleInput } from '../lib/booking/types';

const baseline = () => normalizeSchedule(fixtureState().settings['1']);
const only = (openingHours: ScheduleInput['openingHours']) => ({
  ...baseline(),
  openingHours,
});
test('weekly split shifts allow adjacent boundaries and reject overlap across midnight/week boundaries', () => {
  assert.equal(
    scheduleSchema.safeParse(
      only([
        { weekday: 1, startMinute: 600, endMinute: 720 },
        { weekday: 1, startMinute: 720, endMinute: 900 },
      ]),
    ).success,
    true,
  );
  assert.equal(
    scheduleSchema.safeParse(
      only([
        { weekday: 6, startMinute: 1320, endMinute: 1560 },
        { weekday: 0, startMinute: 60, endMinute: 180 },
      ]),
    ).success,
    false,
  );
  assert.equal(
    scheduleSchema.safeParse(
      only([{ weekday: 1, startMinute: 600, endMinute: 600 }]),
    ).success,
    false,
  );
  assert.equal(
    scheduleSchema.safeParse(
      only([{ weekday: 1, startMinute: 600, endMinute: 2041 }]),
    ).success,
    false,
  );
  const overnight = only([{ weekday: 5, startMinute: 1320, endMinute: 1560 }]);
  assert.deepEqual(effectiveScheduleDay(overnight, '2040-06-02').intervals, [
    { startMinute: 0, endMinute: 120 },
  ]);
  assert.deepEqual(effectiveScheduleDay(overnight, '2040-06-01').intervals, [
    { startMinute: 1320, endMinute: 1440 },
  ]);
});
test('dated overrides replace incoming carry; inclusive vacations and legacy closed dates have priority', () => {
  const schedule = {
    ...only([{ weekday: 5, startMinute: 1320, endMinute: 1560 }]),
    dateOverrides: [
      {
        date: '2040-06-02',
        closed: false,
        intervals: [{ startMinute: 600, endMinute: 720 }],
        label: 'Sommerdag',
      },
    ],
  };
  assert.deepEqual(effectiveScheduleDay(schedule, '2040-06-02').intervals, [
    { startMinute: 600, endMinute: 720 },
  ]);
  schedule.vacationRanges = [
    { from: '2040-06-01', to: '2040-06-02', label: 'Ferie' },
  ];
  assert.equal(effectiveScheduleDay(schedule, '2040-06-02').source, 'vacation');
  assert.equal(effectiveScheduleDay(schedule, '2040-06-02').closed, true);
  assert.equal(effectiveScheduleDay(schedule, '2040-06-03').source, 'weekly');
  schedule.vacationRanges = [];
  schedule.closedDates = ['2040-06-02'];
  assert.equal(
    effectiveScheduleDay(schedule, '2040-06-02').source,
    'closed-date',
  );
});
test('real dates, duplicate exceptions, vacation overlap and override overnight overlap are validated', () => {
  assert.equal(isRealDate('2040-02-29'), true);
  assert.equal(isRealDate('2041-02-29'), false);
  assert.equal(
    scheduleSchema.safeParse({ ...baseline(), closedDates: ['2040-02-30'] })
      .success,
    false,
  );
  assert.equal(
    scheduleSchema.safeParse({
      ...baseline(),
      vacationRanges: [{ from: '2040-06-02', to: '2040-06-01' }],
    }).success,
    false,
  );
  assert.equal(
    scheduleSchema.safeParse({
      ...baseline(),
      vacationRanges: [
        { from: '2040-06-01', to: '2040-06-03' },
        { from: '2040-06-03', to: '2040-06-05' },
      ],
    }).success,
    false,
  );
  const override = { date: '2040-06-01', closed: true, intervals: [] };
  assert.equal(
    scheduleSchema.safeParse({
      ...baseline(),
      dateOverrides: [override, override],
    }).success,
    false,
  );
  assert.equal(
    scheduleSchema.safeParse({
      ...baseline(),
      dateOverrides: [
        { ...override, intervals: [{ startMinute: 600, endMinute: 720 }] },
      ],
    }).success,
    false,
  );
  assert.equal(
    scheduleSchema.safeParse({
      ...only([{ weekday: 6, startMinute: 60, endMinute: 180 }]),
      dateOverrides: [
        {
          date: '2040-06-01',
          closed: false,
          intervals: [{ startMinute: 1320, endMinute: 1560 }],
        },
      ],
    }).success,
    false,
  );
});
const eventInput = {
  date: '2040-06-01',
  startTime: '12:00',
  durationHours: 2,
  guestCount: 30,
  notes: 'Syntetisk test',
  location: {
    label: 'Oslo demo',
    coordinates: { longitude: 10.7522, latitude: 59.9139 },
    source: 'preset',
  },
};
test('Oslo DST uses elapsed minutes; nonexistent and repeated local starts remain explicit', () => {
  const event = eventSchema.parse({
    ...eventInput,
    date: '2027-03-28',
    startTime: '01:30',
    durationHours: 2,
  });
  const times = eventTimes(event, new Date('2027-01-01T00:00Z'));
  assert.equal(times.endsAt.toISOString(), '2027-03-28T02:30:00.000Z');
  assert.deepEqual(
    scheduleReasons(
      only([{ weekday: 0, startMinute: 60, endMinute: 270 }]),
      times.startsAt,
      times.endsAt,
    ),
    [],
  );
  assert.deepEqual(
    scheduleReasons(
      only([{ weekday: 0, startMinute: 60, endMinute: 240 }]),
      times.startsAt,
      times.endsAt,
    ),
    ['OUTSIDE_OPENING_HOURS'],
  );
  assert.throws(
    () =>
      eventTimes(
        { ...event, startTime: '02:30' },
        new Date('2027-01-01T00:00Z'),
      ),
    /does not exist/,
  );
  assert.throws(
    () =>
      eventTimes(
        { ...event, date: '2027-10-31', startTime: '02:30' },
        new Date('2027-01-01T00:00Z'),
      ),
    /UTC offset/,
  );
  const autumn = eventTimes(
    {
      ...event,
      date: '2027-10-31',
      startTime: '02:00',
      durationHours: 3,
      utcOffsetMinutes: 120,
    },
    new Date('2027-01-01T00:00Z'),
  );
  assert.deepEqual(
    scheduleReasons(
      only([{ weekday: 0, startMinute: 120, endMinute: 240 }]),
      autumn.startsAt,
      autumn.endsAt,
    ),
    [],
  );
});
test('preview next opening uses Oslo boundaries including DST gaps and repeated opening times', () => {
  const spring = schedulePreview(
    only([{ weekday: 0, startMinute: 150, endMinute: 240 }]),
    '2027-03',
    true,
    new Date('2027-03-28T00:50:00Z'),
  );
  assert.equal(spring.nextOpening?.startsAt, '2027-03-28T01:00:00.000Z');
  assert.equal(spring.nextOpening?.minute, 180);
  const autumn = schedulePreview(
    only([{ weekday: 0, startMinute: 135, endMinute: 150 }]),
    '2027-10',
    true,
    new Date('2027-10-31T00:40:00Z'),
  );
  assert.equal(autumn.nextOpening?.startsAt, '2027-10-31T01:15:00.000Z');
  assert.equal(
    schedulePreview(baseline(), '2040-06', false, new Date('2040-06-01T10:00Z'))
      .nextOpening,
    null,
  );
  assert.equal(
    schedulePreview(only([]), '2040-06', true, new Date('2040-06-01T10:00Z'))
      .nextOpening,
    null,
  );
});
test('lead time and inclusive calendar-day horizon default to unchanged legacy behavior', () => {
  const legacy = fixtureState().settings['1'];
  delete legacy.dateOverrides;
  delete legacy.vacationRanges;
  delete legacy.minimumNoticeHours;
  delete legacy.maximumAdvanceDays;
  const parsed = settingsSchema.parse(legacy);
  assert.equal(parsed.minimumNoticeHours, 0);
  assert.equal(parsed.maximumAdvanceDays, null);
  const schedule = {
    ...baseline(),
    minimumNoticeHours: 12,
    maximumAdvanceDays: 2,
  };
  const now = new Date('2040-06-01T08:00:00Z');
  assert.deepEqual(
    bookingWindowReasons(schedule, new Date('2040-06-01T19:59:00Z'), now),
    ['MINIMUM_NOTICE'],
  );
  assert.deepEqual(
    bookingWindowReasons(schedule, new Date('2040-06-01T20:00:00Z'), now),
    [],
  );
  assert.deepEqual(
    bookingWindowReasons(schedule, new Date('2040-06-03T21:59:00Z'), now),
    [],
  );
  assert.deepEqual(
    bookingWindowReasons(schedule, new Date('2040-06-03T22:00:00Z'), now),
    ['MAXIMUM_ADVANCE'],
  );
});

const origin = 'https://schedule.example.invalid';
function harness() {
  const database = createTestDb();
  const env = { DB: database.db, BUCKET: {} } as ShowcaseEnvironment;
  const jar = new Map<string, string>();
  return {
    ...database,
    async call(
      path: string,
      method = 'GET',
      payload?: unknown,
      headers: Record<string, string> = {},
    ) {
      const result = await handleShowcaseRequest(
        new Request(`${origin}/api/booking/${path}`, {
          method,
          headers: {
            Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
            ...(method !== 'GET'
              ? { Origin: origin, 'Content-Type': 'application/json' }
              : {}),
            ...headers,
          },
          ...(method !== 'GET' ? { body: JSON.stringify(payload ?? {}) } : {}),
        }),
        env,
        path.split('?')[0],
      );
      for (const line of result.headers.getSetCookie()) {
        const pair = line.split(';')[0];
        const index = pair.indexOf('=');
        jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return {
        status: result.status,
        body: result.status === 204 ? null : ((await result.json()) as any),
      };
    },
  };
}
const base = 'owner/businesses/1/trucks/1';
async function create(
  h: ReturnType<typeof harness>,
  date: string,
  name = 'Demo Kunde',
  extraEvent: Partial<typeof eventInput> = {},
) {
  const draftId = randomUUID();
  await h.call('drafts', 'POST', { draftId });
  const headers = { 'x-draft-id': draftId };
  const quoted = await h.call(
    'quotes',
    'POST',
    {
      foodtruckId: '1',
      event: { ...eventInput, date, ...extraEvent },
      quantities: { 101: 3 },
    },
    headers,
  );
  assert.equal(quoted.status, 201, JSON.stringify(quoted.body));
  const created = await h.call(
    'requests',
    'POST',
    {
      quoteId: quoted.body.data.quoteId,
      contact: {
        name,
        email: 'demo@example.invalid',
        phone: '00000000',
        customerType: 'private',
      },
    },
    { ...headers, 'idempotency-key': randomUUID() },
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body.data;
}
test('D1 persisted schedule blocks quote/search/accept together; accepted reservations survive changes with preview warnings', async () => {
  const h = harness();
  try {
    await h.call('demo/session', 'POST');
    const accepted = await create(h, '2040-06-01');
    const pending = await create(h, '2040-06-03');
    await h.call('owner/login', 'POST');
    assert.equal(
      (await h.call(`${base}/bookings/${accepted.id}/accept`, 'POST')).status,
      200,
    );
    const boundary = await create(h, '2040-05-31', 'Natt Demo', {
      startTime: '23:45',
      durationHours: 0.25,
    });
    assert.equal(
      (await h.call(`${base}/bookings/${boundary.id}/accept`, 'POST')).status,
      200,
    );
    await h.call(`${base}/booking-settings`, 'PATCH', {
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    });
    const schedule = {
      ...baseline(),
      vacationRanges: [
        { from: '2040-06-01', to: '2040-06-03', label: 'Sommerferie' },
      ],
    };
    const preview = await h.call(`${base}/schedule-preview`, 'POST', {
      month: '2040-06',
      schedule,
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.conflicts[0].bookingId, accepted.id);
    assert.deepEqual(preview.body.data.conflicts[0].reasons, ['VACATION']);
    assert.equal(preview.body.data.reservations.length, 2);
    const busy = preview.body.data.reservations.find(
      (row: any) => row.bookingId === boundary.id,
    );
    assert.equal(
      busy.reservedEndsAt,
      '2040-05-31T22:30:00.000Z',
      'Stored 30-minute buffer crosses into June despite later settings changes',
    );
    assert.equal(busy.endsAt, '2040-05-31T22:00:00.000Z');
    assert.ok(!('contact' in busy));
    const earlierMonth = await h.call(`${base}/schedule-preview`, 'POST', {
      month: '2040-05',
      schedule,
    });
    assert.equal(earlierMonth.status, 200);
    assert.equal(
      earlierMonth.body.data.conflicts[0].bookingId,
      accepted.id,
      'A later accepted booking still produces a warning outside the visible month',
    );
    assert.deepEqual(
      earlierMonth.body.data.reservations.map((row: any) => row.bookingId),
      [boundary.id],
    );
    assert.equal(
      (await h.call(`${base}/booking-settings/schedule`, 'PUT', schedule))
        .status,
      200,
    );
    assert.equal(
      (await h.call(`${base}/bookings/${accepted.id}`)).body.data.status,
      'ACCEPTED',
    );
    const failed = await h.call(
      `${base}/bookings/${pending.id}/accept`,
      'POST',
    );
    assert.equal(failed.status, 409);
    assert.deepEqual(failed.body.error.details.reasons, ['VACATION']);
    const draftId = randomUUID();
    await h.call('drafts', 'POST', { draftId });
    const quote = await h.call(
      'quotes',
      'POST',
      {
        foodtruckId: '1',
        event: { ...eventInput, date: '2040-06-02' },
        quantities: { 101: 3 },
      },
      { 'x-draft-id': draftId },
    );
    assert.equal(quote.status, 409);
    assert.deepEqual(quote.body.error.details.reasons, ['VACATION']);
    const search = await h.call('catalogue/search', 'POST', {
      event: { ...eventInput, date: '2040-06-02' },
    });
    assert.equal(search.status, 200);
    assert.ok(!search.body.trucks.some((x: any) => x.id === '1'));
    assert.equal(
      (
        await h.call('owner/businesses/2/trucks/1/schedule-preview', 'POST', {
          month: '2040-06',
        })
      ).status,
      404,
    );
  } finally {
    h.close();
  }
});
test('D1 atomic independent editors preserve schedule and prices; overview and search cover records before pagination', async () => {
  const h = harness();
  try {
    await h.call('demo/session', 'POST');
    await h.call('owner/login', 'POST');
    const schedule = {
      ...baseline(),
      dateOverrides: [
        { date: '2040-12-24', closed: true, intervals: [], label: 'Julaften' },
      ],
    };
    const results = await Promise.all([
      h.call(`${base}/booking-settings/schedule`, 'PUT', schedule),
      h.call(`${base}/booking-settings`, 'PATCH', {
        fixedFeeMinor: 250000,
        cuisine: 'Ny meny',
      }),
    ]);
    assert.ok(results.every((x) => x.status === 200));
    const saved = (await h.call(`${base}/booking-settings`)).body.data;
    assert.equal(saved.fixedFeeMinor, 250000);
    assert.equal(saved.dateOverrides[0].label, 'Julaften');
    assert.equal(saved.cuisine, 'Ny meny');
    assert.equal(
      (
        await h.call(`${base}/booking-settings`, 'PATCH', {
          closedDates: ['2040-06-01'],
        })
      ).status,
      400,
    );
    const first = await create(h, '2040-06-01', 'Alfa Kunde');
    const second = await create(h, '2040-06-03', 'Beta Kunde');
    const third = await create(h, '2040-06-05', 'Beta To');
    await h.call(`${base}/bookings/${first.id}/accept`, 'POST');
    await h.call(`${base}/bookings/${second.id}/decline`, 'POST');
    const overview = (await h.call(`${base}/overview`)).body.data;
    assert.deepEqual(overview.counts, {
      PENDING: 1,
      ACCEPTED: 1,
      DECLINED: 1,
      CANCELLED: 0,
    });
    assert.equal(overview.totalQuotedMinor, first.quote.totalMinor * 3);
    assert.equal(overview.acceptedQuotedMinor, first.quote.totalMinor);
    assert.equal(overview.upcoming[0].id, first.id);
    const filtered = await h.call(`${base}/bookings?q=beta&page=2&limit=1`);
    assert.equal(filtered.body.pagination.total, 2);
    assert.equal(filtered.body.data.length, 1);
    assert.ok([second.id, third.id].includes(filtered.body.data[0].id));
  } finally {
    h.close();
  }
});
