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
  staff_members?: { name: string; role_title?: string | null } | null
}

type BookingRequest = {
  id: string
  booking_id: string
  status: string
  requested_start_at: string
  requested_duration_minutes: number
  response_message?: string | null
  created_at: string
  requested_staff?: {
    name: string
    role_title?: string | null
  } | null
}

export default function MyBookings() {
  const router = useRouter()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [requests, setRequests] = useState<BookingRequest[]>([])
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
        services ( name, price ),
        staff_members ( name, role_title )
      `)
      .eq('customer_user_id', session.user.id)
      .order('start_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setBookings(data || [])

    const { data: requestData, error: requestError } = await supabase
      .from('booking_requests')
      .select(`
        id,
        booking_id,
        status,
        requested_start_at,
        requested_duration_minutes,
        response_message,
        created_at,
        requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
          name,
          role_title
        )
      `)
      .eq('customer_user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (requestError) {
      setError(requestError.message)
      setLoading(false)
      return
    }

    setRequests(requestData || [])
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

  const pendingRequestByBookingId = useMemo(() => {
    const map: Record<string, BookingRequest> = {}

    requests
      .filter((request) => request.status === 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((request) => {
        if (!map[request.booking_id]) {
          map[request.booking_id] = request
        }
      })

    return map
  }, [requests])

  const upcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= new Date()
    )
  }, [bookings])

  const pastOrCancelledBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'cancelled' ||
      booking.status === 'completed' ||
      new Date(booking.start_at) < new Date()
    )
  }, [bookings])

  const pendingCount = Object.keys(pendingRequestByBookingId).length

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

          {router.query.requestSent && (
            <div className="card" style={{ marginTop: '1rem', borderColor: 'rgba(255,107,53,0.35)' }}>
              <strong>Reschedule request sent</strong>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                Your original appointment is still confirmed until the business accepts your new requested time.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link href="/account" className="btn btn-ghost">
              Account settings
            </Link>

            <Link href="/explore" className="btn btn-accent">
              Browse businesses
            </Link>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <h3>{upcomingBookings.length}</h3>
            <p className="muted small">Upcoming bookings</p>
          </div>

          <div className="card">
            <h3>{pendingCount}</h3>
            <p className="muted small">Pending requests</p>
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
              {upcomingBookings.map((booking) => {
                const pendingRequest = pendingRequestByBookingId[booking.id]

                return (
                  <div key={booking.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <strong>{booking.businesses?.name || 'Business'}</strong>
                        <p className="small muted">Service: {booking.services?.name || 'Service not recorded'}</p>

                        <p className="small muted">
                          Staff: {booking.staff_members?.name || 'Any available staff'}
                          {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                        </p>

                        <p className="small muted">
                          Price: £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
                        </p>

                        <p className="small muted">Current confirmed time: {new Date(booking.start_at).toLocaleString()}</p>
                        <p className="small muted">Duration: {booking.duration_minutes} minutes</p>
                        <p className="small" style={{ color: 'var(--success)' }}>Status: {booking.status}</p>

                        {pendingRequest && (
                          <div
                            className="card"
                            style={{
                              background: 'var(--surface-2)',
                              marginTop: '1rem',
                              borderColor: 'rgba(255,107,53,0.35)'
                            }}
                          >
                            <p className="small" style={{ color: 'var(--accent)' }}>
                              Pending reschedule request
                            </p>

                            <p className="small muted" style={{ marginTop: '0.35rem' }}>
                              Requested time: {new Date(pendingRequest.requested_start_at).toLocaleString()}
                            </p>

                            <p className="small muted">
                              Requested staff: {pendingRequest.requested_staff?.name || 'Staff not recorded'}
                              {pendingRequest.requested_staff?.role_title ? ` — ${pendingRequest.requested_staff.role_title}` : ''}
                            </p>

                            <p className="small muted">
                              Requested duration: {pendingRequest.requested_duration_minutes} minutes
                            </p>

                            <p className="small muted">
                              Waiting for business approval. Your original booking remains confirmed until accepted.
                            </p>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {pendingRequest ? (
                          <span className="btn btn-ghost" title="The business needs to approve your latest requested time before you can request another change.">
                            Request pending
                          </span>
                        ) : (
                          <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                            Reschedule
                          </Link>
                        )}

                        <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger">
                          Cancel booking
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!loading && pastOrCancelledBookings.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
              Past / cancelled / completed
            </h2>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {pastOrCancelledBookings.map((booking) => (
                <div key={booking.id} className="card" style={{ opacity: 0.65 }}>
                  <strong>{booking.businesses?.name || 'Business'}</strong>
                  <p className="small muted">Service: {booking.services?.name || 'Service not recorded'}</p>

                  <p className="small muted">
                    Staff: {booking.staff_members?.name || 'Any available staff'}
                    {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                  </p>

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