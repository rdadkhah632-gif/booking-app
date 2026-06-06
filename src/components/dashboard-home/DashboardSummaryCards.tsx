import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { DashboardAnalytics } from "./dashboardHomeTypes";

type Props = {
  todayCount: number;
  pendingActionCount: number;
  pendingBookingsCount: number;
  pendingRescheduleCount: number;
  analytics: DashboardAnalytics;
  bookingsLinkForView: (
    view: string,
    status?: string,
    businessId?: string,
  ) => string;
};

export default function DashboardSummaryCards(props: Props) {
  const {
    todayCount,
    pendingActionCount,
    pendingBookingsCount,
    pendingRescheduleCount,
    analytics,
    bookingsLinkForView,
  } = props;
  const { t } = useI18n();

  return (
    <div className="dashboard-summary-grid">
      <Link
        href={bookingsLinkForView("today")}
        className="card dashboard-summary-card"
      >
        <h3>{todayCount}</h3>
        <strong>{t("dashboardHome.summary.today", "Today")}</strong>
        <p className="muted small">
          {t("dashboardHome.summary.todayBody", "Confirmed bookings today")}
        </p>
      </Link>

      <Link
        href="/dashboard/notifications"
        className="card dashboard-summary-card"
        style={{
          borderColor:
            pendingActionCount > 0
              ? "rgba(255,107,53,0.35)"
              : "var(--border)",
        }}
      >
        <h3>{pendingActionCount}</h3>
        <strong>
          {t("dashboardHome.summary.actionRequired", "Action required")}
        </strong>
        <p className="muted small">
          {pendingActionCount > 0
            ? `${pendingBookingsCount} ${t("dashboardHome.summary.bookingApproval", "booking approval")} · ${pendingRescheduleCount} ${t("dashboardHome.summary.rescheduleRequest", "reschedule request")}`
            : t(
                "dashboardHome.priority.noActions",
                "No pending customer actions",
              )}
        </p>
      </Link>

      <Link href="/dashboard/analytics" className="card dashboard-summary-card">
        <h3>{analytics.recentBookings.length}</h3>
        <strong>{t("dashboardHome.summary.last30Days", "Last 30 days")}</strong>
        <p className="muted small">
          {t("dashboardHome.summary.totalActivity", "Total booking activity")}
        </p>
      </Link>

      <style jsx>{`
        .dashboard-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .dashboard-summary-card {
          display: grid;
          gap: 0.55rem;
          align-content: start;
          color: var(--text);
          text-decoration: none;
          cursor: pointer;
        }

        .dashboard-summary-card:hover {
          border-color: rgba(255, 107, 53, 0.35);
          transform: translateY(-1px);
        }

        .dashboard-summary-card h3,
        .dashboard-summary-card p {
          margin-top: 0;
        }

        @media (max-width: 760px) {
          .dashboard-summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
