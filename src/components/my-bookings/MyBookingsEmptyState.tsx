import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

export default function MyBookingsEmptyState() {
  const { t } = useI18n()

  return (
    <div className="card">
      <h3>{t('myBookings.empty.title', 'No bookings yet')}</h3>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        {t('myBookings.empty.body', 'You have not booked any appointments yet. Explore Mirëbook businesses and make your first booking.')}
      </p>

      <div className="my-booking-empty-actions">
        <Link href="/explore" className="btn btn-accent">
          {t('home.cta.explore')}
        </Link>

        <Link href="/support/customer" className="btn btn-ghost">
          {t('nav.customerSupport')}
        </Link>
      </div>
    </div>
  )
}