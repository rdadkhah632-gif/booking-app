import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Booking } from "./notificationTypes";
import { formatCustomerDateTime } from "./dateFormat";

type Props = {
  bookings: Booking[];
  bookingBusinessName: (booking?: Booking | null) => string;
  bookingServiceName: (booking?: Booking | null) => string;
  bookingStaffName: (booking?: Booking | null) => string;
  statusLabel: (status: string, type?: "booking" | "reschedule") => string;
  statusColor: (status: string) => string;
  statusBackground: (status: string) => string;
};

export default function PendingBookingRequestsSection({
  bookings,
  bookingBusinessName,
  bookingServiceName,
  bookingStaffName,
  statusLabel,
  statusColor,
  statusBackground,
}: Props) {
  const { locale, t } = useI18n();

  if (bookings.length === 0) return null;

  return (
    <div className="customer-notification-section">
      <div>
        <p className="small muted">
          {t("notifications.requestStatus", "Request status")}
        </p>
        <h2 style={{ fontFamily: "var(--font-display)" }}>
          {t(
            "notifications.pendingBookings.title",
            "Booking requests awaiting confirmation",
          )}
        </h2>
        <p className="muted small" style={{ marginTop: "0.35rem" }}>
          {t(
            "notifications.pendingBookings.body",
            "These appointments are not confirmed yet. The business needs to accept or decline them.",
          )}
        </p>
      </div>

      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="card"
          style={{
            borderColor: "rgba(255,107,53,0.35)",
            background: "var(--accent-dim)",
          }}
        >
          <div className="customer-notification-card-row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: "0.5rem",
                }}
              >
                <strong>{bookingBusinessName(booking)}</strong>

                <span
                  className="small"
                  style={{
                    background: statusBackground(booking.status),
                    color: statusColor(booking.status),
                    padding: "0.2rem 0.55rem",
                    borderRadius: 999,
                  }}
                >
                  {statusLabel(booking.status, "booking")}
                </span>
              </div>

              <p className="small muted">
                {t("common.service")}: {bookingServiceName(booking)}
              </p>

              <p className="small muted">
                {t("common.staff")}: {bookingStaffName(booking)}
              </p>

              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.8rem",
                  borderRadius: "var(--radius)",
                  background: "rgba(255,107,53,0.10)",
                  border: "1px solid rgba(255,107,53,0.35)",
                }}
              >
                <p className="small muted">
                  {t(
                    "notifications.requestedAppointmentTime",
                    "Requested appointment time",
                  )}
                </p>
                <strong>
                  {formatCustomerDateTime(booking.start_at, locale)}
                </strong>
                <p className="small muted" style={{ marginTop: "0.3rem" }}>
                  {t(
                    "notifications.reservedWhileWaiting",
                    "This time is reserved while waiting for business approval.",
                  )}
                </p>
              </div>
            </div>

            <div className="customer-notification-card-actions">
              <Link href="/my-bookings" className="btn btn-accent">
                {t("notifications.reviewInMyBookings", "Review in My bookings")}
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
