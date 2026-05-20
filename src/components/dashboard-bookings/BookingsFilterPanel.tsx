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
    <div className="card bookings-filter-card">
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
            className="booking-filter-field"
            type="date"
            value={selectedDate}
            onChange={(e) => onUpdateView('custom', e.target.value)}
          />
        </label>

        <label className="small muted">
          {t('dashboardBookings.filters.status', 'Status')}
          <select
            className="booking-filter-field"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
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
            className="booking-filter-field"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('dashboardBookings.filters.searchPlaceholder', 'Search bookings')}
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
        .bookings-filter-card {
          display: grid;
          gap: 1rem;
        }

        .booking-calendar-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .booking-filter-button-row {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .booking-filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          align-items: end;
        }

        .booking-filter-field {
          width: 100%;
          margin-top: 0.35rem;
          min-height: 44px;
        }

        .booking-active-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 0.9rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        @media (max-width: 860px) {
          .booking-filter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .booking-calendar-header,
          .booking-active-filter-bar {
            display: grid;
          }

          .booking-filter-button-row,
          .booking-filter-button-row :global(.btn),
          .booking-filter-button-row button,
          .booking-active-filter-bar :global(.btn),
          .booking-active-filter-bar button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}