import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  loading: boolean
  onRefresh: () => void
}

export default function DashboardHomeHeader({ loading, onRefresh }: Props) {
  const { t } = useI18n()

  return (
    <div className="dashboard-home-topbar">
      <p className="small muted">
        {t(
          'dashboardHome.refreshHint',
          'Mirëbook refreshes this dashboard when you return to the tab. Use refresh if a customer action does not appear straight away.'
        )}
      </p>

      <div className="dashboard-home-actions">
        <button onClick={onRefresh} className="btn btn-ghost" disabled={loading}>
          {loading
            ? t('dashboardHome.refreshing', 'Refreshing...')
            : t('dashboardHome.refresh', 'Refresh dashboard')}
        </button>

        <Link href="/dashboard/analytics" className="btn btn-accent">
          {t('dashboardHome.viewAnalytics', 'View analytics')}
        </Link>
      </div>

      <style jsx>{`
        .dashboard-home-topbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .dashboard-home-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 560px) {
          .dashboard-home-actions,
          .dashboard-home-actions :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}