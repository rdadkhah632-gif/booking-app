import { useI18n } from "@/lib/useI18n";
import { BookingSummary, RangeFilter } from "./dashboardBookingsTypes";

type Props = {
  summary: BookingSummary;
  onSetView: (filter: RangeFilter, status?: string) => void;
};

export default function BookingsSummaryCards({ summary, onSetView }: Props) {
  const { t } = useI18n();

  return (
    <div className="grid-2">
      <button
        type="button"
        className="card booking-summary-button"
        onClick={() => onSetView("upcoming", "pending")}
        style={{
          borderColor:
            summary.pendingCount > 0
              ? "rgba(255,107,53,0.35)"
              : "var(--border)",
        }}
      >
        <h3>{summary.pendingCount}</h3>
        <strong>
          {t("dashboardBookings.summary.needsApproval", "Needs approval")}
        </strong>
        <p className="muted small">
          {t(
            "dashboardBookings.summary.pendingRequests",
            "Pending booking requests",
          )}
        </p>
      </button>

      <button
        type="button"
        className="card booking-summary-button"
        onClick={() => onSetView("today")}
      >
        <h3>{summary.todayCount}</h3>
        <strong>{t("dashboardHome.summary.today", "Today")}</strong>
        <p className="muted small">
          {t(
            "dashboardBookings.summary.todayBody",
            "Appointments and requests today",
          )}
        </p>
      </button>

      <button
        type="button"
        className="card booking-summary-button"
        onClick={() => onSetView("upcoming", "confirmed")}
      >
        <h3>{summary.upcomingConfirmedCount}</h3>
        <strong>
          {t(
            "dashboardBookings.summary.upcomingConfirmed",
            "Upcoming confirmed",
          )}
        </strong>
        <p className="muted small">
          {t(
            "dashboardBookings.summary.upcomingConfirmedBody",
            "Confirmed future appointments",
          )}
        </p>
      </button>

      <button
        type="button"
        className="card booking-summary-button"
        onClick={() => onSetView("history")}
      >
        <h3>{summary.historyCount}</h3>
        <strong>{t("dashboardBookings.summary.history", "History")}</strong>
        <p className="muted small">
          {t(
            "dashboardBookings.summary.historyBody",
            "Completed, cancelled or past appointments",
          )}
        </p>
      </button>

      <div
        className="card booking-summary-static"
        style={{
          borderColor:
            summary.filteredCount > 0
              ? "rgba(45,212,191,0.22)"
              : "var(--border)",
        }}
      >
        <h3>{summary.filteredCount}</h3>
        <strong>
          {t("dashboardBookings.summary.currentView", "Current view")}
        </strong>
        <p className="muted small">
          {t(
            "dashboardBookings.summary.currentViewBody",
            "Bookings matching the filters",
          )}
        </p>
      </div>

      <style jsx>{`
        .booking-summary-button {
          display: grid;
          gap: 0.55rem;
          align-content: start;
          width: 100%;
          text-align: left;
          color: var(--text);
          cursor: pointer;
        }

        .booking-summary-button:hover {
          border-color: rgba(255, 107, 53, 0.35);
          transform: translateY(-1px);
        }

        .booking-summary-static {
          display: grid;
          gap: 0.55rem;
          align-content: start;
        }

        .booking-summary-button h3,
        .booking-summary-button p,
        .booking-summary-static h3,
        .booking-summary-static p {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
