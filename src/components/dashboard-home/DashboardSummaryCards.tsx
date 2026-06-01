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

export default function DashboardSummaryCards({
  todayCount,
  pendingActionCount,
  pendingBookingsCount,
  pendingRescheduleCount,
  analytics,
  bookingsLinkForView,
}: Props) {
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

      <div
        className="card dashboard-summary-card"
        style={{
          borderColor:
            pendingActionCount > 0 ? "rgba(255,107,53,0.35)" : "var(--border)",
        }}
      >
        <h3>{pendingActionCount}</h3>
        <strong>
          {t("dashboardHome.summary.actionRequired", "Action required")}
        </strong>
        <p className="muted small">
          {pendingBookingsCount}{" "}
          {t("dashboardHome.summary.bookingApproval", "booking approval")}
          {pendingBookingsCount === 1 ? "" : "s"} · {pendingRescheduleCount}{" "}
          {t("dashboardHome.summary.rescheduleRequest", "reschedule request")}
          {pendingRescheduleCount === 1 ? "" : "s"}
        </p>

        <div className="dashboard-summary-actions">
          <Link
            href="/dashboard/notifications"
            className={
              pendingActionCount > 0 ? "btn btn-accent" : "btn btn-ghost"
            }
          >
            {t("account.needsAction", "Needs action")}
          </Link>
        </div>
      </div>

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

        .dashboard-summary-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.35rem;
        }
      `}</style>
    </div>
  );
}
