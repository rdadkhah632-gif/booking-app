import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Booking, BookingMode, BookingRequest } from "./myBookingsTypes";

type Props = {
  booking: Booking;
  mode: BookingMode;
  pendingRequest?: BookingRequest;
  isWorking: boolean;
  onCancel: (booking: Booking) => void;
  businessName: (booking: Booking) => string;
  serviceName: (booking: Booking) => string;
  servicePrice: (booking: Booking) => number;
  staffName: (booking: Booking) => string;
  requestedStaffName: (request: BookingRequest) => string;
  lifecycleCopy: (booking: Booking, pendingRequest?: BookingRequest) => string;
  statusLabel: (status: string) => string;
  statusColor: (status: string) => string;
  statusBackground: (status: string) => string;
  cardTone: (
    status: string,
    hasPendingRequest: boolean,
    mode: BookingMode,
  ) => {
    border: string;
    background: string;
  };
};

export default function MyBookingCard({
  booking,
  mode,
  pendingRequest,
  isWorking,
  onCancel,
  businessName,
  serviceName,
  servicePrice,
  staffName,
  requestedStaffName,
  lifecycleCopy,
  statusLabel,
  statusColor,
  statusBackground,
  cardTone,
}: Props) {
  const { t } = useI18n();
  const isLocked =
    booking.status === "cancelled" ||
    booking.status === "declined" ||
    booking.status === "completed" ||
    mode === "history";
  const hasPendingChange = Boolean(
    pendingRequest && booking.status === "confirmed",
  );
  const tone = cardTone(booking.status, Boolean(pendingRequest), mode);
  const appointmentTime = new Date(booking.start_at).toLocaleString();

  return (
    <div
      key={booking.id}
      className="card my-booking-card"
      style={{
        opacity: isLocked ? 0.78 : 1,
        borderColor: tone.border,
        background: tone.background,
      }}
    >
      <div className="my-booking-card-row">
        <div className="my-booking-card-main">
          <div className="my-booking-card-head">
            <div>
              <strong>{businessName(booking)}</strong>
              <h3>{serviceName(booking)}</h3>
            </div>
            <span
              className="small my-booking-status-pill"
              style={{
                background: hasPendingChange
                  ? "rgba(255,107,53,0.12)"
                  : statusBackground(booking.status),
                color: hasPendingChange
                  ? "var(--accent)"
                  : statusColor(booking.status),
              }}
            >
              {hasPendingChange
                ? t("myBookings.card.changePending", "Change request pending")
                : statusLabel(booking.status)}
            </span>
          </div>

          <p className="small muted my-booking-lifecycle-copy">
            {lifecycleCopy(booking, pendingRequest)}
          </p>

          <div className="my-booking-appointment-strip">
            <div>
              <p className="small muted">
                {booking.status === "pending"
                  ? t(
                      "myBookings.card.requestedTime",
                      "Requested appointment time",
                    )
                  : hasPendingChange
                    ? t(
                        "myBookings.card.originalConfirmedTime",
                        "Original confirmed appointment time",
                      )
                    : booking.status === "completed"
                      ? t(
                          "myBookings.card.completedTime",
                          "Completed appointment time",
                        )
                      : booking.status === "cancelled"
                        ? t(
                            "myBookings.card.cancelledTime",
                            "Cancelled appointment time",
                          )
                        : booking.status === "declined"
                          ? t(
                              "myBookings.card.declinedTime",
                              "Declined requested time",
                            )
                          : t(
                              "myBookings.card.currentConfirmed",
                              "Current confirmed appointment",
                            )}
              </p>
              <strong>{appointmentTime}</strong>
            </div>

            <div className="my-booking-meta-grid">
              <span>
                <b>{t("common.staff", "Staff")}</b>
                {staffName(booking)}
              </span>
              <span>
                <b>{t("myBookings.card.duration", "Duration")}</b>
                {booking.duration_minutes} {t("common.minutes", "minutes")}
              </span>
              <span>
                <b>{t("myBookings.card.price", "Price")}</b>£
                {servicePrice(booking).toFixed(2)}
              </span>
            </div>
          </div>

          {hasPendingChange && (
            <p className="small my-booking-inline-note">
              {t(
                "myBookings.card.originalHint",
                "This remains your active appointment until the business accepts your new requested time.",
              )}
            </p>
          )}

          {hasPendingChange && pendingRequest && (
            <div className="my-booking-pending-change-card">
              <div className="my-booking-card-row">
                <div>
                  <p className="small" style={{ color: "var(--accent)" }}>
                    {t(
                      "myBookings.card.changeAwaiting",
                      "Requested change awaiting business review",
                    )}
                  </p>
                  <h3 style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
                    {new Date(
                      pendingRequest.requested_start_at,
                    ).toLocaleString()}
                  </h3>
                </div>

                <span className="small my-booking-pill-accent">
                  {t(
                    "myBookings.card.businessApprovalNeeded",
                    "Business approval needed",
                  )}
                </span>
              </div>

              <div className="my-booking-requested-time-box">
                <span>
                  <b>
                    {t("myBookings.card.requestedStaff", "Requested staff")}
                  </b>
                  {requestedStaffName(pendingRequest)}
                </span>
                <span>
                  <b>
                    {t(
                      "myBookings.card.requestedDuration",
                      "Requested duration",
                    )}
                  </b>
                  {pendingRequest.requested_duration_minutes}{" "}
                  {t("common.minutes", "minutes")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="my-booking-card-actions">
          {booking.status === "pending" && (
            <button
              onClick={() => onCancel(booking)}
              className="btn btn-danger"
              disabled={isWorking}
            >
              {isWorking
                ? t("common.working", "Working...")
                : t("myBookings.card.cancelRequest", "Cancel request")}
            </button>
          )}

          {booking.status === "confirmed" && mode !== "history" && (
            <>
              {pendingRequest ? (
                <span className="small muted">
                  {t(
                    "myBookings.card.originalStillConfirmed",
                    "Original time still confirmed",
                  )}
                </span>
              ) : (
                <Link
                  href={`/reschedule-booking?id=${booking.id}`}
                  className="btn btn-ghost"
                >
                  {t("myBookings.card.reschedule", "Reschedule")}
                </Link>
              )}

              <button
                onClick={() => onCancel(booking)}
                className="btn btn-danger"
                disabled={isWorking}
              >
                {isWorking
                  ? t("common.working", "Working...")
                  : t("myBookings.card.cancelBooking", "Cancel booking")}
              </button>
            </>
          )}

          {(booking.status === "completed" ||
            booking.status === "cancelled" ||
            booking.status === "declined" ||
            mode === "history") &&
            booking.status !== "pending" && (
              <p className="small muted my-booking-locked-note">
                {t(
                  "myBookings.card.lockedBody",
                  "This booking can no longer be rescheduled or cancelled.",
                )}
              </p>
            )}
        </div>
      </div>

      <style jsx>{`
        .my-booking-card {
          padding: 1rem;
        }

        .my-booking-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .my-booking-card-main {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 0.75rem;
        }

        .my-booking-card-head {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .my-booking-card-head h3,
        .my-booking-card-head strong,
        .my-booking-lifecycle-copy,
        .my-booking-appointment-strip p,
        .my-booking-inline-note,
        .my-booking-locked-note {
          margin: 0;
        }

        .my-booking-card-head h3 {
          margin-top: 0.15rem;
          font-family: var(--font-display);
        }

        .my-booking-status-pill,
        .my-booking-pill-accent {
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          white-space: nowrap;
        }

        .my-booking-lifecycle-copy {
          max-width: 46rem;
        }

        .my-booking-appointment-strip {
          display: grid;
          gap: 0.75rem;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
        }

        .my-booking-meta-grid,
        .my-booking-requested-time-box {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .my-booking-meta-grid span,
        .my-booking-requested-time-box span {
          display: grid;
          gap: 0.15rem;
          min-width: 0;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .my-booking-meta-grid b,
        .my-booking-requested-time-box b {
          color: var(--text);
          font-size: 0.72rem;
          font-weight: 800;
        }

        .my-booking-inline-note {
          color: var(--accent);
        }

        .my-booking-pending-change-card {
          padding: 0.85rem;
          border: 1px solid rgba(255, 107, 53, 0.32);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.07);
        }

        .my-booking-pill-accent {
          background: rgba(255, 107, 53, 0.14);
          color: var(--accent);
        }

        .my-booking-card-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: flex-start;
          max-width: 18rem;
        }

        .my-booking-locked-note {
          max-width: 14rem;
        }

        @media (max-width: 760px) {
          .my-booking-card-row,
          .my-booking-card-head,
          .my-booking-card-actions {
            display: grid;
          }

          .my-booking-card-actions {
            max-width: none;
            width: 100%;
          }

          .my-booking-card-actions :global(.btn),
          .my-booking-card-actions button,
          .my-booking-card-actions a {
            width: 100%;
            justify-content: center;
          }

          .my-booking-meta-grid,
          .my-booking-requested-time-box {
            grid-template-columns: 1fr;
          }

          .my-booking-status-pill {
            justify-self: start;
          }
        }
      `}</style>
    </div>
  );
}
