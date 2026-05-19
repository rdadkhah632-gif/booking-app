import { useI18n } from '@/lib/useI18n'
import { StaffStats as StaffStatsType } from './dashboardStaffTypes'

type Props = {
  stats: StaffStatsType
}

export default function StaffStats({ stats }: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
      <div className="card">
        <p className="small muted">{t('dashboardStaff.stats.staff', 'Staff')}</p>
        <h3>{stats.total}</h3>
        <p className="muted small">{t('dashboardStaff.stats.totalProfiles', 'Total staff profiles')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.active > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardStaff.stats.active', 'Active')}</p>
        <h3>{stats.active}</h3>
        <p className="muted small">{t('dashboardStaff.stats.activeBody', 'Staff visible for business setup and booking rules')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.assignedToServices > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardStaff.stats.assigned', 'Assigned')}</p>
        <h3>{stats.assignedToServices}</h3>
        <p className="muted small">{t('dashboardStaff.stats.assignedBody', 'Staff assigned to at least one service')}</p>
      </div>

      <div className="card" style={{ borderColor: stats.unassignedToServices > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
        <p className="small muted">{t('dashboardStaff.stats.unassigned', 'Unassigned')}</p>
        <h3>{stats.unassignedToServices}</h3>
        <p className="muted small">{t('dashboardStaff.stats.unassignedBody', 'Active staff without service assignments')}</p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardStaff.stats.linkedAccounts', 'Linked accounts')}</p>
        <h3>{stats.linkedAccounts}</h3>
        <p className="muted small">{t('dashboardStaff.stats.linkedBody', 'Staff profiles connected to user logins')}</p>
      </div>

      <div className="card">
        <p className="small muted">{t('dashboardStaff.stats.activeServices', 'Active services')}</p>
        <h3>{stats.activeServices}</h3>
        <p className="muted small">{t('dashboardStaff.stats.activeServicesBody', 'Services that need staff coverage')}</p>
      </div>
    </div>
  )
}