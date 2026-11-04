'use client';

import { useEffect, useRef, useState } from 'react';
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
const normalize = (truck: TruckLocation) => ({
  address: truck.address ?? '',
  city: truck.city ?? '',
  state: truck.state ?? '',
  postalCode: truck.postalCode ?? '',
  country: truck.country ?? '',
  latitude: truck.latitude == null ? '' : String(truck.latitude),
  longitude: truck.longitude == null ? '' : String(truck.longitude),
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
  const [form, setForm] = useState(() => normalize(initial ?? {}));
  const [baseline, setBaseline] = useState(() => JSON.stringify(normalize(initial ?? {})));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== baseline;
  const callbacks = useRef({ onDirtyChange, onBusyChange });
  callbacks.current = { onDirtyChange, onBusyChange };

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => {
    callbacks.current.onDirtyChange?.(false);
    callbacks.current.onBusyChange?.(false);
  }, []);

  useEffect(() => {
    const value = JSON.stringify(normalize(initial ?? {}));
    if (!dirty) {
      setForm(JSON.parse(value));
      setBaseline(value);
    }
  }, [initial, dirty]);

  function change(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      if (!form.address.trim() || !form.city.trim() || !form.country.trim())
        throw new Error('Fyll inn adresse, sted og land.');
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
        throw new Error('Breddegrad må være mellom −90 og 90.');
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
        throw new Error('Lengdegrad må være mellom −180 og 180.');
      const result = await api<{ data: TruckLocation }>(path, {
        method: 'PATCH',
        body: JSON.stringify({
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
          latitude,
          longitude,
        }),
      });
      const next = JSON.stringify(normalize(result.data));
      setForm(JSON.parse(next));
      setBaseline(next);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="service-form service-card owner-settings-form" onSubmit={submit}>
      <span className="eyebrow">TRUCKENS PLASSERING</span>
      <h2>Adresse og kartposisjon</h2>
      <p>Posisjonen brukes til å vise trucken på kartet og beregne tjenesteavstand. Adresseteksten brukes som stedsinformasjon.</p>
      {error && <div role="alert" className="service-banner error">{error}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Adresse</span>
          <input required maxLength={200} value={form.address} onChange={(event) => change('address', event.target.value)} />
        </label>
        <label className="field">
          <span>Sted</span>
          <input required maxLength={100} value={form.city} onChange={(event) => change('city', event.target.value)} />
        </label>
        <label className="field">
          <span>Region</span>
          <input maxLength={100} value={form.state} onChange={(event) => change('state', event.target.value)} />
        </label>
        <label className="field">
          <span>Postnummer</span>
          <input maxLength={20} value={form.postalCode} onChange={(event) => change('postalCode', event.target.value)} />
        </label>
        <label className="field">
          <span>Land</span>
          <input required maxLength={100} value={form.country} onChange={(event) => change('country', event.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Breddegrad</span>
          <input required type="number" min={-90} max={90} step="any" value={form.latitude} onChange={(event) => change('latitude', event.target.value)} />
        </label>
        <label className="field">
          <span>Lengdegrad</span>
          <input required type="number" min={-180} max={180} step="any" value={form.longitude} onChange={(event) => change('longitude', event.target.value)} />
        </label>
      </div>
      <div className="service-actions">
        <span role="status">{dirty ? 'Ulagrede endringer' : 'Ingen ulagrede endringer'}</span>
        <button type="button" disabled={busy || !dirty} className="button button-secondary" onClick={() => { setForm(normalize(initial ?? {})); setError(''); }}>Forkast</button>
        <button disabled={busy || !dirty} className="button button-primary">{busy ? 'Lagrer …' : 'Lagre plassering'}</button>
      </div>
    </form>
  );
}
