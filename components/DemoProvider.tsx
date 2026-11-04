'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  calculateQuote,
  type ContactDetails,
  type EventDetails,
  type FoodTruck,
} from '@/domain';
import { foodTrucks as demoTrucks } from '@/data/demo';
import { ensureShowcaseSession } from '@/lib/booking/showcase-client';
import { api, errorMessage } from '@/lib/booking/client';
import type { AppMode } from '@/lib/booking/mode';
const initialEvent: EventDetails = {
  location: { label: '', source: 'manual' },
  date: '',
  startTime: '17:00',
  durationHours: 3,
  guestCount: 40,
  notes: '',
};
const initialContact: ContactDetails = {
  name: '',
  email: '',
  phone: '',
  customerType: 'private',
  companyName: '',
};
type DemoContextValue = {
  mode: AppMode;
  showcase: boolean;
  catalogue: FoodTruck[];
  catalogueState: 'loading' | 'ready' | 'error';
  catalogueError: string;
  reloadCatalogue: () => void;
  event: EventDetails;
  setEvent: Dispatch<SetStateAction<EventDetails>>;
  contact: ContactDetails;
  setContact: (contact: ContactDetails) => void;
  quantities: Record<string, Record<string, number>>;
  setQuantity: (truckId: string, itemId: string, quantity: number) => boolean;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (value: boolean) => void;
  discovery: {
    place: string;
    cuisine: string;
    sort: string;
    view: string;
    veggie: boolean;
  };
  setDiscovery: Dispatch<
    SetStateAction<{
      place: string;
      cuisine: string;
      sort: string;
      view: string;
      veggie: boolean;
    }>
  >;
};
const DemoContext = createContext<DemoContextValue | null>(null);
export function DemoProvider({
  children,
  mode,
  showcase = false,
}: {
  children: ReactNode;
  mode: AppMode;
  showcase?: boolean;
}) {
  const [catalogue, setCatalogue] = useState<FoodTruck[]>(
    mode === 'demo' ? demoTrucks : [],
  );
  const [catalogueState, setCatalogueState] = useState<
    'loading' | 'ready' | 'error'
  >(mode === 'demo' ? 'ready' : 'loading');
  const [catalogueError, setCatalogueError] = useState('');
  const reloadCatalogue = useCallback(() => {
    if (mode === 'demo') return;
    setCatalogueState('loading');
    setCatalogueError('');
    void (showcase ? ensureShowcaseSession() : Promise.resolve())
      .then(() => api<{ trucks: FoodTruck[] }>('catalogue'))
      .then((result) => {
        setCatalogue(result.trucks);
        setCatalogueState('ready');
        setQuantities((current) =>
          Object.fromEntries(
            result.trucks.map((truck) => [
              truck.id,
              Object.fromEntries(
                Object.entries(current[truck.id] ?? {}).filter(([id]) =>
                  truck.menu.some((item) => item.id === id),
                ),
              ),
            ]),
          ),
        );
      })
      .catch((error) => {
        setCatalogue([]);
        setCatalogueState('error');
        setCatalogueError(errorMessage(error));
      });
  }, [mode, showcase]);
  useEffect(() => {
    reloadCatalogue();
  }, [reloadCatalogue]);
  const [event, setEvent] = useState(initialEvent);
  const [contact, setContact] = useState(initialContact);
  const [quantities, setQuantities] = useState<
    Record<string, Record<string, number>>
  >({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [discovery, setDiscovery] = useState({
    place: '',
    cuisine: 'Alle smaker',
    sort: 'recommended',
    view: 'list',
    veggie: false,
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem('humbites-favorites-v1');
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (Array.isArray(value))
          setFavorites(
            value.filter((id): id is string => typeof id === 'string'),
          );
      }
    } catch {}
  }, []);
  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      try {
        localStorage.setItem('humbites-favorites-v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function setQuantity(truckId: string, itemId: string, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) return false;
    const truck = catalogue.find((item) => item.id === truckId);
    if (!truck) return false;
    const next = { ...quantities[truckId], [itemId]: quantity > 0 ? 1 : 0 };
    try {
      calculateQuote(truck, next);
    } catch {
      return false;
    }
    setQuantities((current) => ({ ...current, [truckId]: next }));
    return true;
  }
  return (
    <DemoContext.Provider
      value={{
        mode,
        showcase,
        catalogue,
        catalogueState,
        catalogueError,
        reloadCatalogue,
        event,
        setEvent,
        contact,
        setContact,
        quantities,
        setQuantity,
        favorites,
        toggleFavorite,
        favoritesOnly,
        setFavoritesOnly,
        discovery,
        setDiscovery,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoProvider missing');
  return context;
}
