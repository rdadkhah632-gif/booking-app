import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'

type Booking = {
  id: string
  customer_name: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: { name: string } | null
  services?: { name: string; price: number } | null
}

export default function MyBookings() {
  const router = useRouter()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadBookings() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    setEmail(session.user.email || '')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role === 'business') {
      router.replace('/dashboard')
      return
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        businesses ( name ),
        services ( name, price )
      `)
      .eq('customer_user_id', session.user.id)
      .order('start_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
  }, [])

  async function cancelBooking(id: string) {
    const confirmed = confirm('Cancel this booking?')
    if (!confirmed) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const upcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status !== 'cancelled' && new Date(booking.start_at) >= new Date()
    )
  }, [bookings])

  const pastOrCancelledBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'cancelled' || new Date(booking.start_at) < new Date()
    )
  }, [bookings])

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '36px 24px 70px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="small muted">Customer dashboard</p>

          <h1 className="page-title">
            My bookings
          </h1>

          <p className="page-sub" style={{ marginTop: '0.5rem' }}>
            {email ? `Signed in as ${email}` : 'View and manage your appointments.'}
          </p>
        </div>

        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <h3>{upcomingBookings.length}</h3>
            <p className="muted small">Upcoming bookings</p>
          </div>

          <div className="card">
            <h3>{pastOrCancelledBookings.length}</h3>
            <p className="muted small">Past or cancelled bookings</p>
          </div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">Loading your bookings...</p>
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="card">
            <h3>No bookings yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              You have not booked any appointments yet. Browse businesses and make your first booking.
            </p>

            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Browse businesses
            </Link>
          </div>
        )}

        {!loading && upcomingBookings.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
              Upcoming
            </h2>

            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{booking.businesses?.name || 'Business'}</strong>
                      <p className="small muted">Service: {booking.services?.name || 'Service not recorded'}</p>
                      <p className="small muted">
                        Price: £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
                      </p>
                      <p className="small muted">Time: {new Date(booking.start_at).toLocaleString()}</p>
                      <p className="small muted">Duration: {booking.duration_minutes} minutes</p>
                      <p className="small" style={{ color: 'var(--success)' }}>Status: {booking.status}</p>
                    </div>

                    <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger">
                      Cancel booking
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && pastOrCancelledBookings.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
              Past / cancelled
            </h2>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {pastOrCancelledBookings.map((booking) => (
                <div key={booking.id} className="card" style={{ opacity: 0.65 }}>
                  <strong>{booking.businesses?.name || 'Business'}</strong>
                  <p className="small muted">Service: {booking.services?.name || 'Service not recorded'}</p>
                  <p className="small muted">Time: {new Date(booking.start_at).toLocaleString()}</p>
                  <p className="small muted">Duration: {booking.duration_minutes} minutes</p>
                  <p className="small muted">Status: {booking.status}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}