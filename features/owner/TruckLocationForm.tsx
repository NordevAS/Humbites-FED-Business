'use client';

import { useEffect, useRef, useState } from 'react';
import type { Coordinates, EventLocation } from '@/domain';
import { isCoordinates } from '@/domain';
import { PlaceAutocomplete } from '@/features/discovery/PlaceAutocomplete';
import { TravelMap } from '@/components/map/TravelMap';
import { api, errorMessage } from '@/lib/booking/client';

type TruckLocation = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};
type LocationFields = Pick<
  TruckLocation,
  'address' | 'city' | 'state' | 'postalCode' | 'country'
>;

const fieldsFor = (truck: TruckLocation | undefined): LocationFields => ({
  address: truck?.address ?? '',
  city: truck?.city ?? '',
  state: truck?.state ?? '',
  postalCode: truck?.postalCode ?? '',
  country: truck?.country ?? '',
});

function coordinatesFor(
  truck: TruckLocation | undefined,
): Coordinates | undefined {
  if (truck?.latitude == null || truck.longitude == null) return undefined;
  const point = {
    latitude: Number(truck.latitude),
    longitude: Number(truck.longitude),
  };
  return isCoordinates(point) ? point : undefined;
}

function initialLocation(truck: TruckLocation | undefined): EventLocation {
  const fields = fieldsFor(truck);
  const label = [
    fields.address,
    [fields.postalCode, fields.city].filter(Boolean).join(' '),
    fields.country,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    label,
    coordinates: coordinatesFor(truck),
    source: 'map',
  };
}

function detailsFromLocation(location: EventLocation): LocationFields {
  const label = location.label.trim();
  const addressLabel = label.replace(/^Ved\s+/i, '');
  const match = /^(.*?),\s*(\d{4})\s+([^,]+?)(?:,\s*(.+))?$/.exec(addressLabel);
  if (match) {
    return {
      address: location.addressDetails?.address || match[1].trim(),
      postalCode: location.addressDetails?.postalCode || match[2],
      city: location.addressDetails?.city || match[3].trim(),
      state:
        location.addressDetails?.state ||
        location.addressDetails?.city ||
        location.addressDetails?.country ||
        '',
      country: location.addressDetails?.country || match[4]?.trim() || 'Norge',
    };
  }
  const parts = addressLabel
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const countryFromLabel = parts.length > 1 ? parts.at(-1) || '' : '';
  const localityFromLabel = parts.length > 2 ? parts.at(-2) || '' : '';
  const postalMatch = /^(\S+)\s+(.+)$/.exec(localityFromLabel);
  const parsedCity = postalMatch ? postalMatch[2] : localityFromLabel;
  if (parts.length > 1 || location.addressDetails) {
    return {
      address:
        location.addressDetails?.address || (parts.length > 2 ? parts[0] : ''),
      postalCode: location.addressDetails?.postalCode || postalMatch?.[1] || '',
      city: location.addressDetails?.city || parsedCity,
      state:
        location.addressDetails?.state ||
        (parts.length > 3 ? parts.at(-3) || '' : '') ||
        location.addressDetails?.city ||
        location.addressDetails?.country ||
        '',
      country: location.addressDetails?.country || countryFromLabel,
    };
  }
  if (location.addressDetails) return location.addressDetails;
  const example = /^(.*?)\s+sentrum\s+\(eksempelsted\)$/i.exec(label);
  if (example) {
    return {
      address: example[1].trim(),
      city: example[1].trim(),
      postalCode: '',
      state: '',
      country: 'Norge',
    };
  }
  return {
    address: '',
    city: '',
    postalCode: '',
    state: '',
    country: '',
  };
}

const normalize = (value: TruckLocation | undefined) => ({
  ...fieldsFor(value),
  latitude: coordinatesFor(value)?.latitude ?? null,
  longitude: coordinatesFor(value)?.longitude ?? null,
});

