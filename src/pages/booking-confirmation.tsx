import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Booking = {
  id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: {
    name: string
    address?: string | null
    city?: string | null
    country?: string | null
    phone?: string | null
  } | null
  services?: {
    name: string
    price: number
  } | null
}

export default function BookingConfirmation() {
  const router = useRouter()
  const { id } = router.query

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    async function loadBooking() {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      if (!id || Array.isArray(id)) {
        setError('Missing booking reference.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          businesses (
            name,
            address,
            city,
            country,
            phone
          ),
          services (
            name,
            price
          )
        `)
        .eq('id', id)
        .eq('customer_user_id', session.user.id)
        .single()

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setBooking(data)
      setLoading(false)
    }

    loadBooking()
  }, [router.isReady, id])

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        {loading && (
          <div className="card">
            <p className="muted">Loading booking confirmation...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
            <h1 className="page-title">Could not load booking</h1>
            <p style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>{error}</p>
            <Link href="/my-bookings" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Go to my bookings
            </Link>
          </div>
        )}

        {!loading && !error && booking && (
          <div style={{
            maxWidth: 760,
            margin: '0 auto',
            display: 'grid',
            gap: '1rem'
          }}>
            <div className="card" style={{
              textAlign: 'center',
              padding: '2.2rem'
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 999,
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1rem'
              }}>
                ✓
              </div>

              <p className="small muted">Booking confirmed</p>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.4rem',
                marginTop: '0.35rem'
              }}>
                You're booked in.
              </h1>

              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Your appointment has been confirmed and added to your bookings.
              </p>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
                Appointment details
              </h2>

              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div>
                  <p className="small muted">Business</p>
                  <strong>{booking.businesses?.name || 'Business'}</strong>
                </div>

                <div>
                  <p className="small muted">Service</p>
                  <strong>{booking.services?.name || 'Service'}</strong>
                </div>

                <div>
                  <p className="small muted">Date and time</p>
                  <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                </div>

                <div>
                  <p className="small muted">Duration</p>
                  <strong>{booking.duration_minutes} minutes</strong>
                </div>

                <div>
                  <p className="small muted">Price</p>
                  <strong>£{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}</strong>
                </div>

                <div>
                  <p className="small muted">Customer</p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                  {booking.customer_phone && (
                    <p className="small muted">{booking.customer_phone}</p>
                  )}
                </div>

                <div>
                  <p className="small muted">Location</p>
                  <strong>
                    {[booking.businesses?.address, booking.businesses?.city, booking.businesses?.country]
                      .filter(Boolean)
                      .join(', ') || 'Location not added'}
                  </strong>
                </div>

                {booking.businesses?.phone && (
                  <div>
                    <p className="small muted">Business phone</p>
                    <strong>{booking.businesses.phone}</strong>
                  </div>
                )}

                <div>
                  <p className="small muted">Status</p>
                  <strong style={{
                    color: booking.status === 'cancelled' ? 'var(--warning)' : 'var(--success)'
                  }}>
                    {booking.status}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <Link href="/my-bookings" className="btn btn-accent">
                View my bookings
              </Link>

              <Link href="/explore" className="btn btn-ghost">
                Browse more businesses
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}