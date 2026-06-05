import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Booking, BookingMode, BookingRequest } from './myBookingsTypes'

type Props = {
  booking: Booking
  mode: BookingMode
  pendingRequest?: BookingRequest
  isWorking: boolean
  onCancel: (booking: Booking) => void
  businessName: (booking: Booking) => string
  serviceName: (booking: Booking) => string
  servicePrice: (booking: Booking) => number
  staffName: (booking: Booking) => string
  requestedStaffName: (request: BookingRequest) => string
  lifecycleTitle: (booking: Booking, pendingRequest?: BookingRequest) => string
  lifecycleCopy: (booking: Booking, pendingRequest?: BookingRequest) => string
  statusLabel: (status: string) => string
  statusColor: (status: string) => string
  statusBackground: (status: string) => string
  cardTone: (status: string, hasPendingRequest: boolean, mode: BookingMode) => {
    border: string
    background: string
  }
}

export default function MyBookingCard({
  booking,
  mode,
  pendingRequest,
  isWorking,
  onCancel,
  businessName,
  serviceName,
  servicePrice,
  staffName,
  requestedStaffName,
  lifecycleTitle,
  lifecycleCopy,
  statusLabel,
  statusColor,
  statusBackground,
  cardTone
}: Props) {
  const { t } = useI18n()
  const isLocked = booking.status === 'cancelled' || booking.status === 'declined' || booking.status === 'completed' || mode === 'history'
  const tone = cardTone(booking.status, Boolean(pendingRequest), mode)

  return (
    <div
      key={booking.id}
      className="card my-booking-card"
      style={{
        opacity: isLocked ? 0.78 : 1,
        borderColor: tone.border,
        background: tone.background
      }}
    >
      <div className="my-booking-card-row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <strong>{businessName(booking)}</strong>

            <span
              className="small"
              style={{
                background: pendingRequest && booking.status === 'confirmed'
                  ? 'rgba(255,107,53,0.12)'
                  : statusBackground(booking.status),
                color: pendingRequest && booking.status === 'confirmed'
                  ? 'var(--accent)'
                  : statusColor(booking.status),
                padding: '0.2rem 0.55rem',
                borderRadius: 999
              }}
            >
              {pendingRequest && booking.status === 'confirmed'
                ? t('myBookings.card.changePending', 'Change request pending')
                : statusLabel(booking.status)}
            </span>

            {pendingRequest && booking.status === 'confirmed' && (
              <span className="small my-booking-pill-success">
                {t('myBookings.card.originalStillConfirmed', 'Original time still confirmed')}
              </span>
            )}

            {booking.status === 'completed' && (
              <span className="small my-booking-pill-success">
                {t('myBookings.card.locked', 'Locked')}
              </span>
            )}
          </div>

          <h3 style={{ marginBottom: '0.35rem' }}>
            {lifecycleTitle(booking, pendingRequest)}
          </h3>

          <p className="small muted" style={{ marginBottom: '0.65rem' }}>
            {lifecycleCopy(booking, pendingRequest)}
          </p>

          <p className="small muted">{t('common.service', 'Service')}: {serviceName(booking)}</p>
          <p className="small muted">{t('common.staff', 'Staff')}: {staffName(booking)}</p>
          <p className="small muted">{t('myBookings.card.price', 'Price')}: £{servicePrice(booking).toFixed(2)}</p>

          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.8rem',
              borderRadius: 'var(--radius)',
              background: booking.status === 'pending' || pendingRequest ? 'rgba(255,107,53,0.08)' : 'var(--surface-2)',
              border: booking.status === 'pending' || pendingRequest ? '1px solid rgba(255,107,53,0.28)' : '1px solid var(--border)'
            }}
          >
            <p className="small muted">
              {booking.status === 'pending'
                ? t('myBookings.card.requestedTime', 'Requested appointment time')
                : pendingRequest && booking.status === 'confirmed'
                  ? t('myBookings.card.originalConfirmedTime', 'Original confirmed appointment time')
                  : booking.status === 'completed'
                    ? t('myBookings.card.completedTime', 'Completed appointment time')
                    : booking.status === 'cancelled'
                      ? t('myBookings.card.cancelledTime', 'Cancelled appointment time')
                      : booking.status === 'declined'
                        ? t('myBookings.card.declinedTime', 'Declined requested time')
                      : t('myBookings.card.currentConfirmed', 'Current confirmed appointment')}
            </p>

            <strong>{new Date(booking.start_at).toLocaleString()}</strong>

            <p className="small muted" style={{ marginTop: '0.25rem' }}>
              {booking.status === 'pending'
                ? t('myBookings.card.pendingHint', 'This booking is not confirmed until the business accepts it.')
                : pendingRequest && booking.status === 'confirmed'
                  ? t('myBookings.card.originalHint', 'This remains your active appointment until the business accepts your new requested time.')
                  : booking.status === 'confirmed'
                    ? t('myBookings.card.activeHint', 'This is your active booked time.')
                    : booking.status === 'completed'
                      ? t('myBookings.card.completedHint', 'Completed bookings cannot be rescheduled or cancelled.')
                      : t('myBookings.card.inactiveHint', 'This appointment is no longer active.')}
            </p>
          </div>

          <p className="small muted" style={{ marginTop: '0.65rem' }}>
            {t('myBookings.card.duration', 'Duration')}: {booking.duration_minutes} {t('common.minutes', 'minutes')}
          </p>

          <p className="small" style={{ color: statusColor(booking.status), marginTop: '0.4rem' }}>
            {t('myBookings.card.status', 'Status')}: {statusLabel(booking.status)}
          </p>

          {pendingRequest && booking.status === 'confirmed' && (
            <div className="card my-booking-pending-change-card">
              <div className="my-booking-card-row">
                <div>
                  <p className="small" style={{ color: 'var(--accent)' }}>
                    {t('myBookings.card.changeAwaiting', 'Requested change awaiting approval')}
                  </p>
                  <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {t('myBookings.card.newRequestedTime', 'New requested appointment time')}
                  </h3>
                </div>

                <span className="small my-booking-pill-accent">
                  {t('myBookings.card.businessApprovalNeeded', 'Business approval needed')}
                </span>
              </div>

              <div className="my-booking-requested-time-box">
                <p className="small muted">{t('myBookings.card.requestedNewTime', 'Requested new time')}</p>
                <strong>{new Date(pendingRequest.requested_start_at).toLocaleString()}</strong>

                <p className="small muted" style={{ marginTop: '0.55rem' }}>
                  {t('myBookings.card.requestedStaff', 'Requested staff')}: {requestedStaffName(pendingRequest)}
                </p>

                <p className="small muted">
                  {t('myBookings.card.requestedDuration', 'Requested duration')}: {pendingRequest.requested_duration_minutes} {t('common.minutes', 'minutes')}
                </p>
              </div>

              <p className="small muted" style={{ marginTop: '0.75rem' }}>
                {t('myBookings.card.changeHint', 'The business can accept or decline this request. Until then, the original confirmed appointment time above remains active.')}
              </p>
            </div>
          )}
        </div>

        <div className="my-booking-card-actions">
          {booking.status === 'pending' && (
            <>
              <Link href="/notifications" className="btn btn-ghost">
                {t('myBookings.card.trackRequest', 'Track request')}
              </Link>

              <button onClick={() => onCancel(booking)} className="btn btn-danger" disabled={isWorking}>
                {isWorking ? t('common.working', 'Working...') : t('myBookings.card.cancelRequest', 'Cancel request')}
              </button>
            </>
          )}

          {booking.status === 'confirmed' && mode !== 'history' && (
            <>
              {pendingRequest ? (
                <Link href="/notifications" className="btn btn-ghost" title={t('myBookings.card.pendingRequestTitle', 'The business needs to approve your latest requested time before you can request another change.')}>
                  {t('myBookings.card.viewPendingRequest', 'View pending request')}
                </Link>
              ) : (
                <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                  {t('myBookings.card.reschedule', 'Reschedule')}
                </Link>
              )}

              <button onClick={() => onCancel(booking)} className="btn btn-danger" disabled={isWorking}>
                {isWorking ? t('common.working', 'Working...') : t('myBookings.card.cancelBooking', 'Cancel booking')}
              </button>
            </>
          )}

          {(booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'declined' || mode === 'history') && booking.status !== 'pending' && (
            <div className="card my-booking-locked-card">
              <p className="small" style={{ color: statusColor(booking.status) }}>
                {booking.status === 'completed'
                  ? t('myBookings.card.lockedCompleted', 'Locked completed record')
                  : booking.status === 'cancelled'
                    ? t('myBookings.card.lockedCancelled', 'Locked cancelled record')
                    : booking.status === 'declined'
                      ? t('myBookings.card.lockedDeclined', 'Locked declined request')
                    : t('myBookings.card.pastRecord', 'Past appointment record')}
              </p>
              <p className="small muted" style={{ marginTop: '0.3rem' }}>
                {t('myBookings.card.lockedBody', 'This booking can no longer be rescheduled or cancelled.')}
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .my-booking-pill-success {
          background: rgba(45,212,191,0.12);
          color: var(--success);
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
        }
      `}</style>
    </div>
  )
}
