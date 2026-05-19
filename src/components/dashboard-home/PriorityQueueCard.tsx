import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  pendingActionCount: number
  bookingsLinkForView: (view: string, status?: string, businessId?: string) => string
}

export default function PriorityQueueCard({
  pendingActionCount,
  bookingsLinkForView
}: Props) {
  const { t } = useI18n()

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        borderColor: pendingActionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p className="small muted">{t('dashboardHome.priority.kicker', 'Priority queue')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {pendingActionCount > 0
              ? t('dashboardHome.priority.hasActions', 'You have customer actions to review')
              : t('dashboardHome.priority.noActions', 'No pending customer actions')}
          </h3>

          <p className="small muted" style={{ marginTop: '0.5rem' }}>
            {t(
              'dashboardHome.priority.body',
              'Pending booking approvals and reschedule requests should be handled quickly so customers know where they stand.'
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notifications" className={pendingActionCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'}>
            {t('dashboardHome.priority.reviewNotifications', 'Review notifications')}
          </Link>

          <Link href={bookingsLinkForView('upcoming')} className="btn btn-ghost">
            {t('dashboardHome.priority.bookingManager', 'Booking manager')}
          </Link>
        </div>
      </div>
    </div>
  )
}