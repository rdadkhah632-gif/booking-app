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
  const { todayCount, analytics, bookingsLinkForView } = props;
  const { t } = useI18n();

  return (
    <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
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

      <Link href="/dashboard/analytics" className="card dashboard-summary-card">
        <h3>{analytics.recentBookings.length}</h3>
        <strong>{t("dashboardHome.summary.last30Days", "Last 30 days")}</strong>
        <p className="muted small">
          {t("dashboardHome.summary.totalActivity", "Total booking activity")}
        </p>
      </Link>

      <Link
        href="/dashboard/analytics"
        className="card dashboard-summary-card"
        style={{ borderColor: "rgba(45,212,191,0.25)" }}
      >
        <h3>£{analytics.estimatedRevenue.toFixed(2)}</h3>
        <strong>
          {t(
            "dashboardHome.summary.completedValue",
            "Estimated completed value",
          )}
        </strong>
        <p className="muted small">
          {t(
            "dashboardHome.summary.completedValueBody",
            "Based on completed appointments in the last 30 days",
          )}
        </p>
      </Link>

      <style jsx>{`
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
      `}</style>
    </div>
  );
}
