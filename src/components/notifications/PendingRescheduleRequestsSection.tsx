import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { BookingRequest, RequestBooking } from "./notificationTypes";

type Props = {
  requests: BookingRequest[];
  requestBooking: (
    request: BookingRequest,
  ) => RequestBooking | undefined | null;
  bookingBusinessName: (booking?: RequestBooking | null) => string;
  bookingServiceName: (booking?: RequestBooking | null) => string;
  requestedStaffName: (request: BookingRequest) => string;
  statusLabel: (status: string, type?: "booking" | "reschedule") => string;
  statusColor: (status: string) => string;
  statusBackground: (status: string) => string;
};

export default function PendingRescheduleRequestsSection({
  requests,
  requestBooking,
  bookingBusinessName,
  bookingServiceName,
  requestedStaffName,
  statusLabel,
  statusColor,
  statusBackground,
}: Props) {
  const { t } = useI18n();

  if (requests.length === 0) return null;

  return (
    <div className="customer-notification-section">
      <div>
        <p className="small muted">
          {t("notifications.actionStatus", "Action status")}
        </p>
        <h2 style={{ fontFamily: "var(--font-display)" }}>
          {t(
            "notifications.pendingReschedules.title",
            "Reschedule requests awaiting business review",
          )}
        </h2>
      </div>

      {requests.map((request) => {
        const linkedBooking = requestBooking(request);

        return (
          <div
            key={request.id}
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
                  <strong>{bookingBusinessName(linkedBooking)}</strong>

                  <span
                    className="small"
                    style={{
                      background: statusBackground(request.status),
                      color: statusColor(request.status),
                      padding: "0.2rem 0.55rem",
                      borderRadius: 999,
                    }}
                  >
                    {statusLabel(request.status, "reschedule")}
                  </span>
                </div>

                <p className="small muted">
                  {t("common.service")}: {bookingServiceName(linkedBooking)}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "0.75rem",
                    marginTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.8rem",
                      borderRadius: "var(--radius)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p className="small muted">
                      {t(
                        "notifications.currentConfirmedAppointment",
                        "Current confirmed appointment",
                      )}
                    </p>
                    <strong>
                      {linkedBooking?.start_at
                        ? new Date(linkedBooking.start_at).toLocaleString()
                        : t("notifications.notRecorded", "Not recorded")}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: "0.8rem",
                      borderRadius: "var(--radius)",
                      background: "rgba(255,107,53,0.10)",
                      border: "1px solid rgba(255,107,53,0.35)",
                    }}
                  >
                    <p className="small muted">
                      {t(
                        "notifications.requestedNewAppointment",
                        "Requested new appointment",
                      )}
                    </p>
                    <strong>
                      {new Date(request.requested_start_at).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <p className="small muted" style={{ marginTop: "0.75rem" }}>
                  {t("myBookings.card.requestedStaff")}:{" "}
                  {requestedStaffName(request)}
                </p>

                <p className="small muted">
                  {t("myBookings.card.requestedDuration")}:{" "}
                  {request.requested_duration_minutes} minutes
                </p>

                <p className="small muted" style={{ marginTop: "0.5rem" }}>
                  {t(
                    "notifications.originalRemainsConfirmed",
                    "Your original booking remains confirmed until the business accepts this request.",
                  )}
                </p>
              </div>

              <div className="customer-notification-card-actions">
                <Link href="/my-bookings" className="btn btn-accent">
                  {t(
                    "notifications.reviewInMyBookings",
                    "Review in My bookings",
                  )}
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
