import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoveryHref,
  eventFromQuery,
} from '../features/discovery/search-query';
import type { EventDetails } from '../domain';
import { resolvePlace, suggestPlaces } from '../features/discovery/places';
import { servesLocation } from '../features/discovery/service-area';
import { foodTrucks } from '../data/demo';
import { distanceKm } from '../lib/showcase/validation';
import { fixtureState, publicTrucks } from '../lib/showcase/store';

const event: EventDetails = {
  location: {
    label: 'Tromsø',
    source: 'map',
    coordinates: { longitude: 18.95, latitude: 69.65 },
  },
  date: '2027-06-12',
  startTime: '17:00',
  durationHours: 3,
  guestCount: 40,
  notes: 'Private arrangement notes',
};
test('search URL round-trips Norway locations, date and guests without private notes', () => {
  const href = discoveryHref(event);
  assert.ok(href.startsWith('/foodtrucks?'));
  assert.ok(!href.includes('Private'));
  const restored = eventFromQuery(
    new URL(href, 'https://example.test').searchParams,
    {
      ...event,
      location: { label: '', source: 'manual' },
      date: '',
      guestCount: 1,
    },
  );
  assert.equal(restored.location.label, 'Tromsø sentrum (eksempelsted)');
  assert.deepEqual(
    restored.location.coordinates,
    resolvePlace('Tromsø')?.coordinates,
  );
  assert.equal(restored.date, event.date);
  assert.equal(restored.guestCount, 40);
});
test('malformed shared links cannot inject invalid dates or guest counts', () => {
  for (const query of [
    'date=2027-02-30&guests=-2',
    'date=bad&guests=Infinity',
    'guests=1.5',
    'guests=',
  ]) {
    const restored = eventFromQuery(new URLSearchParams(query), event);
    assert.equal(restored.date, event.date);
    assert.equal(restored.guestCount, event.guestCount);
  }
});
test('map coordinates survive same-label navigation; known cities resolve and unknown text stays unlocated', () => {
  assert.deepEqual(
    eventFromQuery(new URLSearchParams('place=Tromsø'), event).location,
    event.location,
  );
  assert.deepEqual(
    eventFromQuery(new URLSearchParams('place=Bergen&date='), event).location,
    resolvePlace('Bergen'),
  );
  assert.deepEqual(
    eventFromQuery(new URLSearchParams('place=Unknown address'), event)
      .location,
    { label: 'Unknown address', source: 'manual' },
  );
  assert.equal(eventFromQuery(new URLSearchParams('date='), event).date, '');
});

test('city suggestions match typing and exact Trondheim links resolve without geocoding', () => {
  assert.equal(suggestPlaces('Trond')[0]?.city, 'Trondheim');
  assert.equal(suggestPlaces('troMS')[0]?.city, 'Tromsø');
  assert.deepEqual(suggestPlaces('Unknown address'), []);
  assert.equal(resolvePlace('Trond'), undefined);
  const fromLink = eventFromQuery(
    new URLSearchParams('place=Trondheim&date=2027-07-01&guests=90'),
    event,
  );
  assert.deepEqual(fromLink.location, resolvePlace('Trondheim'));
  assert.equal(fromLink.date, '2027-07-01');
  assert.equal(fromLink.guestCount, 90);
});

test('typed city form submission stays unresolved until the customer selects a suggestion', () => {
  const typed = {
    ...event,
    location: { label: 'Trondheim', source: 'manual' as const },
  };
  const query = new URL(discoveryHref(typed), 'https://example.test')
    .searchParams;
  assert.equal(query.get('unresolved'), '1');
  const restored = eventFromQuery(query, typed);
  assert.equal(restored.location.coordinates, undefined);
});

test('only configured and enabled trucks with validated geometry cover a destination', () => {
  const truck = {
    ...foodTrucks[0],
    booking: {
      configured: true,
      enabled: true,
      maxGuests: 250,
      maxPortions: 500,
      serviceRadiusKm: 150,
    },
  };
  const place = resolvePlace('Oslo')!;
  assert.equal(servesLocation(truck, place), true);
  assert.equal(
    servesLocation(truck, { label: 'Oslo', source: 'manual' }),
    false,
  );
  assert.equal(servesLocation({ ...truck, booking: undefined }, place), false);
  assert.equal(
    servesLocation(
      { ...truck, booking: { ...truck.booking, configured: false } },
      place,
    ),
    false,
  );
  assert.equal(
    servesLocation(
      { ...truck, booking: { ...truck.booking, enabled: false } },
      place,
    ),
    false,
  );
  for (const serviceRadiusKm of [null, NaN, -1, 0, Infinity])
    assert.equal(
      servesLocation(
        { ...truck, booking: { ...truck.booking, serviceRadiusKm } },
        place,
      ),
      false,
    );
  assert.equal(
    servesLocation(
      { ...truck, coordinates: { longitude: NaN, latitude: 60 } },
      place,
    ),
    false,
  );
  assert.equal(
    servesLocation(truck, {
      ...place,
      coordinates: { longitude: 10, latitude: 91 },
    }),
    false,
  );
});

test('delivery radius uses the same boundary calculation as the backend', () => {
  const place = resolvePlace('Trondheim')!;
  const truck = {
    ...foodTrucks[0],
    booking: {
      configured: true,
      enabled: true,
      maxGuests: 250,
      maxPortions: 500,
      serviceRadiusKm: 150,
    },
  };
  const boundary = distanceKm(truck.coordinates, place.coordinates!);
  assert.equal(
    servesLocation(
      { ...truck, booking: { ...truck.booking, serviceRadiusKm: boundary } },
      place,
    ),
    true,
  );
  assert.equal(
    servesLocation(
      {
        ...truck,
        booking: { ...truck.booking, serviceRadiusKm: boundary - 0.001 },
      },
      place,
    ),
    false,
  );
});

test('new demo sessions use local delivery areas while saved custom radii stay authoritative', () => {
  const state = fixtureState();
  const trondheim = resolvePlace('Trondheim')!;
  assert.deepEqual(
    publicTrucks(state)
      .filter((truck) => servesLocation(truck, trondheim))
      .map((truck) => truck.city),
    ['Trondheim'],
  );
  state.settings['1'].serviceRadiusKm = 3000;
  const customized = publicTrucks(state).find((truck) => truck.id === '1')!;
  assert.equal(servesLocation(customized, trondheim), true);
  assert.match(customized.serviceAreaLabel, /3000 km/);
});
