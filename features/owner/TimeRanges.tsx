'use client';
import { Icon } from '@/components/Icon';
import type { OpeningInterval } from '@/lib/booking/types';
import { clockInput, parseClock } from './schedule-helpers';
/** Controlled local-time inputs. End minutes above 1440 explicitly mean the next day. */
export function TimeRanges({
  value,
  label,
  onChange,
  onRemove,
  disabled,
}: {
  value: OpeningInterval[];
  label: string;
  onChange: (rows: OpeningInterval[]) => void;
  onRemove: (index: number) => void;
  disabled: boolean;
}) {
  const update = (index: number, row: OpeningInterval) =>
    onChange(value.map((item, i) => (i === index ? row : item)));
  return (
    <div className="schedule-ranges">
      {value.map((row, index) => (
        <div className="schedule-range" key={index}>
          <label>
            <span>Fra</span>
            <input
              type="time"
              required
              disabled={disabled}
              aria-label={`${label}, tidsrom ${index + 1}, fra`}
              value={clockInput(row.startMinute)}
              onChange={(e) =>
                update(index, {
                  ...row,
                  startMinute: parseClock(e.target.value),
                })
              }
            />
          </label>
          <span className="schedule-range-dash" aria-hidden="true">
            –
          </span>
          <label>
            <span>Til</span>
            <input
              type="time"
              required
              disabled={disabled}
              aria-label={`${label}, tidsrom ${index + 1}, til`}
              value={clockInput(row.endMinute)}
              onChange={(e) => {
                const minute = parseClock(e.target.value);
                update(index, {
                  ...row,
                  endMinute:
                    minute < 0
                      ? -1
                      : minute + (row.endMinute >= 1440 ? 1440 : 0),
                });
              }}
            />
          </label>
          <label className="schedule-checkbox">
            <input
              type="checkbox"
              disabled={disabled || row.endMinute < 0}
              checked={row.endMinute >= 1440}
              onChange={(e) =>
                update(index, {
                  ...row,
                  endMinute:
                    (row.endMinute % 1440) + (e.target.checked ? 1440 : 0),
                })
              }
            />
            <span>Slutter neste dag</span>
          </label>
          <button
            type="button"
            disabled={disabled}
            className="schedule-remove"
            aria-label={`Fjern tidsrom ${index + 1} for ${label}`}
            onClick={() => onRemove(index)}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="schedule-add"
        disabled={disabled || value.length >= 10}
        onClick={() =>
          onChange([...value, { startMinute: 660, endMinute: 1200 }])
        }
      >
        + Legg til tidsrom
      </button>
    </div>
  );
}
