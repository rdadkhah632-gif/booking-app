import { useEffect, useMemo, useRef, useState } from 'react'
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
  completed_at?: string | null
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

  const pendingSectionRef = useRef<HTMLElement | null>(null)
  const upcomingSectionRef = useRef<HTMLElement | null>(null)
  const changeRequestsSectionRef = useRef<HTMLElement | null>(null)
  const historySectionRef = useRef<HTMLElement | null>(null)

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

  function cardTone(status: string, hasPendingRequest: boolean, mode: 'pending' | 'confirmed' | 'history') {
    if (status === 'pending') {
      return {
        border: 'rgba(255,107,53,0.45)',
        background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))'
      }
    }

    if (hasPendingRequest && status === 'confirmed') {
      return {
        border: 'rgba(255,107,53,0.45)',
        background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(31,28,44,0.85))'
      }
    }

    if (status === 'completed') {
      return {
        border: 'rgba(45,212,191,0.22)',
        background: 'linear-gradient(135deg, rgba(45,212,191,0.08), rgba(31,28,44,0.72))'
      }
    }

    if (status === 'cancelled') {
      return {
        border: 'rgba(255,190,11,0.22)',
        background: 'linear-gradient(135deg, rgba(255,190,11,0.07), rgba(31,28,44,0.66))'
      }
    }

    if (mode === 'history') {
      return {
        border: 'rgba(255,255,255,0.08)',
        background: 'rgba(31,28,44,0.62)'
      }
    }

    return {
      border: 'var(--border)',
      background: 'var(--surface)'
    }
  }

  function lifecycleTitle(booking: Booking, pendingRequest?: BookingRequest) {
    if (booking.status === 'pending') return 'Waiting for business approval'
    if (pendingRequest && booking.status === 'confirmed') return 'Confirmed appointment with a pending change request'
    if (booking.status === 'confirmed') return 'Confirmed appointment'
    if (booking.status === 'completed') return 'Completed appointment'
    if (booking.status === 'cancelled') return 'Cancelled booking'
    return statusLabel(booking.status)
  }

  function lifecycleCopy(booking: Booking, pendingRequest?: BookingRequest) {
    if (booking.status === 'pending') {
      return 'This booking is not confirmed yet. The business needs to accept it before it becomes an appointment.'
    }

    if (pendingRequest && booking.status === 'confirmed') {
      return 'Your original appointment is still confirmed. The new requested time will only replace it if the business accepts your request.'
    }

    if (booking.status === 'confirmed') {
      return 'This is your active appointment. You can request a new time or cancel it before it is completed.'
    }

    if (booking.status === 'completed') {
      return 'This appointment is complete and locked. It stays here as part of your booking history.'
    }

    if (booking.status === 'cancelled') {
      return 'This booking is cancelled and no longer active.'
    }

    return 'Booking details are shown below.'
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

  function scrollToSection(section: 'pending' | 'upcoming' | 'changes' | 'history') {
    const sectionMap = {
      pending: pendingSectionRef,
      upcoming: upcomingSectionRef,
      changes: changeRequestsSectionRef,
      history: historySectionRef
    }

    const target = sectionMap[section].current

    if (!target) return

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  function statCardStyle(isActive: boolean) {
    return {
      width: '100%',
      textAlign: 'left' as const,
      cursor: isActive ? 'pointer' : 'default',
      borderColor: isActive ? 'rgba(255,107,53,0.35)' : 'var(--border)',
      background: isActive ? 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(31,28,44,0.72))' : 'var(--surface)',
      color: 'var(--text)'
    }
  }

  function renderBookingCard(booking: Booking, mode: 'pending' | 'confirmed' | 'history') {
    const pendingRequest = pendingRequestByBookingId[booking.id]
    const isWorking = actionLoadingId === booking.id
    const isLocked = booking.status === 'cancelled' || booking.status === 'completed' || mode === 'history'
    const tone = cardTone(booking.status, Boolean(pendingRequest), mode)

    return (
      <div
        key={booking.id}
        className="card"
        style={{
          opacity: isLocked ? 0.78 : 1,
          borderColor: tone.border,
          background: tone.background
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
                  ? 'Change request pending'
                  : statusLabel(booking.status)}
              </span>

              {pendingRequest && booking.status === 'confirmed' && (
                <span
                  className="small"
                  style={{
                    background: 'rgba(45,212,191,0.12)',
                    color: 'var(--success)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 999
                  }}
                >
                  Original time still confirmed
                </span>
              )}

              {booking.status === 'completed' && (
                <span
                  className="small"
                  style={{
                    background: 'rgba(45,212,191,0.12)',
                    color: 'var(--success)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 999
                  }}
                >
                  Locked
                </span>
              )}
            </div>

            <h3 style={{ marginBottom: '0.35rem' }}>
              {lifecycleTitle(booking, pendingRequest)}
            </h3>

            <p className="small muted" style={{ marginBottom: '0.65rem' }}>
              {lifecycleCopy(booking, pendingRequest)}
            </p>

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
                background: booking.status === 'pending' || pendingRequest ? 'rgba(255,107,53,0.08)' : 'var(--surface-2)',
                border: booking.status === 'pending' || pendingRequest ? '1px solid rgba(255,107,53,0.28)' : '1px solid var(--border)'
              }}
            >
              <p className="small muted">
                {booking.status === 'pending'
                  ? 'Requested appointment time'
                  : pendingRequest && booking.status === 'confirmed'
                    ? 'Original confirmed appointment time'
                    : booking.status === 'completed'
                      ? 'Completed appointment time'
                      : booking.status === 'cancelled'
                        ? 'Cancelled appointment time'
                        : 'Current confirmed appointment'}
              </p>
              <strong>{new Date(booking.start_at).toLocaleString()}</strong>
              <p className="small muted" style={{ marginTop: '0.25rem' }}>
                {booking.status === 'pending'
                  ? 'This booking is not confirmed until the business accepts it.'
                  : pendingRequest && booking.status === 'confirmed'
                    ? 'This remains your active appointment until the business accepts your new requested time.'
                    : booking.status === 'confirmed'
                      ? 'This is your active booked time.'
                      : booking.status === 'completed'
                        ? 'Completed bookings cannot be rescheduled or cancelled.'
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
                  background: 'linear-gradient(135deg, rgba(255,107,53,0.14), rgba(255,107,53,0.05))',
                  marginTop: '1rem',
                  borderColor: 'rgba(255,107,53,0.45)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <p className="small" style={{ color: 'var(--accent)' }}>
                      Requested change awaiting approval
                    </p>

                    <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                      New requested appointment time
                    </h3>
                  </div>

                  <span
                    className="small"
                    style={{
                      background: 'rgba(255,107,53,0.14)',
                      color: 'var(--accent)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 999
                    }}
                  >
                    Business approval needed
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(11,18,32,0.28)',
                    border: '1px solid rgba(255,107,53,0.28)'
                  }}
                >
                  <p className="small muted">Requested new time</p>
                  <strong>{new Date(pendingRequest.requested_start_at).toLocaleString()}</strong>

                  <p className="small muted" style={{ marginTop: '0.55rem' }}>
                    Requested staff: {pendingRequest.requested_staff?.name || 'Staff not recorded'}
                    {pendingRequest.requested_staff?.role_title ? ` — ${pendingRequest.requested_staff.role_title}` : ''}
                  </p>

                  <p className="small muted">
                    Requested duration: {pendingRequest.requested_duration_minutes} minutes
                  </p>
                </div>

                <p className="small muted" style={{ marginTop: '0.75rem' }}>
                  The business can accept or decline this request. Until then, the original confirmed appointment time above remains active.
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
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
              <div
                className="card"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: booking.status === 'completed' ? 'rgba(45,212,191,0.22)' : 'rgba(255,190,11,0.22)',
                  padding: '0.85rem',
                  maxWidth: 240
                }}
              >
                <p className="small" style={{ color: statusColor(booking.status) }}>
                  {booking.status === 'completed'
                    ? 'Locked completed record'
                    : booking.status === 'cancelled'
                      ? 'Locked cancelled record'
                      : 'Past appointment record'}
                </p>
                <p className="small muted" style={{ marginTop: '0.3rem' }}>
                  This booking can no longer be rescheduled or cancelled.
                </p>
              </div>
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
          <button
            type="button"
            className="card"
            onClick={() => scrollToSection('pending')}
            disabled={pendingBookings.length === 0}
            style={statCardStyle(pendingBookings.length > 0)}
          >
            <p className="small muted">Waiting approval</p>
            <h3>{pendingBookings.length}</h3>
            <p className="muted small">Booking requests not confirmed yet</p>
            <p className="small" style={{ color: pendingBookings.length > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
              {pendingBookings.length > 0 ? 'Tap to view requests ↓' : 'No waiting approvals'}
            </p>
          </button>

          <button
            type="button"
            className="card"
            onClick={() => scrollToSection('upcoming')}
            disabled={confirmedUpcomingBookings.length === 0}
            style={statCardStyle(confirmedUpcomingBookings.length > 0)}
          >
            <p className="small muted">Upcoming</p>
            <h3>{confirmedUpcomingBookings.length}</h3>
            <p className="muted small">Confirmed future appointments</p>
            <p className="small" style={{ color: confirmedUpcomingBookings.length > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
              {confirmedUpcomingBookings.length > 0 ? 'Tap to view schedule ↓' : 'No upcoming appointments'}
            </p>
          </button>

          <button
            type="button"
            className="card"
            onClick={() => scrollToSection('changes')}
            disabled={pendingRescheduleCount === 0}
            style={statCardStyle(pendingRescheduleCount > 0)}
          >
            <p className="small muted">Change requests</p>
            <h3>{pendingRescheduleCount}</h3>
            <p className="muted small">Pending reschedule requests</p>
            <p className="small" style={{ color: pendingRescheduleCount > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
              {pendingRescheduleCount > 0 ? 'Tap to view requested changes ↓' : 'No pending changes'}
            </p>
          </button>

          <button
            type="button"
            className="card"
            onClick={() => scrollToSection('history')}
            disabled={historyBookings.length === 0}
            style={statCardStyle(historyBookings.length > 0)}
          >
            <p className="small muted">History</p>
            <h3>{historyBookings.length}</h3>
            <p className="muted small">Completed, cancelled or past bookings</p>
            <p className="small" style={{ color: historyBookings.length > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.55rem' }}>
              {historyBookings.length > 0 ? 'Tap to view history ↓' : 'No history yet'}
            </p>
          </button>
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
              <section ref={pendingSectionRef} id="waiting-approval" style={{ display: 'grid', gap: '1rem', scrollMarginTop: 96 }}>
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

            {pendingRescheduleCount > 0 && (
              <section ref={changeRequestsSectionRef} id="change-requests" style={{ display: 'grid', gap: '1rem', scrollMarginTop: 96 }}>
                <div>
                  <p className="small muted">Requested changes</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>Pending reschedule requests</h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    These cards are also shown inside your active appointments. Your current appointment remains confirmed until the business approves the requested time.
                  </p>
                </div>

                {confirmedUpcomingBookings
                  .filter((booking) => pendingRequestByBookingId[booking.id])
                  .map((booking) => renderBookingCard(booking, 'confirmed'))}
              </section>
            )}

            {confirmedUpcomingBookings.length > 0 && (
            <section ref={upcomingSectionRef} id="upcoming-bookings" style={{ display: 'grid', gap: '1rem', scrollMarginTop: 96 }}>
                <div>
                  <p className="small muted">Schedule</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>Active confirmed appointments</h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    These are your active bookings. If a change request is pending, your original appointment still remains confirmed until the business accepts the new time.
                  </p>
                  {pendingRescheduleCount > 0 && (
                    <button type="button" onClick={() => scrollToSection('changes')} className="btn btn-ghost" style={{ marginTop: '0.75rem' }}>
                      View pending change requests
                    </button>
                  )}
                </div>
                {confirmedUpcomingBookings
                  .filter((booking) => !pendingRequestByBookingId[booking.id])
                  .map((booking) => renderBookingCard(booking, 'confirmed'))}
              </section>
            )}

            {historyBookings.length > 0 && (
            <section ref={historySectionRef} id="booking-history" style={{ display: 'grid', gap: '1rem', scrollMarginTop: 96 }}>
                <div>
                  <p className="small muted">History</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>History and locked bookings</h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    Completed, cancelled and past bookings are shown for your records only.
                  </p>
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