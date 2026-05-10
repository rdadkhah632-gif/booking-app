import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type BookingRequest = {
  id: string
  booking_id: string
  status: string
  requested_start_at: string
  requested_duration_minutes: number
  response_message?: string | null
  created_at: string
  updated_at?: string | null
  bookings?: {
    customer_name?: string | null
    start_at?: string | null
    duration_minutes?: number | null
    status?: string | null
    businesses?: {
      name: string
    } | null
    services?: {
      name: string
      price?: number | null
    } | null
    staff_members?: {
      name: string
      role_title?: string | null
    } | null
  } | null
  requested_staff?: {
    name: string
    role_title?: string | null
  } | null
}

type Booking = {
  id: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: {
    name: string
  } | null
  services?: {
    name: string
    price?: number | null
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

export default function CustomerNotifications() {
  const router = useRouter()

  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadNotifications() {
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
      router.replace('/dashboard/notifications')
      return
    }

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
        updated_at,
        requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
          name,
          role_title
        ),
        bookings (
          customer_name,
          start_at,
          duration_minutes,
          status,
          businesses (
            name
          ),
          services (
            name,
            price
          ),
          staff_members (
            name,
            role_title
          )
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
        : request.requested_staff,
      bookings: Array.isArray(request.bookings)
        ? request.bookings[0] || null
        : request.bookings
    }))

    setRequests(normalisedRequests)

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        start_at,
        duration_minutes,
        status,
        businesses (
          name
        ),
        services (
          name,
          price
        ),
        staff_members (
          name,
          role_title
        )
      `)
      .eq('customer_user_id', session.user.id)
      .in('status', ['completed', 'cancelled'])
      .order('start_at', { ascending: false })
      .limit(10)

    if (bookingError) {
      setError(bookingError.message)
      setLoading(false)
      return
    }

    const normalisedBookings = (bookingData || []).map((booking: any) => ({
      ...booking,
      businesses: Array.isArray(booking.businesses)
        ? booking.businesses[0] || null
        : booking.businesses,
      services: Array.isArray(booking.services)
        ? booking.services[0] || null
        : booking.services,
      staff_members: Array.isArray(booking.staff_members)
        ? booking.staff_members[0] || null
        : booking.staff_members
    }))

    setRecentBookings(normalisedBookings)
    setLoading(false)
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  function statusLabel(status: string) {
    if (status === 'pending') return 'Waiting for business approval'
    if (status === 'accepted') return 'Reschedule accepted'
    if (status === 'declined') return 'Reschedule declined'
    if (status === 'cancelled') return 'Superseded / replaced'
    if (status === 'completed') return 'Appointment completed'
    if (status === 'confirmed') return 'Confirmed appointment'
    return status
  }

  function statusColor(status: string) {
    if (status === 'pending') return 'var(--accent)'
    if (status === 'accepted') return 'var(--success)'
    if (status === 'declined') return 'var(--warning)'
    if (status === 'cancelled') return 'var(--text-muted)'
    if (status === 'completed') return 'var(--accent)'
    return 'var(--text-muted)'
  }

  function statusBackground(status: string) {
    if (status === 'pending') return 'rgba(255,107,53,0.12)'
    if (status === 'accepted') return 'rgba(45,212,191,0.12)'
    if (status === 'declined') return 'rgba(255,190,11,0.12)'
    if (status === 'completed') return 'rgba(255,107,53,0.12)'
    return 'var(--surface-2)'
  }

  const latestRequestsByBooking = useMemo(() => {
    const map: Record<string, BookingRequest> = {}

    requests
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((request) => {
        if (!map[request.booking_id]) {
          map[request.booking_id] = request
        }
      })

    return Object.values(map)
  }, [requests])

  const pendingRequests = latestRequestsByBooking.filter((request) => request.status === 'pending')
  const resolvedRequests = latestRequestsByBooking.filter((request) => request.status !== 'pending')

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '36px 24px 70px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="small muted">Customer notifications</p>

          <h1 className="page-title">
            Notifications
          </h1>

          <p className="page-sub" style={{ marginTop: '0.5rem' }}>
            {email
              ? `Signed in as ${email}`
              : 'Track booking updates, reschedule requests and appointment changes.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link href="/my-bookings" className="btn btn-accent">
              My bookings
            </Link>

            <Link href="/explore" className="btn btn-ghost">
              Browse businesses
            </Link>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <p className="small muted">Waiting approval</p>
            <h3>{pendingRequests.length}</h3>
            <p className="muted small">Pending reschedule requests</p>
          </div>

          <div className="card">
            <p className="small muted">History</p>
            <h3>{resolvedRequests.length + recentBookings.length}</h3>
            <p className="muted small">Resolved requests and completed/cancelled bookings</p>
          </div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">Loading notifications...</p>
          </div>
        )}

        {!loading && requests.length === 0 && recentBookings.length === 0 && (
          <div className="card">
            <h3>No notifications yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Booking updates, reschedule decisions and completed appointments will appear here.
            </p>

            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Browse businesses
            </Link>
          </div>
        )}

        {!loading && pendingRequests.length > 0 && (
          <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <p className="small muted">Action status</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Waiting for business approval
              </h2>
            </div>

            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="card"
                style={{
                  borderColor: 'rgba(255,107,53,0.35)',
                  background: 'var(--accent-dim)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <strong>{request.bookings?.businesses?.name || 'Business'}</strong>

                      <span
                        className="small"
                        style={{
                          background: statusBackground(request.status),
                          color: statusColor(request.status),
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        {statusLabel(request.status)}
                      </span>
                    </div>

                    <p className="small muted">
                      Service: {request.bookings?.services?.name || 'Service'}
                    </p>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '0.75rem',
                        marginTop: '1rem'
                      }}
                    >
                      <div
                        style={{
                          padding: '0.8rem',
                          borderRadius: 'var(--radius)',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <p className="small muted">Current confirmed appointment</p>
                        <strong>
                          {request.bookings?.start_at
                            ? new Date(request.bookings.start_at).toLocaleString()
                            : 'Not recorded'}
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: '0.8rem',
                          borderRadius: 'var(--radius)',
                          background: 'rgba(255,107,53,0.10)',
                          border: '1px solid rgba(255,107,53,0.35)'
                        }}
                      >
                        <p className="small muted">Requested new appointment</p>
                        <strong>{new Date(request.requested_start_at).toLocaleString()}</strong>
                      </div>
                    </div>

                    <p className="small muted" style={{ marginTop: '0.75rem' }}>
                      Requested staff: {request.requested_staff?.name || 'Staff not recorded'}
                      {request.requested_staff?.role_title ? ` — ${request.requested_staff.role_title}` : ''}
                    </p>

                    <p className="small muted">
                      Requested duration: {request.requested_duration_minutes} minutes
                    </p>

                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
                      Your original booking remains confirmed until the business accepts this request.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <Link href="/my-bookings" className="btn btn-accent">
                      View booking
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && resolvedRequests.length > 0 && (
          <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <p className="small muted">Request history</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Reschedule updates
              </h2>
            </div>

            {resolvedRequests.map((request) => (
              <div
                key={request.id}
                className="card"
                style={{
                  opacity: request.status === 'cancelled' ? 0.65 : 1,
                  borderColor: request.status === 'accepted'
                    ? 'rgba(45,212,191,0.28)'
                    : request.status === 'declined'
                      ? 'rgba(255,190,11,0.28)'
                      : 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <strong>{request.bookings?.businesses?.name || 'Business'}</strong>

                      <span
                        className="small"
                        style={{
                          background: statusBackground(request.status),
                          color: statusColor(request.status),
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        {statusLabel(request.status)}
                      </span>
                    </div>

                    <p className="small muted">
                      Service: {request.bookings?.services?.name || 'Service'}
                    </p>

                    <p className="small muted">
                      Requested time: {new Date(request.requested_start_at).toLocaleString()}
                    </p>

                    <p className="small muted">
                      Requested staff: {request.requested_staff?.name || 'Staff not recorded'}
                      {request.requested_staff?.role_title ? ` — ${request.requested_staff.role_title}` : ''}
                    </p>

                    {request.response_message && (
                      <p className="small muted" style={{ marginTop: '0.5rem' }}>
                        Business response: {request.response_message}
                      </p>
                    )}

                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
                      Updated: {request.updated_at
                        ? new Date(request.updated_at).toLocaleString()
                        : new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>

                  <Link href="/my-bookings" className="btn btn-ghost">
                    My bookings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && recentBookings.length > 0 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <p className="small muted">Booking history</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Completed / cancelled appointments
              </h2>
            </div>

            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="card"
                style={{
                  opacity: booking.status === 'cancelled' ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <strong>{booking.businesses?.name || 'Business'}</strong>

                      <span
                        className="small"
                        style={{
                          background: statusBackground(booking.status),
                          color: statusColor(booking.status),
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        {statusLabel(booking.status)}
                      </span>
                    </div>

                    <p className="small muted">
                      Service: {booking.services?.name || 'Service'}
                    </p>

                    <p className="small muted">
                      Staff: {booking.staff_members?.name || 'Staff not recorded'}
                      {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                    </p>

                    <p className="small muted">
                      Time: {new Date(booking.start_at).toLocaleString()}
                    </p>
                  </div>

                  <Link href="/my-bookings" className="btn btn-ghost">
                    View bookings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}