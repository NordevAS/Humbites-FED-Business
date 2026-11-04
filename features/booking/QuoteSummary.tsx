'use client';
import {
  calculateQuote,
  formatNok,
  eventEndLabel,
  type FoodTruck,
  type Quote,
} from '@/domain';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';
import type { ReactNode } from 'react';
export function dateLabel(date: string) {
  if (!date) return 'Dato velges senere';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return 'Velg en gyldig dato';
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}
export function QuoteSummary({
  truck,
  action,
  showEvent = true,
  quoteOverride,
  id = 'prisoversikt',
}: {
  truck: FoodTruck;
  id?: string;
  action?: ReactNode;
  showEvent?: boolean;
  quoteOverride?: Quote;
}) {
  const { event, quantities } = useDemo();
  if (
    !quoteOverride &&
    (truck.fixedFeeMinor === null ||
      truck.booking?.configured === false ||
      truck.booking?.enabled === false)
  )
    return (
      <div className="quote-card" id={id}>
        <h3>Forespørsler er ikke åpnet.</h3>
        <p>Eieren må konfigurere leieprisen før du kan sende en forespørsel.</p>
      </div>
    );
  const quote =
    quoteOverride ?? calculateQuote(truck, quantities[truck.id] ?? {});
  const rental = quote.pricingModel === 'rental-v1';
  return (
    <div className="quote-card" id={id}>
      <span className="eyebrow">
        {rental ? 'LEIE AV FOODTRUCK' : 'TIDLIGERE PRISMODELL'}
      </span>
      <div className="quote-truck">
        <img src={truck.image} alt="" width="64" height="64" />
        <div>
          <h3>{truck.name}</h3>
          <span>
            {truck.cuisine} · {truck.city}
          </span>
        </div>
      </div>
      {showEvent && (
        <div className="quote-event">
          <p>
            <Icon name="pin" size={17} />
            <span>{event.location.label || 'Sted velges senere'}</span>
          </p>
          <p>
            <Icon name="calendar" size={17} />
            <span>
              {dateLabel(event.date)}
              {event.date && (
                <small>
                  Kl. {event.startTime}–{eventEndLabel(event)} ·{' '}
                  {event.durationHours} timer
                </small>
              )}
            </span>
          </p>
          <p>
            <Icon name="people" size={17} />
            <span>
              {event.guestCount || '–'} gjester ·{' '}
              {rental
                ? `${quote.lines.length} retter valgt`
                : `${quote.portionCount} porsjoner`}
            </span>
          </p>
        </div>
      )}
      <div className="quote-lines">
        {quote.lines.length ? (
          quote.lines.map((line) => (
            <div key={line.itemId}>
              <span>
                {rental ? line.name : `${line.quantity} × ${line.name}`}
                <small className="quote-unit">
                  {rental
                    ? 'Tilbys til gjestene'
                    : `${formatNok(line.unitPriceMinor)} / porsjon`}
                </small>
              </span>
              {!rental && <strong>{formatNok(line.lineTotalMinor)}</strong>}
            </div>
          ))
        ) : (
          <p className="quote-empty">Velg minst én rett trucken skal tilby.</p>
        )}
        <div className="quote-fee">
          <span>
            {rental ? 'Leie av foodtruck' : 'Transport og rigg'}
            <small>
              {rental
                ? 'Transport og rigg inkludert'
                : 'Tidligere fast tillegg'}
            </small>
          </span>
          <strong>{formatNok(quote.transportFeeMinor)}</strong>
        </div>
      </div>
      <div className="quote-total">
        <span>{rental ? 'Din leiepris' : 'Tidligere total'}</span>
        <strong>{formatNok(quote.totalMinor)}</strong>
      </div>
      <p className="quote-explanation">
        {rental
          ? 'Gjestene kjøper og betaler maten selv på arrangementet. Mat er ikke inkludert i leieprisen.'
          : 'Denne lagrede forespørselen beholder sitt opprinnelige prisgrunnlag.'}{' '}
        Eieren må godkjenne forespørselen.
      </p>
      {action && <div className="quote-action">{action}</div>}
      <div className="quote-assurance">
        <Icon name="check" size={16} />
        <span>
          {quote.isDemo
            ? 'Demo · ingen ekte booking eller betaling'
            : 'Prisgrunnlaget må godkjennes av eieren'}
        </span>
      </div>
    </div>
  );
}
