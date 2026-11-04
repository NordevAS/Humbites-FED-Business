'use client';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { getOsloToday } from '@/domain';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';
import { discoveryHref } from './search-query';
import { PlaceAutocomplete } from './PlaceAutocomplete';

/** One form shares event details with profiles and booking, on both discovery routes. */
export function EventSearch({ variant }: { variant: 'hero' | 'results' }) {
  const { event, setEvent, setFavoritesOnly } = useDemo();
  const router = useRouter();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Read the submitted controls together: native date inputs may commit on blur.
    const fields = new FormData(e.currentTarget);
    const label = String(fields.get('place') ?? '').trim();
    const submitted = {
      ...event,
      location:
        label === event.location.label && event.location.coordinates
          ? event.location
          : { label, source: 'manual' as const },
      date: String(fields.get('date') ?? ''),
      guestCount: Number(fields.get('guests')),
    };
    setEvent(submitted);
    if (variant === 'hero') setFavoritesOnly(false);
    router.push(discoveryHref(submitted));
  }
  return (
    <div className={`discovery-search discovery-search--${variant}`}>
      <form className="event-search" onSubmit={submit}>
        <PlaceAutocomplete
          location={event.location}
          onChange={(location) =>
            setEvent((current) => ({ ...current, location }))
          }
        />
        <label className="search-field">
          <Icon name="calendar" />
          <span>
            <span className="field-caption">NÅR?</span>
            <input
              type="date"
              name="date"
              value={event.date}
              min={getOsloToday()}
              onInput={(e) => {
                const date = e.currentTarget.value;
                setEvent((current) => ({ ...current, date }));
              }}
              aria-label="Dato for arrangementet"
            />
          </span>
        </label>
        <label className="search-field guests-field">
          <Icon name="people" />
          <span>
            <span className="field-caption">HVOR MANGE?</span>
            <input
              type="number"
              name="guests"
              min="1"
              required
              step="1"
              value={event.guestCount}
              onChange={(e) =>
                setEvent({ ...event, guestCount: Number(e.target.value) })
              }
              aria-label="Antall gjester"
            />
          </span>
          <span className="input-suffix">gjester</span>
        </label>
        <button className="button search-button" type="submit">
          {variant === 'hero' ? 'Finn foodtrucks' : 'Oppdater søk'}{' '}
          <Icon name="arrow" />
        </button>
      </form>

      <p className="search-footnote">
        Velg en adresse, et byforslag eller et kartpunkt. Vi viser bare trucks
        med tjenesteområde som dekker det valgte stedet. En by angir sentrum,
        ikke en nøyaktig adresse.
      </p>
    </div>
  );
}
