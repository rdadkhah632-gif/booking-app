import { useI18n } from '@/lib/useI18n'
import { DashboardStats } from './dashboardBusinessesTypes'

type Props = {
  stats: DashboardStats
}

export default function BusinessSetupStats({ stats }: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
      <div className="card">
        <p className="small muted">{t('dashboardBusinesses.stats.businesses', 'Businesses')}</p>
        <h3>{stats.total}</h3>
        <p className="muted small">{t('dashboardBusinesses.stats.totalProfiles', 'Total business profiles')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.ready > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardBusinesses.stats.readyProfiles', 'Ready profiles')}</p>
        <h3>{stats.ready}/{stats.total}</h3>
        <p className="muted small">
          {t('dashboardBusinesses.stats.readyBody', 'Profiles with image, services, assigned staff and hours')}
        </p>
      </div>

      <div className="card" style={{ borderColor: stats.incompletePublished > 0 ? 'rgba(255,190,11,0.28)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardBusinesses.stats.liveIncomplete', 'Live but incomplete')}</p>
        <h3>{stats.incompletePublished}</h3>
        <p className="muted small">
          {t('dashboardBusinesses.stats.liveIncompleteBody', 'Published profiles that still need setup attention')}
        </p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardBusinesses.stats.live', 'Live')}</p>
        <h3>{stats.published}</h3>
        <p className="muted small">{t('dashboardBusinesses.stats.visible', 'Visible to customers')}</p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardBusinesses.stats.hidden', 'Hidden')}</p>
        <h3>{stats.hidden}</h3>
        <p className="muted small">{t('dashboardBusinesses.stats.hiddenBody', 'Not visible in marketplace')}</p>
      </div>
    </div>
  )
}