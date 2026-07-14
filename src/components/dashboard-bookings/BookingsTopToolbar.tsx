import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  pageLoading: boolean
  onRefresh: () => void
}

export default function BookingsTopToolbar({
  pageLoading,
  onRefresh
}: Props) {
  const { t } = useI18n()

  return (
    <div className="booking-top-toolbar">
      <p className="small muted">
        {t(
          'dashboardBookings.toolbar.body',
          'Use the date, status and search filters to manage appointments, approvals and booking history as the business grows.'
        )}
      </p>

      <div className="booking-top-toolbar-actions">
        <button
          type="button"
          onClick={onRefresh}
          className="btn btn-ghost"
          disabled={pageLoading}
        >
          {pageLoading
            ? t('dashboardBookings.toolbar.refreshing', 'Refreshing...')
            : t('dashboardBookings.toolbar.refresh', 'Refresh bookings')}
        </button>

        <Link href="/dashboard/notifications" className="btn btn-ghost">
          {t('account.needsAction', 'Needs action')}
        </Link>

        <Link href="/support/business" className="btn btn-ghost">
          {t('nav.businessSupport', 'Business support')}
        </Link>
      </div>

      <style jsx>{`
        .booking-top-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .booking-top-toolbar-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 700px) {
          .booking-top-toolbar {
            display: grid;
          }

          .booking-top-toolbar-actions,
          .booking-top-toolbar-actions :global(.btn),
          .booking-top-toolbar-actions button,
          .booking-top-toolbar-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
