import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  email: string
  loading: boolean
  bookingRequested?: string | string[]
  requestSent?: string | string[]
  success: string | null
  onClearSuccess: () => void
  onRefresh: () => void
}

export default function MyBookingsHeader({
  email,
  loading,
  bookingRequested,
  requestSent,
  success,
  onClearSuccess,
  onRefresh
}: Props) {
  const { t } = useI18n()

  return (
    <div style={{ marginBottom: '1rem' }}>

      <h1 className="page-title">
        {t('myBookings.title', 'My bookings')}
      </h1>

      <p className="page-sub" style={{ marginTop: '0.35rem' }}>
        {email
          ? email
          : t('myBookings.subtitle', 'View and manage your Mirëbook appointments.')}
      </p>

      {bookingRequested && (
        <div className="card my-booking-route-banner">
          <strong>{t('myBookings.requestSent.title', 'Waiting for the business to confirm.')}</strong>
        </div>
      )}

      {requestSent && (
        <div className="card my-booking-route-banner">
          <strong>{t('myBookings.rescheduleSent.title', 'Your reschedule request is waiting for business approval.')}</strong>
        </div>
      )}

      {success && (
        <div className="card my-booking-success-banner">
          <div className="my-booking-banner-row">
            <div>
              <p className="small" style={{ color: 'var(--success)' }}>{t('myBookings.actionCompleted', 'Action completed')}</p>
              <strong>{success}</strong>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClearSuccess}>
              {t('common.dismiss', 'Dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="my-bookings-header-actions">
        <Link href="/explore" className="btn btn-accent">
          {t('home.cta.explore', 'Explore')}
        </Link>
        <button onClick={onRefresh} className="btn btn-ghost" disabled={loading}>
          {loading ? t('myBookings.refreshing', 'Refreshing...') : t('myBookings.refresh', 'Refresh')}
        </button>
      </div>

    </div>
  )
}
