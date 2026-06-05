import { useI18n } from '@/lib/useI18n'

type Props = {
  pendingCount: number
  upcomingCount: number
  changeCount: number
  historyCount: number
  onJump: (section: 'pending' | 'upcoming' | 'changes' | 'history') => void
  statCardStyle: (isActive: boolean) => React.CSSProperties
}

export default function MyBookingsStats({
  pendingCount,
  upcomingCount,
  changeCount,
  historyCount,
  onJump,
  statCardStyle
}: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-2 my-bookings-summary-grid" style={{ marginBottom: '1.5rem' }}>
      <button
        type="button"
        className="card"
        onClick={() => onJump('pending')}
        disabled={pendingCount === 0}
        style={statCardStyle(pendingCount > 0)}
      >
        <p className="small muted">{t('myBookings.stats.waitingApproval', 'Request sent')}</p>
        <h3>{pendingCount}</h3>
        <p className="muted small">{t('myBookings.stats.waitingBody', 'Booking requests not confirmed yet')}</p>
        <p className="small" style={{ color: pendingCount > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
          {pendingCount > 0 ? t('myBookings.stats.tapRequests', 'Tap to view requests ↓') : t('myBookings.stats.noApprovals', 'No requests waiting for confirmation')}
        </p>
      </button>

      <button
        type="button"
        className="card"
        onClick={() => onJump('upcoming')}
        disabled={upcomingCount === 0}
        style={statCardStyle(upcomingCount > 0)}
      >
        <p className="small muted">{t('myBookings.stats.upcoming', 'Upcoming')}</p>
        <h3>{upcomingCount}</h3>
        <p className="muted small">{t('myBookings.stats.upcomingBody', 'Confirmed future appointments')}</p>
        <p className="small" style={{ color: upcomingCount > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
          {upcomingCount > 0 ? t('myBookings.stats.tapSchedule', 'Tap to view schedule ↓') : t('myBookings.stats.noUpcoming', 'No upcoming appointments')}
        </p>
      </button>

      <button
        type="button"
        className="card"
        onClick={() => onJump('changes')}
        disabled={changeCount === 0}
        style={statCardStyle(changeCount > 0)}
      >
        <p className="small muted">{t('myBookings.stats.changes', 'Change requests')}</p>
        <h3>{changeCount}</h3>
        <p className="muted small">{t('dashboardNotifications.sections.pendingRescheduleRequests', 'Pending reschedule requests')}</p>
        <p className="small" style={{ color: changeCount > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
          {changeCount > 0 ? t('myBookings.stats.tapChanges', 'Tap to view requested changes ↓') : t('myBookings.stats.noChanges', 'No pending changes')}
        </p>
      </button>

      <button
        type="button"
        className="card"
        onClick={() => onJump('history')}
        disabled={historyCount === 0}
        style={statCardStyle(historyCount > 0)}
      >
        <p className="small muted">{t('dashboardBookings.summary.history', 'History')}</p>
        <h3>{historyCount}</h3>
        <p className="muted small">{t('myBookings.stats.historyBody', 'Completed, declined, cancelled or past bookings')}</p>
        <p className="small" style={{ color: historyCount > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
          {historyCount > 0 ? t('myBookings.stats.tapHistory', 'Tap to view history ↓') : t('myBookings.stats.noHistory', 'No history yet')}
        </p>
      </button>
    </div>
  )
}
