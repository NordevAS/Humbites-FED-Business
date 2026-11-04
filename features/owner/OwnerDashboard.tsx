'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  UtensilsCrossed,
  ImageIcon,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Truck,
  Clock3,
  MapPin,
  Users,
  Check,
  Coins,
} from 'lucide-react';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { ensureShowcaseSession } from '@/lib/booking/showcase-client';
import Link from '@/components/AppLink';
import { useDemo } from '@/components/DemoProvider';
import { api, post, ApiError, errorMessage } from '@/lib/booking/client';
import {
  statusLabel,
  type BookingRecord,
  type Settings,
  type Payment,
  type BookingStatus,
  type OwnerOverview,
} from '@/lib/booking/types';
import { formatNok } from '@/domain';
import { dateLabel } from '@/features/booking/QuoteSummary';
import { SettingsForm } from './SettingsForm';
import { OpeningHoursEditor } from './OpeningHoursEditor';
import { MenuEditor, type OwnerItem } from './MenuEditor';
import { ImageManager } from './ImageManager';
import {
  paymentLabel,
  canCapture,
  canRelease,
} from '@/lib/booking/payment-state';
import './owner-dashboard.css';
import { DateTile, Status, ownerStatus } from './BookingPresentation';

type Option = { id: string | number; name?: string; businessName?: string };
type User = { id: string | number; email: string; firstName?: string };
type Tab = 'overview' | 'inbox' | 'calendar' | 'menu' | 'images' | 'settings';
const navigation = [
  { id: 'overview', label: 'Oversikt', icon: LayoutDashboard },
  { id: 'inbox', label: 'Forespørsler', icon: Inbox },
  { id: 'calendar', label: 'Kalender og åpningstid', icon: CalendarDays },
  { id: 'menu', label: 'Meny', icon: UtensilsCrossed },
  { id: 'images', label: 'Bilder', icon: ImageIcon },
  { id: 'settings', label: 'Truckinnstillinger', icon: Settings2 },
] as const;
const tabTitles: Record<Tab, { title: string; description: string }> = {
  overview: {
    title: 'Full oversikt. God flyt.',
    description:
      'Fra første forespørsel til gjennomført arrangement. Her er statusen for trucken din.',
  },
  inbox: {
    title: 'Neste gode samling.',
    description:
      'Se hvem som vil ha deg på besøk. Du bestemmer hvilke forespørsler du tar.',
  },
  calendar: {
    title: 'Gjør plass til mer.',
    description:
      'Sett åpningstidene, planlegg unntak og se når trucken kan bookes.',
  },
  menu: {
    title: 'Sett smaken på menyen.',
    description:
      'Retter, porsjonspriser, allergener og bilder. Akkurat slik kunden møter dem.',
  },
  images: {
    title: 'Vis hva du byr på.',
    description:
      'Gi kundene en smakebit på trucken. Bildene lagres bare i ditt demoområde.',
  },
  settings: {
    title: 'Din truck. Dine rammer.',
    description: 'Priser, kapasitet og arbeidsområde samlet på ett sted.',
  },
};
export function OwnerDashboard() {
  const confirm = useConfirmation();
  const router = useRouter();
  const { mode, showcase, reloadCatalogue, catalogue } = useDemo();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businesses, setBusinesses] = useState<Option[]>([]);
  const [business, setBusiness] = useState('');
  const [trucks, setTrucks] = useState<Option[]>([]);
  const [truck, setTruck] = useState('');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<OwnerItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [allergens, setAllergens] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  // Separate generations prevent stale truck/filter responses from replacing current data.
  const coreSequence = useRef(0);
  const inboxSequence = useRef(0);
  const actionRunning = useRef(false);
  const [payment, setPayment] = useState<{
    booking: BookingRecord;
    value: Payment | null;
  } | null>(null);
  const paymentKeys = useRef<Record<string, string>>({});
  const paymentHeading = useRef<HTMLHeadingElement | null>(null);
  const base =
    business && truck ? `owner/businesses/${business}/trucks/${truck}` : '';
  const selectedTruck = catalogue.find((item) => item.id === truck);
  const truckName =
    trucks.find((item) => String(item.id) === truck)?.name ?? 'Din foodtruck';
  const profileHref = selectedTruck
    ? `/foodtruck/${selectedTruck.slug}`
    : '/foodtrucks';
  async function loadBusinesses() {
    try {
      const result = await api<{ data: Option[] }>('owner/businesses');
      setBusinesses(result.data);
      setBusiness(result.data[0] ? String(result.data[0].id) : '');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setBusinesses([]);
        return;
      }
      throw e;
    }
  }
  useEffect(() => {
    if (mode === 'demo') {
      setChecking(false);
      return;
    }
    let alive = true;
    void (showcase ? ensureShowcaseSession() : Promise.resolve())
      .then(() => api<{ data: User }>('owner/session'))
      .then(async (result) => {
        if (alive) {
          setUser(result.data);
          await loadBusinesses();
        }
      })
      .catch((e) => {
        if (alive && !(e instanceof ApiError && e.status === 401))
          setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, showcase]);
  useEffect(() => {
    setTruck('');
    setTrucks([]);
    setBookings([]);
    setOverview(null);
    if (!business) return;
    let alive = true;
    setLoading(true);
    void api<{ data: Option[] }>(`owner/businesses/${business}/trucks`)
      .then((result) => {
        if (alive) {
          setTrucks(result.data);
          const selected = new URLSearchParams(window.location.search).get(
            'truck',
          );
          setTruck(
            result.data.some((item) => String(item.id) === selected)
              ? selected!
              : result.data[0]
                ? String(result.data[0].id)
                : '',
          );
        }
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [business]);
  const loadCore = useCallback(async () => {
    if (!base) return;
    const sequence = ++coreSequence.current;
    const [summary, configuration, menu, options] = await Promise.all([
      api<{ data: OwnerOverview }>(`${base}/overview`),
      api<{ data: Settings | null }>(`${base}/booking-settings`),
      api<{ data: OwnerItem[] }>(`${base}/menu`),
      api<{
        data: {
          allergens: { id: number; name: string }[];
          categories: { id: number; name: string }[];
        };
      }>(`${base}/menu-options`),
    ]);
    if (sequence !== coreSequence.current) return;
    setOverview(summary.data);
    setSettings(configuration.data);
    setItems(menu.data);
    setAllergens(options.data.allergens);
    setCategories(options.data.categories);
    reloadCatalogue();
  }, [base, reloadCatalogue]);
  const loadInbox = useCallback(async () => {
    if (!base) return;
    const sequence = ++inboxSequence.current;
    const result = await api<{
      data: BookingRecord[];
      pagination?: { totalPages: number; total: number };
    }>(
      `${base}/bookings?page=${page}&limit=10${status ? `&status=${status}` : ''}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
    );
    if (sequence !== inboxSequence.current) return;
    setBookings(result.data);
    setTotalPages(result.pagination?.totalPages ?? 1);
    setTotal(result.pagination?.total ?? result.data.length);
  }, [base, page, status, query]);
  useEffect(() => {
    setPayment(null);
    setError('');
    setOverview(null);
    setSettings(null);
    setItems([]);
    setCategories([]);
    if (!base) return;
    let alive = true;
    setLoading(true);
    void loadCore()
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      coreSequence.current++;
    };
  }, [base, loadCore]);
  useEffect(() => {
    if (!base) return;
    let alive = true;
    setInboxLoading(true);
    setInboxError('');
    void loadInbox()
      .catch((e) => {
        if (alive) setInboxError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setInboxLoading(false);
      });
    return () => {
      alive = false;
      inboxSequence.current++;
    };
  }, [base, loadInbox]);
  useEffect(() => {
    if (payment) paymentHeading.current?.focus();
  }, [payment]);
  async function refresh() {
    await Promise.all([loadCore(), loadInbox()]);
    setInboxError('');
  }
  // The ref blocks double clicks before React renders the disabled button state.
  async function action(task: () => Promise<void>) {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 401) setUser(null);
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  }
  // In-portal navigation must settle unsaved edits before unmounting the editor.
  async function guard(task: () => void) {
    if (busy || editorBusy) return;
    if (
      dirty &&
      !(await confirm({
        title: 'Forkaste endringene?',
        message:
          'Du har endringer som ikke er lagret. Bli her for å lagre, eller forkast dem og gå videre.',
        confirmLabel: 'Forkast og gå videre',
      }))
    )
      return;
    setDirty(false);
    task();
  }
  function linkGuard(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      (!dirty && !editorBusy) ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    void guard(() => router.push(href));
  }
  function changeTab(next: Tab) {
    if (next === tab) return;
    void guard(() => {
      setTab(next);
      setPayment(null);
      setNotice('');
    });
  }
  function showInbox(nextStatus = '') {
    if (busy) return;
    setStatus(nextStatus);
    setPage(1);
    setQuery('');
    setSearch('');
    setTab('inbox');
  }
  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    await action(async () => {
      const result = await post<{ data: User }>(
        'owner/login',
        showcase ? {} : { email, password },
      );
      setPassword('');
      setUser(result.data);
      await loadBusinesses();
    });
  }
  async function logout() {
    await action(async () => {
      await post('owner/logout', {});
      setUser(null);
      setBusiness('');
      setTruck('');
      setBookings([]);
      setOverview(null);
      setTab('overview');
    });
  }
  async function decide(
    booking: BookingRecord,
    decision: 'accept' | 'decline' | 'cancel',
  ) {
    const label = { accept: 'Godkjenne', decline: 'Avslå', cancel: 'Avlyse' }[
      decision
    ];
    if (
      busy ||
      !(await confirm({
        title: `${label} denne ${showcase ? 'demoforespørselen' : 'forespørselen'}?`,
        message: `${booking.contact.name} · ${dateLabel(booking.event.date)}.${showcase ? ' Handlingen gjelder bare denne demoen; ingen ekte kunde varsles.' : ''}`,
        confirmLabel: {
          accept: 'Ja, godkjenn',
          decline: 'Ja, avslå',
          cancel: 'Ja, avlys',
        }[decision],
      }))
    )
      return;
    await action(async () => {
      await post(`${base}/bookings/${booking.id}/${decision}`, {});
      await refresh();
      setNotice('Forespørselen er oppdatert.');
    });
  }
  async function inspectPayment(booking: BookingRecord) {
    await action(async () => {
      const config = await api<{ enabled: boolean }>('payment-config');
      if (!config.enabled) {
        setNotice(
          'Betaling er ikke aktivert. Ingen betalingshandling utføres.',
        );
        return;
      }
      try {
        const result = await api<{ data: Payment | null }>(
          `owner/payments/${booking.id}`,
        );
        setPayment({ booking, value: result.data });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404)
          setPayment({ booking, value: null });
        else throw e;
      }
    });
  }
  async function paymentAction(kind: 'capture' | 'cancel' | 'refund') {
    if (!payment?.value) return;
    const current = payment;
    const labels = {
      capture: 'Belast hele gjenværende autoriserte beløpet',
      cancel: 'Frigi hele gjenværende reservasjon',
      refund: 'Refunder hele gjenværende belastede beløpet',
    };
    if (
      busy ||
      !(await confirm({
        title: showcase
          ? 'Bekreft simulert betalingshandling'
          : 'Bekreft betalingshandling',
        message: `${labels[kind]} for denne forespørselen.${showcase ? ' Ingen penger flyttes og ingen betalingsleverandør kontaktes.' : ''}`,
        confirmLabel: showcase
          ? {
              capture: 'Simuler belastning',
              cancel: 'Simuler frigivelse',
              refund: 'Simuler refusjon',
            }[kind]
          : {
              capture: 'Belast beløpet',
              cancel: 'Frigi beløpet',
              refund: 'Refunder beløpet',
            }[kind],
      }))
    )
      return;
    await action(async () => {
      const key = `${current.value!.id}:${kind}:${current.value!.authorizedMinor}:${current.value!.capturedMinor}:${current.value!.cancelledMinor}:${current.value!.refundedMinor}`;
      paymentKeys.current[key] ??= crypto.randomUUID();
      const result = await post<{ data: Payment }>(
        `owner/payments/${current.booking.id}/${kind}`,
        {},
        { 'Idempotency-Key': paymentKeys.current[key] },
      );
      setPayment({ ...current, value: result.data });
      setNotice(
        showcase
          ? 'Demobetalingen er oppdatert. Ingen penger er flyttet.'
          : 'Betalingsstatus er oppdatert fra betalingsleverandøren.',
      );
    });
  }
  const notices = (
    <>
      {error && (
        <div role="alert" className="service-banner error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="service-banner">
          {notice}
        </div>
      )}
    </>
  );
  if (mode === 'demo')
    return (
      <main id="main" className="container service-page">
        <h1>For truckeiere.</h1>
        <div className="service-state">
          <p>Eierverktøyet krever den tilkoblede bookingtjenesten.</p>
          <Link href="/" className="text-link">
            Til kundesiden
          </Link>
        </div>
      </main>
    );
  if (!user)
    return (
      <main id="main" className="owner-entry owner-portal">
        <div className="owner-entry-copy">
          <Link href="/" className="owner-wordmark">
            humbites<span>.</span>
          </Link>
          <span className="owner-kicker">FOR DEG SOM SERVERER</span>
          <h1>
            Mer smak.
            <br />
            <em>Mindre styr.</em>
          </h1>
          <p>
            Et eget sted for trucken din. Hold orden på forespørsler, planlegg
            dagene og gjør menyen klar for neste samling.
          </p>
          <div className="owner-entry-features">
            <span>
              <Inbox size={20} /> Forespørsler på ett sted
            </span>
            <span>
              <CalendarDays size={20} /> Kalender på dine premisser
            </span>
            <span>
              <UtensilsCrossed size={20} /> En meny som frister
            </span>
          </div>
          <span className="owner-entry-star" aria-hidden="true">
            ✳
          </span>
        </div>
        <div className="owner-entry-form">
          {notices}
          {checking ? (
            <p role="status">Gjør klart eierverktøyet …</p>
          ) : showcase ? (
            <div>
              <span className="owner-kicker">DIN EGEN DEMO</span>
              <h2>Ta plass bak disken.</h2>
              <p>
                Prøv eierrollen med seks fiktive trucks. Lagrede
                demoforespørsler og endringer er bare dine.
              </p>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void login()}
              >
                {busy ? 'Åpner …' : 'Åpne eierdemo'}
                <ArrowRight size={20} />
              </button>
              <p className="owner-subtle">
                Ingen konto eller passord. Ingen ekte bestilling eller betaling.
              </p>
              <Link href="/" className="text-link">
                Tilbake til kundesiden <ArrowUpRight size={17} />
              </Link>
            </div>
          ) : (
            <form onSubmit={login}>
              <span className="owner-kicker">VELKOMMEN TILBAKE</span>
              <h2>Logg inn.</h2>
              <label className="field">
                <span>E-post</span>
                <input
                  required
                  autoComplete="username"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Passord</span>
                <input
                  required
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button disabled={busy} className="button button-primary">
                {busy ? 'Logger inn …' : 'Logg inn'}
              </button>
              <p className="owner-subtle">
                Bruk eierkontoen som er knyttet til bedriften din.
              </p>
            </form>
          )}
        </div>
      </main>
    );
  return (
    <main id="main" className="owner-portal owner-shell">
      <aside className="owner-sidebar">
        <Link
          href="/"
          onClick={(e) => linkGuard(e, '/')}
          className="owner-wordmark"
          aria-label="Humbites kundeside"
        >
          humbites<span>.</span>
        </Link>
        <span className="owner-sidebar-label">BEDRIFTSPORTAL</span>
        <nav aria-label="Bedriftsmeny">
          {navigation.map(({ id, label, icon: NavIcon }) => (
            <button
              key={id}
              disabled={busy || editorBusy}
              className={tab === id ? 'active' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => changeTab(id)}
            >
              <NavIcon size={20} />
              <span>{label}</span>
              {id === 'inbox' && Boolean(overview?.counts.PENDING) && (
                <b>{overview!.counts.PENDING}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="owner-sidebar-bottom">
          <div className="owner-demo-note">
            <span aria-hidden="true">✳</span>
            <strong>
              {showcase ? 'Et rom for å prøve.' : 'Klart for neste samling.'}
            </strong>
            <p>
              {showcase
                ? 'Alt du gjør her, blir i ditt eget demoområde.'
                : 'Hold truckens opplysninger og kalender oppdatert.'}
            </p>
          </div>
          <Link
            href="/mine-foresporsler"
            onClick={(e) => linkGuard(e, '/mine-foresporsler')}
          >
            <ArrowUpRight size={18} /> Kundens kvitteringer
          </Link>
          <button
            disabled={busy || editorBusy}
            onClick={() => void guard(() => void logout())}
          >
            <LogOut size={18} /> Logg ut
          </button>
        </div>
      </aside>
      <div className="owner-workspace">
        <header className="owner-topbar">
          <div>
            <span className="owner-kicker">
              {showcase ? 'HUMBITES · EIERDEMO' : 'HUMBITES FOR BEDRIFT'}
            </span>
            <span className="owner-session">
              {showcase ? 'Ditt private demoområde' : user.email}
            </span>
          </div>
          <Link
            href={profileHref}
            onClick={(e) => linkGuard(e, profileHref)}
            className="owner-customer-link"
          >
            Se kundesiden <ArrowUpRight size={17} />
          </Link>
        </header>
        <section className="owner-switcher" aria-label="Velg bedrift og truck">
          <label>
            <span>BEDRIFT</span>
            <select
              aria-label="Bedrift"
              value={business}
              disabled={busy || editorBusy || !businesses.length}
              onChange={(e) => {
                const next = e.target.value;
                void guard(() => {
                  setPage(1);
                  setBusiness(next);
                  setStatus('');
                  setQuery('');
                  setSearch('');
                });
              }}
            >
              {businesses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name ?? item.businessName ?? `Bedrift ${item.id}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              <Truck size={14} /> FOODTRUCK
            </span>
            <select
              aria-label="Foodtruck"
              value={truck}
              disabled={busy || editorBusy || !trucks.length}
              onChange={(e) => {
                const next = e.target.value;
                void guard(() => {
                  setPage(1);
                  setTruck(next);
                  setStatus('');
                  setQuery('');
                  setSearch('');
                });
              }}
            >
              {trucks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name ?? `Truck ${item.id}`}
                </option>
              ))}
            </select>
          </label>
          <span className={`owner-bookable ${settings?.enabled ? 'open' : ''}`}>
            <i />
            {loading
              ? 'Henter status'
              : settings?.enabled
                ? 'Åpen for forespørsler'
                : 'Forespørsler er slått av'}
          </span>
        </section>
        <div className="owner-page-heading">
          <div>
            <span className="owner-kicker">
              {truckName.toLocaleUpperCase('nb-NO')}
            </span>
            <h1>{tabTitles[tab].title}</h1>
            <p>{tabTitles[tab].description}</p>
          </div>
          <button
            className="owner-refresh"
            disabled={busy || editorBusy || loading || inboxLoading || !base}
            onClick={() => void action(refresh)}
          >
            <RefreshCw size={18} /> Oppdater
          </button>
        </div>
        {notices}
        {!businesses.length && (
          <div className="owner-empty">
            <Truck size={32} />
            <h2>Ingen bedrift er knyttet til kontoen.</h2>
            <p>
              Be administratoren knytte eierkontoen til en registrert bedrift.
            </p>
          </div>
        )}
        {business && !loading && !trucks.length && (
          <div className="owner-empty">
            <h2>Truckprofilen mangler.</h2>
            <p>Be administratoren fullføre bedriftens truckprofil.</p>
          </div>
        )}
        {base && (
          <div className="owner-content" aria-busy={loading}>
            {loading ? (
              <div className="owner-loading" role="status">
                <span className="owner-loading-mark" aria-hidden="true">
                  ✳
                </span>
                Henter truckens opplysninger …
              </div>
            ) : (
              <>
                {tab === 'overview' && overview && (
                  <>
                    <div className="owner-welcome">
                      <div>
                        <span className="owner-kicker">
                          KLAR FOR NESTE SERVERING?
                        </span>
                        <h2>
                          {overview.counts.PENDING > 0
                            ? `${overview.counts.PENDING} ${overview.counts.PENDING === 1 ? 'forespørsel venter' : 'forespørsler venter'} på deg.`
                            : 'En god dag starter med oversikt.'}
                        </h2>
                        <p>
                          {overview.counts.PENDING > 0
                            ? 'Ta en titt på detaljene, sjekk kalenderen og gi kunden et svar.'
                            : 'Oppdater kalenderen og menyen, så er trucken klar når neste forespørsel kommer.'}
                        </p>
                        <button
                          className="button"
                          onClick={() =>
                            overview.counts.PENDING > 0
                              ? showInbox('PENDING')
                              : changeTab('calendar')
                          }
                        >
                          {overview.counts.PENDING > 0
                            ? 'Se forespørslene'
                            : 'Åpne kalenderen'}
                          <ArrowRight size={19} />
                        </button>
                      </div>
                      <div className="owner-welcome-art" aria-hidden="true">
                        {selectedTruck?.image ? (
                          <img src={selectedTruck.image} alt="" />
                        ) : (
                          <Truck size={86} />
                        )}
                        <span>
                          GOD MAT.
                          <br />
                          GOD FLYT.
                        </span>
                      </div>
                    </div>
                    <div className="owner-metrics">
                      <button onClick={() => showInbox('PENDING')}>
                        <span>
                          <Clock3 size={19} /> Venter på svar
                        </span>
                        <strong>{overview.counts.PENDING}</strong>
                        <small>
                          Forespørsler som trenger deg{' '}
                          <ArrowUpRight size={16} />
                        </small>
                      </button>
                      <button onClick={() => showInbox('ACCEPTED')}>
                        <span>
                          <Check size={19} /> Godkjente bookinger
                        </span>
                        <strong>{overview.counts.ACCEPTED}</strong>
                        <small>
                          Alle lagrede, godkjente oppdrag{' '}
                          <ArrowUpRight size={16} />
                        </small>
                      </button>
                      <button onClick={() => showInbox()}>
                        <span>
                          <Inbox size={19} /> Alle forespørsler
                        </span>
                        <strong>
                          {Object.values(overview.counts).reduce(
                            (sum, value) => sum + value,
                            0,
                          )}
                        </strong>
                        <small>
                          Samlet for denne trucken <ArrowUpRight size={16} />
                        </small>
                      </button>
                      <div className="owner-metric-value">
                        <span>
                          <Coins size={19} /> Godkjent ordreverdi
                        </span>
                        <strong>
                          {formatNok(overview.acceptedQuotedMinor)}
                        </strong>
                        <small>Prisgrunnlag, ikke innbetalt beløp</small>
                      </div>
                    </div>
                    <div className="owner-overview-grid">
                      <section className="owner-panel">
                        <div className="owner-panel-heading">
                          <div>
                            <span className="owner-kicker">DET SOM SKJER</span>
                            <h2>Kommende oppdrag</h2>
                          </div>
                          <button
                            className="owner-inline-link"
                            onClick={() => changeTab('calendar')}
                          >
                            Kalender <ArrowUpRight size={17} />
                          </button>
                        </div>
                        {overview.upcoming.length ? (
                          overview.upcoming.map((booking) => (
                            <button
                              className="owner-upcoming-row"
                              key={booking.id}
                              onClick={() => {
                                showInbox('ACCEPTED');
                                setQuery(booking.id);
                                setSearch(booking.id);
                              }}
                            >
                              <DateTile date={booking.event.date} />
                              <span>
                                <strong>{booking.contact.name}</strong>
                                <small>
                                  {booking.event.startTime} ·{' '}
                                  {booking.event.guestCount} gjester
                                </small>
                                <small>
                                  <MapPin size={14} />
                                  {booking.event.location.label}
                                </small>
                              </span>
                              <ArrowUpRight size={19} />
                            </button>
                          ))
                        ) : (
                          <div className="owner-empty compact">
                            <CalendarDays size={30} />
                            <h3>Plass til noe godt.</h3>
                            <p>Fremtidige, godkjente bookinger vises her.</p>
                            <Link
                              href={profileHref}
                              className="owner-inline-link"
                            >
                              {showcase
                                ? 'Lag en demoforespørsel'
                                : 'Se truckens profil'}{' '}
                              <ArrowRight size={17} />
                            </Link>
                          </div>
                        )}
                      </section>
                      <section className="owner-panel">
                        <div className="owner-panel-heading">
                          <div>
                            <span className="owner-kicker">SIST INNKOMMET</span>
                            <h2>Forespørsler</h2>
                          </div>
                          <button
                            className="owner-inline-link"
                            onClick={() => showInbox()}
                          >
                            Se alle <ArrowUpRight size={17} />
                          </button>
                        </div>
                        {overview.recent.length ? (
                          overview.recent.map((booking) => (
                            <button
                              className="owner-recent-row"
                              key={booking.id}
                              onClick={() => {
                                showInbox();
                                setQuery(booking.id);
                                setSearch(booking.id);
                              }}
                            >
                              <span>
                                <strong>{booking.contact.name}</strong>
                                <small>
                                  {dateLabel(booking.event.date)} ·{' '}
                                  {formatNok(booking.quote.totalMinor)}
                                </small>
                              </span>
                              <Status value={booking.status} />
                            </button>
                          ))
                        ) : (
                          <div className="owner-empty compact">
                            <Inbox size={30} />
                            <h3>Innboksen er klar.</h3>
                            <p>
                              Lag en forespørsel fra kundesiden og følg hele
                              veien hit.
                            </p>
                            <Link
                              href={profileHref}
                              className="owner-inline-link"
                            >
                              {showcase
                                ? 'Prøv kundereisen'
                                : 'Se truckens profil'}{' '}
                              <ArrowRight size={17} />
                            </Link>
                          </div>
                        )}
                      </section>
                    </div>
                    <div className="owner-quick-actions">
                      <button onClick={() => changeTab('menu')}>
                        <UtensilsCrossed size={25} />
                        <span>
                          <strong>En meny som frister</strong>
                          <small>
                            {items.filter((item) => item.enabled).length} aktive
                            retter · rediger menyen
                          </small>
                        </span>
                        <ArrowUpRight size={20} />
                      </button>
                      <button onClick={() => changeTab('calendar')}>
                        <CalendarDays size={25} />
                        <span>
                          <strong>Planlegg neste uke</strong>
                          <small>Åpningstider, pauser og unntak</small>
                        </span>
                        <ArrowUpRight size={20} />
                      </button>
                      <button onClick={() => changeTab('settings')}>
                        <Settings2 size={25} />
                        <span>
                          <strong>Rammene rundt maten</strong>
                          <small>Priser, kapasitet og riggtid</small>
                        </span>
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                  </>
                )}
                {tab === 'inbox' && (
                  <section>
                    <div className="owner-inbox-tools">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (busy) return;
                          setPage(1);
                          setQuery(search.trim());
                        }}
                        className="owner-search"
                      >
                        <Search size={19} />
                        <input
                          aria-label="Søk i forespørsler"
                          disabled={busy}
                          placeholder="Navn, sted eller referanse"
                          maxLength={100}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="submit" disabled={busy}>
                          Søk
                        </button>
                      </form>
                      <label className="owner-status-filter">
                        <span>Status</span>
                        <select
                          disabled={busy}
                          value={status}
                          onChange={(e) => {
                            setPage(1);
                            setStatus(e.target.value);
                          }}
                        >
                          <option value="">Alle statuser</option>
                          {Object.keys(statusLabel).map((value) => (
                            <option key={value} value={value}>
                              {ownerStatus[value as BookingStatus]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(query || status) && (
                        <button
                          className="owner-inline-link"
                          disabled={busy}
                          onClick={() => {
                            setPage(1);
                            setStatus('');
                            setSearch('');
                            setQuery('');
                          }}
                        >
                          Nullstill filter
                        </button>
                      )}
                    </div>
                    <div className="owner-inbox-meta">
                      <span role="status" aria-live="polite">
                        {inboxError
                          ? 'Forespørslene kunne ikke hentes'
                          : inboxLoading
                            ? 'Henter forespørsler …'
                            : `${total} ${total === 1 ? 'forespørsel' : 'forespørsler'}`}
                      </span>
                      <span>Ventende forespørsler reserverer ikke tid.</span>
                    </div>
                    {inboxError ? (
                      <div role="alert" className="service-banner error">
                        {inboxError}
                        <button
                          className="owner-inline-link"
                          disabled={busy}
                          onClick={() => void action(refresh)}
                        >
                          Prøv igjen
                        </button>
                      </div>
                    ) : inboxLoading ? (
                      <div className="owner-loading" role="status">
                        Oppdaterer innboksen …
                      </div>
                    ) : bookings.length === 0 ? (
                      <div className="owner-empty">
                        <Inbox size={36} />
                        <h2>
                          {query || status
                            ? 'Ingen treff denne gangen.'
                            : 'Her starter neste samling.'}
                        </h2>
                        <p>
                          {query || status
                            ? 'Prøv et annet navn eller fjern filtrene.'
                            : 'Når en kunde sender en forespørsel til denne trucken, dukker den opp her.'}
                        </p>
                        {!query && !status && (
                          <Link
                            className="button button-primary"
                            href={profileHref}
                          >
                            {showcase
                              ? 'Lag en demoforespørsel'
                              : 'Se truckens profil'}{' '}
                            <ArrowUpRight size={18} />
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="owner-booking-list">
                        {bookings.map((booking) => (
                          <article
                            className="owner-booking-card"
                            key={booking.id}
                          >
                            <div className="owner-booking-header">
                              <DateTile date={booking.event.date} />
                              <div>
                                <Status value={booking.status} />
                                <h2>{booking.contact.name}</h2>
                                <p>
                                  {dateLabel(booking.event.date)} · kl.{' '}
                                  {booking.event.startTime}
                                </p>
                              </div>
                              <div className="owner-booking-price">
                                <strong>
                                  {formatNok(booking.quote.totalMinor)}
                                </strong>
                                <span>
                                  {booking.quote.pricingModel === 'rental-v1'
                                    ? 'Leiepris inkl. transport/rigg'
                                    : 'Prisgrunnlag (tidligere modell)'}
                                </span>
                              </div>
                            </div>
                            <div className="owner-booking-facts">
                              <span>
                                <MapPin size={18} />
                                {booking.event.location.label}
                              </span>
                              <span>
                                <Users size={18} />
                                {booking.event.guestCount} gjester ·{' '}
                                {booking.quote.pricingModel === 'rental-v1'
                                  ? booking.quote.lines.length
                                  : booking.quote.portionCount}{' '}
                                {booking.quote.pricingModel === 'rental-v1'
                                  ? 'retter valgt'
                                  : 'porsjoner (tidligere modell)'}
                              </span>
                              <span>
                                <Clock3 size={18} />
                                {booking.event.durationHours} timers servering
                              </span>
                            </div>
                            <details className="owner-booking-details">
                              <summary>
                                Kontakt, meny og referanse{' '}
                                <ChevronRight size={16} />
                              </summary>
                              <div>
                                <dl>
                                  <dt>E-post</dt>
                                  <dd>
                                    <a href={`mailto:${booking.contact.email}`}>
                                      {booking.contact.email}
                                    </a>
                                  </dd>
                                  <dt>Telefon</dt>
                                  <dd>
                                    <a href={`tel:${booking.contact.phone}`}>
                                      {booking.contact.phone}
                                    </a>
                                  </dd>
                                  {booking.contact.companyName && (
                                    <>
                                      <dt>Bedrift</dt>
                                      <dd>{booking.contact.companyName}</dd>
                                    </>
                                  )}
                                  <dt>Referanse</dt>
                                  <dd className="owner-reference">
                                    {booking.id}
                                  </dd>
                                </dl>
                                <ul>
                                  {booking.quote.lines.map((line) => (
                                    <li key={line.itemId}>
                                      <span>
                                        {booking.quote.pricingModel ===
                                        'rental-v1'
                                          ? line.name
                                          : `${line.quantity} × ${line.name}`}
                                      </span>
                                      {booking.quote.pricingModel !==
                                        'rental-v1' && (
                                        <strong>
                                          {formatNok(line.lineTotalMinor)}
                                        </strong>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                {booking.event.notes && (
                                  <p className="owner-booking-note">
                                    {booking.event.notes}
                                  </p>
                                )}
                              </div>
                            </details>
                            <div className="owner-booking-actions">
                              {booking.status === 'PENDING' && (
                                <>
                                  <button
                                    disabled={busy}
                                    className="button button-primary"
                                    onClick={() =>
                                      void decide(booking, 'accept')
                                    }
                                  >
                                    <Check size={18} /> Godkjenn
                                  </button>
                                  <button
                                    disabled={busy}
                                    className="button button-secondary"
                                    onClick={() =>
                                      void decide(booking, 'decline')
                                    }
                                  >
                                    Avslå
                                  </button>
                                </>
                              )}
                              {['PENDING', 'ACCEPTED'].includes(
                                booking.status,
                              ) && (
                                <button
                                  disabled={busy}
                                  className="owner-inline-link"
                                  onClick={() => void decide(booking, 'cancel')}
                                >
                                  Avlys
                                </button>
                              )}
                              <button
                                disabled={busy}
                                className="owner-payment-link"
                                onClick={() => void inspectPayment(booking)}
                              >
                                <Coins size={17} /> Betalingsstatus
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                    <div className="owner-pagination">
                      <button
                        aria-label="Forrige side"
                        disabled={busy || inboxLoading || page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        <ChevronLeft size={19} /> Forrige
                      </button>
                      <span>
                        Side {page} av {Math.max(1, totalPages)}
                      </span>
                      <button
                        disabled={busy || inboxLoading || page >= totalPages}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        Neste <ChevronRight size={19} />
                      </button>
                    </div>
                    <p className="owner-subtle">
                      Ved godkjenning kontrolleres åpningstid, kapasitet og
                      andre bookinger på nytt.
                    </p>
                  </section>
                )}
                {tab === 'calendar' && (
                  <OpeningHoursEditor
                    key={base}
                    path={`${base}/booking-settings`}
                    initial={settings}
                    onDirtyChange={setDirty}
                    onBusyChange={setEditorBusy}
                    onSaved={() => {
                      setNotice('Åpningstidene er lagret.');
                      void loadCore().catch((e) => setError(errorMessage(e)));
                    }}
                  />
                )}
                {tab === 'settings' && (
                  <SettingsForm
                    key={base}
                    path={`${base}/booking-settings`}
                    initial={settings}
                    onDirtyChange={setDirty}
                    onBusyChange={setEditorBusy}
                    onSaved={() => {
                      setNotice(
                        showcase
                          ? 'Innstillingene er lagret i demoen.'
                          : 'Innstillingene er lagret.',
                      );
                      void loadCore().catch((e) => setError(errorMessage(e)));
                    }}
                  />
                )}
                {tab === 'menu' && (
                  <MenuEditor
                    key={base}
                    path={`${base}/menu`}
                    mediaPath={`${base}/media`}
                    items={items}
                    allergens={allergens}
                    categories={categories}
                    onSaved={loadCore}
                  />
                )}
                {tab === 'images' && (
                  <ImageManager
                    key={base}
                    path={`${base}/media`}
                    onSaved={reloadCatalogue}
                  />
                )}
              </>
            )}
          </div>
        )}
        {payment && (
          <section className="owner-payment-panel service-card">
            <div className="owner-panel-heading">
              <div>
                <span className="owner-kicker">
                  {showcase ? 'SIMULERT BETALING' : 'BETALING'}
                </span>
                <h2 ref={paymentHeading} tabIndex={-1}>
                  {payment.booking.contact.name}
                </h2>
              </div>
              <button
                className="owner-inline-link"
                disabled={busy}
                onClick={() => setPayment(null)}
              >
                Lukk
              </button>
            </div>
            {payment.value ? (
              <>
                <p className="owner-payment-state">
                  {paymentLabel(payment.value)}
                </p>
                <dl>
                  <dt>Autorisert</dt>
                  <dd>{formatNok(payment.value.authorizedMinor)}</dd>
                  <dt>Belastet</dt>
                  <dd>{formatNok(payment.value.capturedMinor)}</dd>
                  <dt>Frigitt</dt>
                  <dd>{formatNok(payment.value.cancelledMinor)}</dd>
                  <dt>Refundert</dt>
                  <dd>{formatNok(payment.value.refundedMinor)}</dd>
                </dl>
                <p>
                  {showcase
                    ? 'Alle beløp er simulerte. Ingen betalingsleverandør kontaktes og ingen penger flyttes.'
                    : 'Handlingene gjelder gjenværende beløp hos betalingsleverandøren.'}{' '}
                  Avlysning av en booking utfører ikke automatisk refusjon.
                </p>
                <div className="service-actions">
                  {canCapture(payment.value) && (
                    <button
                      disabled={busy}
                      className="button button-primary"
                      onClick={() => void paymentAction('capture')}
                    >
                      {showcase
                        ? 'Simuler belastning'
                        : 'Belast gjenværende beløp'}
                    </button>
                  )}
                  {canRelease(payment.value) && (
                    <button
                      disabled={busy}
                      className="button button-secondary"
                      onClick={() => void paymentAction('cancel')}
                    >
                      {payment.value.state === 'CREATED'
                        ? 'Avbryt betalingsforsøk'
                        : 'Frigi reservasjon'}
                    </button>
                  )}
                  {payment.value.capturedMinor >
                    payment.value.refundedMinor && (
                    <button
                      disabled={busy}
                      className="button button-secondary"
                      onClick={() => void paymentAction('refund')}
                    >
                      {showcase
                        ? 'Simuler refusjon'
                        : 'Refunder gjenværende beløp'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>Ingen betaling er opprettet for denne forespørselen.</p>
            )}
          </section>
        )}
        <footer className="owner-footer">
          <span>
            humbites for bedrift<span aria-hidden="true"> ✳</span>
          </span>
          <span>
            {showcase
              ? 'Eksempeldata. Ekte muligheter.'
              : 'Gode smaker. Godt samarbeid.'}
          </span>
        </footer>
      </div>
    </main>
  );
}
