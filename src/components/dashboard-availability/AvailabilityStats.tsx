import { useI18n } from '@/lib/useI18n'
import { AvailabilityStats as AvailabilityStatsType } from './dashboardAvailabilityTypes'

type Props = {
  stats: AvailabilityStatsType
}

export default function AvailabilityStats({ stats }: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
      <div className="card">
        <p className="small muted">{t('dashboardAvailability.stats.openDays', 'Open days')}</p>
        <h3>{stats.openDays}</h3>
        <p className="muted small">
          {t('dashboardAvailability.stats.openDaysBody', 'Business days marked as open')}
        </p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardAvailability.stats.closedDays', 'Closed days')}</p>
        <h3>{stats.closedDays}</h3>
        <p className="muted small">
          {t('dashboardAvailability.stats.closedDaysBody', 'Business days marked as closed')}
        </p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardAvailability.stats.weeklyHours', 'Weekly hours')}</p>
        <h3>{stats.totalHours.toFixed(1)}</h3>
        <p className="muted small">
          {t('dashboardAvailability.stats.weeklyHoursBody', 'Estimated business-wide open hours')}
        </p>
      </div>

      <div
        className="card"
        style={{ borderColor: stats.invalidDays > 0 ? 'rgba(255,77,109,0.35)' : 'var(--border)' }}
      >
        <p className="small muted">{t('dashboardAvailability.stats.invalidDays', 'Invalid days')}</p>
        <h3>{stats.invalidDays}</h3>
        <p className="muted small">
          {t('dashboardAvailability.stats.invalidDaysBody', 'Open days where start time is not before end time')}
        </p>
      </div>

      <div
        className="card"
        style={{ borderColor: stats.ready ? 'rgba(45,212,191,0.25)' : 'rgba(255,190,11,0.35)' }}
      >
        <p className="small muted">{t('dashboardAvailability.stats.status', 'Status')}</p>
        <h3>
          {stats.ready
            ? t('dashboardBusinesses.ready', 'Ready')
            : t('dashboardBusinesses.needsWork', 'Needs work')}
        </h3>
        <p className="muted small">
          {t('dashboardAvailability.stats.statusBody', 'At least one valid open day helps Mirëbook generate customer booking dates')}
        </p>
      </div>
    </div>
  )
}