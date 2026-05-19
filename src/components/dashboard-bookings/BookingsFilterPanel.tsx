import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { RangeFilter } from './dashboardBookingsTypes'
import { useBookingStatusLabel } from './BookingStatusBadge'

type Props = {
  selectedRangeLabel: string
  rangeFilter: RangeFilter
  selectedDate: string
  statusFilter: string
  searchTerm: string
  activeFilterSummary: string
  onUpdateView: (filter: RangeFilter, date?: string) => void
  onStatusChange: (status: string) => void
  onSearchChange: (value: string) => void
  onReset: () => void
}

export default function BookingsFilterPanel({
  selectedRangeLabel,
  rangeFilter,
  selectedDate,
  statusFilter,
  searchTerm,
  activeFilterSummary,
  onUpdateView,
  onStatusChange,
  onSearchChange,
  onReset
}: Props) {
  const { t } = useI18n()
  const statusLabel = useBookingStatusLabel()

  const rangeButtons: { key: RangeFilter; label: string }[] = [
    { key: 'today', label: t('dashboardHome.summary.today', 'Today') },
    { key: 'tomorrow', label: t('dashboardBookings.range.tomorrow', 'Tomorrow') },
    { key: 'week', label: t('dashboardHome.schedule.title', 'Next 7 days') },
    { key: 'upcoming', label: t('dashboardBookings.range.upcoming', 'All upcoming') },
    { key: 'history', label: t('dashboardBookings.summary.history', 'History') }
  ]

  return (
    <div className="card">
      <div className="booking-calendar-header">
        <div>
          <p className="small muted">{t('dashboardBookings.filters.calendarView', 'Calendar view')}</p>
          <h3>{selectedRangeLabel}</h3>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardBookings.filters.body',
              'Start with today, jump to a specific date, or open a filtered Mirëbook view from the dashboard calendar.'
            )}
          </p>
        </div>

        <Link href="/dashboard/analytics" className="btn btn-ghost">
          {t('dashboardHome.viewAnalytics', 'View analytics')}
        </Link>
      </div>

      <div className="booking-filter-button-row">
        {rangeButtons.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onUpdateView(item.key)}
            className={rangeFilter === item.key ? 'btn btn-accent' : 'btn btn-ghost'}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="booking-filter-grid">
        <label className="small muted">
          {t('dashboardBookings.filters.jumpDate', 'Jump to date')}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onUpdateView('custom', e.target.value)}
            style={{ marginTop: '0.35rem' }}
          />
        </label>

        <label className="small muted">
          {t('dashboardBookings.filters.status', 'Status')}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            style={{ marginTop: '0.35rem', width: '100%' }}
          >
            <option value="all">{t('dashboardBookings.status.all', 'All statuses')}</option>
            <option value="pending">{statusLabel('pending')}</option>
            <option value="confirmed">{t('dashboardBookings.status.confirmed', 'Confirmed')}</option>
            <option value="completed">{t('dashboardBookings.status.completed', 'Completed')}</option>
            <option value="cancelled">{t('dashboardBookings.status.cancelled', 'Cancelled')}</option>
          </select>
        </label>

        <label className="small muted">
          {t('dashboardBookings.filters.searchLabel', 'Search customer/service/staff')}
          <input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('dashboardBookings.filters.searchPlaceholder', 'Search bookings')}
            style={{ marginTop: '0.35rem' }}
          />
        </label>
      </div>

      <div className="booking-active-filter-bar">
        <div>
          <p className="small muted">{t('dashboardBookings.filters.activeView', 'Active view')}</p>
          <strong>{activeFilterSummary}</strong>
        </div>

        {(statusFilter !== 'all' || searchTerm.trim() || rangeFilter !== 'today') && (
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            {t('dashboardBookings.filters.reset', 'Reset filters')}
          </button>
        )}
      </div>

      <style jsx>{`
        .booking-calendar-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .booking-filter-button-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .booking-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
        }

        .booking-active-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-top: 1rem;
          padding: 0.9rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        @media (max-width: 700px) {
          .booking-calendar-header,
          .booking-active-filter-bar {
            display: grid;
          }

          .booking-filter-button-row,
          .booking-filter-button-row :global(.btn),
          .booking-filter-button-row button,
          .booking-calendar-header :global(.btn),
          .booking-calendar-header a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}