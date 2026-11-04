'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useConfirmation } from '@/components/ConfirmationProvider';
import { api, errorMessage } from '@/lib/booking/client';
import type {
  DateOverride,
  OpeningInterval,
  ScheduleInput,
  SchedulePreview,
  Settings,
} from '@/lib/booking/types';
import {
  addCalendarDays,
  normalizeSchedule,
  osloTime,
  scheduleSchema,
} from '@/lib/showcase/schedule';
import {
  addHolidayClosures,
  clockLabel,
  dayIntervals,
  dayMode,
  displayDate,
  emptySchedule,
  intervalLabel,
  monthShift,
  norwegianHolidays,
  replaceDays,
  weekDays,
} from './schedule-helpers';
import './schedule.css';
import { TimeRanges } from './TimeRanges';

type Props = {
  path: string;
  initial: Settings | null;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
};
const defaultHours = [{ startMinute: 660, endMinute: 1200 }];
const sourceLabels = {
  weekly: 'Fast ukeplan',
  override: 'Eget datounntak',
  vacation: 'Stengt periode',
  'closed-date': 'Stengt dato',
};
const keyOf = (schedule: ScheduleInput) => JSON.stringify(schedule);

export function OpeningHoursEditor({
  path,
  initial,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: Props) {
  const confirm = useConfirmation();
  const incoming = keyOf(initial ? normalizeSchedule(initial) : emptySchedule);
  const [draft, setDraft] = useState<ScheduleInput>(() => JSON.parse(incoming));
  const [baseline, setBaseline] = useState(incoming);
  // Keep incoming snapshots separate so background refreshes do not erase a dirty draft.
  const incomingSeen = useRef(incoming);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const today = osloTime(new Date()).date;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [preview, setPreview] = useState<{
    key: string;
    value: SchedulePreview;
  } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [copySource, setCopySource] = useState(1);
  const [copyTarget, setCopyTarget] = useState('weekdays');
  const [preset, setPreset] = useState('weekdays');
  const [dateToAdd, setDateToAdd] = useState(today);
  const [holidayYear, setHolidayYear] = useState(Number(today.slice(0, 4)));
  const [holidaySelection, setHolidaySelection] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onDirtyChange, onBusyChange });
  callbacks.current = { onDirtyChange, onBusyChange };
  const dirty = keyOf(draft) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      callbacks.current.onDirtyChange?.(false);
      callbacks.current.onBusyChange?.(false);
    },
    [],
  );
  useEffect(() => {
    if (incomingSeen.current !== incoming) {
      incomingSeen.current = incoming;
      if (!dirty) {
        setDraft(JSON.parse(incoming));
        setBaseline(incoming);
      }
    }
  }, [incoming, dirty]);
  const validation = useMemo(() => scheduleSchema.safeParse(draft), [draft]);
  // Only display responses for this exact month and draft; older responses are stale.
  const previewKey = validation.success
    ? `${month}:${keyOf(validation.data)}:${refresh}`
    : '';
  const previewPath = path.replace(/\/booking-settings$/, '/schedule-preview');
  useEffect(() => {
    setRefresh((value) => value + 1);
  }, [initial]);
  useEffect(() => {
    setPreviewError('');
    if (!validation.success) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      void api<{ data: SchedulePreview }>(previewPath, {
        method: 'POST',
        body: JSON.stringify({ month, schedule: validation.data }),
        signal: controller.signal,
      })
        .then((result) => {
          if (active) setPreview({ key: previewKey, value: result.data });
        })
        .catch((cause) => {
          if (active) setPreviewError(errorMessage(cause));
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
    // The serialized key includes every validated schedule field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, previewPath]);
  const currentPreview = preview?.key === previewKey ? preview.value : null;
  const selectedDay = currentPreview?.days.find(
    (day) => day.date === selectedDate,
  );
  const holidays = useMemo(() => norwegianHolidays(holidayYear), [holidayYear]);
  const existingDates = new Set([
    ...draft.closedDates,
    ...draft.dateOverrides.map((row) => row.date),
  ]);
  const chosenHolidays = holidays.filter(
    (row) =>
      holidaySelection.includes(row.date) && !existingDates.has(row.date),
  );
  function change(update: (schedule: ScheduleInput) => ScheduleInput) {
    setDraft((current) => update(current));
    setNotice('');
    setError('');
  }
  async function approve(
    title: string,
    message: string,
    confirmLabel = 'Ja, bruk endringen',
  ) {
    return confirm({ title, message, confirmLabel });
  }
  async function removeRange(
    rows: OpeningInterval[],
    index: number,
    apply: (rows: OpeningInterval[]) => void,
  ) {
    if (
      await approve(
        'Fjerne dette tidsrommet?',
        `Tidsrommet ${intervalLabel(rows[index])} fjernes fra utkastet. Du må lagre for å endre tilgjengeligheten.`,
        'Ja, fjern tidsrommet',
      )
    )
      apply(rows.filter((_, i) => i !== index));
  }
  async function changeDayMode(day: number, mode: string) {
    const current = dayIntervals(draft.openingHours, day),
      next =
        mode === 'closed'
          ? []
          : mode === 'all-day'
            ? [{ startMinute: 0, endMinute: 1440 }]
            : defaultHours;
    if (
      current.length &&
      !(await approve(
        'Erstatte tidene denne dagen?',
        `${weekDays.find((row) => row.id === day)!.name} endres til ${mode === 'closed' ? 'stengt' : mode === 'all-day' ? 'døgnåpent' : 'åpent med egne tider'}. Dagens tidsrom erstattes i utkastet.`,
      ))
    )
      return;
    change((state) => ({
      ...state,
      openingHours: replaceDays(state.openingHours, [day], next),
    }));
  }
  async function copyDay() {
    const targets =
      copyTarget === 'all'
        ? weekDays.map((row) => row.id)
        : copyTarget === 'weekdays'
          ? [1, 2, 3, 4, 5]
          : [Number(copyTarget)];
    if (
      !(await approve(
        'Kopiere åpningstidene?',
        `Tidene fra ${weekDays.find((row) => row.id === copySource)!.name.toLowerCase()} erstatter ${copyTarget === 'all' ? 'hele uken' : copyTarget === 'weekdays' ? 'mandag til fredag' : weekDays.find((row) => row.id === Number(copyTarget))!.name.toLowerCase()}. Datounntak og ferieperioder beholdes.`,
        'Ja, kopier tidene',
      ))
    )
      return;
    change((state) => ({
      ...state,
      openingHours: replaceDays(
        state.openingHours,
        targets,
        dayIntervals(state.openingHours, copySource),
      ),
    }));
  }
  async function applyPreset() {
    if (
      !(await approve(
        'Erstatte den faste ukeplanen?',
        `Hele ukeplanen erstattes med valgt forslag. Datounntak og ferieperioder beholdes. Endringen lagres først når du trykker «Lagre åpningstider».`,
        'Ja, bruk ukeplanen',
      ))
    )
      return;
    const days =
      preset === 'weekdays'
        ? [1, 2, 3, 4, 5]
        : preset === 'weekend'
          ? [6, 0]
          : weekDays.map((row) => row.id);
    change((state) => ({
      ...state,
      openingHours:
        preset === 'closed'
          ? []
          : replaceDays(
              [],
              days,
              preset === 'always'
                ? [{ startMinute: 0, endMinute: 1440 }]
                : preset === 'weekend'
                  ? [{ startMinute: 720, endMinute: 1320 }]
                  : defaultHours,
            ),
    }));
  }
  function goMonth(next: string) {
    setMonth(next);
    setSelectedDate(next === today.slice(0, 7) ? today : `${next}-01`);
  }
  function addDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Velg datoen du vil tilpasse.');
      return;
    }
    const existing = draft.dateOverrides.findIndex((row) => row.date === date);
    if (existing < 0) {
      if (draft.dateOverrides.length >= 366) {
        setError('Du kan ha høyst 366 datounntak.');
        return;
      }
      change((state) => ({
        ...state,
        dateOverrides: [
          ...state.dateOverrides,
          { date, closed: true, intervals: [], label: '' },
        ],
      }));
    }
    setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            `#schedule-exception-${existing < 0 ? draft.dateOverrides.length : existing} input`,
          )
          ?.focus(),
      0,
    );
  }
  function updateDate(index: number, patch: Partial<DateOverride>) {
    change((state) => ({
      ...state,
      dateOverrides: state.dateOverrides.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  }
  async function setDateMode(index: number, mode: string) {
    const row = draft.dateOverrides[index];
    if (
      row.intervals.length &&
      !(await approve(
        'Erstatte tidene for datoen?',
        `Åpningstidene for ${row.date} erstattes i utkastet.`,
      ))
    )
      return;
    updateDate(index, {
      closed: mode === 'closed',
      intervals:
        mode === 'closed'
          ? []
          : mode === 'all-day'
            ? [{ startMinute: 0, endMinute: 1440 }]
            : defaultHours,
    });
  }
  async function removeDate(index: number) {
    if (
      await approve(
        'Fjerne datounntaket?',
        `Den faste ukeplanen gjelder igjen for ${draft.dateOverrides[index].date}, med mindre en stengt periode eller tidligere stengt dato gjelder.`,
        'Ja, fjern unntaket',
      )
    )
      change((state) => ({
        ...state,
        dateOverrides: state.dateOverrides.filter((_, i) => i !== index),
      }));
  }
  async function addHolidays() {
    if (draft.dateOverrides.length + chosenHolidays.length > 366) {
      setError('Det er ikke plass til flere datounntak. Fjern noen først.');
      return;
    }
    if (
      !chosenHolidays.length ||
      !(await approve(
        'Legge til valgte fridager?',
        `${chosenHolidays.length} valgte datoer legges til som stengt i utkastet. Eksisterende datounntak beholdes. Du bestemmer selv hvilke dager trucken skal være åpen.`,
        'Ja, legg til som stengt',
      ))
    )
      return;
    change((state) => addHolidayClosures(state, chosenHolidays));
    setHolidaySelection([]);
    setNotice(
      'Valgte datoer er lagt til i utkastet. Lagre åpningstidene for å ta dem i bruk.',
    );
  }
  async function discard() {
    if (
      await approve(
        'Forkaste ulagrede endringer?',
        'Åpningstider, unntak og perioder går tilbake til sist lagrede verdier.',
        'Ja, forkast endringene',
      )
    ) {
      setDraft(JSON.parse(incoming));
      setBaseline(incoming);
      setError('');
      setNotice('Utkastet er forkastet.');
    }
  }
  async function save() {
    if (busy) return;
    if (!validation.success) {
      setError('Rett opp punktene under før du lagrer.');
      errorRef.current?.focus();
      return;
    }
    if (
      incoming !== baseline &&
      !(await approve(
        'Erstatte en nyere ukeplan?',
        'Lagrede åpningstider ble oppdatert mens du redigerte. Dette utkastet vil erstatte dem. Pris- og kapasitetsinnstillinger beholdes.',
        'Ja, lagre mitt utkast',
      ))
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ data: Settings }>(path + '/schedule', {
        method: 'PUT',
        body: JSON.stringify(validation.data),
      });
      const normalized = normalizeSchedule(result.data);
      setDraft(normalized);
      setBaseline(keyOf(normalized));
      setNotice(
        'Åpningstidene er lagret. Nye søk og forespørsler bruker den oppdaterte planen.',
      );
      setRefresh((value) => value + 1);
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const issues = validation.success
    ? []
    : validation.error.issues.map((issue) => {
        const section = issue.path[0],
          index = Number(issue.path[1]);
        const prefix =
          section === 'openingHours'
            ? (weekDays.find(
                (row) => row.id === draft.openingHours[index]?.weekday,
              )?.name ?? 'Ukeplan')
            : section === 'dateOverrides'
              ? `Datounntak ${index + 1}`
              : section === 'vacationRanges'
                ? `Periode ${index + 1}`
                : section === 'minimumNoticeHours'
                  ? 'Minste varsel'
                  : section === 'maximumAdvanceDays'
                    ? 'Bestillingshorisont'
                    : 'Stengte datoer';
        return `${prefix}: ${/^(Number|Expected|Required|Array)/.test(issue.message) ? 'Kontroller at alle verdier er gyldige og innenfor grensene.' : issue.message}`;
      });
  const dayReservations = (date: string) =>
    (currentPreview?.reservations ?? []).filter(
      (row) =>
        osloTime(new Date(row.reservedStartsAt)).date <= date &&
        osloTime(new Date(Date.parse(row.reservedEndsAt) - 1)).date >= date,
    );
  const selectedReservations = dayReservations(selectedDate);
  const instantLabel = (instant: string) =>
    new Intl.DateTimeFormat('nb-NO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Oslo',
    }).format(new Date(instant));
  const selectedConflicts =
    currentPreview?.conflicts.filter(
      (row) =>
        osloTime(new Date(row.startsAt)).date <= selectedDate &&
        osloTime(new Date(Date.parse(row.endsAt) - 1)).date >= selectedDate,
    ) ?? [];

  return (
    <section className="schedule-editor" aria-label="Åpningstider og kalender">
      <div className="schedule-intro">
        <div>
          <span className="eyebrow">DIN RYTME. DIN UKE.</span>
          <h2>
            Åpent for gode
            <br />
            <em>samlinger.</em>
          </h2>
          <p>
            Sett serveringstidene, ta fri når du trenger det, og se hvordan
            kalenderen blir.
          </p>
        </div>
        <div className="schedule-timezone">
          <Icon name="clock" size={25} />
          <strong>Europe/Oslo</strong>
          <span>Norsk tid · sommer- og vintertid håndteres automatisk.</span>
        </div>
      </div>
      {notice && (
        <p className="service-banner" role="status">
          {notice}
        </p>
      )}
      {(error || issues.length > 0) && (
        <div
          className="service-banner error"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          {error && <strong>{error}</strong>}
          {issues.length > 0 && (
            <ul>
              {[...new Set(issues)].map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="schedule-status-row">
        <div className="schedule-status-card">
          <span>NÅ, ETTER {dirty ? 'UTKASTET' : 'LAGRET PLAN'}</span>
          <strong>
            {!validation.success
              ? 'Kontroller planen'
              : previewError
                ? 'Kunne ikke beregne'
                : !currentPreview
                  ? 'Beregner …'
                  : !currentPreview.enabled
                    ? 'Forespørsler av'
                    : currentPreview.now.open
                      ? 'Åpent nå'
                      : 'Stengt nå'}
          </strong>
          <p>
            {currentPreview?.enabled === false
              ? 'Slå på forespørsler under priser og innstillinger.'
              : 'Viser serveringstidene. Kalender og kapasitet sjekkes også for hver forespørsel.'}
          </p>
        </div>
        <div className="schedule-status-card is-yellow">
          <span>NESTE ÅPNING</span>
          <strong>
            {!validation.success
              ? 'Kontroller planen'
              : previewError
                ? 'Kunne ikke beregne'
                : !currentPreview
                  ? 'Beregner …'
                  : !currentPreview.enabled
                    ? 'Forespørsler av'
                    : currentPreview.now.open
                      ? 'Du er allerede åpen'
                      : currentPreview.nextOpening
                        ? `${displayDate(currentPreview.nextOpening.date, { day: 'numeric', month: 'short' })} · ${clockLabel(currentPreview.nextOpening.minute)}`
                        : 'Ingen planlagt'}
          </strong>
          <p>
            {currentPreview?.enabled === false
              ? 'Åpningstider vises når forespørsler er aktivert.'
              : currentPreview &&
                  !currentPreview.nextOpening &&
                  !currentPreview.now.open
                ? `Ingen åpning funnet frem til ${displayDate(currentPreview.nextOpeningSearchThrough, { day: 'numeric', month: 'long', year: 'numeric' })}.`
                : 'Forhåndsvisningen viser dine egne timer, ikke en garanti om ledig kapasitet.'}
          </p>
        </div>
      </div>
      {currentPreview && (
        <p className="schedule-snapshot">
          Status oppdatert kl.{' '}
          {new Intl.DateTimeFormat('nb-NO', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Oslo',
          }).format(new Date(currentPreview.generatedAt))}
          . Bruk «Oppdater» for fersk status og nye reservasjoner.
        </p>
      )}
      <div className="schedule-layout">
        <section className="schedule-card schedule-week">
          <div className="schedule-section-heading">
            <span className="schedule-number">01</span>
            <div>
              <h3>Den vanlige uken</h3>
              <p>Flere serveringer samme dag? Legg til flere tidsrom.</p>
            </div>
          </div>
          <div className="schedule-preset">
            <label>
              <span>Start med et forslag</span>
              <select
                value={preset}
                disabled={busy}
                onChange={(e) => setPreset(e.target.value)}
              >
                <option value="weekdays">Man–fre 11:00–20:00</option>
                <option value="all">Alle dager 11:00–20:00</option>
                <option value="weekend">Lør–søn 12:00–22:00</option>
                <option value="always">Døgnåpent hele uken</option>
                <option value="closed">Stengt hele uken</option>
              </select>
            </label>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => void applyPreset()}
            >
              Bruk forslag
            </button>
          </div>
          <div className="schedule-days">
            {weekDays.map((day) => {
              const rows = dayIntervals(draft.openingHours, day.id),
                mode = dayMode(rows);
              const apply = (intervals: OpeningInterval[]) =>
                change((state) => ({
                  ...state,
                  openingHours: replaceDays(
                    state.openingHours,
                    [day.id],
                    intervals,
                  ),
                }));
              return (
                <div
                  className={`schedule-day ${mode === 'closed' ? 'is-closed' : ''}`}
                  key={day.id}
                >
                  <div className="schedule-day-heading">
                    <strong>{day.name}</strong>
                    <select
                      aria-label={`Åpningsstatus ${day.name.toLowerCase()}`}
                      disabled={busy}
                      value={mode}
                      onChange={(e) =>
                        void changeDayMode(day.id, e.target.value)
                      }
                    >
                      <option value="closed">Stengt</option>
                      <option value="open">Egne tider</option>
                      <option value="all-day">Døgnåpent</option>
                    </select>
                  </div>
                  {mode === 'open' ? (
                    <TimeRanges
                      value={rows}
                      label={day.name}
                      disabled={busy}
                      onChange={apply}
                      onRemove={(index) => void removeRange(rows, index, apply)}
                    />
                  ) : (
                    <p className="schedule-day-summary">
                      {mode === 'all-day'
                        ? '00:00–24:00'
                        : 'Ingen servering starter denne dagen'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="schedule-help">
            <Icon name="info" size={17} /> For 22:00–02:00: velg «Slutter neste
            dag». Stengt betyr at ingen servering starter denne ukedagen;
            nattåpent fra dagen før kan fortsatt gjelde.
          </p>
          <div className="schedule-copy">
            <label>
              <span>Kopier fra</span>
              <select
                disabled={busy}
                value={copySource}
                onChange={(e) => setCopySource(Number(e.target.value))}
              >
                {weekDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Bruk på</span>
              <select
                disabled={busy}
                value={copyTarget}
                onChange={(e) => setCopyTarget(e.target.value)}
              >
                <option value="weekdays">Mandag–fredag</option>
                <option value="all">Hele uken</option>
                {weekDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => void copyDay()}
            >
              Kopier tider
            </button>
          </div>
        </section>
        <aside className="schedule-preview schedule-card">
          <div className="schedule-section-heading">
            <span className="schedule-number">↗</span>
            <div>
              <h3>Se kalenderen</h3>
              <p>
                {dirty ? 'Forhåndsvisning av ulagret utkast' : 'Lagret plan'} ·
                Europe/Oslo
              </p>
            </div>
          </div>
          <div className="schedule-month-nav">
            <button
              type="button"
              className="schedule-icon-button"
              aria-label="Forrige måned"
              onClick={() => goMonth(monthShift(month, -1))}
            >
              <Icon name="back" size={18} />
            </button>
            <h4>
              {displayDate(`${month}-01`, { month: 'long', year: 'numeric' })}
            </h4>
            <button
              type="button"
              className="schedule-icon-button"
              aria-label="Neste måned"
              onClick={() => goMonth(monthShift(month, 1))}
            >
              <Icon name="arrow" size={18} />
            </button>
          </div>
          <button
            type="button"
            className="schedule-add"
            onClick={() => {
              goMonth(today.slice(0, 7));
              setSelectedDate(today);
            }}
          >
            Gå til i dag
          </button>
          {previewError ? (
            <div className="service-banner error" role="alert">
              <p>{previewError}</p>
              <button
                type="button"
                className="schedule-add"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Prøv forhåndsvisning igjen
              </button>
            </div>
          ) : !validation.success ? (
            <p className="schedule-empty">
              Rett opp ukeplanen for å se kalenderen.
            </p>
          ) : !currentPreview ? (
            <p className="schedule-empty" role="status">
              Oppdaterer kalenderen …
            </p>
          ) : (
            <>
              <div
                className="schedule-calendar"
                aria-label={`Kalender for ${displayDate(`${month}-01`, { month: 'long', year: 'numeric' })}`}
              >
                {weekDays.map((day) => (
                  <span className="schedule-calendar-weekday" key={day.id}>
                    {day.short}
                  </span>
                ))}
                {Array.from(
                  { length: (currentPreview.days[0].weekday + 6) % 7 },
                  (_, index) => (
                    <span key={`blank-${index}`} aria-hidden="true" />
                  ),
                )}
                {currentPreview.days.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    className={`schedule-calendar-day ${day.closed ? 'is-closed' : 'is-open'} ${day.source !== 'weekly' ? 'is-special' : ''} ${day.date === today ? 'is-today' : ''}`}
                    aria-label={`${displayDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${day.closed ? 'stengt' : day.intervals.map(intervalLabel).join(', ')}${day.label ? `, ${day.label}` : ''}${dayReservations(day.date).length ? `, ${dayReservations(day.date).length} godkjente reservasjoner` : ''}`}
                    aria-pressed={selectedDate === day.date}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setDateToAdd(day.date);
                    }}
                  >
                    <span>{Number(day.date.slice(-2))}</span>
                    <i aria-hidden="true" />
                    {dayReservations(day.date).length > 0 && (
                      <b
                        className="schedule-booking-marker"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="schedule-calendar-legend">
                <span>
                  <i className="open-dot" /> Åpent
                </span>
                <span>
                  <i className="closed-dot" /> Stengt
                </span>
                <span>
                  <i className="special-dot" /> Unntak / ferie
                </span>
                <span>
                  <i className="booked-dot" /> Godkjent reservasjon
                </span>
              </div>
              {selectedDay && (
                <div className="schedule-day-detail" aria-live="polite">
                  <span className="eyebrow">
                    {sourceLabels[selectedDay.source]}
                  </span>
                  <h4>
                    {displayDate(selectedDate, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h4>
                  {selectedDay.label && (
                    <p>
                      <strong>{selectedDay.label}</strong>
                    </p>
                  )}
                  <p>
                    {selectedDay.closed
                      ? 'Stengt hele dagen'
                      : selectedDay.intervals.map(intervalLabel).join(' · ')}
                  </p>
                  {selectedReservations.length > 0 && (
                    <div className="schedule-reservations">
                      <strong>
                        {selectedReservations.length} godkjente{' '}
                        {selectedReservations.length === 1
                          ? 'reservasjon'
                          : 'reservasjoner'}
                      </strong>
                      <ul>
                        {selectedReservations.map((row) => (
                          <li key={row.bookingId}>
                            <span>
                              Servering: {instantLabel(row.startsAt)} –{' '}
                              {instantLabel(row.endsAt)}
                            </span>
                            <small>
                              Opptatt med rigg/rydding:{' '}
                              {instantLabel(row.reservedStartsAt)} –{' '}
                              {instantLabel(row.reservedEndsAt)}
                            </small>
                            <small>Referanse {row.bookingId.slice(0, 8)}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedConflicts.length > 0 && (
                    <p className="schedule-conflict">
                      {selectedConflicts.length} godkjente bookinger berøres av
                      planen denne dagen.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    className="schedule-add"
                    onClick={() => addDate(selectedDate)}
                  >
                    Tilpass denne datoen →
                  </button>
                </div>
              )}
              {currentPreview.conflicts.length > 0 && (
                <div className="service-banner error">
                  <strong>
                    {currentPreview.conflicts.length} fremtidige, godkjente
                    bookinger krever oppfølging
                  </strong>
                  <p>
                    Varslet gjelder alle fremtidige datoer, ikke bare måneden
                    som vises. Bookingene beholdes og avlyses ikke selv om du
                    endrer åpningstidene. Se hver forespørsel før du avklarer
                    endringen.
                  </p>
                  <ul>
                    {currentPreview.conflicts.map((row) => (
                      <li key={row.bookingId}>
                        {displayDate(osloTime(new Date(row.startsAt)).date)} ·
                        referanse {row.bookingId.slice(0, 8)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <p className="schedule-help">
            Ferie og stengte datoer går foran ukeplanen. Et datounntak erstatter
            hele datoen, også nattåpning fra dagen før. Rigg før og etter
            servering reserverer tid, men trenger ikke ligge innenfor
            serveringstidene.
          </p>
        </aside>
      </div>
      <section className="schedule-card">
        <div className="schedule-section-heading">
          <span className="schedule-number">02</span>
          <div>
            <h3>Noen dager er annerledes</h3>
            <p>
              Egne åpningstider eller helt stengt. Navngi gjerne dagen:
              festival, privat selskap eller helligdag.
            </p>
          </div>
        </div>
        <div className="schedule-add-date">
          <label>
            <span>Velg en dato</span>
            <input
              type="date"
              disabled={busy}
              value={dateToAdd}
              onChange={(e) => setDateToAdd(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || !dateToAdd}
            onClick={() => addDate(dateToAdd)}
          >
            Legg til / rediger dato
          </button>
        </div>
        {!draft.dateOverrides.length && (
          <p className="schedule-empty">
            Ingen datounntak ennå. Den faste uken gjelder, med eventuelle
            stengte perioder under.
          </p>
        )}
        <div className="schedule-exceptions">
          {draft.dateOverrides.map((row, index) => (
            <article
              className="schedule-exception"
              id={`schedule-exception-${index}`}
              key={index}
            >
              <div className="schedule-exception-heading">
                <label>
                  <span>Dato</span>
                  <input
                    type="date"
                    required
                    disabled={busy}
                    value={row.date}
                    onChange={(e) =>
                      updateDate(index, { date: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Navn / merknad</span>
                  <input
                    maxLength={120}
                    disabled={busy}
                    placeholder="F.eks. sommerfestival"
                    value={row.label ?? ''}
                    onChange={(e) =>
                      updateDate(index, { label: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Servering</span>
                  <select
                    disabled={busy}
                    value={row.closed ? 'closed' : dayMode(row.intervals)}
                    onChange={(e) => void setDateMode(index, e.target.value)}
                  >
                    <option value="closed">Stengt</option>
                    <option value="open">Egne tider</option>
                    <option value="all-day">Døgnåpent</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="schedule-remove"
                  disabled={busy}
                  aria-label={`Fjern datounntak ${row.date}`}
                  onClick={() => void removeDate(index)}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              {(draft.closedDates.includes(row.date) ||
                draft.vacationRanges.some(
                  (range) => range.from <= row.date && range.to >= row.date,
                )) && (
                <p className="schedule-rule-note">
                  En stengt dato eller periode overstyrer dette unntaket. Fjern
                  eller endre stengingen for å ta disse åpningstidene i bruk.
                </p>
              )}
              {!row.closed && dayMode(row.intervals) !== 'all-day' && (
                <TimeRanges
                  value={row.intervals}
                  label={`Datounntak ${row.date}`}
                  disabled={busy}
                  onChange={(intervals) => updateDate(index, { intervals })}
                  onRemove={(range) =>
                    void removeRange(row.intervals, range, (intervals) =>
                      updateDate(index, {
                        intervals,
                        closed: intervals.length === 0,
                      }),
                    )
                  }
                />
              )}
            </article>
          ))}
        </div>
        {draft.closedDates.length > 0 && (
          <div className="schedule-legacy">
            <h4>Stengte datoer fra tidligere</h4>
            <p>Disse datoene overstyrer både ukeplan og egne åpningstider.</p>
            {draft.closedDates.map((date) => (
              <button
                type="button"
                key={date}
                disabled={busy}
                className="schedule-legacy-date"
                onClick={() =>
                  void approve(
                    'Fjerne stengt dato?',
                    `${date} følger deretter ukeplanen eller et eget datounntak.`,
                    'Ja, fjern datoen',
                  ).then((ok) => {
                    if (ok)
                      change((state) => ({
                        ...state,
                        closedDates: state.closedDates.filter(
                          (value) => value !== date,
                        ),
                      }));
                  })
                }
              >
                {date} <Icon name="close" size={14} />
                <span className="sr-only">Fjern stengt dato</span>
              </button>
            ))}
          </div>
        )}
        <details className="schedule-holidays">
          <summary>
            Planlegg hellig- og høytidsdager <Icon name="chevron" size={18} />
          </summary>
          <p>
            Du velger selv om trucken skal være åpen. Merk datoene du vil legge
            til som stengt; eksisterende datounntak endres ikke. Julaften og
            nyttårsaften kan legges inn som egne datoer over.
          </p>
          <label className="schedule-year">
            <span>År</span>
            <input
              type="number"
              min={1900}
              max={2199}
              value={holidayYear}
              disabled={busy}
              onChange={(e) => {
                setHolidayYear(Number(e.target.value));
                setHolidaySelection([]);
              }}
            />
          </label>
          <div className="schedule-holiday-list">
            {holidays.map((row) => (
              <label key={row.date}>
                <input
                  type="checkbox"
                  disabled={busy || existingDates.has(row.date)}
                  checked={holidaySelection.includes(row.date)}
                  onChange={(e) =>
                    setHolidaySelection((current) =>
                      e.target.checked
                        ? [...current, row.date]
                        : current.filter((value) => value !== row.date),
                    )
                  }
                />
                <span>
                  <strong>{row.label}</strong>
                  <small>
                    {displayDate(row.date, { day: 'numeric', month: 'long' })}
                    {existingDates.has(row.date)
                      ? ' · har allerede et unntak'
                      : ''}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <div className="schedule-holiday-actions">
            <button
              type="button"
              className="schedule-add"
              disabled={busy}
              onClick={() =>
                setHolidaySelection(
                  holidays
                    .filter((row) => !existingDates.has(row.date))
                    .map((row) => row.date),
                )
              }
            >
              Velg alle uten eksisterende unntak
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy || !chosenHolidays.length}
              onClick={() => void addHolidays()}
            >
              Legg til {chosenHolidays.length || ''} valgte som stengt
            </button>
          </div>
        </details>
      </section>
      <section className="schedule-card">
        <div className="schedule-section-heading">
          <span className="schedule-number">03</span>
          <div>
            <h3>Plass til en pause</h3>
            <p>
              Ferie, vedlikehold eller et annet oppdrag. Begge datoene er
              inkludert, og perioden overstyrer alle åpningstider.
            </p>
          </div>
        </div>
        {!draft.vacationRanges.length && (
          <p className="schedule-empty">
            Ingen stengte perioder. Legg til en når du trenger en pause.
          </p>
        )}
        {draft.vacationRanges.map((row, index) => (
          <div className="schedule-vacation" key={index}>
            <label>
              <span>Fra og med</span>
              <input
                type="date"
                required
                disabled={busy}
                value={row.from}
                onChange={(e) =>
                  change((state) => ({
                    ...state,
                    vacationRanges: state.vacationRanges.map((item, i) =>
                      i === index ? { ...item, from: e.target.value } : item,
                    ),
                  }))
                }
              />
            </label>
            <label>
              <span>Til og med</span>
              <input
                type="date"
                required
                disabled={busy}
                value={row.to}
                onChange={(e) =>
                  change((state) => ({
                    ...state,
                    vacationRanges: state.vacationRanges.map((item, i) =>
                      i === index ? { ...item, to: e.target.value } : item,
                    ),
                  }))
                }
              />
            </label>
            <label>
              <span>Navn på perioden</span>
              <input
                maxLength={120}
                disabled={busy}
                placeholder="F.eks. sommerferie"
                value={row.label ?? ''}
                onChange={(e) =>
                  change((state) => ({
                    ...state,
                    vacationRanges: state.vacationRanges.map((item, i) =>
                      i === index ? { ...item, label: e.target.value } : item,
                    ),
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="schedule-remove"
              disabled={busy}
              aria-label={`Fjern stengt periode ${row.from} til ${row.to}`}
              onClick={() =>
                void approve(
                  'Fjerne den stengte perioden?',
                  `Ukeplan og datounntak vil gjelde igjen fra ${row.from} til ${row.to}.`,
                  'Ja, fjern perioden',
                ).then((ok) => {
                  if (ok)
                    change((state) => ({
                      ...state,
                      vacationRanges: state.vacationRanges.filter(
                        (_, i) => i !== index,
                      ),
                    }));
                })
              }
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="schedule-add"
          disabled={busy || draft.vacationRanges.length >= 100}
          onClick={() =>
            change((state) => ({
              ...state,
              vacationRanges: [
                ...state.vacationRanges,
                {
                  from: selectedDate,
                  to: addCalendarDays(selectedDate, 6),
                  label: '',
                },
              ],
            }))
          }
        >
          + Legg til stengt periode
        </button>
      </section>
      <section className="schedule-card">
        <div className="schedule-section-heading">
          <span className="schedule-number">04</span>
          <div>
            <h3>Litt tid til å planlegge</h3>
            <p>
              Velg hvor tidlig og hvor langt frem i tid nye oppdrag kan starte.
              Fristene kontrolleres også på nytt når du godkjenner
              forespørselen.
            </p>
          </div>
        </div>
        <div className="schedule-booking-window">
          <label>
            <span>Minste varsel (timer)</span>
            <input
              type="number"
              min={0}
              max={8760}
              step={1}
              disabled={busy}
              value={
                draft.minimumNoticeHours < 0 ? '' : draft.minimumNoticeHours
              }
              onChange={(e) =>
                change((state) => ({
                  ...state,
                  minimumNoticeHours:
                    e.target.value === '' ? -1 : Number(e.target.value),
                }))
              }
            />
            <small>0 betyr ingen ekstra ventetid.</small>
          </label>
          <label>
            <span>Maksimalt antall dager frem</span>
            <input
              type="number"
              min={1}
              max={3650}
              step={1}
              disabled={busy}
              placeholder="Ingen grense"
              value={draft.maximumAdvanceDays ?? ''}
              onChange={(e) =>
                change((state) => ({
                  ...state,
                  maximumAdvanceDays:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
            <small>La feltet stå tomt for ingen øvre grense.</small>
          </label>
        </div>
        {currentPreview && (
          <p className="schedule-help">
            Tidligste start med denne planen:{' '}
            {new Intl.DateTimeFormat('nb-NO', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Europe/Oslo',
            }).format(new Date(currentPreview.bookingWindow.earliestStartAt))}
            .{' '}
            {currentPreview.bookingWindow.latestStartDate
              ? `Siste tillatte startdato: ${displayDate(currentPreview.bookingWindow.latestStartDate, { day: 'numeric', month: 'long', year: 'numeric' })}.`
              : 'Ingen siste startdato satt.'}
          </p>
        )}
      </section>
      <div className={`schedule-savebar ${dirty ? 'is-dirty' : ''}`}>
        <div>
          <strong>{dirty ? 'Ulagrede endringer' : 'Planen er lagret'}</strong>
          <span>
            {dirty
              ? 'Forhåndsvisningen viser utkastet ditt. Lagre for å ta det i bruk.'
              : 'Endringer i timer og datoer gjelder nye forespørsler etter lagring.'}
          </span>
        </div>
        <div>
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || !dirty}
            onClick={() => void discard()}
          >
            Forkast
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            {busy ? 'Lagrer …' : 'Lagre åpningstider'}
            <Icon name="check" size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
