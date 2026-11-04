'use client';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { useCallback, useEffect, useState } from 'react';
import { api, post, errorMessage } from '@/lib/booking/client';
type Photo = {
  id: string | number;
  status: string;
  sortOrder: number;
  url: string | null;
  isMain?: boolean;
  usedInMenu?: boolean;
};
type Upload = {
  id: string | number;
  uploadUrl: string;
  key: string;
  status: string;
};
export async function uploadPhoto(
  path: string,
  file: File,
  purpose: 'GALLERY' | 'LOGO' = 'GALLERY',
) {
  const start = await post<{ data: Upload }>(
    `${path}/images`,
    { contentType: file.type, contentLength: file.size, purpose },
  );
  const url = new URL(start.data.uploadUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.r2.cloudflarestorage.com'))
    throw new Error('Opplastingsadressen kunne ikke bekreftes.');
  const sent = await fetch(start.data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!sent.ok) throw new Error('Bildet ble ikke lastet opp. Prøv igjen.');
  await post(`${path}/images/${start.data.id}/complete`, {});
}
export function ImageManager({
  path,
  onSaved,
}: {
  path: string;
  onSaved: () => void;
}) {
  const confirm = useConfirmation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    const result = await api<{ data: Photo[] }>(`${path}/images`);
    setPhotos(result.data);
  }, [path]);
  useEffect(() => {
    void refresh().catch((e) => setError(errorMessage(e)));
  }, [refresh]);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await uploadPhoto(path, file);
      setFile(null);
      await refresh();
      onSaved();
      setNotice('Bildet er lastet opp og bekreftet.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(photo: Photo) {
    if (
      busy ||
      !(await confirm({
        title: 'Slette bildet?',
        message: 'Bildet slettes fra R2 og fjernes fra truckens galleri.',
        confirmLabel: 'Ja, fjern bildet',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`${path}/images/${photo.id}`, { method: 'DELETE', body: '{}' });
      await refresh();
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="service-card">
      <h2>Hovedbilde</h2>
      <p>
        Velg hvilket bilde som vises først på den offentlige profilen.
      </p>
      {error && (
        <div className="service-banner error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="service-banner" role="status">
          {notice}
        </div>
      )}
      {photos.find((photo) => photo.isMain)?.url ? (
        <div className="service-card">
          <img src={photos.find((photo) => photo.isMain)?.url ?? ''} alt="Hovedbilde" style={{ width: '100%', maxWidth: 640, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12 }} />
          <p>Dette bildet er valgt som hovedbilde.</p>
          <button type="button" className="text-link" disabled={busy} onClick={() => void api(`${path}/images/main`, { method: 'DELETE', body: '{}' }).then(refresh).then(onSaved).catch((e) => setError(errorMessage(e)))}>Fjern hovedbildet</button>
        </div>
      ) : <p>Ingen hovedbilde valgt.</p>}
      <h2>Bildegalleri</h2>
      <p>Bildene kan også brukes på menyretter uten å lastes opp på nytt.</p>
      <div className="truck-grid">
        {photos.map((photo) => (
          <article key={photo.id}>
            {photo.url && (
              <img
                src={photo.url}
                alt="Truckbilde"
                width="320"
                height="220"
                style={{ width: '100%', height: 'auto', borderRadius: 12 }}
              />
            )}
            <p>
              {photo.isMain ? 'Hovedbilde' : photo.usedInMenu ? 'Brukes i menyen' : 'I galleriet'}
            </p>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => void (photo.isMain ? api(`${path}/images/main`, { method: 'DELETE', body: '{}' }).then(refresh).then(onSaved) : remove(photo)).catch((e) => setError(errorMessage(e)))}
            >
              {photo.isMain ? 'Fjern som hovedbilde' : 'Fjern bilde'}
            </button>
            {!photo.isMain && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void api(`${path}/images/${photo.id}/main`, { method: 'PATCH', body: '{}' }).then(refresh).then(onSaved).catch((e) => setError(errorMessage(e)))}>Bruk som hovedbilde</button>}
          </article>
        ))}
      </div>
      <form onSubmit={upload} className="service-form">
        <label className="field">
          <span>Velg bilde</span>
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button disabled={busy || !file} className="button button-primary">
          {busy ? 'Laster opp …' : 'Last opp bilde'}
        </button>
      </form>
    </section>
  );
}
