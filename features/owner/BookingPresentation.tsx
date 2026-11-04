import type { BookingStatus } from '@/lib/booking/types';
/** Presentation only: booking transitions and permissions belong to the server. */
export const ownerStatus: Record<BookingStatus, string> = {
  PENDING: 'Venter på svar',
  ACCEPTED: 'Godkjent',
  DECLINED: 'Avslått',
  CANCELLED: 'Avlyst',
};
export function DateTile({ date }: { date: string }) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    <span className="owner-date-tile">
      <strong>
        {Number.isNaN(parsed.getTime()) ? '–' : parsed.getUTCDate()}
      </strong>
      <span>
        {Number.isNaN(parsed.getTime())
          ? 'Dato'
          : new Intl.DateTimeFormat('nb-NO', {
              month: 'short',
              timeZone: 'UTC',
            }).format(parsed)}
      </span>
    </span>
  );
}
export function Status({ value }: { value: BookingStatus }) {
  return (
    <span className={`owner-status owner-status-${value.toLowerCase()}`}>
      <span aria-hidden="true" />
      {ownerStatus[value]}
    </span>
  );
}
