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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
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

    const normalisedBookings = (data || []).map((booking: any) => ({
      ...booking,
      businesses: Array.isArray(booking.businesses) ? booking.businesses[0] || null : booking.businesses,
      services: Array.isArray(booking.services) ? booking.services[0] || null : booking.services,
      staff_members: Array.isArray(booking.staff_members) ? booking.staff_members[0] || null : booking.staff_members
    }))

    setBookings(normalisedBookings)

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

    setActionLoadingId(id)
    setError(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
  }

  function statusLabel(status: string) {
    if (status === 'pending') return 'Waiting for approval'
    if (status === 'confirmed') return 'Confirmed appointment'
    if (status === 'completed') return 'Completed appointment'
    if (status === 'cancelled') return 'Cancelled booking'
    return status
  }

  function statusColor(status: string) {
    if (status === 'pending') return 'var(--accent)'
    if (status === 'confirmed') return 'var(--success)'
    if (status === 'completed') return 'var(--accent)'
    if (status === 'cancelled') return 'var(--warning)'
    return 'var(--text-muted)'
  }

  function statusBackground(status: string) {
    if (status === 'pending') return 'rgba(255,107,53,0.12)'
    if (status === 'confirmed') return 'rgba(45,212,191,0.12)'
    if (status === 'completed') return 'rgba(255,107,53,0.12)'
    if (status === 'cancelled') return 'rgba(255,190,11,0.12)'
    return 'var(--surface-2)'
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

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= new Date()
    )
  }, [bookings])

  const historyBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'cancelled' ||
      booking.status === 'completed' ||
      (booking.status === 'confirmed' && new Date(booking.start_at) < new Date())
    )
  }, [bookings])

  const pendingRescheduleCount = Object.keys(pendingRequestByBookingId).length

  function renderBookingCard(booking: Booking, mode: 'pending' | 'confirmed' | 'history') {
    const pendingRequest = pendingRequestByBookingId[booking.id]
    const isWorking = actionLoadingId === booking.id
    const isLocked = booking.status === 'cancelled' || booking.status === 'completed' || mode === 'history'

    return (
      <div
        key={booking.id}
        className="card"
        style={{
          opacity: isLocked ? 0.72 : 1,
          borderColor: booking.status === 'pending'
            ? 'rgba(255,107,53,0.35)'
            : pendingRequest
              ? 'rgba(255,107,53,0.35)'
              : booking.status === 'completed'
                ? 'rgba(255,107,53,0.28)'
                : booking.status === 'cancelled'
                  ? 'rgba(255,190,11,0.25)'
                  : 'var(--border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <strong>{booking.businesses?.name || 'Business'}</strong>
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
                  ? 'Confirmed · Change requested'
                  : statusLabel(booking.status)}
              </span>
            </div>

            <p className="small muted">Service: {booking.services?.name || 'Service not recorded'}</p>

            <p className="small muted">
              Staff: {booking.staff_members?.name || 'Staff not recorded'}
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
                background: booking.status === 'pending' ? 'rgba(255,107,53,0.08)' : 'var(--surface-2)',
                border: booking.status === 'pending' ? '1px solid rgba(255,107,53,0.28)' : '1px solid var(--border)'
              }}
            >
              <p className="small muted">
                {booking.status === 'pending' ? 'Requested appointment time' : 'Current confirmed appointment'}
              </p>
              <strong>{new Date(booking.start_at).toLocaleString()}</strong>
              <p className="small muted" style={{ marginTop: '0.25rem' }}>
                {booking.status === 'pending'
                  ? 'This booking is not confirmed until the business accepts it.'
                  : booking.status === 'confirmed'
                    ? 'This remains your booked time unless a requested change is accepted.'
                    : 'This appointment is no longer active.'}
              </p>
            </div>

            <p className="small muted" style={{ marginTop: '0.65rem' }}>
              Duration: {booking.duration_minutes} minutes
            </p>

            <p className="small" style={{ color: statusColor(booking.status), marginTop: '0.4rem' }}>
              Status: {statusLabel(booking.status)}
            </p>

            {pendingRequest && booking.status === 'confirmed' && (
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

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {booking.status === 'pending' && (
              <>
                <Link href="/notifications" className="btn btn-ghost">
                  Track request
                </Link>

                <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger" disabled={isWorking}>
                  {isWorking ? 'Working...' : 'Cancel request'}
                </button>
              </>
            )}

            {booking.status === 'confirmed' && mode !== 'history' && (
              <>
                {pendingRequest ? (
                  <Link href="/notifications" className="btn btn-ghost" title="The business needs to approve your latest requested time before you can request another change.">
                    View pending request
                  </Link>
                ) : (
                  <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                    Reschedule
                  </Link>
                )}

                <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger" disabled={isWorking}>
                  {isWorking ? 'Working...' : 'Cancel booking'}
                </button>
              </>
            )}

            {(booking.status === 'completed' || booking.status === 'cancelled' || mode === 'history') && booking.status !== 'pending' && (
              <span className="small" style={{ color: statusColor(booking.status) }}>
                {booking.status === 'completed'
                  ? 'Locked: completed appointment'
                  : booking.status === 'cancelled'
                    ? 'Locked: cancelled booking'
                    : 'Past confirmed appointment'}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

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

          {router.query.bookingRequested && (
            <div
              className="card"
              style={{
                marginTop: '1rem',
                borderColor: 'rgba(255,107,53,0.45)',
                background: 'var(--accent-dim)'
              }}
            >
              <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
                Booking request sent
              </p>
              <strong>Your booking is waiting for business approval.</strong>
              <p className="small muted" style={{ marginTop: '0.5rem' }}>
                This appointment is not confirmed yet. You can track the request here or from Notifications.
              </p>
            </div>
          )}

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
                Reschedule request sent
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
          <div className="card" style={{ borderColor: pendingBookings.length > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
            <p className="small muted">Waiting approval</p>
            <h3>{pendingBookings.length}</h3>
            <p className="muted small">Booking requests not confirmed yet</p>
          </div>

          <div className="card">
            <p className="small muted">Upcoming</p>
            <h3>{confirmedUpcomingBookings.length}</h3>
            <p className="muted small">Confirmed future appointments</p>
          </div>

          <div className="card">
            <p className="small muted">Change requests</p>
            <h3>{pendingRescheduleCount}</h3>
            <p className="muted small">Pending reschedule requests</p>
          </div>

          <div className="card">
            <p className="small muted">History</p>
            <h3>{historyBookings.length}</h3>
            <p className="muted small">Completed, cancelled or past bookings</p>
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

        {!loading && bookings.length > 0 && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {pendingBookings.length > 0 && (
              <section style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <p className="small muted">Action status</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>Waiting for business approval</h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    These bookings are not confirmed yet. The business needs to accept them first.
                  </p>
                </div>

                {pendingBookings.map((booking) => renderBookingCard(booking, 'pending'))}
              </section>
            )}

            {confirmedUpcomingBookings.length > 0 && (
              <section style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <p className="small muted">Schedule</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>Confirmed upcoming appointments</h2>
                </div>

                {confirmedUpcomingBookings.map((booking) => renderBookingCard(booking, 'confirmed'))}
              </section>
            )}

            {historyBookings.length > 0 && (
              <section style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <p className="small muted">History</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>Completed / cancelled / past bookings</h2>
                </div>

                {historyBookings.map((booking) => renderBookingCard(booking, 'history'))}
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  )
}