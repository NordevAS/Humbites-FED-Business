export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = 'request-failed',
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export function serverError(status: number, body: unknown): ApiError {
  const error =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const details =
    error.error && typeof error.error === 'object'
      ? (error.error as Record<string, unknown>)
      : error;
  const code =
    typeof details.code === 'string' ? details.code : 'request-failed';
  const messages: Record<string, string> = {
    REQUOTE_REQUIRED:
      'Prisen har utløpt eller blitt endret. Hent ny pris og se over totalen før du sender.',
    BOOKING_CONFLICT:
      'Trucken har allerede en booking i dette tidsrommet. Velg et annet tidspunkt.',
    UNAVAILABLE:
      'Trucken er ikke tilgjengelig med disse arrangementsopplysningene.',
    AMBIGUOUS_LOCAL_TIME:
      'Klokkeslettet finnes to ganger denne dagen. Velg før eller etter overgangen til vintertid.',
    INVALID_LOCAL_TIME:
      'Dette klokkeslettet finnes ikke når klokken stilles frem. Velg et annet tidspunkt.',
    EVENT_IN_PAST: 'Arrangementet må starte i fremtiden.',
    VALIDATION_ERROR: 'Kontroller opplysningene før du fortsetter.',
    PAYMENT_ACTION_REQUIRED:
      'Oppdater betalingsstatus og frigi eller refunder gjenværende beløp før bookingen avlyses.',
    INVALID_MENU_ITEM:
      'En valgt rett er ikke lenger tilgjengelig. Se over menyen.',
    EMPTY_MENU: 'Velg minst én rett trucken skal tilby.',
    IDEMPOTENCY_CONFLICT:
      'Denne innsendingen er allerede brukt med andre opplysninger. Åpne kvitteringen eller start et nytt utkast.',
    INVALID_GUEST_TOKEN: 'Åpne den private kvitteringslenken for å få tilgang.',
    NOT_FOUND: 'Oppføringen finnes ikke, eller du mangler tilgang.',
  };
  const fields: Record<string, string> = {};
  const reasonMessages: string[] = [];
  const raw = details.fields ?? details.errors ?? details.details;
  if (Array.isArray(raw))
    for (const issue of raw) {
      if (!issue || typeof issue !== 'object') continue;
      const path = (issue as { path?: unknown }).path;
      if (!Array.isArray(path)) continue;
      const key =
        path[0] === 'event'
          ? String(path[1])
          : path[0] === 'contact'
            ? String(path[1])
            : path[0] === 'quantities'
              ? 'portions'
              : String(path[0]);
      const labels: Record<string, string> = {
        location: 'Oppgi et faktisk arrangementssted med gyldige koordinater.',
        date: 'Velg en gyldig dato.',
        startTime: 'Velg et gyldig starttidspunkt.',
        durationHours: 'Kontroller varigheten.',
        guestCount: 'Kontroller antall gjester.',
        portions: 'Kontroller menyvalget.',
        email: 'Oppgi en gyldig e-postadresse.',
        name: 'Oppgi navnet ditt.',
        phone: 'Oppgi et gyldig telefonnummer.',
        companyName: 'Oppgi bedriftens navn.',
      };
      fields[key] = labels[key] ?? 'Kontroller denne opplysningen.';
    }
  else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw))
      if (typeof value === 'string') fields[key] = value;
    const reasons = (raw as { reasons?: unknown }).reasons;
    if (Array.isArray(reasons)) {
      const mapped: Record<string, [string, string]> = {
        GUEST_CAPACITY_EXCEEDED: [
          'guestCount',
          'Antall gjester overstiger truckens kapasitet.',
        ],
        PORTION_CAPACITY_EXCEEDED: [
          'portions',
          'Antall porsjoner overstiger truckens kapasitet.',
        ],
        OUTSIDE_SERVICE_AREA: [
          'location',
          'Arrangementet er utenfor truckens tjenesteområde.',
        ],
        CLOSED_DATE: ['date', 'Trucken er stengt på denne datoen.'],
        VACATION: [
          'date',
          'Arrangementet faller i en stengt periode. Velg en annen dato.',
        ],
        MINIMUM_NOTICE: [
          'startTime',
          'Trucken trenger lengre varsel. Velg en senere dato eller starttid.',
        ],
        MAXIMUM_ADVANCE: [
          'date',
          'Datoen er for langt frem i tid for denne trucken. Velg en tidligere dato.',
        ],
        OUTSIDE_OPENING_HOURS: [
          'startTime',
          'Tidsrommet er utenfor truckens åpningstider.',
        ],
      };
      for (const reason of reasons) {
        const match = mapped[String(reason)];
        if (match) {
          fields[match[0]] = match[1];
          reasonMessages.push(match[1]);
        }
      }
    }
  }
  const availabilityMessage =
    code === 'UNAVAILABLE' && reasonMessages.length
      ? [...new Set(reasonMessages)].join(' ')
      : undefined;
  return new ApiError(
    availabilityMessage ??
      messages[code] ??
      (typeof details.message === 'string'
        ? details.message
        : 'Handlingen kunne ikke fullføres. Prøv igjen.'),
    status,
    code,
    fields,
  );
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/booking/${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Vi fikk ikke kontakt med tjenesten. Kontroller forbindelsen og prøv igjen.',
      0,
      'network',
    );
  }
  if (response.status === 204) return null as T;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'Tjenesten ga et svar vi ikke kunne bruke. Prøv igjen.',
      response.status,
      'invalid-response',
    );
  }
  if (!response.ok) {
    throw serverError(response.status, body);
  }
  return body as T;
}

export const post = <T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
) => api<T>(path, { method: 'POST', body: JSON.stringify(body), headers });

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Noe gikk galt. Prøv igjen.';
}
