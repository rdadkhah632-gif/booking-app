import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { DashboardAnalytics } from './dashboardHomeTypes'

type Props = {
  todayCount: number
  pendingActionCount: number
  pendingBookingsCount: number
  pendingRescheduleCount: number
  analytics: DashboardAnalytics
  bookingsLinkForView: (view: string, status?: string, businessId?: string) => string
}

export default function DashboardSummaryCards({
  todayCount,
  pendingActionCount,
  pendingBookingsCount,
  pendingRescheduleCount,
  analytics,
  bookingsLinkForView
}: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
      <Link href={bookingsLinkForView('today')} className="card dashboard-summary-card">
        <p className="small muted">{t('dashboardHome.summary.today', 'Today')}</p>
        <h3>{todayCount}</h3>
        <p className="muted small">
          {t('dashboardHome.summary.todayBody', 'Confirmed bookings today')}
        </p>
      </Link>

      <div
        className="card dashboard-summary-card"
        style={{ borderColor: pendingActionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}
      >
        <p className="small muted">{t('dashboardHome.summary.actionRequired', 'Action required')}</p>
        <h3>{pendingActionCount}</h3>
        <p className="muted small">
          {pendingBookingsCount} {t('dashboardHome.summary.bookingApproval', 'booking approval')}
          {pendingBookingsCount === 1 ? '' : 's'} · {pendingRescheduleCount}{' '}
          {t('dashboardHome.summary.rescheduleRequest', 'reschedule request')}
          {pendingRescheduleCount === 1 ? '' : 's'}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Link href="/dashboard/notifications" className={pendingActionCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'}>
            {t('dashboardHome.openNotifications', 'Open notifications')}
          </Link>

          <Link href={bookingsLinkForView('upcoming', 'pending')} className="btn btn-ghost">
            {t('dashboardHome.pendingBookings', 'Pending bookings')}
          </Link>
        </div>
      </div>

      <Link href="/dashboard/analytics" className="card dashboard-summary-card">
        <p className="small muted">{t('dashboardHome.summary.last30Days', 'Last 30 days')}</p>
        <h3>{analytics.recentBookings.length}</h3>
        <p className="muted small">
          {t('dashboardHome.summary.totalActivity', 'Total booking activity')}
        </p>
      </Link>

      <Link href="/dashboard/analytics" className="card dashboard-summary-card" style={{ borderColor: 'rgba(45,212,191,0.25)' }}>
        <p className="small muted">{t('dashboardHome.summary.completedValue', 'Estimated completed value')}</p>
        <h3>£{analytics.estimatedRevenue.toFixed(2)}</h3>
        <p className="muted small">
          {t('dashboardHome.summary.completedValueBody', 'Based on completed appointments in the last 30 days')}
        </p>
      </Link>

      <style jsx>{`
        .dashboard-summary-card {
          color: var(--text);
          text-decoration: none;
          cursor: pointer;
        }

        .dashboard-summary-card:hover {
          border-color: rgba(255,107,53,0.35);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  )
}