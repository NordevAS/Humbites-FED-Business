import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateQuote,
  createDemoRequest,
  eventEndLabel,
  getOsloToday,
  validateContactDetails,
  validateEventDetails,
  validatePortions,
  type BookingRequestInput,
} from '../domain/index';
import { foodTrucks } from '../data/demo/index';

const truck = foodTrucks[0];
const now = new Date('2026-10-28T23:30:00Z');
const input: BookingRequestInput = {
  event: {
    location: { label: 'Et arrangement i Oslo', source: 'manual' },
    date: '2026-10-29',
    startTime: '18:00',
    durationHours: 3,
    guestCount: 80,
    notes: 'Gjestene kjøper mat selv.',
  },
  quantities: { 'sol-chicken': 30, 'sol-mushroom': 20 },
  contact: {
    name: 'Demo Kunde',
    email: 'demo@example.com',
    phone: '+47 123 45 678',
    customerType: 'private',
  },
};

test('event quote charges rental only and canonicalizes legacy quantities', () => {
  const quote = calculateQuote(truck, input.quantities);
  assert.equal(quote.subtotalMinor, 0);
  assert.equal(quote.totalMinor, 190000);
  assert.equal(quote.portionCount, 0);
  assert.equal(quote.lines.length, 2);
  assert.equal(quote.pricingModel, 'rental-v1');
  assert.equal(quote.selectedDishCount, 2);
  assert.equal(quote.rentalFeeMinor, 190000);
  assert.ok(
    quote.lines.every(
      (line) => line.quantity === 1 && line.lineTotalMinor === 0,
    ),
  );
  assert.equal(
    calculateQuote(truck, { 'sol-chicken': 100000 }).totalMinor,
    190000,
  );
  assert.equal(quote.currency, 'NOK');
  assert.equal(quote.isDemo, true);
  assert.equal(
    quote.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
    quote.subtotalMinor,
  );
});

test('zero removes a dish; an empty menu is invalid at progression, not quote rendering', () => {
  const quote = calculateQuote(truck, { 'sol-chicken': 0, 'sol-mushroom': 2 });
  assert.equal(quote.portionCount, 0);
  assert.deepEqual(
    quote.lines.map((line) => line.itemId),
    ['sol-mushroom'],
  );
  assert.equal(calculateQuote(truck, {}).totalMinor, truck.fixedFeeMinor);
  assert.equal(validatePortions(truck, {}).valid, false);
});

test('invalid quantities, unknown items and unsafe money cannot produce a quote', () => {
  for (const quantity of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => calculateQuote(truck, { 'sol-chicken': quantity }));
  assert.throws(() => calculateQuote(truck, { 'other-menu': 5 }));
  assert.equal(validatePortions(truck, { 'sol-chicken': -1 }).valid, false);
});

test('guest count stays separate from dish selection and demo creation has no send/payment claim', () => {
  const result = createDemoRequest(truck, input, now);
  assert.equal(result.event.guestCount, 80);
  assert.deepEqual(result.quantities, { 'sol-chicken': 1, 'sol-mushroom': 1 });
  assert.equal(result.quote.portionCount, 0);
  assert.equal(result.sendState, 'not-sent');
  assert.equal(result.status, 'awaiting-owner-approval');
  assert.equal('id' in result, false);
  result.contact.name = 'Local change';
  assert.equal(input.contact.name, 'Demo Kunde');
});

test('Norwegian calendar date does not use the previous UTC day', () => {
  assert.equal(getOsloToday(now), '2026-10-29');
  assert.equal(validateEventDetails(input.event, now).valid, true);
  assert.ok(
    validateEventDetails({ ...input.event, date: '2026-10-28' }, now).errors
      .date,
  );
  assert.equal(getOsloToday(new Date('2026-06-01T22:30:00Z')), '2026-06-02');
});

test('event validation catches impossible dates, times, guest values and coordinates', () => {
  const result = validateEventDetails(
    {
      ...input.event,
      date: '2026-02-30',
      startTime: '24:00',
      durationHours: 0,
      guestCount: 1.5,
      location: {
        label: 'X',
        source: 'map',
        coordinates: { longitude: Infinity, latitude: 60 },
      },
    },
    now,
  );
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'date',
    'durationHours',
    'guestCount',
    'location',
    'startTime',
  ]);
  assert.equal(
    eventEndLabel({ date: '2026-10-31', startTime: '23:30', durationHours: 2 }),
    '01:30 (01.11)',
  );
});

test('contact-last validation requires usable contact details and conditional company', () => {
  assert.equal(validateContactDetails(input.contact).valid, true);
  assert.ok(
    validateContactDetails({ ...input.contact, customerType: 'business' })
      .errors.companyName,
  );
  assert.equal(
    validateContactDetails({
      ...input.contact,
      customerType: 'business',
      companyName: 'Eksempel AS',
    }).valid,
    true,
  );
  assert.ok(
    validateContactDetails({ ...input.contact, email: 'invalid', phone: 'abc' })
      .errors.email,
  );
  assert.throws(() =>
    createDemoRequest(
      truck,
      { ...input, contact: { ...input.contact, name: '' } },
      now,
    ),
  );
});

test('each fictional catalogue menu has unique IDs and valid money', () => {
  assert.equal(new Set(foodTrucks.map((item) => item.id)).size, 6);
  for (const item of foodTrucks) {
    assert.notEqual(item.fixedFeeMinor, null);
    assert.equal(
      new Set(item.menu.map((dish) => dish.id)).size,
      item.menu.length,
    );
    const quote = calculateQuote(
      item,
      Object.fromEntries(item.menu.map((dish) => [dish.id, 1])),
    );
    assert.equal(quote.totalMinor, item.fixedFeeMinor);
  }
});
