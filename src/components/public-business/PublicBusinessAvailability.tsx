import { TimeSlot } from "./publicBusinessTypes";
import { useI18n } from "@/lib/useI18n";
import { formatLocalizedDate } from "@/lib/i18n";

type DateOption = {
  value: string;
  weekday: string;
  dateLabel: string;
};

type Props = {
  selectedServiceName?: string | null;
  selectedStaffLabel?: string | null;
  selectedDate: string;
  availableSlots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  loadingSlots: boolean;
  canPickDate?: boolean;
  noSlotsMessage?: string;
  onDateChange: (date: string) => void;
  onSelectSlot: (slot: TimeSlot) => void;
};

export default function PublicBusinessAvailability({
  selectedServiceName,
  selectedStaffLabel,
  selectedDate,
  availableSlots,
  selectedSlot,
  loadingSlots,
  canPickDate = true,
  noSlotsMessage,
  onDateChange,
  onSelectSlot,
}: Props) {
  const { locale, t } = useI18n();
  const dateOptions = Array.from({ length: 10 }, (_, index): DateOption => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return {
      value: `${year}-${month}-${day}`,
      weekday:
        index === 0
          ? t("publicBusiness.availability.today", "Today")
          : formatLocalizedDate(date, locale, { weekday: "short" }),
      dateLabel: formatLocalizedDate(date, locale, {
        day: "numeric",
        month: "short",
      }),
    };
  });

  function handleDateValue(value: string) {
    onDateChange(value);
  }

  const selectedDateInStrip = dateOptions.some(
    (option) => option.value === selectedDate,
  );

  return (
    <div className="card">
      <div>
        <h2 style={{ fontFamily: "var(--font-display)" }}>
          {t("publicBusiness.availability.title", "Choose a time")}
        </h2>
        {(selectedServiceName || selectedStaffLabel) && (
          <p className="small muted" style={{ marginTop: "0.35rem" }}>
            {[selectedServiceName, selectedStaffLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="public-business-date-picker">
        <span className="small muted">
          {t("publicBusiness.availability.date", "Date")}
        </span>
        <div className="public-business-date-strip">
          {dateOptions.map((option) => {
            const selected = selectedDate === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={
                  selected
                    ? "public-business-date-option selected"
                    : "public-business-date-option"
                }
                disabled={!canPickDate}
                onClick={() => handleDateValue(option.value)}
                aria-pressed={selected}
              >
                <span>{option.weekday}</span>
                <strong>{option.dateLabel}</strong>
              </button>
            );
          })}
        </div>
        <details
          className="public-business-more-date"
          open={Boolean(selectedDate && !selectedDateInStrip)}
        >
          <summary className="small muted">
            {t("publicBusiness.availability.moreDates", "More dates")}
          </summary>
          <input
            aria-label={t("publicBusiness.availability.date", "Date")}
            type="date"
            value={selectedDate}
            onInput={(e) => handleDateValue(e.currentTarget.value)}
            onChange={(e) => handleDateValue(e.target.value)}
            disabled={!canPickDate}
          />
        </details>
      </div>

      <div className="public-business-slot-grid">
        {loadingSlots && (
          <p className="small muted">
            {t(
              "publicBusiness.availability.loading",
              "Checking available times...",
            )}
          </p>
        )}

        {!loadingSlots && availableSlots.length === 0 && (
          <div
            className="card"
            style={{ background: "var(--surface-2)", gridColumn: "1 / -1" }}
          >
            <p className="muted">
              {noSlotsMessage ||
                t(
                  "publicBusiness.availability.none",
                  "No available times for this date. Try another date or staff member.",
                )}
            </p>
          </div>
        )}

        {!loadingSlots &&
          availableSlots.map((slot) => {
            const selected =
              selectedSlot?.startAt === slot.startAt &&
              selectedSlot?.staffMemberId === slot.staffMemberId;

            return (
              <button
                key={`${slot.startAt}-${slot.staffMemberId || "any"}`}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className={selected ? "btn btn-accent" : "btn btn-ghost"}
              >
                {slot.label}
              </button>
            );
          })}
      </div>
      <style jsx>{`
        .public-business-date-picker {
          display: grid;
          gap: 0.65rem;
          margin-top: 1rem;
        }

        .public-business-date-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
          gap: 0.45rem;
        }

        .public-business-date-option {
          display: grid;
          gap: 0.12rem;
          min-height: 4.15rem;
          padding: 0.7rem 0.55rem;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-2);
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .public-business-date-option span {
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 800;
        }

        .public-business-date-option strong {
          font-size: 0.96rem;
        }

        .public-business-date-option.selected {
          border-color: rgba(255, 107, 53, 0.7);
          background: rgba(255, 107, 53, 0.12);
          box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.18);
        }

        .public-business-date-option:disabled,
        .public-business-more-date input:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .public-business-more-date {
          display: grid;
          gap: 0.35rem;
        }

        .public-business-more-date summary {
          cursor: pointer;
          width: fit-content;
        }

        @media (max-width: 520px) {
          .public-business-date-strip {
            display: flex;
            overflow-x: auto;
            padding-bottom: 0.15rem;
            scroll-snap-type: x proximity;
          }

          .public-business-date-option {
            min-height: 3.75rem;
            min-width: 5.75rem;
            scroll-snap-align: start;
          }
        }
      `}</style>
    </div>
  );
}
