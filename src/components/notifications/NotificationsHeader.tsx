import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  email: string
  loading: boolean
  markingRead: boolean
  unreadCount: number
  onRefresh: () => void
  onMarkAllRead: () => void
}

export default function NotificationsHeader({
  email,
  loading,
  markingRead,
  unreadCount,
  onRefresh,
  onMarkAllRead
}: Props) {
  const { t } = useI18n()

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <p className="small muted">{t('notifications.kicker', 'Booking updates')}</p>

      <h1 className="page-title">
        {t('notifications.title', 'Notifications')}
      </h1>

      <p className="page-sub" style={{ marginTop: '0.5rem' }}>
        {email
          ? `${t('myBookings.signedInAs', 'Signed in as')} ${email}`
          : t('notifications.subtitle', 'Track booking approvals, reschedule decisions and appointment updates.')}
      </p>

      <div className="customer-notification-actions">
        <Link href="/my-bookings" className="btn btn-accent">
          {t('nav.myBookings')}
        </Link>

        <button onClick={onRefresh} className="btn btn-ghost" disabled={loading}>
          {loading ? t('notifications.refreshing', 'Refreshing...') : t('notifications.refresh', 'Refresh notifications')}
        </button>

        <Link href="/explore" className="btn btn-ghost">
          {t('home.cta.explore')}
        </Link>

        <button onClick={onMarkAllRead} className="btn btn-ghost" disabled={markingRead || unreadCount === 0}>
          {markingRead
            ? t('notifications.markingRead', 'Marking read...')
            : unreadCount > 0
              ? `${t('notifications.mark', 'Mark')} ${unreadCount} ${t('notifications.read', 'read')}`
              : t('notifications.allRead', 'All read')}
        </button>
      </div>

      <p className="small muted" style={{ marginTop: '0.75rem' }}>
        {t('notifications.refreshHint', 'Mirëbook refreshes this page when you return to the tab. Use refresh if a recent booking update does not appear straight away.')}
      </p>
    </div>
  )
}
