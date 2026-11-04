'use client';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/booking/client';
import { uploadPhoto } from './ImageManager';

export function TruckLogoManager({ path, logoUrl, onSaved }: { path: string; logoUrl?: string | null; onSaved: () => Promise<void> | void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await uploadPhoto(path, file, 'LOGO');
      setFile(null);
      await onSaved();
      setNotice('Logoen er oppdatert.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api(`${path}/logo`, { method: 'DELETE', body: '{}' }); await onSaved(); setNotice('Logoen er fjernet.'); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="service-card">
    <h2>Logo</h2>
    <p>Logoen vises separat fra hovedbildet og bildegalleriet.</p>
    {error && <p className="service-banner error" role="alert">{error}</p>}
    {notice && <p className="service-banner" role="status">{notice}</p>}
    {logoUrl ? <div><img src={logoUrl} alt="Bedriftens logo" width="180" height="180" style={{ objectFit: 'contain', borderRadius: 12 }} /><button type="button" className="text-link" disabled={busy} onClick={() => void remove()}>Fjern logo</button></div> : <p>Ingen logo er lastet opp.</p>}
    <form className="service-form" onSubmit={(event) => void save(event)}>
      <label className="field"><span>{logoUrl ? 'Bytt logo' : 'Last opp logo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <button className="button button-primary" disabled={busy || !file}>{busy ? 'Laster opp …' : 'Lagre logo'}</button>
    </form>
  </section>;
}
