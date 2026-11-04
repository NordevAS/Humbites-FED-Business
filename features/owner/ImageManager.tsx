'use client';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { useCallback, useEffect, useState } from 'react';
import { api, post, errorMessage } from '@/lib/booking/client';
type Photo = {
  id: string | number;
  status: string;
  sortOrder: number;
  url: string | null;
};
type Upload = {
  id: string | number;
  uploadId: string;
  uploadToken: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  status: string;
};
export async function uploadPhoto(
  path: string,
  file: File,
  itemId?: string | number,
) {
  const start = await post<{ data: Upload }>(
    `${path}/${itemId ? `menu/${itemId}/images` : 'images'}`,
    { contentType: file.type, contentLength: file.size },
  );
  const url = new URL(start.data.uploadUrl);
  if (url.origin !== window.location.origin || url.protocol !== 'https:')
    throw new Error('Opplastingsadressen kunne ikke bekreftes.');
  const sent = await fetch(start.data.uploadUrl, {
    method: 'PUT',
    headers: { ...start.data.headers, 'Content-Type': file.type },
    body: file,
    credentials: 'same-origin',
    referrerPolicy: 'no-referrer',
  });
  if (!sent.ok) throw new Error('Bildet ble ikke lastet opp. Prøv igjen.');
  await post(
    `${path}/uploads/${encodeURIComponent(start.data.uploadId)}/complete`,
    { uploadToken: start.data.uploadToken },
  );
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
        title: 'Fjerne dette demobildet?',
        message: 'Bildet fjernes fra trucken i ditt demoområde.',
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
      <h2>Truckbilder</h2>
      <p>
        Last opp et eksempelbilde du har rett til å bruke (JPEG, PNG eller WebP,
        maks 5 MB). Det vises bare i ditt demoområde og fjernes når demoen
        nullstilles.
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
              {photo.status === 'COMPLETED'
                ? 'Lagret demobilde'
                : 'Opplasting ikke fullført'}
            </p>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => void remove(photo)}
            >
              Fjern bilde
            </button>
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
