'use client';
import Link from '@/components/AppLink';
import { useRouter } from 'next/navigation';
import { post, ApiError, errorMessage } from '@/lib/booking/client';
import type { ServerQuote, BookingRecord } from '@/lib/booking/types';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  calculateQuote,
  formatNok,
  getOsloToday,
  eventEndLabel,
  validateEventDetails,
  validatePortions,
  validateContactDetails,
  validateBookingRequest,
  createDemoRequest,
  type FoodTruck,
  type DemoRequest,
} from '@/domain';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';
import { PlaceAutocomplete } from '@/features/discovery/PlaceAutocomplete';
import { TravelMap } from '@/components/map/TravelMap';
import { MenuSelection } from '@/features/foodtruck/MenuSelection';
import { QuoteSummary, dateLabel } from './QuoteSummary';
export function BookingFlow({ truck }: { truck: FoodTruck }) {
  const {
    mode,
    showcase,
    event,
    setEvent,
    contact,
    setContact,
    quantities,
    setQuantity,
  } = useDemo();
  const selection = quantities[truck.id] ?? {};
  const quote = calculateQuote(truck, selection);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverQuote, setServerQuote] = useState<ServerQuote | null>(null);
  const [coordinateText, setCoordinateText] = useState({
    longitude: event.location.coordinates?.longitude.toString() ?? '',
    latitude: event.location.coordinates?.latitude.toString() ?? '',
  });
  const draftId = useRef('');
  const createKey = useRef('');
  const quoteInput = useRef('');
  const fingerprint = JSON.stringify({ event, selection });
  useEffect(() => {
    if (serverQuote && quoteInput.current !== fingerprint) setServerQuote(null);
  }, [fingerprint, serverQuote]);
  useEffect(() => {
    setCoordinateText({
      longitude: event.location.coordinates?.longitude.toString() ?? '',
      latitude: event.location.coordinates?.latitude.toString() ?? '',
    });
  }, [
    event.location.coordinates?.longitude,
    event.location.coordinates?.latitude,
  ]);
  function editCoordinate(axis: 'longitude' | 'latitude', value: string) {
    const next = { ...coordinateText, [axis]: value };
    setCoordinateText(next);
    const longitude = Number(next.longitude),
      latitude = Number(next.latitude);
    const coordinates =
      next.longitude.trim() &&
      next.latitude.trim() &&
      Number.isFinite(longitude) &&
      Number.isFinite(latitude)
        ? { longitude, latitude }
        : undefined;
    setEvent({
      ...event,
      location: { label: event.location.label, source: 'manual', coordinates },
    });
  }
  function fillExample() {
    const date = new Date(getOsloToday() + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + 14);
    setEvent({
      location: {
        label: 'Eksempelarrangement ved truckens base i ' + truck.city,
        coordinates: truck.coordinates,
        source: 'preset',
      },
      date: date.toISOString().slice(0, 10),
      startTime: '17:00',
      durationHours: 3,
      guestCount: 40,
      notes: 'Dette er et eksempelarrangement i demoen.',
    });
    if (truck.menu[0] && !Object.values(selection).some((n) => n > 0))
      setQuantity(truck.id, truck.menu[0].id, 1);
  }
  async function loadQuote() {
    if (!event.location.coordinates)
      throw new ApiError(
        'Velg et punkt i kartet eller oppgi de faktiske koordinatene til arrangementet.',
        400,
        'LOCATION_REQUIRED',
        {
          location:
            'Vi trenger arrangementets koordinater for å kontrollere tjenesteområdet.',
        },
      );
    if (
      event.location.source === 'mapbox' &&
      event.location.geocodingStorage !== 'permanent'
    )
      throw new ApiError(
        'Velg adressen på nytt eller skriv den inn selv. Dette søketreffet kan ikke lagres.',
        400,
        'LOCATION_REQUIRED',
      );
    if (!draftId.current) draftId.current = crypto.randomUUID();
    await post('drafts', { draftId: draftId.current });
    const result = await post<{ data: ServerQuote }>(
      'quotes',
      { foodtruckId: truck.id, event, quantities: selection },
      { 'X-Draft-Id': draftId.current },
    );
    quoteInput.current = fingerprint;
    createKey.current = crypto.randomUUID();
    setServerQuote(result.data);
    return result.data;
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<DemoRequest | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const successTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (request) successTitle.current?.focus();
  }, [request]);
  const stepNames = ['Arrangement', 'Meny', 'Kontakt og gjennomgang'];
  function move(next: number) {
    setStep(next);
    setErrors({});
    setTimeout(() => {
      title.current?.focus();
      title.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      });
    }, 0);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validation =
      step === 0
        ? validateEventDetails(event)
        : step === 1
          ? validatePortions(truck, selection)
          : validateContactDetails(contact);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    if (step === 0) {
      move(1);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      if (step === 1) {
        if (mode === 'live') await loadQuote();
        move(2);
        return;
      }
      const all = validateBookingRequest(truck, {
        event,
        quantities: selection,
        contact,
      });
      if (!all.valid) {
        setErrors(all.errors);
        setStep(
          !validateEventDetails(event).valid
            ? 0
            : !validatePortions(truck, selection).valid
              ? 1
              : 2,
        );
        return;
      }
      if (mode === 'demo') {
        setRequest(
          createDemoRequest(truck, { event, quantities: selection, contact }),
        );
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'instant'
            : 'smooth',
        });
        return;
      }
      if (
        !serverQuote ||
        quoteInput.current !== fingerprint ||
        Date.parse(serverQuote.expiresAt) <= Date.now()
      )
        throw new ApiError(
          'Prisgrunnlaget har utløpt. Hent ny pris og se over totalen før du sender.',
          409,
          'REQUOTE_REQUIRED',
        );
      const result = await post<{ data: BookingRecord; receiptToken: string }>(
        'requests',
        { quoteId: serverQuote.quoteId, contact },
        { 'X-Draft-Id': draftId.current, 'Idempotency-Key': createKey.current },
      );
      router.push(
        `/kvittering/${encodeURIComponent(result.data.id)}#access=${encodeURIComponent(result.receiptToken)}`,
      );
    } catch (error) {
      const message = errorMessage(error);
      setErrors(
        error instanceof ApiError
          ? { ...error.fields, request: message }
          : { request: message },
      );
      if (error instanceof ApiError && error.code === 'REQUOTE_REQUIRED') {
        setServerQuote(null);
        setStep(1);
      } else if (
        error instanceof ApiError &&
        ([
          'location',
          'date',
          'startTime',
          'durationHours',
          'guestCount',
          'utcOffsetMinutes',
        ].some((key) => error.fields[key]) ||
          error.code.includes('TIME') ||
          error.code.includes('LOCATION') ||
          error.code === 'EVENT_IN_PAST')
      ) {
        setStep(0);
      } else if (
        error instanceof ApiError &&
        (error.fields.portions || error.code === 'INVALID_MENU_ITEM')
      ) {
        setStep(1);
      }
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (key: string) =>
    errors[key] ? (
      <span id={`error-${key}`} className="field-error">
        {errors[key]}
      </span>
    ) : null;
  const invalid = (key: string) => ({
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `error-${key}` : undefined,
  });
  if (request)
    return (
      <main id="main" className="container success-page">
        <div className="success-copy">
          <span className="success-icon">
            <Icon name="check" size={40} />
          </span>
          <span className="eyebrow">EN LITEN SMAKEBIT PÅ DET SOM KOMMER</span>
          <h1 ref={successTitle} tabIndex={-1}>
            Slik ser forespørselen din ut.
          </h1>
          <p>
            Du har planlagt en matopplevelse med {truck.name}. I den ferdige
            tjenesten må eieren godkjenne oppdraget før det blir en booking.
          </p>
          <div className="success-status">
            <Icon name="info" />
            <div>
              <strong>Dette er en demonstrasjon i nettleseren.</strong>
              <span>
                Ingenting er sendt, reservert eller betalt. Kontaktopplysningene
                er bare i denne åpne demoen.
              </span>
            </div>
          </div>
          <div className="success-details">
            <h2>Ditt arrangement</h2>
            <dl>
              <div>
                <dt>Sted</dt>
                <dd>{request.event.location.label}</dd>
              </div>
              <div>
                <dt>Tidspunkt</dt>
                <dd>
                  {dateLabel(request.event.date)} · {request.event.startTime}–
                  {eventEndLabel(request.event)}
                </dd>
              </div>
              <div>
                <dt>Gjester og mat</dt>
                <dd>
                  {request.event.guestCount} gjester ·{' '}
                  {request.quote.lines.length} retter valgt
                </dd>
              </div>
              <div>
                <dt>Kontakt</dt>
                <dd>
                  {request.contact.name}
                  <br />
                  {request.contact.email}
                  <br />
                  {request.contact.phone}
                </dd>
              </div>
              {request.event.notes && (
                <div>
                  <dt>Merknader</dt>
                  <dd>{request.event.notes}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="success-actions">
            <button
              className="button button-primary"
              onClick={() => {
                setRequest(null);
                move(0);
              }}
            >
              Endre forespørselen
            </button>
            <Link className="button button-secondary" href="/foodtrucks">
              Tilbake til utvalget <Icon name="arrow" />
            </Link>
          </div>
        </div>
        <aside className="success-summary">
          <QuoteSummary
            truck={truck}
            showEvent={false}
            quoteOverride={request.quote}
          />
        </aside>
      </main>
    );
  return (
    <main id="main" className="container booking-page">
      <Link href={`/foodtruck/${truck.slug}`} className="back-link">
        <Icon name="back" size={18} />
        Tilbake til {truck.name}
      </Link>
      <div className="booking-top">
        <span className="eyebrow">DIN NESTE GODE MATOPPLEVELSE</span>
        <h1>La oss planlegge noe godt.</h1>
        <p>
          Én truck, dine favoritter og en tydelig pris. Du velger detaljene.
        </p>
      </div>
      <ol className="booking-steps" aria-label="Fremdrift">
        {stepNames.map((label, index) => (
          <li
            key={label}
            className={`${index === step ? 'current' : ''} ${index < step ? 'complete' : ''}`}
          >
            <button
              onClick={() => move(index)}
              disabled={index > step}
              aria-current={index === step ? 'step' : undefined}
            >
              <span>
                {index < step ? <Icon name="check" size={17} /> : index + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="booking-layout">
        <div className="booking-main">
          <form id="booking-form" noValidate onSubmit={submit}>
            <div className="booking-panel">
              <div className="booking-panel-heading">
                <span className="step-kicker">STEG {step + 1} AV 3</span>
                <h2 ref={title} tabIndex={-1}>
                  {step === 0
                    ? 'Fortell oss om arrangementet.'
                    : step === 1
                      ? 'Sett sammen menyen.'
                      : 'Alt klart for en god samling?'}
                </h2>
                <p>
                  {step === 0
                    ? 'En hage, en bakgård eller rett utenfor kontoret. Hvor skal vi samles?'
                    : step === 1
                      ? 'Velg rettene trucken skal tilby. Du betaler kun leie; gjestene kjøper maten selv.'
                      : 'Se over planen og legg til kontaktinformasjonen din. Du trenger ingen konto.'}
                </p>
              </div>
              {Object.keys(errors).length > 0 && (
                <div className="form-error" role="alert">
                  <Icon name="info" />
                  <div>
                    <strong>
                      Sjekk disse opplysningene før du fortsetter:
                    </strong>
                    <ul>
                      {Object.entries(errors).map(([key, message]) => (
                        <li key={key}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {step === 0 && (
                <div className="event-form">
                  {showcase && (
                    <div className="showcase-help">
                      <strong>Kom raskt i gang.</strong>
                      <p>
                        Fyll inn et fiktivt arrangement i {truck.city}, to uker
                        frem i tid, med 40 gjester og én valgt rett. Du kan
                        endre alle valgene etterpå.
                      </p>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={fillExample}
                      >
                        Bruk et eksempelarrangement
                      </button>
                    </div>
                  )}
                  <div>
                    <PlaceAutocomplete
                      variant="field"
                      label="Hvor skal arrangementet være?"
                      required
                      inputProps={invalid('location')}
                      location={event.location}
                      onChange={(location) => setEvent({ ...event, location })}
                    />
                    {fieldError('location')}
                  </div>
                  <button
                    type="button"
                    className="map-disclosure"
                    aria-expanded={mapOpen}
                    onClick={() => setMapOpen(!mapOpen)}
                  >
                    <Icon name="map" size={19} />
                    {mapOpen
                      ? 'Skjul kart og reise'
                      : 'Finn adresse på kart og se reisevei'}
                    <Icon
                      name="chevron"
                      size={17}
                      style={{
                        transform: mapOpen ? 'rotate(180deg)' : undefined,
                      }}
                    />
                  </button>
                  {mapOpen && (
                    <div className="booking-map">
                      <TravelMap
                        truck={truck}
                        location={event.location}
                        onLocationChange={(location) =>
                          setEvent({ ...event, location })
                        }
                        compact
                      />
                    </div>
                  )}
                  {mode === 'live' && (
                    <details className="service-card">
                      <summary>Oppgi koordinater manuelt</summary>
                      <p>
                        Bruk stedets faktiske lengde- og breddegrad hvis kartet
                        ikke er tilgjengelig. Adresseteksten alene bekrefter
                        ikke plasseringen.
                      </p>
                      <div className="form-grid">
                        <label className="field">
                          <span>Lengdegrad</span>
                          <input
                            type="number"
                            step="any"
                            min="-180"
                            max="180"
                            value={coordinateText.longitude}
                            onChange={(e) =>
                              editCoordinate('longitude', e.target.value)
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Breddegrad</span>
                          <input
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            value={coordinateText.latitude}
                            onChange={(e) =>
                              editCoordinate('latitude', e.target.value)
                            }
                          />
                        </label>
                      </div>
                    </details>
                  )}
                  <div className="form-grid">
                    <label className="field">
                      <span>
                        Dato <b>*</b>
                      </span>
                      <input
                        type="date"
                        value={event.date}
                        min={getOsloToday()}
                        {...invalid('date')}
                        onChange={(e) =>
                          setEvent({ ...event, date: e.target.value })
                        }
                      />
                      {fieldError('date')}
                    </label>
                    <label className="field">
                      <span>
                        Servering starter <b>*</b>
                      </span>
                      <input
                        type="time"
                        value={event.startTime}
                        {...invalid('startTime')}
                        onChange={(e) =>
                          setEvent({ ...event, startTime: e.target.value })
                        }
                      />
                      {fieldError('startTime')}
                    </label>
                    <label className="field">
                      <span>
                        Varighet <b>*</b>
                      </span>
                      <select
                        value={event.durationHours}
                        {...invalid('durationHours')}
                        onChange={(e) =>
                          setEvent({
                            ...event,
                            durationHours: Number(e.target.value),
                          })
                        }
                      >
                        {[1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8].map((hours) => (
                          <option key={hours} value={hours}>
                            {String(hours).replace('.', ',')}{' '}
                            {hours === 1 ? 'time' : 'timer'}
                          </option>
                        ))}
                      </select>
                      {fieldError('durationHours')}
                    </label>
                    <label className="field">
                      <span>
                        Forventet antall gjester <b>*</b>
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={event.guestCount || ''}
                        {...invalid('guestCount')}
                        onChange={(e) =>
                          setEvent({
                            ...event,
                            guestCount: Number(e.target.value),
                          })
                        }
                      />
                      {fieldError('guestCount')}
                    </label>
                  </div>
                  {event.date && (
                    <p className="time-summary">
                      <Icon name="clock" size={17} />
                      Planlagt servering {event.startTime}–
                      {eventEndLabel(event)}. Norsk lokal tid.
                    </p>
                  )}
                  {mode === 'live' && (
                    <label className="field">
                      <span>
                        Ved overgang til vintertid: hvilket klokkeslett?{' '}
                        <small>Vanligvis automatisk</small>
                      </span>
                      <select
                        value={event.utcOffsetMinutes ?? ''}
                        onChange={(e) =>
                          setEvent({
                            ...event,
                            utcOffsetMinutes: e.target.value
                              ? (Number(e.target.value) as 60 | 120)
                              : undefined,
                          })
                        }
                      >
                        <option value="">Automatisk norsk tid</option>
                        <option value="120">
                          Før klokken stilles tilbake (sommertid)
                        </option>
                        <option value="60">
                          Etter klokken stilles tilbake (vintertid)
                        </option>
                      </select>
                    </label>
                  )}
                  <label className="field">
                    <span>
                      Noe vi bør vite? <small>Valgfritt</small>
                    </span>
                    <textarea
                      rows={4}
                      value={event.notes}
                      placeholder="Anledning, kostholdsbehov, adkomst eller andre ønsker …"
                      onChange={(e) =>
                        setEvent({ ...event, notes: e.target.value })
                      }
                    />
                  </label>
                  <p className="form-note">
                    Dette er planleggingsopplysninger. Tilgjengelighet avklares
                    alltid med truckeieren.
                  </p>
                </div>
              )}
              {step === 1 && (
                <>
                  <MenuSelection truck={truck} />
                  {fieldError('portions')}
                  <div className="portion-note">
                    <Icon name="people" />
                    <p>
                      <strong>
                        {event.guestCount} gjester, {quote.lines.length} valgte
                        retter valgt.
                      </strong>
                      <br />
                      Du bestemmer hvor mye mat dere ønsker. Vi endrer ikke
                      mengden automatisk.
                    </p>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  {serverQuote && (
                    <div className="service-banner">
                      <strong>
                        {showcase
                          ? 'Demopris beregnet på serveren:'
                          : 'Pris hentet fra truckeieren:'}{' '}
                        {formatNok(serverQuote.quote.totalMinor)}
                      </strong>
                      <p>
                        Prisgrunnlaget er gyldig til{' '}
                        {new Date(serverQuote.expiresAt).toLocaleTimeString(
                          'nb-NO',
                          { hour: '2-digit', minute: '2-digit' },
                        )}
                        . Se over totalen før du sender.
                      </p>
                    </div>
                  )}
                  <div className="review-event">
                    <div>
                      <h3>Arrangementet ditt</h3>
                      <button
                        className="text-link"
                        type="button"
                        onClick={() => move(0)}
                      >
                        Endre <Icon name="back" size={15} />
                      </button>
                    </div>
                    <p>
                      <Icon name="pin" size={17} />
                      {event.location.label}
                    </p>
                    <p>
                      <Icon name="calendar" size={17} />
                      {dateLabel(event.date)} · {event.startTime}–
                      {eventEndLabel(event)}
                    </p>
                    <p>
                      <Icon name="people" size={17} />
                      {event.guestCount} gjester · {quote.lines.length} retter
                      valgt
                    </p>
                    {event.notes && (
                      <p className="review-notes">{event.notes}</p>
                    )}
                  </div>
                  <div className="contact-form">
                    <h3>Hvem planlegger arrangementet?</h3>
                    {showcase && (
                      <div className="showcase-help">
                        <p>
                          Bruk fiktive opplysninger. Demoen lagrer dem i ditt
                          eget prøveområde i inntil 24 timer. Ingen e-post eller
                          SMS sendes.
                        </p>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() =>
                            setContact({
                              name: 'Alex Eksempel',
                              email: 'alex@example.test',
                              phone: '40000000',
                              customerType: 'private',
                              companyName: '',
                            })
                          }
                        >
                          Fyll inn eksempelkontakt
                        </button>
                      </div>
                    )}
                    <fieldset className="customer-type">
                      <legend className="sr-only">Kundetype</legend>
                      <label
                        className={
                          contact.customerType === 'private' ? 'selected' : ''
                        }
                      >
                        <input
                          type="radio"
                          name="customerType"
                          checked={contact.customerType === 'private'}
                          onChange={() =>
                            setContact({ ...contact, customerType: 'private' })
                          }
                        />
                        Privatperson
                      </label>
                      <label
                        className={
                          contact.customerType === 'business' ? 'selected' : ''
                        }
                      >
                        <input
                          type="radio"
                          name="customerType"
                          checked={contact.customerType === 'business'}
                          onChange={() =>
                            setContact({ ...contact, customerType: 'business' })
                          }
                        />
                        Bedrift
                      </label>
                    </fieldset>
                    {contact.customerType === 'business' && (
                      <label className="field">
                        <span>
                          Bedriftens navn <b>*</b>
                        </span>
                        <input
                          value={contact.companyName ?? ''}
                          autoComplete="organization"
                          {...invalid('companyName')}
                          onChange={(e) =>
                            setContact({
                              ...contact,
                              companyName: e.target.value,
                            })
                          }
                        />
                        {fieldError('companyName')}
                      </label>
                    )}
                    <label className="field">
                      <span>
                        Fullt navn <b>*</b>
                      </span>
                      <input
                        value={contact.name}
                        autoComplete="name"
                        {...invalid('name')}
                        onChange={(e) =>
                          setContact({ ...contact, name: e.target.value })
                        }
                      />
                      {fieldError('name')}
                    </label>
                    <div className="form-grid">
                      <label className="field">
                        <span>
                          E-postadresse <b>*</b>
                        </span>
                        <input
                          type="email"
                          value={contact.email}
                          autoComplete="email"
                          {...invalid('email')}
                          onChange={(e) =>
                            setContact({ ...contact, email: e.target.value })
                          }
                        />
                        {fieldError('email')}
                      </label>
                      <label className="field">
                        <span>
                          Telefonnummer <b>*</b>
                        </span>
                        <input
                          type="tel"
                          value={contact.phone}
                          autoComplete="tel"
                          {...invalid('phone')}
                          onChange={(e) =>
                            setContact({ ...contact, phone: e.target.value })
                          }
                        />
                        {fieldError('phone')}
                      </label>
                    </div>
                    <p className="form-note">
                      {showcase || mode === 'demo'
                        ? 'Eksempelopplysningene lagres bare i ditt avgrensede demoområde. Ingen reell truckeier kontaktes.'
                        : 'Kontaktopplysningene deles med truckeieren når du sender forespørselen.'}
                    </p>
                  </div>
                  <div className="demo-submit-note">
                    <Icon name="info" />
                    <p>
                      <strong>
                        {showcase || mode === 'demo'
                          ? 'Prøv flyten – helt uforpliktende.'
                          : 'Klar til å sende?'}
                      </strong>
                      <br />
                      {showcase || mode === 'demo'
                        ? 'Dette lagrer en demoforespørsel som du selv kan behandle i eierdemoen.'
                        : 'Forespørselen lagres og blir synlig for truckeieren.'}{' '}
                      Eieren må godkjenne oppdraget. Ingen betaling skjer ved
                      innsending.
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="booking-actions">
              {step > 0 ? (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => move(step - 1)}
                >
                  <Icon name="back" size={18} />
                  Tilbake
                </button>
              ) : (
                <Link
                  href={`/foodtruck/${truck.slug}`}
                  className="button button-secondary"
                >
                  <Icon name="back" size={18} />
                  Til profilen
                </Link>
              )}
              <button
                className="button button-primary desktop-next"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? 'Venter på tjenesten …'
                  : step === 0
                    ? 'Velg menyen'
                    : step === 1
                      ? 'Hent pris og gå videre'
                      : showcase || mode === 'demo'
                        ? 'Lagre demoforespørsel'
                        : 'Send forespørsel'}
                <Icon name="arrow" size={18} />
              </button>
            </div>
            {step === 2 && (
              <p className="submit-caption">
                {showcase || mode === 'demo'
                  ? 'Demo – ingen ekte booking, e-post eller betaling.'
                  : 'Forespørselen må godkjennes av eieren. Ingen betaling nå.'}
              </p>
            )}
          </form>
        </div>
        <aside className="quote-sidebar">
          <QuoteSummary
            truck={truck}
            quoteOverride={serverQuote?.quote}
            action={
              step === 2 ? (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => move(1)}
                >
                  Endre menyen <Icon name="back" size={16} />
                </button>
              ) : undefined
            }
          />
        </aside>
      </div>
      <div className="mobile-booking-bar">
        <a href="#prisoversikt">
          <small>{quote.lines.length} retter valgt · leiepris</small>
          <strong>
            {formatNok(serverQuote?.quote.totalMinor ?? quote.totalMinor)}
          </strong>
        </a>
        <button
          className="button button-primary"
          type="submit"
          form="booking-form"
          disabled={busy}
        >
          {busy
            ? 'Venter …'
            : step === 0
              ? 'Velg menyen'
              : step === 1
                ? 'Hent pris'
                : showcase || mode === 'demo'
                  ? 'Lagre demo'
                  : 'Send forespørsel'}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </main>
  );
}
