'use client';
import { useEffect, useState } from 'react';
import type { MenuCategory } from '@/domain';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { api, errorMessage, post } from '@/lib/booking/client';

/** Category changes are independent of the dish draft; assigned categories cannot be deleted. */
export function CategoryManager({
  path,
  categories,
  assignments,
  draftCategoryIds,
  disabled,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  path: string;
  categories: MenuCategory[];
  assignments: { categoryIds?: number[] }[];
  draftCategoryIds: number[];
  disabled: boolean;
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const confirm = useConfirmation();
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = name !== (editing?.name ?? '');
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      onBusyChange(false);
    },
    [onDirtyChange, onBusyChange],
  );
  async function select(category: MenuCategory | null) {
    if (
      busy ||
      disabled ||
      (dirty &&
        !(await confirm({
          title: 'Forkaste kategoriutkastet?',
          message: 'Navnet er ikke lagret ennå.',
          confirmLabel: 'Forkast utkastet',
        })))
    )
      return;
    setEditing(category);
    setName(category?.name ?? '');
    setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (editing)
        await api(`${path}/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        });
      else await post(path, { name });
      setEditing(null);
      setName('');
      await onSaved();
      setMessage('Kategorien er lagret.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function remove(category: MenuCategory) {
    if (
      busy ||
      disabled ||
      !(await confirm({
        title: `Slette «${category.name}»?`,
        message: 'Bare tomme kategorier kan slettes. Rettene beholdes.',
        confirmLabel: 'Slett kategorien',
      }))
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`${path}/${category.id}`, { method: 'DELETE', body: '{}' });
      if (editing?.id === category.id) {
        setEditing(null);
        setName('');
      }
      await onSaved();
      setMessage('Kategorien er slettet.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="service-card">
      <h2>Menykategorier</h2>
      <p>
        Lag dine egne kategorier, for eksempel Dessert, Drikke eller Ekstra.
        Velg kategorier når du redigerer en rett.
      </p>
      {categories.length === 0 && (
        <p>Ingen kategorier ennå. Rettene vises uten kategori.</p>
      )}
      {categories.map((category) => {
        const count = assignments.filter((item) =>
          item.categoryIds?.includes(category.id),
        ).length;
        const selectedInDraft = draftCategoryIds.includes(category.id);
        return (
          <div className="owner-item" key={category.id}>
            <h3>{category.name}</h3>
            <p>
              {count} {count === 1 ? 'rett' : 'retter'}
              {count > 0 ? ' – flytt rettene før kategorien kan slettes.' : ''}
            </p>
            {selectedInDraft && (
              <p>
                Valgt i menyutkastet. Fjern valget der før du sletter
                kategorien.
              </p>
            )}
            <div className="service-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={busy || disabled}
                onClick={() => void select(category)}
              >
                Endre navn
              </button>
              <button
                type="button"
                className="text-link"
                disabled={busy || disabled || count > 0 || selectedInDraft}
                onClick={() => void remove(category)}
              >
                Slett kategori
              </button>
            </div>
          </div>
        );
      })}
      <form className="service-form" onSubmit={save}>
        <label className="field">
          <span>{editing ? 'Nytt kategorinavn' : 'Ny kategori'}</span>
          <input
            required
            maxLength={60}
            value={name}
            disabled={busy || disabled}
            onChange={(event) => setName(event.target.value)}
            placeholder="For eksempel Dessert"
          />
        </label>
        {error && (
          <p role="alert" className="service-banner error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <div className="service-actions">
          <button
            className="button button-primary"
            disabled={
              busy || disabled || !name.trim() || (Boolean(editing) && !dirty)
            }
          >
            {busy ? 'Lagrer …' : editing ? 'Lagre navn' : 'Legg til kategori'}
          </button>
          {(editing || name) && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy || disabled}
              onClick={() => void select(null)}
            >
              Avbryt
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
