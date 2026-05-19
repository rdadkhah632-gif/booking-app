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
    <div style={{ marginBottom: '1.5rem' }}>
      <p className="small muted">{t('myBookings.kicker', 'Mirëbook customer dashboard')}</p>

      <h1 className="page-title">
        {t('myBookings.title', 'My Mirëbook bookings')}
      </h1>

      <p className="page-sub" style={{ marginTop: '0.5rem' }}>
        {email
          ? `${t('myBookings.signedInAs', 'Signed in as')} ${email}`
          : t('myBookings.subtitle', 'View and manage your Mirëbook appointments.')}
      </p>

      {bookingRequested && (
        <div className="card my-booking-route-banner">
          <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
            {t('myBookings.requestSent.kicker', 'Booking request sent')}
          </p>
          <strong>{t('myBookings.requestSent.title', 'Your booking is waiting for business approval.')}</strong>
          <p className="small muted" style={{ marginTop: '0.5rem' }}>
            {t('myBookings.requestSent.body', 'This appointment is not confirmed yet. You can track the request here or from Notifications.')}
          </p>
        </div>
      )}

      {requestSent && (
        <div className="card my-booking-route-banner">
          <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
            {t('myBookings.rescheduleSent.kicker', 'Reschedule request sent')}
          </p>
          <strong>{t('myBookings.rescheduleSent.title', 'Your reschedule request is waiting for business approval.')}</strong>
          <p className="small muted" style={{ marginTop: '0.5rem' }}>
            {t('myBookings.rescheduleSent.body', 'Your original appointment is still confirmed. If the business accepts your request, your booking will update to the requested time.')}
          </p>
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
              {t('myBookings.dismiss', 'Dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="my-bookings-header-actions">
        <Link href="/account" className="btn btn-ghost">
          {t('nav.account')}
        </Link>

        <Link href="/notifications" className="btn btn-ghost">
          {t('nav.notifications')}
        </Link>

        <Link href="/support/customer" className="btn btn-ghost">
          {t('nav.customerSupport')}
        </Link>

        <button onClick={onRefresh} className="btn btn-ghost" disabled={loading}>
          {loading ? t('myBookings.refreshing', 'Refreshing...') : t('myBookings.refresh', 'Refresh bookings')}
        </button>

        <Link href="/explore" className="btn btn-accent">
          {t('home.cta.explore')}
        </Link>
      </div>

      <p className="small muted" style={{ marginTop: '0.75rem' }}>
        {t('myBookings.refreshHint', 'Booking changes update this page after each action. It also refreshes when you return to the tab.')}
      </p>
    </div>
  )
}