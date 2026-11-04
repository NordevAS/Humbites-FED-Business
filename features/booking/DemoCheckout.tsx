'use client';
import Link from '@/components/AppLink';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, post, errorMessage } from '@/lib/booking/client';
import type { Payment } from '@/lib/booking/types';
import { formatNok } from '@/domain';

export function DemoCheckout({ id }: { id: string }) {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api<{ data: Payment | null }>(`requests/${id}/payment`)
      .then((result) => {
        if (active) setPayment(result.data);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function decide(decision: 'authorize' | 'abort') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await post(`demo/payments/${id}/${decision}`, {});
      router.push(`/kvittering/${id}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  return (
    <main id="main" className="container">
      <section className="showcase-checkout service-card">
        <span className="eyebrow">SIMULERT BETALING</span>
        <h1>Prøv det siste steget.</h1>
        <p>
          Dette er Humbites sin betalingsdemo. Ingen bank, kort eller
          Vipps-konto brukes, og ingen penger trekkes.
        </p>
        {loading && <p role="status">Henter demoen …</p>}
        {error && (
          <p role="alert" className="service-banner error">
            {error}
          </p>
        )}
        {payment && (
          <>
            <div className="quote-total">
              <span>Demobeløp</span>
              <strong>{formatNok(payment.amountMinor)}</strong>
            </div>
            {payment.state === 'CREATED' ? (
              <>
                <p>
                  Godkjenn en simulert reservasjon. I eierdemoen kan du deretter
                  prøve belastning, frigivelse og refusjon.
                </p>
                <div className="service-actions">
                  <button
                    disabled={busy}
                    className="button button-primary"
                    onClick={() => void decide('authorize')}
                  >
                    {busy ? 'Oppdaterer …' : 'Simuler godkjent betaling'}
                  </button>
                  <button
                    disabled={busy}
                    className="button button-secondary"
                    onClick={() => void decide('abort')}
                  >
                    Simuler avbrutt betaling
                  </button>
                </div>
              </>
            ) : (
              <p>
                Dette betalingsforsøket er allerede behandlet. Se oppdatert
                status på kvitteringen.
              </p>
            )}
          </>
        )}
        <div className="service-actions">
          <Link href={`/kvittering/${id}`} className="text-link">
            Tilbake til demokvitteringen
          </Link>
        </div>
      </section>
    </main>
  );
}
