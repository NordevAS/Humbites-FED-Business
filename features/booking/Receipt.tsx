'use client';
import { useConfirmation } from '@/components/ConfirmationProvider';
import Link from '@/components/AppLink';
import { useDemo } from '@/components/DemoProvider';
import { ensureShowcaseSession } from '@/lib/booking/showcase-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, post, ApiError, errorMessage } from '@/lib/booking/client';
import {
  statusLabel,
  type BookingRecord,
  type Payment,
} from '@/lib/booking/types';
import { formatNok } from '@/domain';
import { dateLabel } from './QuoteSummary';
import { paymentLabel, canStartPayment } from '@/lib/booking/payment-state';

export function Receipt({ id }: { id: string }) {
  const { showcase } = useDemo();
  const confirm = useConfirmation();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [privateLink, setPrivateLink] = useState('');
  const [notice, setNotice] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [paymentEnvironment, setPaymentEnvironment] = useState('');
  const paymentKey = useRef('');
  const title = useRef<HTMLHeadingElement>(null);
  const retriedTerminal = useRef('');
  const refresh = useCallback(async () => {
    const result = await api<{ data: BookingRecord }>(`requests/${id}`);
    setBooking(result.data);
    try {
      const config = await api<{ enabled: boolean; environment?: string }>(
        'payment-config',
      );
      setPaymentsEnabled(config.enabled);
      setPaymentEnvironment(config.environment ?? '');
      if (config.enabled) {
        try {
          const info = await api<{ data: Payment | null }>(
            `requests/${id}/payment`,
          );
          setPayment(info.data);
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 404)) throw e;
        }
      }
    } catch {
      setNotice(
        'Betalingsstatus kunne ikke hentes. Forespørselen din er fortsatt lagret.',
      );
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access = fragment.get('access');
    if (access) window.history.replaceState(null, '', window.location.pathname);
    async function load() {
      try {
        if (showcase) await ensureShowcaseSession();
        if (access) {
          await post(`requests/${id}/access`, { token: access });
          if (active)
            setPrivateLink(
              `${window.location.origin}/kvittering/${id}#access=${encodeURIComponent(access)}`,
            );
        }
        await refresh();
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, refresh, showcase]);
  useEffect(() => {
    if (booking) title.current?.focus();
  }, [booking?.id]);
  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (
      busy ||
      !(await confirm({
        title: 'Trekke demoforespørselen?',
        message:
          'Forespørselen markeres som avlyst i denne demoen. Ingen ekte kunde eller truckeier varsles.',
        confirmLabel: 'Ja, trekk forespørselen',
      }))
    )
      return;
    await action(async () => {
      const result = await post<{ data: BookingRecord }>(
        `requests/${id}/cancel`,
        {},
      );
      setBooking(result.data);
    });
  }
  async function restore() {
    let raw = token.trim();
    try {
      if (raw.includes('#')) raw = new URL(raw).hash.slice(1);
      if (raw.startsWith('access='))
        raw = new URLSearchParams(raw).get('access') ?? '';
    } catch {
      throw new ApiError('Lim inn hele den private kvitteringslenken.', 400);
    }
    await post(`requests/${id}/access`, { token: raw });
    setToken('');
    setPrivateLink(
      `${window.location.origin}/kvittering/${id}#access=${encodeURIComponent(raw)}`,
    );
    await refresh();
  }
  async function copyLink() {
    let link = privateLink;
    if (!link) {
      const result = await post<{ token: string }>(`requests/${id}/access`, {});
      link = `${window.location.origin}/kvittering/${id}#access=${encodeURIComponent(result.token)}`;
      setPrivateLink(link);
    }
    try {
      await navigator.clipboard.writeText(link);
      setNotice('Privat lenke kopiert. Lagre den på et trygt sted.');
    } catch {
      setNotice(
        'Den private lenken vises nedenfor. Kopier eller bokmerk den selv.',
      );
    }
  }
  async function startPayment() {
    if (payment?.state === 'CREATED' && payment.redirectUrl) {
      const url = new URL(payment.redirectUrl);
      if (
        showcase
          ? url.origin !== window.location.origin ||
            url.pathname !== `/demobetaling/${id}`
          : url.protocol !== 'https:'
      )
        throw new ApiError('Betalingslenken kunne ikke bekreftes.', 502);
      window.location.assign(payment.redirectUrl);
      return;
    }
    if (
      payment &&
      ['EXPIRED', 'ABORTED', 'TERMINATED'].includes(payment.state) &&
      retriedTerminal.current !== payment.id
    ) {
      paymentKey.current = crypto.randomUUID();
      retriedTerminal.current = payment.id;
    }
    if (!paymentKey.current) paymentKey.current = crypto.randomUUID();
    const result = await post<{ data: Payment }>(
      `requests/${id}/payment`,
      {},
      { 'Idempotency-Key': paymentKey.current },
    );
    setPayment(result.data);
    if (result.data.redirectUrl) {
      const url = new URL(result.data.redirectUrl);
      if (
        showcase
          ? url.origin !== window.location.origin ||
            url.pathname !== `/demobetaling/${id}`
          : url.protocol !== 'https:'
      )
        throw new ApiError(
          'Betalingslenken kunne ikke bekreftes. Prøv igjen senere.',
          502,
        );
      window.location.assign(result.data.redirectUrl);
    } else
      setNotice(
        'Betalingen er opprettet. Oppdater status for å se resultatet.',
      );
  }
  return (
    <main id="main" className="container service-page">
      <span className="eyebrow">DITT ARRANGEMENT</span>
      <h1 ref={title} tabIndex={-1}>
        {showcase ? 'Demokvitteringen din.' : 'Forespørselen din.'}
      </h1>
      {loading && <p role="status">Henter kvitteringen …</p>}
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
      {!loading && !booking && (
        <form
          className="service-card service-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action(restore);
          }}
        >
          <h2>Åpne med den private lenken.</h2>
          <p>
            Lenken gir tilgang til kontaktopplysningene og forespørselen. Del
            den bare med personer du vil gi tilgang.
          </p>
          <label className="field">
            <span>Privat kvitteringslenke</span>
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <button disabled={busy} className="button button-primary">
            Åpne forespørsel
          </button>
        </form>
      )}
      {booking && showcase && (
        <div className="showcase-help">
          <strong>
            {booking.status === 'PENDING'
              ? 'Nå kan du prøve den andre siden.'
              : 'Dette er din lagrede prøvebooking.'}
          </strong>
          <p>
            Åpne eierdemoen for å behandle forespørselen. Kom tilbake hit for å
            oppdatere status og prøve betalingen. Ingen ekte truckeier blir
            kontaktet.
          </p>
          <Link
            className="button button-secondary"
            href={`/eier?truck=${booking.foodtruckId}`}
          >
            Behandle i eierdemoen
          </Link>
        </div>
      )}
      {booking && (
        <div className="service-columns">
          <div>
            <section className="service-card">
              <span className="service-status">
                {statusLabel[booking.status]}
              </span>
              <h2>{booking.foodtruckName}</h2>
              <p>
                {booking.status === 'PENDING'
                  ? 'Forespørselen er lagret. Eieren må godkjenne den før oppdraget er bekreftet.'
                  : ''}
              </p>
              <dl>
                <dt>Sted</dt>
                <dd>{booking.event.location.label}</dd>
                <dt>Når</dt>
                <dd>
                  {dateLabel(booking.event.date)} kl. {booking.event.startTime}{' '}
                  · {booking.event.durationHours} timer
                </dd>
                <dt>Gjester og mat</dt>
                <dd>
                  {booking.event.guestCount} gjester ·{' '}
                  {booking.quote.pricingModel === 'rental-v1'
                    ? booking.quote.lines.length
                    : booking.quote.portionCount}{' '}
                  {booking.quote.pricingModel === 'rental-v1'
                    ? 'retter valgt'
                    : 'porsjoner (tidligere modell)'}
                </dd>
                <dt>Kontakt</dt>
                <dd>
                  {booking.contact.name}
                  <br />
                  {booking.contact.email}
                  <br />
                  {booking.contact.phone}
                </dd>
                <dt>Referanse</dt>
                <dd>{booking.id}</dd>
              </dl>
              {booking.event.notes && <p>{booking.event.notes}</p>}
              <div className="service-actions">
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void action(refresh)}
                >
                  Oppdater status
                </button>
                {booking.status === 'PENDING' && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void withdraw()}
                  >
                    Trekk forespørselen
                  </button>
                )}
              </div>
            </section>
            <section className="service-card">
              <h2>Lagre kvitteringen.</h2>
              <p>
                Den private lenken er nøkkelen til forespørselen.{' '}
                {showcase
                  ? 'Lenken kan åpne denne demokvitteringen i en annen nettleser, men gir ikke tilgang til eierdemoen.'
                  : 'Den fungerer også i en annen nettleser.'}{' '}
                Kontaktopplysningene vises bare når tilgangen er bekreftet.
              </p>
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void action(copyLink)}
              >
                Kopier privat lenke
              </button>
              {privateLink && (
                <p className="private-link">
                  <a href={privateLink} rel="noreferrer">
                    Privat lenke – bokmerk denne
                  </a>
                </p>
              )}
            </section>
            <section className="service-card">
              <h2>Betaling</h2>
              {!paymentsEnabled ? (
                <p>
                  Betaling er ikke aktivert her. Det er ikke trukket penger ved
                  innsending.
                </p>
              ) : (
                <>
                  <p>
                    {showcase
                      ? 'Dette er en intern betalingssimulering. Ingen penger, kort eller Vipps-konto brukes.'
                      : paymentEnvironment === 'test'
                        ? 'Vipps er i testmiljø. Ingen reell betaling.'
                        : 'Betaling håndteres hos Vipps.'}
                  </p>
                  {payment && (
                    <p>
                      Status: <strong>{paymentLabel(payment)}</strong>.
                      Belastet: {formatNok(payment.capturedMinor)}. Refundert:{' '}
                      {formatNok(payment.refundedMinor)}.
                    </p>
                  )}
                  {booking.status === 'ACCEPTED' &&
                    canStartPayment(payment) && (
                      <button
                        className="button button-primary"
                        disabled={busy}
                        onClick={() => void action(startPayment)}
                      >
                        {payment?.state === 'INITIATING'
                          ? 'Hent betalingslenken igjen'
                          : showcase
                            ? 'Prøv demobetaling'
                            : 'Fortsett til Vipps'}{' '}
                        · {formatNok(booking.quote.totalMinor)}
                      </button>
                    )}
                  {booking.status !== 'ACCEPTED' && (
                    <p>
                      Betaling kan først startes etter at eieren har godkjent
                      oppdraget.
                    </p>
                  )}
                  <p>
                    {showcase
                      ? 'Beløp og betalingsstatus er simulerte. Prøv belastning og refusjon i eierdemoen.'
                      : 'En retur fra Vipps bekrefter ikke betaling. Bruk «Oppdater status» for verifisert resultat.'}
                  </p>
                </>
              )}
            </section>
          </div>
          <aside className="service-card">
            <h2>Prisgrunnlag</h2>
            {booking.quote.lines.map((line) => (
              <div className="quote-fee" key={line.itemId}>
                <span>
                  {booking.quote.pricingModel === 'rental-v1'
                    ? line.name
                    : `${line.quantity} × ${line.name}`}
                  <small>
                    {booking.quote.pricingModel === 'rental-v1'
                      ? 'Tilbys til gjestene, betales separat'
                      : formatNok(line.unitPriceMinor) + ' / porsjon'}
                  </small>
                </span>
                {booking.quote.pricingModel !== 'rental-v1' && (
                  <strong>{formatNok(line.lineTotalMinor)}</strong>
                )}
              </div>
            ))}
            <div className="quote-fee">
              <span>
                {booking.quote.pricingModel === 'rental-v1'
                  ? 'Leie inkl. transport og rigg'
                  : 'Transport og rigg (tidligere modell)'}
              </span>
              <strong>{formatNok(booking.quote.transportFeeMinor)}</strong>
            </div>
            <div className="quote-total">
              <span>Totalt</span>
              <strong>{formatNok(booking.quote.totalMinor)}</strong>
            </div>
          </aside>
        </div>
      )}
      <div className="service-actions">
        <Link className="button button-secondary" href="/">
          Tilbake til utvalget
        </Link>
      </div>
    </main>
  );
}
