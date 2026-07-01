import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  showExploreAction?: boolean;
  bookingRequested?: string | string[];
  requestSent?: string | string[];
  success: string | null;
  showRefreshAction?: boolean;
  onClearSuccess: () => void;
  onRefresh: () => void;
};

export default function MyBookingsHeader({
  loading,
  showExploreAction = true,
  bookingRequested,
  requestSent,
  success,
  showRefreshAction = true,
  onClearSuccess,
  onRefresh,
}: Props) {
  const { t } = useI18n();

  return (
    <div style={{ marginBottom: "1rem" }}>
      <h1 className="page-title">{t("myBookings.title", "My bookings")}</h1>

      {bookingRequested && (
        <div className="card my-booking-route-banner">
          <strong>
            {t(
              "myBookings.requestSent.title",
              "Waiting for the business to confirm.",
            )}
          </strong>
        </div>
      )}

      {requestSent && (
        <div className="card my-booking-route-banner">
          <strong>
            {t(
              "myBookings.rescheduleSent.title",
              "Your reschedule request is waiting for business approval.",
            )}
          </strong>
        </div>
      )}

      {success && (
        <div className="card my-booking-success-banner">
          <div className="my-booking-banner-row">
            <div>
              <p className="small" style={{ color: "var(--success)" }}>
                {t("myBookings.actionCompleted", "Action completed")}
              </p>
              <strong>{success}</strong>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClearSuccess}
            >
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        </div>
      )}

      {(showExploreAction || showRefreshAction) && (
        <div className="my-bookings-header-actions">
          {showExploreAction && (
            <Link href="/explore" className="btn btn-accent">
              {t("home.cta.explore", "Explore")}
            </Link>
          )}
          {showRefreshAction && (
            <button
              type="button"
              onClick={onRefresh}
              className="btn btn-ghost"
              disabled={loading}
            >
              {loading
                ? t("myBookings.refreshing", "Refreshing...")
                : t("myBookings.refresh", "Refresh")}
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .my-bookings-header-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .my-bookings-header-actions {
            gap: 0.55rem;
          }

          .my-bookings-header-actions :global(.btn),
          .my-bookings-header-actions button,
          .my-bookings-header-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
