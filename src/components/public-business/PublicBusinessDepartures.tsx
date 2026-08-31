import { Minus, Plus, Users } from "lucide-react";
import { formatLocalizedDate } from "@/lib/i18n";
import { useI18n } from "@/lib/useI18n";
import type {
  PublicDeparture,
  Service,
  StaffMember,
} from "./publicBusinessTypes";

type Props = {
  service: Service;
  departures: PublicDeparture[];
  staffMembers: StaffMember[];
  selectedDepartureId: string;
  bookingOption: "shared" | "private";
  partySize: number;
  timeZone?: string | null;
  onSelectDeparture: (departureId: string) => void;
  onBookingOptionChange: (option: "shared" | "private") => void;
  onPartySizeChange: (partySize: number) => void;
  formatPrice: (price: number) => string;
};

export default function PublicBusinessDepartures({
  service,
  departures,
  staffMembers,
  selectedDepartureId,
  bookingOption,
  partySize,
  timeZone,
  onSelectDeparture,
  onBookingOptionChange,
  onPartySizeChange,
  formatPrice,
}: Props) {
  const { locale, t } = useI18n();
  const selectedDeparture = departures.find(
    (departure) => departure.id === selectedDepartureId,
  );
  const maxGuests = Math.max(selectedDeparture?.remaining_seats || 1, 1);
  const privateAvailable = Boolean(
    selectedDeparture &&
    selectedDeparture.remaining_seats === selectedDeparture.capacity,
  );
  const selectedGuide = selectedDeparture?.staff_member_id
    ? staffMembers.find(
        (staff) => staff.id === selectedDeparture.staff_member_id,
      )
    : null;

  function formatDeparture(value: string) {
    return formatLocalizedDate(value, locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    });
  }

  return (
    <section className="public-business-section departure-picker-section">
      <div className="public-business-section-head">
        <div>
          <p className="public-business-step-kicker">
            {t("publicBusiness.departures.step", "Step 2")}
          </p>
          <h2>
            {t("publicBusiness.departures.title", "Choose a date and time")}
          </h2>
        </div>
        <span className="small public-business-pill-muted">
          {departures.length}{" "}
          {t("publicBusiness.departures.upcoming", "upcoming")}
        </span>
      </div>

      {departures.length === 0 ? (
        <div className="departure-empty">
          <p className="muted">
            {t(
              "publicBusiness.departures.none",
              "No upcoming departures are available for this trip yet.",
            )}
          </p>
        </div>
      ) : (
        <div className="departure-options">
          {departures.map((departure) => {
            const selected = departure.id === selectedDepartureId;
            return (
              <button
                type="button"
                key={departure.id}
                className={"departure-option" + (selected ? " selected" : "")}
                aria-pressed={selected}
                onClick={() => onSelectDeparture(departure.id)}
              >
                <span>
                  <strong>{formatDeparture(departure.start_at)}</strong>
                  <small>
                    {departure.duration_minutes}{" "}
                    {t("common.minutes", "minutes")}
                  </small>
                </span>
                <span className="departure-space">
                  <Users size={16} aria-hidden="true" />
                  {departure.remaining_seats}{" "}
                  {departure.remaining_seats === 1
                    ? t("publicBusiness.departures.seatLeft", "seat left")
                    : t("publicBusiness.departures.seatsLeft", "seats left")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedDeparture && (
        <div className="departure-choice-controls">
          {service.private_booking_enabled && (
            <fieldset className="booking-option-fieldset">
              <legend className="small muted">
                {t("publicBusiness.departures.bookingType", "Booking type")}
              </legend>
              <div className="booking-option-segments">
                <button
                  type="button"
                  className={bookingOption === "shared" ? "selected" : ""}
                  aria-pressed={bookingOption === "shared"}
                  onClick={() => onBookingOptionChange("shared")}
                >
                  <strong>
                    {t("publicBusiness.departures.shared", "Shared seats")}
                  </strong>
                  <small>
                    {formatPrice(service.price)}{" "}
                    {t("publicBusiness.services.perGuest", "per guest")}
                  </small>
                </button>
                <button
                  type="button"
                  className={bookingOption === "private" ? "selected" : ""}
                  aria-pressed={bookingOption === "private"}
                  disabled={!privateAvailable}
                  onClick={() => onBookingOptionChange("private")}
                >
                  <strong>
                    {t("publicBusiness.departures.private", "Private trip")}
                  </strong>
                  <small>
                    {privateAvailable ? (
                      <>
                        {formatPrice(
                          Number(service.private_price ?? service.price),
                        )}{" "}
                        {t("publicBusiness.departures.wholeTrip", "whole trip")}
                      </>
                    ) : (
                      t(
                        "publicBusiness.departures.privateUnavailable",
                        "Unavailable after seats are reserved",
                      )
                    )}
                  </small>
                </button>
              </div>
            </fieldset>
          )}

          <div className="guest-stepper-row">
            <div>
              <strong>{t("publicBusiness.departures.guests", "Guests")}</strong>
              <p className="small muted">
                {bookingOption === "private"
                  ? t(
                      "publicBusiness.departures.privateGuestHint",
                      "Enter the actual guest count. The whole departure will be reserved.",
                    )
                  : t(
                      "publicBusiness.departures.guestHint",
                      "Choose how many seats you need.",
                    )}
              </p>
            </div>
            <div className="guest-stepper">
              <button
                type="button"
                aria-label={t(
                  "publicBusiness.departures.removeGuest",
                  "Remove one guest",
                )}
                disabled={partySize <= 1}
                onClick={() => onPartySizeChange(Math.max(partySize - 1, 1))}
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <strong aria-live="polite">{partySize}</strong>
              <button
                type="button"
                aria-label={t(
                  "publicBusiness.departures.addGuest",
                  "Add one guest",
                )}
                disabled={partySize >= maxGuests}
                onClick={() =>
                  onPartySizeChange(Math.min(partySize + 1, maxGuests))
                }
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="departure-operational-details">
            {selectedGuide && (
              <span>
                <small>{t("publicBusiness.departures.guide", "Guide")}</small>
                <strong>{selectedGuide.name}</strong>
              </span>
            )}
            {selectedDeparture.meeting_point && (
              <span>
                <small>
                  {t("publicBusiness.departures.meetingPoint", "Meeting point")}
                </small>
                <strong>{selectedDeparture.meeting_point}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .departure-picker-section {
          margin-top: 1rem;
        }

        .departure-options {
          display: grid;
          gap: 0.55rem;
        }

        .departure-option {
          width: 100%;
          min-height: 66px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .departure-option.selected {
          border-color: var(--success);
          box-shadow: inset 3px 0 0 var(--success);
        }

        .departure-option > span:first-child {
          display: grid;
          gap: 0.2rem;
        }

        .departure-option small {
          color: var(--text-muted);
        }

        .departure-space {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--success);
          font-size: 0.8rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .departure-empty {
          padding: 1rem;
          border: 1px dashed var(--border);
          border-radius: 8px;
        }

        .departure-choice-controls {
          display: grid;
          gap: 0.85rem;
          margin-top: 0.8rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .booking-option-fieldset {
          margin: 0;
          padding: 0;
          border: 0;
        }

        .booking-option-fieldset legend {
          margin-bottom: 0.35rem;
        }

        .booking-option-segments {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .booking-option-segments button {
          min-height: 64px;
          display: grid;
          gap: 0.15rem;
          text-align: left;
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
        }

        .booking-option-segments button.selected {
          border-color: var(--success);
          background: rgba(20, 125, 112, 0.08);
        }

        .booking-option-segments button:disabled {
          opacity: 0.52;
          cursor: not-allowed;
        }

        .booking-option-segments small {
          color: var(--text-muted);
        }

        .guest-stepper-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .guest-stepper-row p {
          margin: 0.15rem 0 0;
        }

        .guest-stepper {
          display: grid;
          grid-template-columns: 44px 48px 44px;
          align-items: center;
          text-align: center;
        }

        .guest-stepper button {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: 50%;
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
        }

        .guest-stepper button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .departure-operational-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.5rem;
        }

        .departure-operational-details span {
          display: grid;
          gap: 0.15rem;
        }

        .departure-operational-details small {
          color: var(--text-muted);
        }

        @media (max-width: 560px) {
          .departure-option,
          .guest-stepper-row {
            align-items: flex-start;
          }

          .departure-option {
            display: grid;
          }

          .booking-option-segments {
            grid-template-columns: 1fr;
          }

          .guest-stepper-row {
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
}
