import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props =
  | {
      type: 'no-business'
    }
  | {
      type: 'no-bookings'
      businessId: string
    }
  | {
      type: 'no-filtered-results'
    }

export default function EmptyBookingsCard(props: Props) {
  const { t } = useI18n()

  if (props.type === 'no-business') {
    return (
      <div className="card">
        <h3>{t('dashboardBookings.empty.noBusinessTitle', 'No business found')}</h3>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          {t('dashboardBookings.empty.noBusinessBody', 'Create a business profile first, then customer bookings will appear here.')}
        </p>
        <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
          {t('dashboardAvailability.noBusiness.cta', 'Create business')}
        </Link>
      </div>
    )
  }

  if (props.type === 'no-filtered-results') {
    return (
      <div className="card">
        <h3>{t('dashboardBookings.empty.noFilteredTitle', 'No bookings in this view')}</h3>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          {t(
            'dashboardBookings.empty.noFilteredBody',
            'Try another date, status or search term. If this came from the dashboard schedule preview, the selected date is already applied through the URL.'
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>{t('dashboardBookings.empty.noBookingsTitle', 'No bookings yet')}</h3>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        {t(
          'dashboardBookings.empty.noBookingsBody',
          'Customer bookings for this business will appear here once your public page is published and customers start booking.'
        )}
      </p>

      <div className="booking-empty-actions">
        <Link href="/dashboard/businesses" className="btn btn-ghost">
          {t('dashboardBookings.empty.checkSetup', 'Check setup')}
        </Link>

        <Link href={`/explore/${props.businessId}`} className="btn btn-ghost">
          {t('dashboardLayout.previewBusiness', 'Preview business page')}
        </Link>

        <Link href="/support/business" className="btn btn-ghost">
          {t('nav.businessSupport', 'Business support')}
        </Link>
      </div>

      <style jsx>{`
        .booking-empty-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 700px) {
          .booking-empty-actions,
          .booking-empty-actions :global(.btn),
          .booking-empty-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}