import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardBookingsTypes'

type Props = {
  businesses: Business[]
}

export default function BookingsBusinessPicker({ businesses }: Props) {
  const { t } = useI18n()

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card">
        <p className="small muted">{t('dashboardBookings.businessPicker.kicker', 'Multiple businesses found')}</p>

        <h3 style={{ marginTop: '0.25rem' }}>
          {t('dashboardBookings.businessPicker.title', 'Choose a business to continue')}
        </h3>

        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {t('dashboardBookings.businessPicker.body', 'Select one business to view and manage its bookings.')}
        </p>
      </div>

      {businesses.map((business) => (
        <Link
          key={business.id}
          href={`/dashboard/bookings?businessId=${business.id}&view=today`}
          className="card business-select-card"
        >
          <div>
            <strong>{business.name}</strong>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t('dashboardBookings.businessPicker.manageBody', 'View bookings for this business.')}
            </p>
          </div>

          <span className="btn btn-accent">
            {t('dashboardBookings.businessPicker.cta', 'View bookings')}
          </span>
        </Link>
      ))}

      <style jsx>{`
        .business-select-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          color: var(--text);
          text-decoration: none;
        }

        @media (max-width: 700px) {
          .business-select-card {
            display: grid;
          }

          .business-select-card :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}