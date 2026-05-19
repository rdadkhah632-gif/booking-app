import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { NotificationRow } from './notificationTypes'

type Props = {
  notifications: NotificationRow[]
  onMarkRead: (notification: NotificationRow) => void
  notificationBorder: (notification: NotificationRow) => string
  notificationBackground: (notification: NotificationRow) => string
}

export default function NotificationInboxSection({
  notifications,
  onMarkRead,
  notificationBorder,
  notificationBackground
}: Props) {
  const { t } = useI18n()

  if (notifications.length === 0) return null

  return (
    <div className="customer-notification-section">
      <div>
        <p className="small muted">{t('notifications.inbox.kicker', 'Notification inbox')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>
          {t('notifications.inbox.title', 'Recent Mirëbook updates')}
        </h2>
        <p className="muted small" style={{ marginTop: '0.35rem' }}>
          {t('notifications.inbox.body', 'These are real notification records created by booking and reschedule activity.')}
        </p>
      </div>

      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="card"
          style={{
            borderColor: notificationBorder(notification),
            background: notificationBackground(notification)
          }}
        >
          <div className="customer-notification-card-row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <strong>{notification.title}</strong>

                <span
                  className="small"
                  style={{
                    background: notification.read_at ? 'var(--surface-2)' : 'var(--accent-dim)',
                    color: notification.read_at ? 'var(--text-muted)' : 'var(--accent)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 999,
                    border: '1px solid var(--border)'
                  }}
                >
                  {notification.read_at ? t('notifications.readStatus.read', 'Read') : t('notifications.readStatus.unread', 'Unread')}
                </span>
              </div>

              {notification.message && (
                <p className="small muted">{notification.message}</p>
              )}

              <p className="small muted" style={{ marginTop: '0.5rem' }}>
                {notification.created_at ? new Date(notification.created_at).toLocaleString() : t('notifications.recently', 'Recently')}
              </p>
            </div>

            <div className="customer-notification-card-actions">
              {notification.action_url && (
                <Link
                  href={notification.action_url}
                  className="btn btn-accent"
                  onClick={() => onMarkRead(notification)}
                >
                  {t('notifications.open', 'Open')}
                </Link>
              )}

              {!notification.read_at && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onMarkRead(notification)}
                >
                  {t('notifications.markRead', 'Mark read')}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}