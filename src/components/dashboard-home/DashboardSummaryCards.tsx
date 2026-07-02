import { useI18n } from "@/lib/useI18n";
import { DashboardAnalytics } from "./dashboardHomeTypes";

type Props = {
  todayCount: number;
  pendingActionCount: number;
  pendingBookingsCount: number;
  pendingRescheduleCount: number;
  analytics: DashboardAnalytics;
};

export default function DashboardSummaryCards(props: Props) {
  const {
    todayCount,
    pendingActionCount,
    pendingBookingsCount,
    pendingRescheduleCount,
    analytics,
  } = props;
  const { t } = useI18n();

  return (
    <div className="dashboard-summary-grid">
      <div className="dashboard-summary-card">
        <h3>{todayCount}</h3>
        <strong>{t("dashboardHome.summary.today", "Today")}</strong>
        <p className="muted small">
          {t("dashboardHome.summary.todayBody", "Confirmed appointments today")}
        </p>
      </div>

      <div
        className="dashboard-summary-card"
        style={{
          color: pendingActionCount > 0 ? "var(--accent)" : "var(--text)",
        }}
      >
        <h3>{pendingActionCount}</h3>
        <strong>
          {t("dashboardHome.summary.actionRequired", "Action required")}
        </strong>
        <p className="muted small">
          {pendingActionCount > 0
            ? `${pendingBookingsCount} ${t("dashboardHome.summary.bookingApproval", "appointment request")} · ${pendingRescheduleCount} ${t("dashboardHome.summary.rescheduleRequest", "reschedule request")}`
            : t(
                "dashboardHome.priority.noActions",
                "No pending customer actions",
              )}
        </p>
      </div>

      <div className="dashboard-summary-card">
        <h3>{analytics.recentBookings.length}</h3>
        <strong>{t("dashboardHome.summary.last30Days", "Last 30 days")}</strong>
        <p className="muted small">
          {t(
            "dashboardHome.summary.totalActivity",
            "Total appointment activity",
          )}
        </p>
      </div>

      <style jsx>{`
        .dashboard-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          margin-bottom: 1.25rem;
          padding: 0.85rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .dashboard-summary-card {
          display: grid;
          gap: 0.25rem;
          align-content: start;
          padding: 0.25rem 1rem;
          border-right: 1px solid var(--border);
        }

        .dashboard-summary-card h3,
        .dashboard-summary-card p {
          margin-top: 0;
        }

        .dashboard-summary-card:last-child {
          border-right: 0;
        }

        @media (max-width: 760px) {
          .dashboard-summary-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .dashboard-summary-card {
            padding: 0.25rem 0;
            border-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
