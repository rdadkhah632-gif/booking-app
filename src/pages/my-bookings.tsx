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

    const normalisedRequests = (requestData || []).map((request: any) => ({
      ...request,
      requested_staff: Array.isArray(request.requested_staff)
        ? request.requested_staff[0] || null
        : request.requested_staff
    }))

    setRequests(normalisedRequests)
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
  }, [])

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadBookings()
      }
    }

    window.addEventListener('focus', loadBookings)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', loadBookings)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
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
            <div
              className="card"
              style={{
                marginTop: '1rem',
                borderColor: 'rgba(255,107,53,0.45)',
                background: 'var(--accent-dim)'
              }}
            >
              <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
                Request sent
              </p>
              <strong>Your reschedule request is waiting for business approval.</strong>
              <p className="small muted" style={{ marginTop: '0.5rem' }}>
                Your original appointment is still confirmed. If the business accepts your request, your booking will update to the requested time.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link href="/account" className="btn btn-ghost">
              Account settings
            </Link>

            <Link href="/notifications" className="btn btn-ghost">
              Notifications
            </Link>

            <button onClick={loadBookings} className="btn btn-ghost" disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh bookings'}
            </button>

            <Link href="/explore" className="btn btn-accent">
              Browse businesses
            </Link>
          </div>

          <p className="small muted" style={{ marginTop: '0.75rem' }}>
            Your bookings and pending requests refresh when you return to this tab. Use refresh if a recent change does not appear straight away.
          </p>
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
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                          <strong>{booking.businesses?.name || 'Business'}</strong>
                          <span
                            className="small"
                            style={{
                              background: pendingRequest ? 'rgba(255,107,53,0.12)' : 'rgba(45, 212, 191, 0.12)',
                              color: pendingRequest ? 'var(--accent)' : 'var(--success)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 999
                            }}
                          >
                            {pendingRequest ? 'Confirmed · Change requested' : 'Confirmed appointment'}
                          </span>
                        </div>

                        <p className="small muted">Service: {booking.services?.name || 'Service not recorded'}</p>

                        <p className="small muted">
                          Staff: {booking.staff_members?.name || 'Any available staff'}
                          {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                        </p>

                        <p className="small muted">
                          Price: £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
                        </p>

                        <div
                          style={{
                            marginTop: '0.75rem',
                            padding: '0.8rem',
                            borderRadius: 'var(--radius)',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)'
                          }}
                        >
                          <p className="small muted">Current confirmed appointment</p>
                          <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                          <p className="small muted" style={{ marginTop: '0.25rem' }}>
                            This remains your booked time unless a requested change is accepted.
                          </p>
                        </div>
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

                            <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                              Waiting for business approval
                            </h3>

                            <p className="small muted">
                              Requested new time: {new Date(pendingRequest.requested_start_at).toLocaleString()}
                            </p>

                            <p className="small muted">
                              Requested staff: {pendingRequest.requested_staff?.name || 'Staff not recorded'}
                              {pendingRequest.requested_staff?.role_title ? ` — ${pendingRequest.requested_staff.role_title}` : ''}
                            </p>

                            <p className="small muted">
                              Requested duration: {pendingRequest.requested_duration_minutes} minutes
                            </p>

                            <p className="small muted" style={{ marginTop: '0.5rem' }}>
                              The business can accept or decline this request. Until then, your current confirmed appointment above is still active. You can also track updates from Notifications.
                            </p>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {pendingRequest ? (
                          <Link href="/notifications" className="btn btn-ghost" title="The business needs to approve your latest requested time before you can request another change.">
                            View pending request
                          </Link>
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
                  <p
                    className="small"
                    style={{
                      color: booking.status === 'completed'
                        ? 'var(--accent)'
                        : booking.status === 'cancelled'
                          ? 'var(--warning)'
                          : 'var(--text-muted)'
                    }}
                  >
                    Status: {booking.status === 'completed' ? 'completed appointment' : booking.status}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}