import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Service, StaffMember } from './dashboardStaffTypes'
import { formatCurrencyAmount } from '@/lib/currency'
import type { Locale } from '@/lib/i18n'

type Props = {
  staff: StaffMember
  currency?: string | null
  locale: Locale
  services: Service[]
  assignedServiceIds: string[]
  savingAssignmentKey: string | null
  onToggleAssignment: (staffId: string, serviceId: string, currentlyAssigned: boolean) => void
}

export default function StaffServiceAssignmentCard({
  staff,
  currency,
  locale,
  services,
  assignedServiceIds,
  savingAssignmentKey,
  onToggleAssignment
}: Props) {
  const { t } = useI18n()
  const activeServices = services.filter((service) => service.active)

  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <div className="assignment-header">
        <div>
          <p className="small muted">{t('dashboardStaff.assignments.kicker', 'Service assignments')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {assignedServiceIds.length} {t('dashboardStaff.assignments.assigned', 'assigned')}
          </h3>

          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardStaff.assignments.body',
              'A service needs at least one active assigned staff member before customers can book it properly.'
            )}
          </p>
        </div>

        <Link href={`/dashboard/services?businessId=${staff.business_id}`} className="btn btn-ghost">
          {t('support.business.services', 'Services')}
        </Link>
      </div>

      {activeServices.length === 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p className="small muted">
            {t('dashboardStaff.assignments.noServices', 'No active services found. Add active services before assigning staff.')}
          </p>

          <Link href={`/dashboard/services?businessId=${staff.business_id}`} className="btn btn-accent" style={{ marginTop: '0.75rem' }}>
            {t('dashboardStaff.assignments.addServices', 'Add services')}
          </Link>
        </div>
      )}

      {activeServices.length > 0 && (
        <div className="assignment-list">
          {activeServices.map((service) => {
            const checked = assignedServiceIds.includes(service.id)
            const key = `${staff.id}:${service.id}`

            return (
              <label key={service.id} className={checked ? 'assignment-row assignment-row-active' : 'assignment-row'}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={savingAssignmentKey === key}
                  onChange={() => onToggleAssignment(staff.id, service.id, checked)}
                />

                <span>
                  <strong>{service.name}</strong>
                  <p className="small muted">
                    {service.duration_minutes || 0} {t('common.minutes', 'minutes')} · {formatCurrencyAmount(Number(service.price || 0), currency, locale)}
                  </p>
                </span>

                <small>
                  {checked
                    ? t('dashboardStaff.assignments.canDeliver', 'Can deliver')
                    : t('dashboardStaff.assignments.notAssigned', 'Not assigned')}
                </small>
              </label>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .assignment-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .assignment-list {
          display: grid;
          gap: 0.6rem;
          margin-top: 1rem;
        }

        .assignment-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.75rem;
          align-items: center;
          padding: 0.75rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface);
          cursor: pointer;
        }

        .assignment-row-active {
          border-color: rgba(45,212,191,0.25);
          background: rgba(45,212,191,0.08);
        }

        .assignment-row small {
          color: var(--text-muted);
        }

        @media (max-width: 640px) {
          .assignment-row {
            grid-template-columns: auto 1fr;
          }

          .assignment-row small {
            grid-column: 2;
          }
        }
      `}</style>
    </div>
  )
}
