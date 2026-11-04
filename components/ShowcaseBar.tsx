'use client';
import { useConfirmation } from '@/components/ConfirmationProvider';
import Link from '@/components/AppLink';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDemo } from './DemoProvider';
import { post, errorMessage } from '@/lib/booking/client';

export function ShowcaseBar() {
  const { showcase } = useDemo();
  const confirm = useConfirmation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ownerPage = usePathname() === '/eier';
  if (!showcase) return null;
  async function reset() {
    if (
      busy ||
      !(await confirm({
        title: 'Starte demoen på nytt?',
        message:
          'Dine demoforespørsler, bilder og endringer slettes. Andre besøkendes demo påvirkes ikke.',
        confirmLabel: 'Ja, nullstill min demo',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await post('demo/reset', {});
      try {
        localStorage.removeItem('humbites-favorites-v1');
      } catch {}
      window.location.assign('/');
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  return (
    <aside className="showcase-bar" aria-label="Demonstrasjon">
      <div>
        <strong>Prøv hele Humbites</strong>
        <span>
          Din egen demo · ingen ekte bestilling, betaling eller e-post. Bruk
          eksempelopplysninger.
        </span>
      </div>
      <nav aria-label="Demoverktøy">
        {!ownerPage && (
          <>
            <Link href="/mine-foresporsler">Mine demoforespørsler</Link>
            <Link href="/eier">Åpne eierdemo</Link>
          </>
        )}
        <button disabled={busy} onClick={() => void reset()}>
          {busy ? 'Nullstiller …' : 'Start på nytt'}
        </button>
      </nav>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
