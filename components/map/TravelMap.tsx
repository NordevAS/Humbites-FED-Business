'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { EventLocation, FoodTruck } from '@/domain';
import { isCoordinates } from '@/domain';
import { PlaceAutocomplete } from '@/features/discovery/PlaceAutocomplete';
import { useDemo } from '@/components/DemoProvider';
import type {
  DirectionsResponse,
  MapboxFailure,
  MatrixJourney,
  MatrixResponse,
} from '@/lib/mapbox/types';
import styles from './TravelMap.module.css';

import { createMapSelection } from '@/lib/places/map-selection';

export interface TravelMapProps {
  trucks?: FoodTruck[];
  truck?: FoodTruck;
  location?: EventLocation;
  onLocationChange?: (location: EventLocation) => void;
  compact?: boolean;
  showLocationSearch?: boolean;
  reverseProvider?: 'kartverket' | 'osm';
  onLocationLookupPending?: (pending: boolean) => void;
}

const clientFailure = (): MapboxFailure => ({
  status: 'error',
  code: 'upstream',
  message: 'Kartinformasjonen kunne ikke hentes. Prøv igjen om litt.',
});
const openStreetMapStyle = {
  version: 8 as const,
  sources: {
    'open-street-map': {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'open-street-map',
      type: 'raster' as const,
      source: 'open-street-map',
    },
  ],
};
async function post<T>(
  operation: string,
  data: unknown,
  signal: AbortSignal,
): Promise<T | MapboxFailure> {
  try {
    const response = await fetch(`/api/mapbox/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
      cache: 'no-store',
    });
    return (await response.json()) as T;
  } catch {
    return clientFailure();
  }
}

function journeyLabel(journey: Extract<MatrixJourney, { status: 'ready' }>) {
  const distance = new Intl.NumberFormat('nb-NO', {
    maximumFractionDigits: 1,
  }).format(journey.distanceMeters / 1000);
  const minutes = Math.round(journey.durationSeconds / 60);
  const time =
    journey.durationSeconds > 0 && minutes === 0
      ? 'under 1 min'
      : minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} t ${minutes % 60} min`;
  return `${distance} km · ca. ${time}`;
}

export function TravelMap({
  trucks,
  truck,
  location,
  onLocationChange,
  compact = false,
  showLocationSearch = true,
  reverseProvider = 'kartverket',
  onLocationLookupPending,
}: TravelMapProps) {
  const { showcase } = useDemo();
  const fieldId = useId();
  const [mapSelection] = useState(() =>
    createMapSelection(
      fetch,
      reverseProvider === 'osm'
        ? '/api/places/osm-reverse'
        : '/api/places/reverse',
    ),
  );
  const [reverseMessage, setReverseMessage] = useState('');
  const pendingPoint = useRef<EventLocation['coordinates']>(undefined);
  const cancelReverse = () => {
    mapSelection.cancel();
    pendingPoint.current = undefined;
    setReverseMessage('');
  };
  const catalogue = useMemo(
    () => (truck ? [truck] : (trucks ?? [])),
    [truck, trucks],
  );
  const truckKey = catalogue.map((item) => item.id).join('|');
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [directions, setDirections] = useState<DirectionsResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mapState, setMapState] = useState<
    'loading' | 'ready' | 'unconfigured' | 'error'
  >('loading');
  const [mapProvider, setMapProvider] = useState<'mapbox' | 'openstreetmap'>(
    'mapbox',
  );
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const library = useRef<typeof mapboxgl | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const onLocationRef = useRef(onLocationChange);
  const onLocationLookupPendingRef = useRef(onLocationLookupPending);
  const longitude = location?.coordinates?.longitude;
  const latitude = location?.coordinates?.latitude;
  useEffect(() => () => mapSelection.cancel(), [mapSelection]);
  useEffect(() => {
    const pending = pendingPoint.current;
    if (
      pending &&
      (pending.longitude !== longitude || pending.latitude !== latitude)
    ) {
      mapSelection.cancel();
      pendingPoint.current = undefined;
      onLocationLookupPendingRef.current?.(false);
      setReverseMessage('');
    }
  }, [longitude, latitude, mapSelection]);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch('/api/mapbox/config', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => {
        const data = result as { publicToken?: unknown };
        if (active)
          setPublicToken(
            typeof data.publicToken === 'string' &&
              data.publicToken.startsWith('pk.')
              ? data.publicToken
              : '',
          );
      })
      .catch(() => {
        if (active) setPublicToken('');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onLocationRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onLocationLookupPendingRef.current = onLocationLookupPending;
  }, [onLocationLookupPending]);

  useEffect(() => {
    if (publicToken === null) return;
    if (!container.current) return;
    let disposed = false;
    let instance: mapboxgl.Map | null = null;
    let fellBackToOpenStreetMap = !publicToken.startsWith('pk.');
    const target = container.current;
    let observer: ResizeObserver | undefined;
    import('mapbox-gl')
      .then((module) => {
        if (disposed) return;
        const gl = module.default;
        library.current = gl;
        instance = new gl.Map({
          container: target,
          accessToken: publicToken.startsWith('pk.') ? publicToken : undefined,
          style: fellBackToOpenStreetMap
            ? openStreetMapStyle
            : 'mapbox://styles/mapbox/standard',
          center: [12, 64.4],
          zoom: 3.5,
          attributionControl: true,
          scrollZoom: true,
          touchZoomRotate: true,
          cooperativeGestures: false,
        });
        // Wheel/trackpad and pinch zoom are primary gestures; controls remain a keyboard-accessible alternative.
        instance
          .getCanvas()
          .setAttribute('aria-describedby', `${fieldId}-map-help`);
        map.current = instance;
        instance.addControl(
          new gl.NavigationControl({ showCompass: false }),
          'top-right',
        );
        instance.dragRotate.disable();
        instance.touchZoomRotate.disableRotation();
        instance.on('load', () => {
          if (!disposed) {
            setMapProvider(
              fellBackToOpenStreetMap ? 'openstreetmap' : 'mapbox',
            );
            setMapState('ready');
          }
        });
        instance.on('error', (event) => {
          if (disposed) return;
          // A missing or rejected public Mapbox token should not disable the
          // location picker. Switch to public OSM raster tiles, which need no token.
          if (!fellBackToOpenStreetMap && !instance?.loaded()) {
            fellBackToOpenStreetMap = true;
            setMapProvider('openstreetmap');
            instance?.setStyle(openStreetMapStyle);
            return;
          }
          if (fellBackToOpenStreetMap && event.error) setMapState('error');
        });
        instance.on('click', (event) => {
          if (!onLocationRef.current) return;
          const point = {
            longitude: event.lngLat.lng,
            latitude: event.lngLat.lat,
          };
          pendingPoint.current = point;
          void mapSelection.select(
            point,
            (next) => onLocationRef.current?.(next),
            setReverseMessage,
            (pending) => onLocationLookupPendingRef.current?.(pending),
          );
        });
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(target);
      })
      .catch(() => {
        if (!disposed) setMapState('error');
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      for (const marker of markers.current) marker.remove();
      markers.current = [];
      instance?.remove();
      if (map.current === instance) map.current = null;
    };
  }, [publicToken]);

  useEffect(() => {
    const instance = map.current;
    const gl = library.current;
    if (!instance || !gl || mapState !== 'ready') return;
    for (const marker of markers.current) marker.remove();
    markers.current = [];
    const bounds = new gl.LngLatBounds();
    for (const item of catalogue) {
      const point: [number, number] = [
        item.coordinates.longitude,
        item.coordinates.latitude,
      ];
      const element = document.createElement('div');
      element.className = styles.truckMarker;
      element.textContent = 'H';
      element.setAttribute('aria-label', `${item.name}, registrert base`);
      element.addEventListener('click', (event) => event.stopPropagation());
      markers.current.push(
        new gl.Marker({ element })
          .setLngLat(point)
          .setPopup(
            new gl.Popup({ offset: 20 }).setText(
              `${item.name} · registrert base i ${item.city}`,
            ),
          )
          .addTo(instance),
      );
      bounds.extend(point);
    }
    if (
      typeof longitude === 'number' &&
      typeof latitude === 'number' &&
      isCoordinates({ longitude, latitude })
    ) {
      const element = document.createElement('div');
      element.className = styles.eventMarker;
      element.textContent = '●';
      element.setAttribute('aria-label', 'Arrangementets sted');
      element.addEventListener('click', (event) => event.stopPropagation());
      markers.current.push(
        new gl.Marker({ element })
          .setLngLat([longitude, latitude])
          .setPopup(new gl.Popup({ offset: 20 }).setText('Arrangementets sted'))
          .addTo(instance),
      );
      bounds.extend([longitude, latitude]);
    }
    if (!bounds.isEmpty())
      instance.fitBounds(bounds, {
        padding: 60,
        maxZoom: 12,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 400,
      });
  }, [catalogue, mapState, longitude, latitude]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || mapState !== 'ready') return;
    const geometry =
      directions?.status === 'ready' ? directions.geometry : null;
    const data = {
      type: 'FeatureCollection' as const,
      features: geometry
        ? [{ type: 'Feature' as const, properties: {}, geometry }]
        : [],
    };
    const source = instance.getSource('humbites-road-route') as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) source.setData(data);
    else {
      instance.addSource('humbites-road-route', { type: 'geojson', data });
      instance.addLayer({
        id: 'humbites-road-route',
        type: 'line',
        source: 'humbites-road-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#BF4927',
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });
    }
  }, [directions, mapState]);

  useEffect(() => {
    setMatrix(null);
    setDirections(null);
    if (
      !truckKey ||
      typeof longitude !== 'number' ||
      typeof latitude !== 'number' ||
      !isCoordinates({ longitude, latitude })
    ) {
      setCalculating(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    setCalculating(true);
    const destination = { longitude, latitude };
    const matrixPromise = post<MatrixResponse>(
      'matrix',
      { truckIds: truckKey.split('|').slice(0, 24), destination },
      controller.signal,
    );
    const routePromise = truck
      ? post<DirectionsResponse>(
          'directions',
          { truckId: truck.id, destination },
          controller.signal,
        )
      : Promise.resolve(null);
    Promise.all([matrixPromise, routePromise]).then(([metrics, route]) => {
      if (controller.signal.aborted) return;
      setMatrix(metrics);
      setDirections(route);
      setCalculating(false);
      clearTimeout(timer);
    });
    const timeout = setTimeout(() => {
      if (controller.signal.aborted) {
        setCalculating(false);
        setMatrix(clientFailure());
      }
    }, 12010);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [truckKey, truck, longitude, latitude, retry]);

  const changeLocation = (next: EventLocation) => {
    // Typing or choosing an address must supersede any pending map-click lookup.
    // The shared autocomplete owns its debounced search and clears stale coordinates.
    cancelReverse();
    onLocationChange?.(next);
  };

  return (
    <section
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      aria-label="Sted og kjøreinformasjon"
    >
      {onLocationChange && showLocationSearch && (
        <div className={styles.searchArea}>
          <PlaceAutocomplete
            location={location ?? { label: '', source: 'manual' }}
            onChange={changeLocation}
          />
        </div>
      )}

      <div className={styles.mapFrame}>
        <div
          ref={container}
          className={styles.map}
          aria-label="Mapbox-kart med registrert baser og valgt arrangementssted"
        />
        {mapState !== 'ready' && (
          <div className={styles.mapMessage}>
            <svg
              viewBox="0 0 48 48"
              width="48"
              height="48"
              aria-hidden="true"
              fill="none"
            >
              <path
                d="m6 12 12-5 12 5 12-5v29l-12 5-12-5-12 5V12Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M18 7v29m12-24v29"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="24"
                cy="21"
                r="5"
                fill="var(--surface,white)"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <strong>
              {mapState === 'loading'
                ? 'Åpner kartet…'
                : mapState === 'unconfigured'
                  ? 'Kartet mangler konfigurasjon'
                  : 'Kartet kunne ikke lastes'}
            </strong>
            <span>
              {mapState === 'loading'
                ? 'Henter kart fra Mapbox.'
                : mapState === 'unconfigured'
                  ? 'Du kan fortsatt søke etter adressen, men kartvalg krever at karttjenesten konfigureres.'
                  : 'Kontroller internettforbindelsen og prøv igjen. Du kan fortsatt søke etter en adresse.'}
            </span>
          </div>
        )}
      </div>
      {reverseMessage && (
        <p role="status" className={styles.help}>
          {reverseMessage}
        </p>
      )}
      <p className={styles.caption}>
        Kartdata fra{' '}
        {mapProvider === 'openstreetmap' ? (
          <a href="https://www.openstreetmap.org/copyright">
            OpenStreetMap-bidragsytere
          </a>
        ) : (
          <a href="https://www.mapbox.com/about/maps/">Mapbox</a>
        )}
        . Nærmeste adresse hentes fra{' '}
        <a href="https://www.kartverket.no/api-og-data/eiendomsdata/brukarrettleiing-adresse-api">
          Kartverket
        </a>
        . Markøren viser alltid punktet du valgte.
      </p>
      <p id={`${fieldId}-map-help`} className={styles.caption}>
        Zoom med musehjul eller styreflate, eller knip med to fingre. Bla
        utenfor kartet for å rulle videre på siden.
      </p>
      <p className={styles.caption}>
        {showcase
          ? 'Truckene og basene er eksempler. Kart, kjørerute og reisetid beregnes av Mapbox når tjenesten er tilgjengelig.'
          : 'Truckenes posisjoner er registrerte baser, ikke sanntidsplasseringer.'}
        {mapState === 'ready' && onLocationChange
          ? ' Du kan også velge sted i kartet.'
          : ''}
      </p>

      <div aria-live="polite" className={styles.travel}>
        {catalogue.length > 24 && (
          <p className={styles.help}>
            Kjøring vises for de første 24 truckene. Åpne en truck for
            detaljene.
          </p>
        )}
        {calculating && (
          <p className={styles.help}>Beregner kjøring til valgt sted…</p>
        )}
        {matrix?.status === 'ready' && (
          <ul className={styles.journeys}>
            {matrix.journeys.map((journey) => (
              <li key={journey.truckId}>
                <span>
                  {catalogue.find((item) => item.id === journey.truckId)
                    ?.name ?? 'Truck'}
                </span>
                <strong>
                  {journey.status === 'ready'
                    ? journeyLabel(journey)
                    : 'Ingen kjørerute funnet'}
                </strong>
              </li>
            ))}
          </ul>
        )}
        {matrix && matrix.status !== 'ready' && (
          <div className={styles.unavailable}>
            <span>
              Reisetid og kjøreavstand er ikke tilgjengelig akkurat nå.
            </span>
            {matrix.status === 'error' && (
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Prøv igjen
              </button>
            )}
          </div>
        )}
        {!calculating && !location?.coordinates && (
          <p className={styles.help}>
            Velg et treff fra adressesøket, et punkt i kartet for å beregne
            kjøring.
          </p>
        )}
        {directions &&
          directions.status !== 'ready' &&
          directions.status !== 'unconfigured' &&
          matrix?.status === 'ready' && (
            <p className={styles.help}>
              Vi kunne ikke tegne kjøreruten i kartet.
            </p>
          )}
        {matrix?.status === 'ready' && (
          <p className={styles.caption}>
            Beregnet med Mapbox fra truckens eksempelbase. Kjøretiden er et
            anslag. Fast leiepris, inkludert transport og rigg, endres ikke.
          </p>
        )}
      </div>
    </section>
  );
}

export default TravelMap;
