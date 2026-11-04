import test from 'node:test';
import assert from 'node:assert/strict';
import { serverError } from '../lib/booking/client';
import {
  paymentLabel,
  canStartPayment,
  canCapture,
  canRelease,
} from '../lib/booking/payment-state';
import { permittedQuery } from '../lib/booking/proxy-policy';
import type { Payment } from '../lib/booking/types';
const payment: Payment = {
  id: 'p',
  bookingId: 'b',
  reference: 'r',
  state: 'AUTHORIZED',
  amountMinor: 10000,
  currency: 'NOK',
  authorizedMinor: 10000,
  capturedMinor: 0,
  cancelledMinor: 0,
  refundedMinor: 0,
  redirectUrl: null,
};
test('backend validation paths and availability reasons map back to correct form fields', () => {
  const error = serverError(400, {
    error: {
      code: 'VALIDATION_ERROR',
      details: [
        { path: ['event', 'location', 'coordinates'] },
        { path: ['contact', 'email'] },
        { path: ['quantities', '7'] },
      ],
    },
  });
  assert.ok(error.fields.location);
  assert.ok(error.fields.email);
  assert.ok(error.fields.portions);
  const availability = serverError(409, {
    error: {
      code: 'UNAVAILABLE',
      details: {
        reasons: [
          'GUEST_CAPACITY_EXCEEDED',
          'OUTSIDE_SERVICE_AREA',
          'CLOSED_DATE',
        ],
      },
    },
  });
  assert.ok(availability.fields.guestCount);
  assert.ok(availability.fields.location);
  assert.ok(availability.fields.date);
  for (const [reason, field, word] of [
    ['VACATION', 'date', 'stengt periode'],
    ['MINIMUM_NOTICE', 'startTime', 'lengre varsel'],
    ['MAXIMUM_ADVANCE', 'date', 'for langt frem'],
  ] as const) {
    const scheduled = serverError(409, {
      error: { code: 'UNAVAILABLE', details: { reasons: [reason] } },
    });
    assert.match(scheduled.fields[field], new RegExp(word));
    assert.match(scheduled.message, new RegExp(word));
  }
  const combined = serverError(409, {
    error: {
      code: 'UNAVAILABLE',
      details: { reasons: ['VACATION', 'MINIMUM_NOTICE', 'VACATION'] },
    },
  });
  assert.equal(combined.message.split('stengt periode').length - 1, 1);
  assert.match(combined.message, /lengre varsel/);
  assert.match(
    serverError(400, { error: { code: 'AMBIGUOUS_LOCAL_TIME' } }).message,
    /vintertid/,
  );
});
test('verified payment aggregates distinguish authorization, partial/full capture and refunds', () => {
  assert.match(paymentLabel(payment), /ikke belastet/);
  assert.equal(
    paymentLabel({ ...payment, capturedMinor: 5000 }),
    'Delvis betalt',
  );
  assert.equal(paymentLabel({ ...payment, capturedMinor: 10000 }), 'Betalt');
  assert.equal(
    paymentLabel({ ...payment, capturedMinor: 10000, refundedMinor: 2000 }),
    'Delvis refundert',
  );
  assert.equal(
    paymentLabel({ ...payment, capturedMinor: 10000, refundedMinor: 10000 }),
    'Beløpet er refundert',
  );
});
test('receipt never offers a new payment for reserved, captured or refunded money', () => {
  assert.equal(canStartPayment(payment), false);
  assert.equal(
    canStartPayment({ ...payment, capturedMinor: 10000, refundedMinor: 10000 }),
    false,
  );
  assert.equal(
    canStartPayment({ ...payment, state: 'INITIATING', authorizedMinor: 0 }),
    true,
  );
  assert.equal(
    canStartPayment({ ...payment, state: 'EXPIRED', authorizedMinor: 0 }),
    true,
  );
});
test('owner can cancel a CREATED payment attempt with no authorization, but cannot capture it', () => {
  const created = { ...payment, state: 'CREATED', authorizedMinor: 0 };
  assert.equal(canRelease(created), true);
  assert.equal(canCapture(created), false);
  assert.equal(canRelease({ ...payment, capturedMinor: 10000 }), false);
});
test('only typed inbox pagination/status query fields may cross the BFF', () => {
  const path = 'owner/businesses/1/trucks/2/bookings';
  assert.equal(
    permittedQuery(
      'GET',
      path,
      new URLSearchParams('page=2&limit=25&status=PENDING'),
    ),
    '?page=2&limit=25&status=PENDING',
  );
  for (const query of [
    'token=secret',
    'page=0',
    'page=1&page=2',
    'limit=101',
    'status=PAID',
  ])
    assert.equal(permittedQuery('GET', path, new URLSearchParams(query)), null);
  assert.equal(
    permittedQuery('GET', 'requests/abc', new URLSearchParams('token=secret')),
    null,
  );
});
