'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { post, errorMessage } from '@/lib/booking/client';
import type { FoodTruck } from '@/domain';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';
import { TravelMap } from '@/components/map/TravelMap';
import { TruckCard } from './TruckCard';
import { EventSearch } from './EventSearch';
import { discoveryHref, eventFromQuery } from './search-query';
import { servesLocation } from './service-area';

/** Keep marketing off the results route; availability stays provisional until quoted. */
export function ResultsPage() {
  const {
    mode,
    showcase,
    catalogue: foodTrucks,
    catalogueState,
    catalogueError,
    reloadCatalogue,
    event,
    setEvent,
    favorites,
    favoritesOnly,
    setFavoritesOnly,
    discovery,
    setDiscovery,
  } = useDemo();
  const query = useSearchParams().toString();
  const router = useRouter();
  const { place, cuisine, sort, view, veggie } = discovery;
  const [availableTrucks, setAvailableTrucks] = useState<FoodTruck[] | null>(
    null,
  );
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // A submitted URL survives reloads and back/forward navigation. Contact data never enters it.
    if (!query) return;
    setEvent((current) => eventFromQuery(new URLSearchParams(query), current));
  }, [query, setEvent]);

  useEffect(() => {
    let cancelled = false;
    setAvailableTrucks(null);
    setSearching(false);
    setAvailabilityMessage('');
    setDiscovery((current) => ({
      ...current,
      place: event.location.label.trim(),
    }));
    if (mode !== 'live' || catalogueState !== 'ready') return;
    if (!event.date || !event.location.coordinates) {
      setAvailabilityMessage(
        event.location.coordinates
          ? 'Tjenesteområdet er avklart. Velg dato for å kontrollere tilgjengelighet.'
          : 'Velg et byforslag eller et nøyaktig kartpunkt først. Vi viser ingen trucks før vi kan kontrollere tjenesteområdet.',
      );
      return;
    }
    setSearching(true);
    void post<{ trucks: FoodTruck[] }>('catalogue/search', { event })
      .then((result) => {
        if (cancelled) return;
        setAvailableTrucks(result.trucks);
        setAvailabilityMessage(
          'Sted, tid og gjester er kontrollert. Menyvalget kontrolleres når du henter leieprisen. Ingen tid er reservert.',
        );
      })
      .catch((error) => {
        if (!cancelled)
          setAvailabilityMessage(
            errorMessage(error) +
              ' Utvalget er ikke kontrollert for tilgjengelighet.',
          );
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    // Ignore old responses when the visitor changes the event or leaves this route.
    return () => {
      cancelled = true;
    };
  }, [mode, catalogueState, event, setDiscovery]);
  const cuisines = [
    'Alle smaker',
    ...new Set(foodTrucks.map((truck) => truck.cuisine)),
  ];
  const filtered = useMemo(() => {
    let rows = (availableTrucks ?? foodTrucks).filter((truck) => {
      return (
        servesLocation(truck, event.location) &&
        (truck.booking?.maxGuests == null ||
          event.guestCount <= truck.booking.maxGuests) &&
        (cuisine === 'Alle smaker' || truck.cuisine === cuisine) &&
        (!favoritesOnly || favorites.includes(truck.id)) &&
        (!veggie ||
          truck.menu.some((item) =>
            item.dietaryTags.some((tag) => /vega|veget/i.test(tag)),
          ))
      );
    });
    if (sort === 'price')
      rows = [...rows].sort(
        (a, b) => (a.fixedFeeMinor ?? Infinity) - (b.fixedFeeMinor ?? Infinity),
      );
    if (sort === 'name')
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    return rows;
  }, [
    availableTrucks,
    foodTrucks,
    event.location,
    event.guestCount,
    place,
    cuisine,
    sort,
    veggie,
    favoritesOnly,
    favorites,
  ]);

  function clearPlace() {
    const cleared = {
      ...event,
      location: { label: '', source: 'manual' as const },
    };
    setEvent(cleared);
    setDiscovery({ ...discovery, place: '' });
    router.replace(discoveryHref(cleared));
  }

  function reset() {
    setAvailabilityMessage(
      'Mat- og favorittfiltre er nullstilt. Valgt sted og antall gjester beholdes.',
    );
    setDiscovery({
      ...discovery,
      cuisine: 'Alle smaker',
      veggie: false,
    });
    setFavoritesOnly(false);
  }
  return (
    <main id="main" className="discovery-results">
      <section className="results-search container" aria-label="Endre søket">
        <EventSearch variant="results" />
      </section>
      {searching && (
        <p className="container" role="status">
          Sjekker tilgjengelighet …
        </p>
      )}
      <section className="catalogue container" id="foodtrucks">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FINN DIN SMAK</span>
            <h1>Foodtrucks til din samling.</h1>
          </div>
          <div className="pulse-catalogue-aside">
            <span className="catalogue-count" role="status" aria-live="polite">
              {filtered.length}{' '}
              {filtered.length === 1 ? 'foodtruck' : 'foodtrucks'} i utvalget
            </span>
          </div>
        </div>
        <div className="pulse-cuisine-nav" aria-label="Filtrer på kjøkken">
          {cuisines.map((item, index) => {
            const photo = foodTrucks.find(
              (truck) => truck.cuisine === item,
            )?.image;
            return (
              <button
                key={item}
                className={`pulse-cuisine ${cuisine === item ? 'active' : ''}`}
                aria-pressed={cuisine === item}
                onClick={() => setDiscovery({ ...discovery, cuisine: item })}
              >
                <span className="pulse-cuisine-photo">
                  {photo ? (
                    <img
                      src={photo}
                      alt=""
                      width="120"
                      height="120"
                      loading="lazy"
                    />
                  ) : (
                    <Icon name="spark" size={37} />
                  )}
                </span>
                <span>{index === 0 ? 'Alt det gode' : item}</span>
              </button>
            );
          })}
        </div>
        <div className="catalogue-toolbar">
          <div className="filter-options">
            <button
              className={`filter-chip ${veggie ? 'selected' : ''}`}
              aria-pressed={veggie}
              onClick={() => setDiscovery({ ...discovery, veggie: !veggie })}
            >
              <Icon name="leaf" size={17} />
              Vegetarvennlig
            </button>
            <button
              className={`filter-chip ${favoritesOnly ? 'selected' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
            >
              <Icon name="heart" size={17} />
              Kun favoritter{favoritesOnly && ` (${favorites.length})`}
            </button>
            {place && availableTrucks === null && (
              <button
                className="filter-chip selected"
                onClick={clearPlace}
                aria-label={`Fjern stedsfilter ${place}`}
              >
                <Icon name="pin" size={16} />
                {place}
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <div className="sort-view">
            <label className="sort-select">
              <span className="sr-only">Sorter trucks</span>
              <select
                value={sort}
                onChange={(e) =>
                  setDiscovery({ ...discovery, sort: e.target.value })
                }
              >
                <option value="recommended">Vårt utvalg</option>
                <option value="price">Laveste leiepris</option>
                <option value="name">Navn A–Å</option>
              </select>
            </label>
            <div className="view-toggle" aria-label="Visning">
              <button
                className={view === 'list' ? 'active' : ''}
                aria-label="Vis liste"
                aria-pressed={view === 'list'}
                onClick={() => setDiscovery({ ...discovery, view: 'list' })}
              >
                <Icon name="grid" size={18} />
              </button>
              <button
                className={view === 'map' ? 'active' : ''}
                aria-label="Vis kart"
                aria-pressed={view === 'map'}
                onClick={() => setDiscovery({ ...discovery, view: 'map' })}
              >
                <Icon name="map" size={18} />
              </button>
            </div>
          </div>
        </div>
        <p className="availability-note">
          <span />
          {showcase || mode === 'demo'
            ? 'Profiler og priser er eksempler. '
            : ''}
          Innenfor truckens oppgitte område. Dato og kapasitet må fortsatt
          kontrolleres. Eieren må godkjenne forespørselen.
        </p>
        {availabilityMessage && (
          <div role="status" className="service-banner">
            {availabilityMessage}
          </div>
        )}
        {!event.location.coordinates && view !== 'map' && (
          <button
            className="button button-secondary"
            onClick={() => setDiscovery({ ...discovery, view: 'map' })}
          >
            Avklar sted på kartet
          </button>
        )}
        {catalogueState === 'loading' && (
          <div className="service-state" role="status">
            Henter foodtrucks og menyer …
          </div>
        )}
        {catalogueState === 'error' && (
          <div className="service-state" role="alert">
            <h3>Vi får ikke hentet utvalget.</h3>
            <p>{catalogueError}</p>
            <button className="button button-primary" onClick={reloadCatalogue}>
              Prøv igjen
            </button>
          </div>
        )}
        {view === 'map' && (
          <div className="catalogue-map">
            <TravelMap
              trucks={filtered}
              location={event.location}
              onLocationChange={(location) => setEvent({ ...event, location })}
            />
          </div>
        )}
        {catalogueState === 'ready' && !event.location.coordinates && (
          <div className="empty-results">
            <h3>Hvor skal maten serveres?</h3>
            <p>
              {event.location.label
                ? 'Velg et forslag i stedsfeltet, eller finn den nøyaktige adressen på kartet. Fritekst alene bekrefter ikke at en truck leverer hit.'
                : 'Søk etter en by ovenfor eller velg stedet på kartet. Da viser vi bare trucks som dekker området.'}
            </p>
            <button
              className="button button-secondary"
              onClick={() => setDiscovery({ ...discovery, view: 'map' })}
            >
              Velg sted på kartet <Icon name="map" />
            </button>
          </div>
        )}
        {catalogueState === 'ready' &&
          !!event.location.coordinates &&
          (filtered.length ? (
            <div className="truck-grid">
              {filtered.map((truck) => (
                <TruckCard key={truck.id} truck={truck} />
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <span className="empty-icon">
                <Icon name={favoritesOnly ? 'heart' : 'search'} size={34} />
              </span>
              <h3>
                {favoritesOnly && favorites.length === 0
                  ? 'Samle dine favorittsmaker.'
                  : 'Ingen trucks i dette utvalget.'}
              </h3>
              <p>
                {favoritesOnly && favorites.length === 0
                  ? 'Trykk på hjertet ved en truck du liker. Her samler vi favorittene dine.'
                  : 'Prøv et annet kjøkken, færre gjester eller et annet kartpunkt.'}
              </p>
              <button className="button button-secondary" onClick={reset}>
                Nullstill mat- og favorittfiltre <Icon name="arrow" />
              </button>
            </div>
          ))}
      </section>
    </main>
  );
}
