import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { BookingRequest, RequestBooking } from "./notificationTypes";
import { formatCustomerDateTime } from "./dateFormat";

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

export default function ResolvedRescheduleRequestsSection({
  requests,
  requestBooking,
  bookingBusinessName,
  bookingServiceName,
  requestedStaffName,
  statusLabel,
  statusColor,
  statusBackground,
}: Props) {
  const { locale, t } = useI18n();

  if (requests.length === 0) return null;

  return (
    <div className="customer-notification-section">
      <div>
        <p className="small muted">
          {t("notifications.requestHistory", "Request history")}
        </p>
        <h2 style={{ fontFamily: "var(--font-display)" }}>
          {t("notifications.rescheduleUpdates", "Reschedule updates")}
        </h2>
      </div>

      {requests.map((request) => {
        const linkedBooking = requestBooking(request);

        return (
          <div
            key={request.id}
            className="card"
            style={{
              opacity: request.status === "cancelled" ? 0.65 : 1,
              borderColor:
                request.status === "accepted"
                  ? "rgba(45,212,191,0.28)"
                  : request.status === "declined"
                    ? "rgba(255,190,11,0.28)"
                    : "var(--border)",
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

                <p className="small muted">
                  {t("notifications.requestedTime", "Requested time")}:{" "}
                  {formatCustomerDateTime(request.requested_start_at, locale)}
                </p>

                <p className="small muted">
                  {t("myBookings.card.requestedStaff")}:{" "}
                  {requestedStaffName(request)}
                </p>

                {request.response_message && (
                  <p className="small muted" style={{ marginTop: "0.5rem" }}>
                    {t("notifications.businessResponse", "Business response")}:{" "}
                    {request.response_message}
                  </p>
                )}

                <p className="small muted" style={{ marginTop: "0.5rem" }}>
                  {t("notifications.updated", "Updated")}:{" "}
                  {request.updated_at
                    ? formatCustomerDateTime(request.updated_at, locale)
                    : formatCustomerDateTime(request.created_at, locale)}
                </p>
              </div>

              <Link href="/my-bookings" className="btn btn-ghost">
                {t("notifications.openMyBookings", "Open My bookings")}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
