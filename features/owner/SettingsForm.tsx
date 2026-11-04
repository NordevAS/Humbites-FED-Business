'use client';
import { useEffect, useRef, useState } from 'react';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { api, errorMessage } from '@/lib/booking/client';
import type { Settings } from '@/lib/booking/types';

export function parseMoney(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw new Error('Oppgi en pris i kroner med høyst to desimaler.');
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error('Prisen er for stor.');
  return amount;
}
const formFor = (initial: Settings | null) => ({
  enabled: initial?.enabled ?? false,
  fixedFee: initial ? String(initial.fixedFeeMinor / 100) : '',
  maxGuests: initial ? String(initial.maxGuests) : '',
  radius: initial ? String(initial.serviceRadiusKm) : '',
  before: initial ? String(initial.bufferBeforeMinutes) : '',
  after: initial ? String(initial.bufferAfterMinutes) : '',
  cuisine: initial?.cuisine ?? '',
  tags: initial?.tags.join(', ') ?? '',
  practical: initial?.practicalInfo.join('\n') ?? '',
});
export function SettingsForm({
  path,
  initial,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  path: string;
  initial: Settings | null;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const confirm = useConfirmation();
  const incoming = JSON.stringify(formFor(initial));
  const incomingSeen = useRef(incoming);
  const [form, setForm] = useState(() => formFor(initial));
  const [baseline, setBaseline] = useState(incoming);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(form) !== baseline;
  const callbacks = useRef({ onDirtyChange, onBusyChange });
  callbacks.current = { onDirtyChange, onBusyChange };
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      callbacks.current.onDirtyChange?.(false);
      callbacks.current.onBusyChange?.(false);
    },
    [],
  );
  useEffect(() => {
    if (incomingSeen.current !== incoming) {
      incomingSeen.current = incoming;
      if (!dirty) {
        setForm(JSON.parse(incoming));
        setBaseline(incoming);
      }
    }
  }, [incoming, dirty]);
  const field = (key: keyof typeof form, value: string | boolean) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const lines = (value: string) =>
    value
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  async function discard() {
    if (
      await confirm({
        title: 'Forkaste ulagrede innstillinger?',
        message:
          'Priser og kapasitet går tilbake til sist lagrede verdier. Åpningstidene påvirkes ikke.',
        confirmLabel: 'Ja, forkast endringene',
      })
    ) {
      setForm(formFor(initial));
      setBaseline(incoming);
      setError('');
      setSaved(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      incoming !== baseline &&
      !(await confirm({
        title: 'Erstatte nyere innstillinger?',
        message:
          'Priser eller kapasitet ble endret mens du redigerte. Vil du lagre dette utkastet? Åpningstider beholdes.',
        confirmLabel: 'Ja, lagre utkastet',
      }))
    )
      return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      for (const key of ['maxGuests', 'radius', 'before', 'after'] as const)
        if (form[key].trim() === '')
          throw new Error(
            'Fyll inn alle kapasitets-, område- og riggverdiene.',
          );
      const settings = {
        enabled: form.enabled,
        fixedFeeMinor: parseMoney(form.fixedFee),
        maxGuests: Number(form.maxGuests),
        // Legacy API field remains stable; event rentals do not reserve food portions.
        maxPortions: initial?.maxPortions ?? 100000,
        serviceRadiusKm: Number(form.radius),
        bufferBeforeMinutes: Number(form.before),
        bufferAfterMinutes: Number(form.after),
        cuisine: form.cuisine.trim(),
        tags: form.tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        practicalInfo: lines(form.practical),
      };
      const result = await api<{ data: Settings }>(path, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      const normalized = formFor(result.data);
      setForm(normalized);
      setBaseline(JSON.stringify(normalized));
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="service-form service-card owner-settings-form"
      onSubmit={submit}
    >
      <span className="eyebrow">RAMMENE FOR GODE OPPDRAG</span>
      <h2>Pris, kapasitet og rigg</h2>
      <p>
        Gi kundene et tydelig prisgrunnlag. Åpningstider, ferie og
        bestillingsfrister redigeres i «Kalender og åpningstid» og beholdes når
        du lagrer her.
      </p>
      {error && (
        <div role="alert" className="service-banner error">
          {error}
        </div>
      )}
      {saved && (
        <p role="status" className="service-banner">
          Innstillingene er lagret. Åpningstidene er beholdt.
        </p>
      )}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Pris og kapasitet</legend>
        <label>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => field('enabled', e.target.checked)}
            style={{ width: 'auto' }}
          />{' '}
          Åpne for forespørsler når alle opplysninger er klare
        </label>
        <div className="form-grid">
          {(
            [
              {
                key: 'fixedFee',
                label: 'Leiepris inkl. transport og rigg (NOK)',
                step: '0.01',
                min: 0,
                max: 1000000,
              },
              {
                key: 'maxGuests',
                label: 'Maksimalt antall gjester',
                step: '1',
                min: 1,
                max: 100000,
              },
              {
                key: 'radius',
                label: 'Tjenesteradius fra basen (km)',
                step: '0.1',
                min: 0.1,
                max: 3000,
              },
              {
                key: 'before',
                label: 'Rigg før servering (minutter)',
                step: '1',
                min: 0,
                max: 1440,
              },
              {
                key: 'after',
                label: 'Rydding etter servering (minutter)',
                step: '1',
                min: 0,
                max: 1440,
              },
            ] as const
          ).map((item) => (
            <label className="field" key={item.key}>
              <span>{item.label}</span>
              <input
                required
                type="number"
                min={item.min}
                max={item.max}
                step={item.step}
                value={form[item.key]}
                onChange={(e) => field(item.key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Kjøkken / matstil</span>
          <input
            required
            maxLength={100}
            value={form.cuisine}
            onChange={(e) => field('cuisine', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Stikkord, skilt med komma</span>
          <input
            value={form.tags}
            onChange={(e) => field('tags', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Praktisk informasjon – ett punkt per linje</span>
          <textarea
            rows={3}
            value={form.practical}
            onChange={(e) => field('practical', e.target.value)}
          />
        </label>
      </fieldset>
      <p className="schedule-help">
        Rigg før servering og rydding etterpå reserverer tid rundt oppdraget.
        Selve serveringen må være innenfor åpningstidene.
      </p>
      <div className="service-actions">
        <span role="status">
          {dirty ? 'Ulagrede endringer' : 'Ingen ulagrede endringer'}
        </span>
        <button
          type="button"
          disabled={busy || !dirty}
          className="button button-secondary"
          onClick={() => void discard()}
        >
          Forkast
        </button>
        <button disabled={busy || !dirty} className="button button-primary">
          {busy ? 'Lagrer …' : 'Lagre innstillinger'}
        </button>
      </div>
    </form>
  );
}
