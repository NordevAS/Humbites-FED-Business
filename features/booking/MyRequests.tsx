'use client';
import Link from '@/components/AppLink';
import { useCallback, useEffect, useState } from 'react';
import { ensureShowcaseSession } from '@/lib/booking/showcase-client';
import { api, errorMessage } from '@/lib/booking/client';
import { statusLabel, type BookingRecord } from '@/lib/booking/types';
import { formatNok } from '@/domain';
import { dateLabel } from './QuoteSummary';

export function MyRequests() {
  const [requests, setRequests] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ensureShowcaseSession();
      const result = await api<{ data: BookingRecord[] }>('demo/requests');
      setRequests(result.data);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <main id="main" className="container service-page">
      <span className="eyebrow">DIN EGEN PRØVERUNDE</span>
      <h1>Mine demoforespørsler.</h1>
      <p>
        Gå fra kunde til truckeier og tilbake. Demoen husker forespørslene i
        denne nettleseren i inntil 24 timer. Ingen ekte booking eller betaling
        utføres.
      </p>
      <div className="service-actions">
        <Link href="/foodtrucks" className="button button-primary">
          Lag en ny forespørsel
        </Link>
        <Link href="/eier" className="button button-secondary">
          Åpne eierdemo
        </Link>
        <button
          disabled={loading}
          className="text-link"
          onClick={() => void refresh()}
        >
          Oppdater
        </button>
      </div>
      {error && (
        <p role="alert" className="service-banner error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Henter demoforespørsler …</p>
      ) : requests.length ? (
        <div className="showcase-list">
          {requests.map((booking) => (
            <article className="service-card" key={booking.id}>
              <span className="service-status">
                {statusLabel[booking.status]}
              </span>
              <h2>{booking.foodtruckName}</h2>
              <p>
                {dateLabel(booking.event.date)} · {booking.event.startTime}
                <br />
                {booking.quote.pricingModel === 'rental-v1'
                  ? booking.quote.lines.length
                  : booking.quote.portionCount}{' '}
                {booking.quote.pricingModel === 'rental-v1'
                  ? 'retter valgt'
                  : 'porsjoner (tidligere modell)'}{' '}
                · {formatNok(booking.quote.totalMinor)}
              </p>
              <Link
                className="button button-secondary"
                href={`/kvittering/${booking.id}`}
              >
                Åpne demokvittering
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="service-state">
          <h2>Den første samlingen venter.</h2>
          <p>
            Velg en foodtruck, bruk et eksempelarrangement og lagre en
            demoforespørsel. Deretter kan du godkjenne den i eierdemoen.
          </p>
        </div>
      )}
    </main>
  );
}
