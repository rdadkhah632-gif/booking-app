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
    <div className="my-bookings-summary-grid">
      <button
        type="button"
        className="card"
        onClick={() => onJump('pending')}
        disabled={pendingCount === 0}
        style={statCardStyle(pendingCount > 0)}
      >
        <p className="small muted">{t('myBookings.stats.waitingApproval', 'Request sent')}</p>
        <h3>{pendingCount}</h3>
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
      </button>
      <style jsx>{`
        .my-bookings-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .my-bookings-summary-grid :global(.card) {
          padding: 0.85rem;
        }

        .my-bookings-summary-grid h3,
        .my-bookings-summary-grid p {
          margin-top: 0;
        }

        @media (max-width: 760px) {
          .my-bookings-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}
