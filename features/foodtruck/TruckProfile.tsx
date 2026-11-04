'use client';
import Link from '@/components/AppLink';
import { calculateQuote, formatNok, type FoodTruck } from '@/domain';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';
import { TravelMap } from '@/components/map/TravelMap';
import { MenuSelection } from './MenuSelection';
import { QuoteSummary } from '@/features/booking/QuoteSummary';
export function TruckProfile({ truck }: { truck: FoodTruck }) {
  const {
    mode,
    showcase,
    event,
    setEvent,
    favorites,
    toggleFavorite,
    quantities,
  } = useDemo();
  const saved = favorites.includes(truck.id);
  const quote =
    truck.fixedFeeMinor === null
      ? null
      : calculateQuote(truck, quantities[truck.id] ?? {});
  return (
    <main id="main" className="profile-page container">
      <Link href="/foodtrucks" className="back-link">
        <Icon name="back" size={18} />
        Tilbake til utvalget
      </Link>
      <section className="profile-hero">
        <img src={truck.image} alt={truck.imageAlt} width="1240" height="440" />
        <div className="profile-hero-shade" />
        <div className="profile-hero-copy">
          <span className="light-badge">
            {truck.cuisine}
            {showcase || mode === 'demo' ? ' · Eksempelprofil' : ''}
          </span>
          <h1>{truck.name}</h1>
          <p>
            <Icon name="pin" size={18} />
            {truck.city} · {truck.serviceAreaLabel}
          </p>
        </div>
        <button
          className={`profile-favorite ${saved ? 'saved' : ''}`}
          aria-pressed={saved}
          onClick={() => toggleFavorite(truck.id)}
        >
          <Icon name="heart" size={19} />
          {saved ? 'Lagret' : 'Lagre favoritt'}
        </button>
        <span className="image-note">Illustrasjonsbilde av maten</span>
      </section>
      <div className="profile-layout">
        <div className="profile-main">
          <nav className="profile-tabs" aria-label="På denne siden">
            <a href="#meny">Meny</a>
            <a href="#om-trucken">Om trucken</a>
            <a href="#praktisk">Praktisk</a>
            <a href="#kart">Kart og reise</a>
          </nav>
          <section className="truck-intro" id="om-trucken">
            <span className="eyebrow">
              GODE SMAKER FRA {truck.city.toLocaleUpperCase('nb')}
            </span>
            <h2>{truck.shortDescription}</h2>
            <p>{truck.description}</p>
            <div className="intro-tags">
              {truck.tags.map((tag) => (
                <span key={tag}>
                  <Icon name="check" size={15} />
                  {tag}
                </span>
              ))}
            </div>
          </section>
          <MenuSelection truck={truck} />
          <section id="praktisk" className="practical-section">
            <span className="eyebrow">LITT PRAKTISK FØR FESTEN</span>
            <h2>Godt å planlegge sammen.</h2>
            <ul>
              {truck.practicalInfo.map((info) => (
                <li key={info}>
                  <Icon name="check" size={18} />
                  {info}
                </li>
              ))}
            </ul>
            <p className="muted">
              Tjenesteområde, kapasitet og behov avklares med eieren. En
              forespørsel er ikke en bekreftet booking.
            </p>
          </section>
          <section id="kart" className="map-section">
            <span className="eyebrow">FRA TRUCK TIL ARRANGEMENT</span>
            <h2>Hvor skal dere samles?</h2>
            <p className="section-description">
              Utforsk reiseveien fra truckens base. Transport og rigg er
              inkludert i leieprisen, som ikke endres av beregnet avstand.
            </p>
            <TravelMap
              truck={truck}
              location={event.location}
              onLocationChange={(location) => setEvent({ ...event, location })}
            />
          </section>
        </div>
        <aside className="quote-sidebar">
          <QuoteSummary
            truck={truck}
            action={
              <Link
                href={`/foresporsel/${truck.slug}`}
                className="button button-primary"
              >
                Planlegg arrangementet <Icon name="arrow" size={18} />
              </Link>
            }
          />
        </aside>
      </div>
      <div className="mobile-booking-bar">
        <div>
          <small>{quote?.lines.length ?? 0} retter valgt · leiepris</small>
          <strong>
            {quote ? formatNok(quote.totalMinor) : 'Pris ikke satt'}
          </strong>
        </div>
        <Link
          href={`/foresporsel/${truck.slug}`}
          className="button button-primary"
        >
          Planlegg videre <Icon name="arrow" size={17} />
        </Link>
      </div>
    </main>
  );
}
