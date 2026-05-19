import { useI18n } from '@/lib/useI18n'
import { ServiceStats } from './dashboardServicesTypes'

type Props = {
  stats: ServiceStats
}

export default function ServicesStats({ stats }: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
      <div className="card">
        <p className="small muted">{t('dashboardServices.stats.services', 'Services')}</p>
        <h3>{stats.total}</h3>
        <p className="muted small">{t('dashboardServices.stats.totalServices', 'Total services')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.active > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardServices.stats.visible', 'Visible')}</p>
        <h3>{stats.active}</h3>
        <p className="muted small">{t('dashboardServices.stats.visibleBody', 'Active customer-facing services')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.bookable > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardServices.stats.bookable', 'Bookable')}</p>
        <h3>{stats.bookable}</h3>
        <p className="muted small">{t('dashboardServices.stats.bookableBody', 'Visible services with assigned staff')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.withImages > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardServices.stats.withImages', 'With images')}</p>
        <h3>{stats.withImages}</h3>
        <p className="muted small">{t('dashboardServices.stats.withImagesBody', 'Services with uploaded public images')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.unassigned > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardServices.stats.unassigned', 'Unassigned')}</p>
        <h3>{stats.unassigned}</h3>
        <p className="muted small">{t('dashboardServices.stats.unassignedBody', 'Services without assigned staff')}</p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardServices.stats.averageService', 'Average service')}</p>
        <h3>£{stats.averagePrice.toFixed(2)}</h3>
        <p className="muted small">
          {t('dashboardServices.stats.averagePrefix', 'Avg.')} {Math.round(stats.averageDuration)} {t('common.minutes', 'minutes')} · £{stats.totalValue.toFixed(2)} {t('dashboardServices.stats.totalListValue', 'total list value')}
        </p>
      </div>
    </div>
  )
}