export function TruckLocationForm({
  path,
  initial,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  path: string;
  initial: TruckLocation | undefined;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [location, setLocation] = useState(() => initialLocation(initial));
  const [fields, setFields] = useState(() => fieldsFor(initial));
  const savedLocation = useRef({
    location: initialLocation(initial),
    fields: fieldsFor(initial),
  });
  const initialValue = JSON.stringify(normalize(initial));
  const [baseline, setBaseline] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [error, setError] = useState('');
  const callbacks = useRef({ onDirtyChange, onBusyChange });
  callbacks.current = { onDirtyChange, onBusyChange };
  const point = location.coordinates;
  const currentValue = JSON.stringify({
    ...fields,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
  });
  const dirty = currentValue !== baseline;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(
    () => onBusyChange?.(busy || resolvingLocation),
    [busy, resolvingLocation, onBusyChange],
  );
  useEffect(
    () => () => {
      callbacks.current.onDirtyChange?.(false);
      callbacks.current.onBusyChange?.(false);
    },
    [],
  );
  useEffect(() => {
    const value = JSON.stringify(normalize(initial));
    if (!dirty) {
      const nextLocation = initialLocation(initial);
      const nextFields = fieldsFor(initial);
      savedLocation.current = { location: nextLocation, fields: nextFields };
      setLocation(nextLocation);
      setFields(nextFields);
      setBaseline(value);
    }
  }, [initial, dirty]);

  function restoreSavedLocation() {
    setLocation(savedLocation.current.location);
    setFields(savedLocation.current.fields);
  }

  function chooseLocation(next: EventLocation) {
    setResolvingLocation(false);
    setLocation(next);
    setFields(
      next.coordinates && isCoordinates(next.coordinates)
        ? detailsFromLocation(next)
        : { address: '', city: '', state: '', postalCode: '', country: '' },
    );
    setError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || resolvingLocation) return;
    if (!point || !isCoordinates(point)) {
      setError('Søk opp en adresse eller velg et punkt på kartet først.');
      restoreSavedLocation();
      return;
    }
    if (
      !fields.address?.trim() ||
      !fields.city?.trim() ||
      !fields.country?.trim()
    ) {
      setError(
        'Stedet mangler adresse, by eller land. Velg en adresse eller et kartpunkt nær en adresse.',
      );
      restoreSavedLocation();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api<{ data: TruckLocation }>(path, {
        method: 'PATCH',
        body: JSON.stringify({
          address: fields.address.trim(),
          city: fields.city.trim(),
          state: fields.state?.trim() ?? '',
          postalCode: fields.postalCode?.trim() ?? '',
          country: fields.country.trim(),
          latitude: point.latitude,
          longitude: point.longitude,
        }),
      });
      const nextValue = JSON.stringify(normalize(result.data));
      const nextLocation = initialLocation(result.data);
      const nextFields = fieldsFor(result.data);
      savedLocation.current = { location: nextLocation, fields: nextFields };
      setBaseline(nextValue);
      setFields(nextFields);
      setLocation(nextLocation);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessage(cause));
      restoreSavedLocation();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="service-form service-card owner-settings-form"
      onSubmit={submit}
    >
      <span className="eyebrow">TRUCKENS PLASSERING</span>
      <h2>Adresse og kartposisjon</h2>
      <p>
        Søk etter adressen eller velg punkt direkte i kartet. Adresse, by, land
        og koordinater oppdateres fra stedet du velger.
      </p>
      {error && (
        <div role="alert" className="service-banner error">
          {error}
        </div>
      )}
      <PlaceAutocomplete
        variant="field"
        label="Søk etter adresse eller sted"
        location={location}
        onChange={chooseLocation}
        showPresets={false}
        searchProvider="osm"
      />
      <TravelMap
        location={location}
        onLocationChange={chooseLocation}
        showLocationSearch={false}
        reverseProvider="osm"
        onLocationLookupPending={setResolvingLocation}
        compact
      />
      <div className="form-grid">
        <label className="field">
          <span>Adresse</span>
          <input readOnly value={fields.address ?? ''} />
        </label>
        <label className="field">
          <span>By / sted</span>
          <input readOnly value={fields.city ?? ''} />
        </label>
        <label className="field">
          <span>Region</span>
          <input readOnly value={fields.state ?? ''} />
        </label>
        <label className="field">
          <span>Postnummer</span>
          <input readOnly value={fields.postalCode ?? ''} />
        </label>
        <label className="field">
          <span>Land</span>
          <input readOnly value={fields.country ?? ''} />
        </label>
      </div>
      <div className="service-actions">
        <span role="status">
          {resolvingLocation
            ? 'Henter adresse fra kartet …'
            : dirty
              ? 'Ulagrede endringer'
              : 'Ingen ulagrede endringer'}
        </span>
        <button
          type="button"
          disabled={busy || resolvingLocation || !dirty}
          className="button button-secondary"
          onClick={() => {
            restoreSavedLocation();
            setError('');
          }}
        >
          Forkast
        </button>
        <button
          disabled={busy || resolvingLocation || !dirty || !point}
          className="button button-primary"
        >
          {busy
            ? 'Lagrer …'
            : resolvingLocation
              ? 'Henter adresse …'
              : 'Lagre plassering'}
        </button>
      </div>
    </form>
  );
}
