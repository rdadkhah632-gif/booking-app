import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { ScheduleDay } from "./dashboardHomeTypes";

type Props = {
  scheduleDays: ScheduleDay[];
  bookingsLinkForDate: (dateString: string) => string;
};

export default function SchedulePreviewCard({
  scheduleDays,
  bookingsLinkForDate,
}: Props) {
  const { t } = useI18n();

  return (
    <div
      className="card schedule-preview-card"
      style={{ marginBottom: "1.25rem" }}
    >
      <div className="schedule-preview-header">
        <div>
          <h3>{t("dashboardHome.schedule.title", "Next 7 days")}</h3>

          <p className="small muted">
            {t(
              "dashboardHome.schedule.body",
              "A quick view of upcoming confirmed bookings. Open the booking manager for full filtering and actions.",
            )}
          </p>
        </div>

        <Link href="/dashboard/bookings" className="btn btn-ghost">
          {t("dashboardHome.schedule.openBookings", "Open booking manager")}
        </Link>
      </div>

      <div className="dashboard-schedule-grid">
        {scheduleDays.map((day) => (
          <Link
            key={day.dateString}
            href={bookingsLinkForDate(day.dateString)}
            className={
              day.bookings.length > 0
                ? "schedule-day schedule-day-active"
                : "schedule-day"
            }
          >
            <span className="small muted">{day.shortLabel}</span>
            <strong>{day.label}</strong>
            <span className="small">
              {day.bookings.length}{" "}
              {day.bookings.length === 1
                ? t("dashboardHome.schedule.booking", "booking")
                : t("dashboardHome.schedule.bookings", "bookings")}
            </span>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .schedule-preview-card {
          display: grid;
          gap: 1rem;
        }

        .schedule-preview-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .schedule-preview-header h3,
        .schedule-preview-header p {
          margin-top: 0;
        }

        .dashboard-schedule-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
          gap: 0.75rem;
        }

        .schedule-day {
          display: grid;
          gap: 0.35rem;
          padding: 0.85rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .schedule-day-active {
          border-color: rgba(255, 107, 53, 0.35);
          background: var(--accent-dim);
        }

        @media (max-width: 700px) {
          .schedule-preview-header,
          .schedule-preview-header :global(.btn) {
            width: 100%;
          }

          .schedule-preview-header :global(.btn) {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
