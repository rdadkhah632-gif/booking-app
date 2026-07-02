import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { DashboardAnalytics } from "./dashboardHomeTypes";

type Props = {
  analytics: DashboardAnalytics;
  completionRate: number;
};

export default function AnalyticsPreviewCard({
  analytics,
  completionRate,
}: Props) {
  const { t } = useI18n();
  const topService = analytics.topServices[0];

  return (
    <div
      className="card analytics-preview-card"
      style={{ marginBottom: "1.25rem" }}
    >
      <div className="analytics-preview-header">
        <div>
          <h3>
            {t(
              "dashboardHome.analytics.title",
              "Business performance snapshot",
            )}
          </h3>
          <p className="small muted">
            {t(
              "dashboardHome.analytics.body",
              "These figures are estimated from Mirëbook bookings and service prices. Payment revenue can replace this later when deposits/payments are added.",
            )}
          </p>
        </div>
        <Link href="/dashboard/analytics" className="btn btn-ghost">
          {t("dashboardHome.analytics.openFull", "Open full analytics")}
        </Link>
      </div>

      <div className="grid-2">
        <div className="card" style={{ background: "var(--surface-2)" }}>
          <h3>{completionRate}%</h3>
          <strong>
            {t("dashboardHome.analytics.completedRate", "Completed rate")}
          </strong>
          <p className="small muted">
            {t(
              "dashboardHome.analytics.completedRateBody",
              "Completed bookings / last 30 days activity",
            )}
          </p>
        </div>

        <div className="card" style={{ background: "var(--surface-2)" }}>
          <h3>£{analytics.estimatedUpcomingValue.toFixed(2)}</h3>
          <strong>
            {t("dashboardHome.analytics.upcomingValue", "Upcoming value")}
          </strong>
          <p className="small muted">
            {t(
              "dashboardHome.analytics.upcomingValueBody",
              "Estimated value of confirmed upcoming appointments",
            )}
          </p>
        </div>

        <div className="card" style={{ background: "var(--surface-2)" }}>
          <h3>£{analytics.averageBookingValue.toFixed(2)}</h3>
          <strong>
            {t(
              "dashboardHome.analytics.averageValue",
              "Average appointment value",
            )}
          </strong>
          <p className="small muted">
            {t(
              "dashboardHome.analytics.averageValueBody",
              "Average listed service price in recent booking activity",
            )}
          </p>
        </div>

        <div className="card" style={{ background: "var(--surface-2)" }}>
          <h3>
            {topService?.name ||
              t("dashboardHome.analytics.noData", "No data yet")}
          </h3>
          <strong>
            {t("dashboardHome.analytics.topService", "Top service")}
          </strong>
          <p className="small muted">
            {topService
              ? `${topService.count} ${topService.count === 1 ? t("dashboardHome.analytics.booking", "appointment") : t("dashboardHome.analytics.bookings", "appointments")} ${t("dashboardHome.analytics.inRecentActivity", "in recent activity")}`
              : t(
                  "dashboardHome.analytics.addBookings",
                  "Add appointments to see your most popular service",
                )}
          </p>
        </div>
      </div>
      <style jsx>{`
        .analytics-preview-card {
          display: grid;
          gap: 1rem;
        }

        .analytics-preview-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .analytics-preview-header h3,
        .analytics-preview-header p {
          margin-top: 0;
        }

        .analytics-preview-card :global(.grid-2 > .card) {
          display: grid;
          gap: 0.55rem;
          align-content: start;
        }

        .analytics-preview-card :global(.grid-2 > .card h3),
        .analytics-preview-card :global(.grid-2 > .card p) {
          margin-top: 0;
        }

        @media (max-width: 700px) {
          .analytics-preview-header,
          .analytics-preview-header :global(.btn) {
            width: 100%;
          }

          .analytics-preview-header :global(.btn) {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
