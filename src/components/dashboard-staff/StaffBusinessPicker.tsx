import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardStaffTypes'

type Props = {
  businesses: Business[]
}

export default function StaffBusinessPicker({ businesses }: Props) {
  const { t } = useI18n()

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08))' }}>
        <p className="small muted">{t('dashboardStaff.businessPicker.kicker', 'Multiple businesses found')}</p>

        <h3 style={{ marginTop: '0.25rem' }}>
          {t('dashboardStaff.businessPicker.title', 'Choose a business to manage staff')}
        </h3>

        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {t(
            'dashboardStaff.businessPicker.body',
            'Staff are managed per business so service assignments, schedules and booking availability stay correct.'
          )}
        </p>
      </div>

      {businesses.map((business) => (
        <Link
          key={business.id}
          href={`/dashboard/staff?businessId=${business.id}`}
          className="card staff-business-picker-card"
        >
          <div>
            <strong>{business.name}</strong>

            <p className="small muted" style={{ marginTop: '0.25rem' }}>
              {business.published
                ? t('support.business.status.published', 'Published')
                : t('support.business.status.draft', 'Hidden / draft')}
            </p>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t('dashboardStaff.businessPicker.manageBody', 'Manage staff, service assignments and availability for this business.')}
            </p>
          </div>

          <span className="btn btn-accent">
            {t('dashboardStaff.businessPicker.manageCta', 'Manage staff')}
          </span>
        </Link>
      ))}

      <style jsx>{`
        .staff-business-picker-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          color: var(--text);
          text-decoration: none;
        }

        @media (max-width: 640px) {
          .staff-business-picker-card {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}