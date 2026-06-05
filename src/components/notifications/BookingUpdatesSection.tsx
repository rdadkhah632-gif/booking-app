import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Booking } from './notificationTypes'

type Props = {
  bookings: Booking[]
  bookingBusinessName: (booking?: Booking | null) => string
  bookingServiceName: (booking?: Booking | null) => string
  bookingStaffName: (booking?: Booking | null) => string
  statusLabel: (status: string, type?: 'booking' | 'reschedule') => string
  statusColor: (status: string) => string
  statusBackground: (status: string) => string
}

export default function BookingUpdatesSection({
  bookings,
  bookingBusinessName,
  bookingServiceName,
  bookingStaffName,
  statusLabel,
  statusColor,
  statusBackground
}: Props) {
  const { t } = useI18n()

  if (bookings.length === 0) return null

  return (
    <div className="customer-notification-section">
      <div>
        <p className="small muted">{t('notifications.bookingHistory', 'Booking history')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>
          {t('notifications.bookingUpdates', 'Booking updates')}
        </h2>
      </div>

      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="card"
          style={{
            opacity: booking.status === 'cancelled' || booking.status === 'declined' ? 0.7 : 1,
            borderColor: booking.status === 'confirmed'
              ? 'rgba(45,212,191,0.28)'
              : booking.status === 'completed'
                ? 'rgba(255,107,53,0.28)'
                : booking.status === 'cancelled' || booking.status === 'declined'
                  ? 'rgba(255,190,11,0.28)'
                  : 'var(--border)'
          }}
        >
          <div className="customer-notification-card-row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <strong>{bookingBusinessName(booking)}</strong>

                <span
                  className="small"
                  style={{
                    background: statusBackground(booking.status),
                    color: statusColor(booking.status),
                    padding: '0.2rem 0.55rem',
                    borderRadius: 999
                  }}
                >
                  {statusLabel(booking.status, 'booking')}
                </span>
              </div>

              <p className="small muted">
                {t('common.service')}: {bookingServiceName(booking)}
              </p>

              <p className="small muted">
                {t('common.staff')}: {bookingStaffName(booking)}
              </p>

              <p className="small muted">
                {t('common.time')}: {new Date(booking.start_at).toLocaleString()}
              </p>
            </div>

            <Link href="/my-bookings" className="btn btn-ghost">
              {t('notifications.viewBookings', 'View bookings')}
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
