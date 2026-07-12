import { useMemo } from "react";

export type MobileCalendarAppointment = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  title: string;
  subtitle: string;
  meta?: string;
  status: string;
  statusLabel: string;
};

export type MobileCalendarDay = {
  key: string;
  weekday: string;
  date: string;
  count: number;
  isToday?: boolean;
};

type Props = {
  ariaLabel: string;
  days: MobileCalendarDay[];
  selectedDayKey: string;
  selectedDayLabel: string;
  appointments: MobileCalendarAppointment[];
  selectedAppointmentId?: string | null;
  startHour: number;
  endHour: number;
  currentTimeMinutes?: number | null;
  emptyLabel: string;
  addAtLabel?: string;
  onSelectDay: (dayKey: string) => void;
  onSelectAppointment: (appointmentId: string) => void;
  onAddSlot?: (minutes: number) => void;
};

const HOUR_HEIGHT = 64;
const SLOT_MINUTES = 30;

type PositionedAppointment = MobileCalendarAppointment & {
  column: number;
  columnCount: number;
};

function positionAppointments(
  appointments: MobileCalendarAppointment[],
): PositionedAppointment[] {
  const sorted = [...appointments].sort(
    (left, right) => left.startMinutes - right.startMinutes,
  );
  const positioned: PositionedAppointment[] = [];

  let group: MobileCalendarAppointment[] = [];
  let groupEnd = -1;

  function flushGroup() {
    if (group.length === 0) return;

    const columnEnds: number[] = [];
    const groupWithColumns = group.map((appointment) => {
      let column = columnEnds.findIndex(
        (endMinutes) => endMinutes <= appointment.startMinutes,
      );

      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(appointment.endMinutes);
      } else {
        columnEnds[column] = appointment.endMinutes;
      }

      return { appointment, column };
    });
    const columnCount = Math.max(1, columnEnds.length);

    groupWithColumns.forEach(({ appointment, column }) => {
      positioned.push({ ...appointment, column, columnCount });
    });
    group = [];
    groupEnd = -1;
  }

  sorted.forEach((appointment) => {
    if (group.length > 0 && appointment.startMinutes >= groupEnd) {
      flushGroup();
    }

    group.push(appointment);
    groupEnd = Math.max(groupEnd, appointment.endMinutes);
  });
  flushGroup();

  return positioned;
}

function timeLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default function MobileDayCalendar({
  ariaLabel,
  days,
  selectedDayKey,
  selectedDayLabel,
  appointments,
  selectedAppointmentId,
  startHour,
  endHour,
  currentTimeMinutes,
  emptyLabel,
  addAtLabel,
  onSelectDay,
  onSelectAppointment,
  onAddSlot,
}: Props) {
  const positionedAppointments = useMemo(
    () => positionAppointments(appointments),
    [appointments],
  );
  const scheduleHeight = Math.max(1, endHour - startHour) * HOUR_HEIGHT;
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, index) => startHour + index,
  );
  const slots = Array.from(
    { length: ((endHour - startHour) * 60) / SLOT_MINUTES },
    (_, index) => startHour * 60 + index * SLOT_MINUTES,
  );
  const showCurrentTime =
    currentTimeMinutes != null &&
    currentTimeMinutes >= startHour * 60 &&
    currentTimeMinutes <= endHour * 60;

  return (
    <section className="mobile-day-calendar" aria-label={ariaLabel}>
      <div className="mobile-day-strip">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`${day.key === selectedDayKey ? "active" : ""} ${day.isToday ? "today" : ""}`.trim()}
            onClick={() => onSelectDay(day.key)}
            aria-pressed={day.key === selectedDayKey}
          >
            <span>{day.weekday}</span>
            <strong>{day.date}</strong>
            <em
              aria-hidden="true"
              className={day.count > 0 ? "has-events" : ""}
            >
              {day.count > 0 ? day.count : ""}
            </em>
          </button>
        ))}
      </div>

      <div className="mobile-selected-day-heading">
        <strong>{selectedDayLabel}</strong>
        <span>{appointments.length}</span>
      </div>

      <div className="mobile-day-scroll">
        <div className="mobile-day-grid">
          <div
            className="mobile-day-time-rail"
            style={{ height: `${scheduleHeight}px` }}
            aria-hidden="true"
          >
            {hours.map((hour) => (
              <span
                key={hour}
                style={{ top: `${(hour - startHour) * HOUR_HEIGHT}px` }}
              >
                {timeLabel(hour * 60)}
              </span>
            ))}
          </div>

          <div
            className="mobile-day-lane"
            style={{ height: `${scheduleHeight}px` }}
          >
            {slots.map((slotStart) => {
              const occupied = appointments.some(
                (appointment) =>
                  (appointment.status === "pending" ||
                    appointment.status === "confirmed") &&
                  slotStart < appointment.endMinutes &&
                  slotStart + SLOT_MINUTES > appointment.startMinutes,
              );

              if (!onAddSlot || occupied) {
                return (
                  <span
                    key={slotStart}
                    className="mobile-day-slot-line"
                    style={{
                      top: `${((slotStart - startHour * 60) / 60) * HOUR_HEIGHT}px`,
                    }}
                    aria-hidden="true"
                  />
                );
              }

              return (
                <button
                  key={slotStart}
                  type="button"
                  className="mobile-day-open-slot"
                  style={{
                    top: `${((slotStart - startHour * 60) / 60) * HOUR_HEIGHT}px`,
                    height: `${(SLOT_MINUTES / 60) * HOUR_HEIGHT}px`,
                  }}
                  onClick={() => onAddSlot(slotStart)}
                  aria-label={`${addAtLabel || "Add appointment"} ${timeLabel(slotStart)}`}
                >
                  <span aria-hidden="true">+</span>
                </button>
              );
            })}

            {showCurrentTime && (
              <span
                className="mobile-day-now-line"
                style={{
                  top: `${((currentTimeMinutes! - startHour * 60) / 60) * HOUR_HEIGHT}px`,
                }}
                aria-hidden="true"
              />
            )}

            {positionedAppointments.map((appointment) => {
              const top =
                ((appointment.startMinutes - startHour * 60) / 60) *
                HOUR_HEIGHT;
              const height = Math.max(
                42,
                ((appointment.endMinutes - appointment.startMinutes) / 60) *
                  HOUR_HEIGHT,
              );
              const isCompact = height < 76;
              const width = 100 / appointment.columnCount;

              return (
                <button
                  key={appointment.id}
                  type="button"
                  className={`mobile-day-appointment ${appointment.status} ${isCompact ? "compact" : ""} ${selectedAppointmentId === appointment.id ? "selected" : ""}`.trim()}
                  style={{
                    top: `${Math.max(0, top)}px`,
                    height: `${height}px`,
                    left: `calc(${appointment.column * width}% + 0.35rem)`,
                    width: `calc(${width}% - 0.55rem)`,
                  }}
                  onClick={() => onSelectAppointment(appointment.id)}
                  aria-label={`${appointment.timeLabel} ${appointment.title}`}
                >
                  <span>{appointment.timeLabel}</span>
                  <strong>{appointment.title}</strong>
                  {!isCompact && <small>{appointment.subtitle}</small>}
                  {!isCompact && appointment.meta && (
                    <small>{appointment.meta}</small>
                  )}
                  {!isCompact && appointment.status !== "confirmed" && (
                    <em>{appointment.statusLabel}</em>
                  )}
                </button>
              );
            })}

            {appointments.length === 0 && (
              <p className="mobile-day-empty">{emptyLabel}</p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .mobile-day-calendar {
          display: none;
        }

        @media (max-width: 700px) {
          .mobile-day-calendar {
            display: grid;
            grid-template-rows: auto auto minmax(0, 1fr);
            min-height: 0;
            overflow: hidden;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: rgba(10, 9, 18, 0.7);
          }

          .mobile-day-strip {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }

          .mobile-day-strip button {
            position: relative;
            min-width: 0;
            min-height: 3.65rem;
            display: grid;
            place-items: center;
            align-content: center;
            gap: 0.05rem;
            padding: 0.35rem 0.1rem;
            border: 0;
            border-right: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 0;
            background: transparent;
            color: var(--text-muted);
            font: inherit;
          }

          .mobile-day-strip button:last-child {
            border-right: 0;
          }

          .mobile-day-strip button.active {
            background: var(--surface-2);
            color: var(--text);
            box-shadow: inset 0 -2px 0 var(--accent);
          }

          .mobile-day-strip button span {
            font-size: 0.62rem;
            font-weight: 800;
            text-transform: uppercase;
          }

          .mobile-day-strip button strong {
            font-size: 0.92rem;
            line-height: 1;
          }

          .mobile-day-strip button.active strong {
            width: 1.65rem;
            height: 1.65rem;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: var(--accent);
            color: var(--bg);
          }

          .mobile-day-strip button em {
            position: absolute;
            right: 0.24rem;
            bottom: 0.18rem;
            min-width: 0.88rem;
            color: var(--accent);
            font-size: 0.58rem;
            font-style: normal;
            font-weight: 900;
          }

          .mobile-selected-day-heading {
            min-height: 2.6rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.75rem;
            padding: 0.55rem 0.7rem;
            border-bottom: 1px solid var(--border);
          }

          .mobile-selected-day-heading strong {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-selected-day-heading span {
            min-width: 1.65rem;
            height: 1.65rem;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: var(--surface-2);
            color: var(--text-muted);
            font-size: 0.72rem;
            font-weight: 800;
          }

          .mobile-day-scroll {
            min-height: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
            scrollbar-width: thin;
          }

          .mobile-day-grid {
            display: grid;
            grid-template-columns: 3.75rem minmax(0, 1fr);
            min-width: 0;
          }

          .mobile-day-time-rail,
          .mobile-day-lane {
            position: relative;
            min-width: 0;
          }

          .mobile-day-time-rail {
            border-right: 1px solid var(--border);
            background: rgba(15, 14, 23, 0.94);
          }

          .mobile-day-time-rail span {
            position: absolute;
            right: 0.45rem;
            transform: translateY(-0.58rem);
            color: var(--text-muted);
            font-size: 0.67rem;
            font-weight: 700;
          }

          .mobile-day-lane {
            overflow: hidden;
            background: rgba(20, 19, 31, 0.58);
          }

          .mobile-day-slot-line,
          .mobile-day-open-slot {
            position: absolute;
            left: 0;
            right: 0;
            border: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 0;
            background: transparent;
          }

          .mobile-day-slot-line:nth-of-type(even),
          .mobile-day-open-slot:nth-of-type(even) {
            border-top-style: dashed;
            border-top-color: rgba(255, 255, 255, 0.04);
          }

          .mobile-day-open-slot {
            z-index: 1;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0 0.45rem;
            color: transparent;
          }

          .mobile-day-open-slot:focus-visible,
          .mobile-day-open-slot:active {
            background: rgba(255, 107, 53, 0.06);
            color: var(--accent);
          }

          .mobile-day-open-slot span {
            width: 1.25rem;
            height: 1.25rem;
            display: grid;
            place-items: center;
            border: 1px solid currentColor;
            border-radius: 50%;
            font-size: 0.8rem;
            font-weight: 900;
          }

          .mobile-day-now-line {
            position: absolute;
            left: 0;
            right: 0;
            z-index: 4;
            height: 2px;
            background: var(--accent);
            pointer-events: none;
          }

          .mobile-day-now-line::before {
            content: "";
            position: absolute;
            left: -0.24rem;
            top: 50%;
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 50%;
            background: var(--accent);
            transform: translateY(-50%);
          }

          .mobile-day-appointment {
            position: absolute;
            z-index: 3;
            min-height: 0;
            display: grid;
            align-content: start;
            gap: 0.06rem;
            overflow: hidden;
            padding: 0.38rem 0.45rem;
            border: 1px solid rgba(6, 214, 160, 0.32);
            border-left: 3px solid var(--success);
            border-radius: 6px;
            background: rgba(34, 33, 53, 0.97);
            color: var(--text);
            font: inherit;
            text-align: left;
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
          }

          .mobile-day-appointment.pending {
            border-color: rgba(255, 107, 53, 0.36);
            border-left-color: var(--accent);
          }

          .mobile-day-appointment.cancelled,
          .mobile-day-appointment.declined {
            border-left-color: var(--warning);
            opacity: 0.7;
          }

          .mobile-day-appointment.selected {
            outline: 2px solid var(--accent);
            outline-offset: 1px;
          }

          .mobile-day-appointment span,
          .mobile-day-appointment small {
            overflow: hidden;
            color: var(--text-muted);
            font-size: 0.64rem;
            line-height: 1.15;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-day-appointment strong {
            overflow: hidden;
            font-size: 0.76rem;
            line-height: 1.15;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-day-appointment.compact {
            align-content: center;
            padding-top: 0.25rem;
            padding-bottom: 0.25rem;
          }

          .mobile-day-appointment em {
            overflow: hidden;
            color: var(--accent);
            font-size: 0.6rem;
            font-style: normal;
            font-weight: 800;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-day-empty {
            position: absolute;
            top: 1rem;
            left: 1rem;
            right: 1rem;
            margin: 0;
            padding: 0.75rem;
            border: 1px dashed var(--border-2);
            border-radius: 6px;
            color: var(--text-muted);
            font-size: 0.78rem;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}
