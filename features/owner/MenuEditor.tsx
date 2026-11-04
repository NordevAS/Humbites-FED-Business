/** Edits menu assignments and prices through the owner API. Existing quotes may need recalculation after menu changes. */
'use client';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, post } from '@/lib/booking/client';
import { formatNok } from '@/domain';
import { parseMoney } from './SettingsForm';
import { uploadPhoto } from './ImageManager';
import { CategoryManager } from './CategoryManager';
import type { MenuCategory } from '@/domain';
export type OwnerItem = {
  id: string | number;
  name: string;
  description: string;
  basePrice: number;
  priceMinor: number;
  enabled: boolean;
  allergenIds: number[];
  categoryIds?: number[];
  allergens: string[];
  image?: string | null;
  imageUrl?: string | null;
};
export function MenuEditor({
  path,
  mediaPath,
  items,
  allergens,
  categories,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  path: string;
  mediaPath: string;
  items: OwnerItem[];
  allergens: { id: number; name: string }[];
  categories: MenuCategory[];
  onSaved: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const confirm = useConfirmation();
  const empty = {
    id: '',
    name: '',
    description: '',
    price: '',
    enabled: true,
    allergenIds: [] as number[],
    categoryIds: [] as number[],
  };
  const [form, setForm] = useState(empty);
  const [baseline, setBaseline] = useState(JSON.stringify(empty));
  const [menuBusy, setBusy] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryDirty, setCategoryDirty] = useState(false);
  const busy = menuBusy || categoryBusy;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const menuDirty =
    JSON.stringify(form) !== baseline || Object.keys(photos).length > 0;
  const dirty = menuDirty || categoryDirty;
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
  // Reuse the portal's guard for tab/truck navigation, and guard replacing a form here.
  async function replaceForm(next: typeof empty) {
    if (
      busy ||
      (menuDirty &&
        !(await confirm({
          title: 'Forkaste menyutkastet?',
          message:
            'Du har endringer som ikke er lagret. Avbryt for å beholde dem.',
          confirmLabel: 'Forkast utkastet',
        })))
    )
      return;
    setForm(next);
    setBaseline(JSON.stringify(next));
    setPhotos({});
    setError('');
  }
  async function photo(id: string | number) {
    const file = photos[String(id)];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await uploadPhoto(mediaPath, file, id);
      setPhotos((current) => {
        const next = { ...current };
        delete next[String(id)];
        return next;
      });
      await onSaved();
      setNotice('Bildet til retten er lagret.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = {
        name: form.name,
        description: form.description,
        basePrice: parseMoney(form.price) / 100,
        enabled: form.enabled,
        allergenIds: form.allergenIds,
        categoryIds: form.categoryIds,
      };
      if (form.id)
        await api(`${path}/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      else await post(path, body);
      setForm(empty);
      setBaseline(JSON.stringify(empty));
      await onSaved();
      setNotice('Menyen er lagret.');
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string | number) {
    if (
      busy ||
      !(await confirm({
        title: 'Fjerne retten fra menyen?',
        message:
          'Retten tas bort fra denne demotrucken. Lagrede demoforespørsler beholder sitt opprinnelige prisgrunnlag.',
        confirmLabel: 'Ja, fjern retten',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`${path}/${id}`, { method: 'DELETE', body: '{}' });
      if (form.id === String(id)) {
        setForm(empty);
        setBaseline(JSON.stringify(empty));
      }
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <CategoryManager
        path={path.replace(/\/menu$/, '/menu-categories')}
        categories={categories}
        assignments={items}
        draftCategoryIds={form.categoryIds}
        disabled={menuBusy}
        onSaved={onSaved}
        onDirtyChange={setCategoryDirty}
        onBusyChange={setCategoryBusy}
      />
      <div className="service-card">
        <h2>Truckens meny</h2>
        <p>
          Endring av en rett gjelder alle trucks som bruker samme rett. Fjerning
          her tar den bare bort fra denne trucken.
        </p>
        {items.length === 0 && <p>Ingen retter er knyttet til trucken ennå.</p>}
        {items.map((item) => (
          <article className="owner-item" key={item.id}>
            {(item.image || item.imageUrl) && (
              <img
                src={item.image || item.imageUrl || undefined}
                alt={item.name}
                width="120"
                height="90"
                style={{ objectFit: 'cover', borderRadius: 12 }}
              />
            )}
            <h3>{item.name}</h3>
            <p>
              {formatNok(item.priceMinor)} / porsjon ·{' '}
              {item.enabled ? 'Aktiv' : 'Deaktivert'}
            </p>
            <p>Allergener: {item.allergens.join(', ') || 'Ikke oppgitt'}</p>
            <p>
              Kategorier:{' '}
              {categories
                .filter((category) => item.categoryIds?.includes(category.id))
                .map((category) => category.name)
                .join(', ') || 'Uten kategori'}
            </p>
            <div className="service-actions">
              <button
                type="button"
                disabled={busy}
                className="button button-secondary"
                onClick={() =>
                  void replaceForm({
                    id: String(item.id),
                    name: item.name,
                    description: item.description,
                    price: String(item.priceMinor / 100),
                    enabled: item.enabled,
                    allergenIds: item.allergenIds ?? [],
                    categoryIds: item.categoryIds ?? [],
                  })
                }
              >
                Rediger
              </button>
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={() => void remove(item.id)}
              >
                Fjern fra trucken
              </button>
            </div>
            <label className="field">
              <span>Bilde av {item.name}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    setPhotos((current) => ({
                      ...current,
                      [String(item.id)]: file,
                    }));
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || !photos[String(item.id)]}
              className="button button-secondary"
              onClick={() => void photo(item.id)}
            >
              Last opp bilde til retten
            </button>
          </article>
        ))}
      </div>
      <form className="service-card service-form" onSubmit={save}>
        <h2>{form.id ? 'Rediger rett' : 'Legg til en rett'}</h2>
        {menuDirty && <p role="status">Ulagret menyutkast</p>}
        {error && (
          <p role="alert" className="service-banner error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="service-banner">
            {notice}
          </p>
        )}
        <label className="field">
          <span>Navn</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Beskrivelse</span>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Pris per porsjon (NOK)</span>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </label>
        <fieldset disabled={busy}>
          <legend>Kategorier</legend>
          <p>Ingen valgte kategorier viser retten under «Uten kategori».</p>
          {categories.map((category) => (
            <label
              key={category.id}
              style={{ display: 'block', margin: '.5rem 0' }}
            >
              <input
                style={{ width: 'auto' }}
                type="checkbox"
                checked={form.categoryIds.includes(category.id)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    categoryIds: event.target.checked
                      ? [...form.categoryIds, category.id]
                      : form.categoryIds.filter((id) => id !== category.id),
                  })
                }
              />{' '}
              {category.name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Allergener</legend>
          <p>
            Oppgi alle kjente allergener. Et tomt valg blir vist som «ikke
            oppgitt».
          </p>
          {allergens.map((option) => (
            <label
              key={option.id}
              style={{ display: 'block', margin: '.5rem 0' }}
            >
              <input
                style={{ width: 'auto' }}
                type="checkbox"
                checked={form.allergenIds.includes(option.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allergenIds: e.target.checked
                      ? [...form.allergenIds, option.id]
                      : form.allergenIds.filter((id) => id !== option.id),
                  })
                }
              />{' '}
              {option.name}
            </label>
          ))}
        </fieldset>
        <label>
          <input
            style={{ width: 'auto' }}
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />{' '}
          Retten kan bestilles
        </label>
        <div className="service-actions">
          <button disabled={busy} className="button button-primary">
            {busy ? 'Lagrer …' : 'Lagre rett'}
          </button>
          {(form.id || menuDirty) && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void replaceForm(empty)}
            >
              Avbryt redigering
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
