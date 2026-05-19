import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { ScheduleDay } from './dashboardHomeTypes'

type Props = {
  scheduleDays: ScheduleDay[]
  bookingsLinkForDate: (dateString: string) => string
}

export default function SchedulePreviewCard({
  scheduleDays,
  bookingsLinkForDate
}: Props) {
  const { t } = useI18n()

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <p className="small muted">{t('dashboardHome.schedule.kicker', 'Schedule preview')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {t('dashboardHome.schedule.title', 'Next 7 days')}
          </h3>

          <p className="small muted" style={{ marginTop: '0.45rem' }}>
            {t('dashboardHome.schedule.body', 'A quick view of upcoming confirmed bookings. Open the booking manager for full filtering and actions.')}
          </p>
        </div>

        <Link href="/dashboard/bookings" className="btn btn-accent">
          {t('dashboardHome.schedule.openBookings', 'Open booking manager')}
        </Link>
      </div>

      <div className="dashboard-schedule-grid">
        {scheduleDays.map((day) => (
          <Link
            key={day.dateString}
            href={bookingsLinkForDate(day.dateString)}
            className={day.bookings.length > 0 ? 'schedule-day schedule-day-active' : 'schedule-day'}
          >
            <span className="small muted">{day.shortLabel}</span>
            <strong>{day.label}</strong>
            <span className="small">
              {day.bookings.length} {t('dashboardHome.schedule.booking', 'booking')}{day.bookings.length === 1 ? '' : 's'}
            </span>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .dashboard-schedule-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .schedule-day {
          display: grid;
          gap: 0.25rem;
          padding: 0.85rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .schedule-day-active {
          border-color: rgba(255,107,53,0.35);
          background: var(--accent-dim);
        }
      `}</style>
    </div>
  )
}