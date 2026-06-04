import { useI18n } from '@/lib/useI18n'

type Props = {
  actionCount: number
  historyCount: number
  unreadCount: number
}

export default function NotificationsStats({ actionCount, historyCount, unreadCount }: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
      <div className="card" style={{ borderColor: actionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
        <p className="small muted">{t('notifications.stats.waitingApproval', 'Request sent')}</p>
        <h3>{actionCount}</h3>
        <p className="muted small">{t('notifications.stats.waitingBody', 'Booking and reschedule requests waiting for business action')}</p>
      </div>

      <div className="card">
        <p className="small muted">{t('notifications.stats.history', 'History')}</p>
        <h3>{historyCount}</h3>
        <p className="muted small">{t('notifications.stats.historyBody', 'Resolved requests and booking updates')}</p>
      </div>

      <div className="card" style={{ borderColor: unreadCount > 0 ? 'rgba(45,212,191,0.28)' : 'var(--border)' }}>
        <p className="small muted">{t('notifications.stats.unread', 'Unread')}</p>
        <h3>{unreadCount}</h3>
        <p className="muted small">{t('notifications.stats.unreadBody', 'Unread Mirëbook notification updates')}</p>
      </div>
    </div>
  )
}
