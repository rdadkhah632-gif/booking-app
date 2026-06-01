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
            <span className="schedule-day-date">{day.label}</span>
            <span className="schedule-day-name">{day.shortLabel}</span>
            <span className="schedule-day-count">
              {day.bookings.length === 1
                ? t("dashboardHome.schedule.oneBooking", "1 booking")
                : t(
                    "dashboardHome.schedule.bookingCount",
                    "{{count}} bookings",
                  ).replace("{{count}}", String(day.bookings.length))}
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
          justify-content: flex-start;
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
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .schedule-day {
          display: grid;
          gap: 0.28rem;
          padding: 0.85rem 0.65rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
          min-height: 96px;
          align-content: center;
          justify-items: center;
          text-align: center;
          overflow: hidden;
        }

        .schedule-day-date {
          display: block;
          width: 100%;
          font-size: 0.95rem;
          font-weight: 800;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .schedule-day-name,
        .schedule-day-count {
          display: block;
          width: 100%;
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .schedule-day-active {
          border-color: rgba(255, 107, 53, 0.35);
          background: var(--accent-dim);
        }

        @media (max-width: 700px) {
          .schedule-preview-header {
            width: 100%;
          }

          .dashboard-schedule-grid {
            grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
