'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import type { EventLocation } from '@/domain';
import { Icon } from '@/components/Icon';
import { suggestPlaces } from './places';
import { useAddressSuggestions } from './useAddressSuggestions';
import styles from './PlaceAutocomplete.module.css';

export function PlaceAutocomplete({
  location,
  onChange,
  variant = 'search',
  label = 'HVOR?',
  required = false,
  inputProps = {},
  showPresets = true,
}: {
  location: EventLocation;
  onChange: (location: EventLocation) => void;
  /** Booking fields reuse the same selection rules with their validation identity. */
  variant?: 'search' | 'field';
  label?: string;
  required?: boolean;
  inputProps?: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'id' | 'aria-invalid' | 'aria-describedby'
  >;
  showPresets?: boolean;
}) {
  const generatedId = useId();
  const id = inputProps.id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = useRef<HTMLUListElement>(null);
  const addressSearch = useAddressSuggestions(
    location.label,
    open && !location.coordinates,
  );
  const suggestions = [
    ...(showPresets ? suggestPlaces(location.label) : []).map((place) => ({
      id: place.city,
      label: place.label,
      title: place.city,
      detail: 'Sentrum · eksempelsted',
      coordinates: place.coordinates,
      source: 'preset' as const,
    })),
    ...addressSearch.suggestions.map((place) => ({
      ...place,
      title: place.label,
      detail: 'Adresse · Kartverket',
      source: 'manual' as const,
    })),
  ];
  useEffect(() => {
    if (active >= 0)
      options.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  function choose(index: number) {
    const place = suggestions[index];
    if (!place) return;
    onChange({
      label: place.label,
      coordinates: { ...place.coordinates },
      source: place.source,
    });
    setOpen(false);
    setActive(-1);
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((current) =>
        suggestions.length
          ? current < 0
            ? event.key === 'ArrowDown'
              ? 0
              : suggestions.length - 1
            : (current +
                (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) %
              suggestions.length
          : -1,
      );
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      choose(active);
    }
  }
  return (
    <div
      className={`${styles.root} ${variant === 'field' ? styles.field : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label
        className={
          variant === 'field' ? 'field' : 'search-field location-field'
        }
        htmlFor={id}
      >
        {variant === 'search' && <Icon name="pin" />}
        <span>
          <span className={variant === 'search' ? 'field-caption' : undefined}>
            {label}
            {required && <b> *</b>}
          </span>
          <input
            {...inputProps}
            id={id}
            name="place"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-suggestions`}
            aria-activedescendant={
              open && active >= 0 && active < suggestions.length
                ? `${id}-option-${active}`
                : undefined
            }
            aria-describedby={[inputProps['aria-describedby'], `${id}-hint`]
              .filter(Boolean)
              .join(' ')}
            aria-label={variant === 'search' ? 'Sted eller by' : undefined}
            placeholder="Søk etter adresse eller by i Norge"
            maxLength={180}
            value={location.label}
            onFocus={() => setOpen(true)}
            onKeyDown={navigate}
            onChange={(event) => {
              onChange({ label: event.target.value, source: 'manual' });
              setOpen(true);
              setActive(-1);
            }}
          />
        </span>
      </label>
      <span id={`${id}-hint`} className="sr-only">
        Skriv minst tre tegn for adressesøk i Norge. Velg et forslag med
        piltastene og Enter. Eksempelsteder er merket, og du kan også velge
        kartpunkt.
      </span>
      {open && (
        <div className={styles.popup}>
          <p className={styles.hint}>Velg adresse eller eksempelsted</p>
          <ul
            ref={options}
            id={`${id}-suggestions`}
            role="listbox"
            aria-label="Stedsforslag"
          >
            {suggestions.map((place, index) => (
              <li
                id={`${id}-option-${index}`}
                key={place.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <strong>{place.title}</strong>
                <span>{place.detail}</span>
              </li>
            ))}
          </ul>
          {addressSearch.loading && (
            <p className={styles.hint} role="status">
              Søker etter adresser i Norge …
            </p>
          )}
          {addressSearch.error && (
            <p className={styles.hint} role="status">
              {addressSearch.error}
            </p>
          )}
          {!addressSearch.loading &&
            !addressSearch.error &&
            suggestions.length === 0 && (
              <p className={styles.hint} role="status">
                {location.label.trim().length < 3
                  ? 'Skriv minst tre tegn for å søke.'
                  : 'Ingen adressetreff. Prøv gatenavn og by, eller velg sted på kartet.'}
              </p>
            )}
        </div>
      )}
      <span className={styles.attribution}>
        Adressedata:{' '}
        <a href="https://www.kartverket.no/" target="_blank" rel="noreferrer">
          © Kartverket
        </a>{' '}
        ·{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY 4.0
        </a>
      </span>
    </div>
  );
}
