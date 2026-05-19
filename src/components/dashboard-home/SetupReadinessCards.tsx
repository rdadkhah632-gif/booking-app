import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  setupScore: number
  businessesCount: number
  publishedCount: number
  activeServicesCount: number
  activeStaffCount: number
  openDaysCount: number
}

export default function SetupReadinessCards({
  setupScore,
  businessesCount,
  publishedCount,
  activeServicesCount,
  activeStaffCount,
  openDaysCount
}: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
      <div className="card" style={{ borderColor: setupScore < 100 ? 'rgba(255,107,53,0.35)' : 'rgba(45,212,191,0.28)' }}>
        <p className="small muted">{t('dashboardHome.readiness.kicker', 'Setup readiness')}</p>
        <h3>{setupScore}%</h3>
        <p className="small muted">
          {t('dashboardHome.readiness.body', 'Profile, services, staff and availability readiness')}
        </p>

        <Link href="/dashboard/businesses" className={setupScore < 100 ? 'btn btn-accent' : 'btn btn-ghost'} style={{ marginTop: '1rem' }}>
          {t('dashboardHome.readiness.openSetup', 'Open setup hub')}
        </Link>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardHome.readiness.businessStatus', 'Business status')}</p>

        <div className="dashboard-readiness-list">
          <div>
            <strong>{businessesCount}</strong>
            <span>{t('dashboardHome.readiness.businessProfiles', 'business profiles')}</span>
          </div>

          <div>
            <strong>{publishedCount}</strong>
            <span>{t('dashboardHome.readiness.published', 'published')}</span>
          </div>

          <div>
            <strong>{activeServicesCount}</strong>
            <span>{t('dashboardHome.readiness.activeServices', 'active services')}</span>
          </div>

          <div>
            <strong>{activeStaffCount}</strong>
            <span>{t('dashboardHome.readiness.activeStaff', 'active staff')}</span>
          </div>

          <div>
            <strong>{openDaysCount}</strong>
            <span>{t('dashboardHome.readiness.openDays', 'open days')}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-readiness-list {
          display: grid;
          gap: 0.7rem;
          margin-top: 1rem;
        }

        .dashboard-readiness-list div {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.55rem;
        }

        .dashboard-readiness-list span {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  )
}