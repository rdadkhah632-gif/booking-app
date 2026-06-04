import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Booking } from "./dashboardBookingsTypes";
import BookingStatusBadge, { statusColor } from "./BookingStatusBadge";

type Props = {
  booking: Booking;
  businessId?: string | null;
  actionLoadingId: string | null;
  customerHistoryLink: (booking: Booking) => string;
  acceptPendingBooking: (booking: Booking) => void;
  declinePendingBooking: (booking: Booking) => void;
  cancelBooking: (booking: Booking) => void;
  completeBooking: (booking: Booking) => void;
};

export default function BookingCard({
  booking,
  businessId,
  actionLoadingId,
  customerHistoryLink,
  acceptPendingBooking,
  declinePendingBooking,
  cancelBooking,
  completeBooking,
}: Props) {
  const { t } = useI18n();
  const isLocked =
    booking.status === "cancelled" || booking.status === "completed";
  const isWorking = actionLoadingId === booking.id;
  const start = new Date(booking.start_at);
  const end = booking.end_at
    ? new Date(booking.end_at)
    : new Date(start.getTime() + booking.duration_minutes * 60000);

  return (
    <div
      className="card booking-manager-card"
      style={{
        opacity: isLocked ? 0.78 : 1,
        borderColor:
          booking.status === "pending"
            ? "rgba(255,107,53,0.35)"
            : booking.status === "completed"
              ? "rgba(45,212,191,0.22)"
              : booking.status === "cancelled"
                ? "rgba(255,190,11,0.25)"
                : "var(--border)",
      }}
    >
      <div className="booking-manager-card-inner">
        <div className="booking-card-main">
          <div className="booking-card-heading-row">
            <Link
              href={customerHistoryLink(booking)}
              style={{ color: "var(--text)", fontWeight: 800 }}
            >
              {booking.customer_name ||
                t("dashboardBookings.card.customerFallback", "Customer")}
            </Link>

            <BookingStatusBadge status={booking.status} />
          </div>

          <p className="small muted booking-card-line">
            {start.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            -{" "}
            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
            · {booking.duration_minutes} {t("common.minutes", "minutes")}
          </p>

          <p className="small muted booking-card-line">
            {t("dashboardBookings.card.service", "Service")}:{" "}
            {booking.services?.name ||
              t("dashboardBookings.card.noService", "No service recorded")}{" "}
            · £
            {booking.services?.price
              ? Number(booking.services.price).toFixed(2)
              : "0.00"}
          </p>

          <p className="small muted booking-card-line">
            {t("support.business.staff", "Staff")}:{" "}
            {booking.staff_members?.name ||
              t("dashboardBookings.card.noStaff", "Staff not recorded")}
            {booking.staff_members?.role_title
              ? ` — ${booking.staff_members.role_title}`
              : ""}
          </p>

          <div
            className="booking-time-box"
            style={{
              background:
                booking.status === "pending"
                  ? "rgba(255,107,53,0.08)"
                  : "var(--surface-2)",
              border:
                booking.status === "pending"
                  ? "1px solid rgba(255,107,53,0.28)"
                  : "1px solid var(--border)",
            }}
          >
            <p className="small muted booking-card-line">
              {booking.status === "pending"
                ? t(
                    "dashboardBookings.card.requestedTime",
                    "Requested appointment time",
                  )
                : t(
                    "dashboardBookings.card.appointmentTime",
                    "Appointment time",
                  )}
            </p>

            <strong>
              {start.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}{" "}
              {t("account.at", "at")}{" "}
              {start.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>

            {booking.status === "pending" && (
              <p className="small muted booking-card-line">
                {t(
                  "dashboardBookings.card.pendingReserved",
                  "Review this booking request.",
                )}
              </p>
            )}
          </div>

          {(booking.customer_notes || booking.internal_notes) && (
            <div className="booking-note-box">
              {booking.customer_notes && (
                <>
                  <p className="small muted">
                    {t("dashboardBookings.card.customerNote", "Customer note")}
                  </p>
                  <p className="small booking-card-line">
                    {booking.customer_notes}
                  </p>
                </>
              )}

              {booking.internal_notes && (
                <>
                  <p
                    className="small muted"
                    style={{
                      marginTop: booking.customer_notes ? "0.65rem" : 0,
                    }}
                  >
                    {t("dashboardBookings.card.internalNote", "Internal note")}
                  </p>
                  <p className="small booking-card-line">
                    {booking.internal_notes}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="booking-contact-actions">
            <Link href={customerHistoryLink(booking)} className="btn btn-ghost">
              {t("dashboardBookings.card.customerDetails", "Customer details")}
            </Link>

            {booking.customer_email && (
              <a
                href={`mailto:${booking.customer_email}`}
                className="btn btn-ghost"
              >
                {t("account.email", "Email")}
              </a>
            )}

            {booking.customer_phone && (
              <a
                href={`tel:${booking.customer_phone}`}
                className="btn btn-ghost"
              >
                {t("dashboardBookings.card.call", "Call")}
              </a>
            )}
          </div>
        </div>

        <div className="booking-manager-actions">
          {booking.status === "pending" && (
            <>
              <button
                onClick={() => acceptPendingBooking(booking)}
                className="btn btn-accent"
                disabled={isWorking}
              >
                {isWorking
                  ? t("dashboardBookings.actions.working", "Working...")
                  : t("dashboardBookings.actions.accept", "Accept booking")}
              </button>

              <button
                onClick={() => declinePendingBooking(booking)}
                className="btn btn-danger"
                disabled={isWorking}
              >
                {t("dashboardBookings.actions.decline", "Decline booking")}
              </button>
            </>
          )}

          {booking.status === "confirmed" && !isLocked && (
            <>
              <button
                onClick={() => completeBooking(booking)}
                className="btn btn-accent"
                disabled={isWorking}
              >
                {isWorking
                  ? t("dashboardBookings.actions.working", "Working...")
                  : t(
                      "dashboardBookings.actions.markCompleted",
                      "Mark completed",
                    )}
              </button>

              <Link
                href={`/reschedule-booking?id=${booking.id}`}
                className="btn btn-ghost"
              >
                {t("dashboardBookings.actions.reschedule", "Reschedule")}
              </Link>

              <button
                onClick={() => cancelBooking(booking)}
                className="btn btn-danger"
                disabled={isWorking}
              >
                {t("dashboardBookings.actions.cancel", "Cancel")}
              </button>
            </>
          )}

          {isLocked && booking.status !== "pending" && (
            <div
              className="card booking-locked-card"
              style={{
                background: "var(--surface-2)",
                borderColor:
                  booking.status === "completed"
                    ? "rgba(45,212,191,0.22)"
                    : "rgba(255,190,11,0.22)",
              }}
            >
              <p
                className="small"
                style={{ color: statusColor(booking.status) }}
              >
                {booking.status === "completed"
                  ? t(
                      "dashboardBookings.card.lockedCompleted",
                      "Locked completed record",
                    )
                  : t(
                      "dashboardBookings.card.lockedCancelled",
                      "Locked cancelled record",
                    )}
              </p>
              <p className="small muted booking-card-line">
                {t(
                  "dashboardBookings.card.lockedBody",
                  "This booking can no longer be changed.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .booking-manager-card-inner {
          display: flex;
          justify-content: space-between;
          gap: 1.25rem;
          flex-wrap: wrap;
        }

        .booking-card-main {
          flex: 1;
          min-width: 280px;
          display: grid;
          gap: 0.55rem;
        }

        .booking-card-line {
          margin-top: 0;
        }

        .booking-card-heading-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 0;
        }

        .booking-time-box {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.25rem;
          padding: 0.8rem;
          border-radius: var(--radius);
        }

        .booking-time-box p {
          margin-top: 0;
        }

        .booking-note-box {
          margin-top: 0.25rem;
          padding: 0.8rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        .booking-note-box p {
          margin-top: 0;
        }

        .booking-contact-actions,
        .booking-manager-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .booking-contact-actions {
          margin-top: 0.25rem;
        }

        .booking-manager-actions {
          align-items: flex-start;
          justify-content: flex-end;
        }

        @media (max-width: 700px) {
          .booking-manager-card-inner {
            display: grid;
          }

          .booking-contact-actions,
          .booking-manager-actions,
          .booking-contact-actions :global(.btn),
          .booking-contact-actions a,
          .booking-manager-actions :global(.btn),
          .booking-manager-actions button,
          .booking-manager-actions a {
            width: 100%;
            justify-content: center;
          }
booking-locked-card {
          display: grid;
          gap: 0.45rem;
          padding: 0.85rem;
          max-width: 240px;
        }

        .booking-locked-card p {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
