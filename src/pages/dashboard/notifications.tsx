import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type BookingRequest = {
  id: string
  booking_id: string
  business_id: string
  customer_user_id: string
  requested_by: string
  request_type: string
  status: string
  current_start_at?: string | null
  requested_start_at: string
  current_staff_member_id?: string | null
  requested_staff_member_id?: string | null
  requested_duration_minutes: number
  message?: string | null
  response_message?: string | null
  created_at: string
  updated_at?: string | null
  bookings?: {
    customer_name: string
    customer_email?: string | null
    customer_phone?: string | null
    start_at?: string | null
    duration_minutes?: number | null
    status?: string | null
    services?: {
      name: string
      price: number
    } | null
    staff_members?: {
      name: string
      role_title?: string | null
    } | null
  } | null
  businesses?: {
    name: string
  } | null
  requested_staff?: {
    name: string
    role_title?: string | null
  } | null
}

type Booking = {
  id: string
  business_id: string
  customer_name: string
  customer_email?: string | null
  customer_phone?: string | null
  start_at: string
  duration_minutes: number
  status: string
  businesses?: {
    name: string
  } | null
  services?: {
    name: string
    price: number
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

export default function BusinessNotifications() {
  const router = useRouter()

  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [businessIds, setBusinessIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadNotifications() {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'business') {
        router.replace('/explore')
        return
      }

      const { data: ownedBusinesses, error: businessesError } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', session.user.id)

      if (businessesError) throw businessesError

      const ownedBusinessIds = (ownedBusinesses || []).map((business) => business.id)
      setBusinessIds(ownedBusinessIds)

      if (ownedBusinessIds.length === 0) {
        setRequests([])
        setBookings([])
        setLoading(false)
        return
      }

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          business_id,
          customer_name,
          customer_email,
          customer_phone,
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
        .in('business_id', ownedBusinessIds)
        .order('start_at', { ascending: true })

      if (bookingError) throw bookingError

      const normalisedBookings = (bookingData || []).map((booking: any) => ({
        ...booking,
        businesses: Array.isArray(booking.businesses) ? booking.businesses[0] || null : booking.businesses,
        services: Array.isArray(booking.services) ? booking.services[0] || null : booking.services,
        staff_members: Array.isArray(booking.staff_members) ? booking.staff_members[0] || null : booking.staff_members
      }))

      setBookings(normalisedBookings)

      const { data: requestData, error: requestError } = await supabase
        .from('booking_requests')
        .select(`
          *,
          bookings (
            customer_name,
            customer_email,
            customer_phone,
            start_at,
            duration_minutes,
            status,
            services (
              name,
              price
            ),
            staff_members (
              name,
              role_title
            )
          ),
          businesses (
            name
          ),
          requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
            name,
            role_title
          )
        `)
        .in('business_id', ownedBusinessIds)
        .order('created_at', { ascending: false })

      if (requestError) throw requestError

      const normalisedRequests = (requestData || []).map((request: any) => ({
        ...request,
        bookings: Array.isArray(request.bookings) ? request.bookings[0] || null : request.bookings,
        businesses: Array.isArray(request.businesses) ? request.businesses[0] || null : request.businesses,
        requested_staff: Array.isArray(request.requested_staff) ? request.requested_staff[0] || null : request.requested_staff
      }))

      setRequests(normalisedRequests)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load notifications.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadNotifications()
      }
    }

    window.addEventListener('focus', loadNotifications)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', loadNotifications)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [])

  async function acceptBooking(booking: Booking) {
    const confirmed = confirm('Accept this booking request and confirm the appointment?')
    if (!confirmed) return

    setActionLoadingId(`booking-${booking.id}`)
    setError(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    await loadNotifications()
    router.replace('/dashboard/notifications?action=booking-accepted', undefined, { shallow: true })
  }

  async function declineBooking(booking: Booking) {
    const confirmed = confirm('Decline this booking request? The customer will see it as cancelled/not accepted.')
    if (!confirmed) return

    setActionLoadingId(`booking-${booking.id}`)
    setError(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    await loadNotifications()
    router.replace('/dashboard/notifications?action=booking-declined', undefined, { shallow: true })
  }

  async function acceptRequest(request: BookingRequest) {
    const confirmed = confirm('Accept this reschedule request? The booking will be updated to the requested time.')
    if (!confirmed) return

    setActionLoadingId(`request-${request.id}`)
    setError(null)

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        start_at: request.requested_start_at,
        duration_minutes: request.requested_duration_minutes,
        staff_member_id: request.requested_staff_member_id,
        status: 'confirmed'
      })
      .eq('id', request.booking_id)

    if (bookingError) {
      setError(bookingError.message)
      setActionLoadingId(null)
      return
    }

    const { error: requestError } = await supabase
      .from('booking_requests')
      .update({
        status: 'accepted',
        response_message: 'Accepted by business',
        updated_at: new Date().toISOString()
      })
      .eq('id', request.id)

    if (requestError) {
      setError(requestError.message)
      setActionLoadingId(null)
      return
    }

    const { error: cancelOtherRequestsError } = await supabase
      .from('booking_requests')
      .update({
        status: 'cancelled',
        response_message: 'Cancelled automatically because another reschedule request was accepted.',
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', request.booking_id)
      .eq('requested_by', 'customer')
      .eq('request_type', 'reschedule')
      .eq('status', 'pending')
      .neq('id', request.id)

    setActionLoadingId(null)

    if (cancelOtherRequestsError) {
      setError(cancelOtherRequestsError.message)
      return
    }

    await loadNotifications()
    router.replace('/dashboard/notifications?action=reschedule-accepted', undefined, { shallow: true })
  }

  async function declineRequest(request: BookingRequest) {
    const responseMessage = prompt('Optional message to customer:', 'Sorry, that time is not available.')
    if (responseMessage === null) return

    setActionLoadingId(`request-${request.id}`)
    setError(null)

    const { error } = await supabase
      .from('booking_requests')
      .update({
        status: 'declined',
        response_message: responseMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    await loadNotifications()
    router.replace('/dashboard/notifications?action=reschedule-declined', undefined, { shallow: true })
  }

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

  const pendingRequests = useMemo(() => {
    return Object.values(
      requests
        .filter((request) => request.status === 'pending')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .reduce<Record<string, BookingRequest>>((latestByBooking, request) => {
          if (!latestByBooking[request.booking_id]) {
            latestByBooking[request.booking_id] = request
          }

          return latestByBooking
        }, {})
    )
  }, [requests])

  const latestPendingRequestIds = new Set(pendingRequests.map((request) => request.id))

  const pastRequests = requests.filter(
    (request) => request.status !== 'pending' || !latestPendingRequestIds.has(request.id)
  )

  const actionCount = pendingBookings.length + pendingRequests.length

  function statusLabel(status: string) {
    if (status === 'pending') return 'Pending approval'
    if (status === 'confirmed') return 'Confirmed appointment'
    if (status === 'accepted') return 'Accepted'
    if (status === 'declined') return 'Declined'
    if (status === 'cancelled') return 'Superseded / cancelled'
    if (status === 'completed') return 'Completed appointment'
    return status
  }

  function statusColor(status: string) {
    if (status === 'pending') return 'var(--accent)'
    if (status === 'confirmed') return 'var(--success)'
    if (status === 'accepted') return 'var(--success)'
    if (status === 'declined') return 'var(--warning)'
    if (status === 'cancelled') return 'var(--text-muted)'
    if (status === 'completed') return 'var(--accent)'
    return 'var(--text-muted)'
  }

  function statusBackground(status: string) {
    if (status === 'pending') return 'rgba(255,107,53,0.12)'
    if (status === 'confirmed') return 'rgba(45,212,191,0.12)'
    if (status === 'accepted') return 'rgba(45,212,191,0.12)'
    if (status === 'declined') return 'rgba(255,190,11,0.12)'
    if (status === 'completed') return 'rgba(255,107,53,0.12)'
    return 'var(--surface-2)'
  }

  function successBanner() {
    const action = router.query.action

    if (action === 'booking-accepted') {
      return {
        tone: 'success',
        title: 'Booking accepted',
        body: 'The customer booking request has been confirmed.'
      }
    }

    if (action === 'booking-declined') {
      return {
        tone: 'warning',
        title: 'Booking declined',
        body: 'The customer booking request has been declined and marked as cancelled.'
      }
    }

    if (action === 'reschedule-accepted') {
      return {
        tone: 'success',
        title: 'Reschedule accepted',
        body: 'The booking has been updated to the customer’s requested time.'
      }
    }

    if (action === 'reschedule-declined') {
      return {
        tone: 'warning',
        title: 'Reschedule declined',
        body: 'The original booking remains unchanged.'
      }
    }

    return null
  }

  const banner = successBanner()

  return (
    <DashboardLayout
      title="Notifications"
      subtitle="Review booking approvals, customer reschedule requests and actions that need your attention."
    >
      {banner && (
        <div
          className="card"
          style={{
            borderColor: banner.tone === 'success' ? 'rgba(45,212,191,0.28)' : 'rgba(255,190,11,0.28)',
            background: banner.tone === 'success' ? 'rgba(45,212,191,0.06)' : 'rgba(255,190,11,0.06)',
            marginBottom: '1rem'
          }}
        >
          <p className="small" style={{ color: banner.tone === 'success' ? 'var(--success)' : 'var(--warning)' }}>
            {banner.title}
          </p>
          <strong>{banner.body}</strong>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p className="small muted">
          Notifications refresh when you return to this tab. Use refresh if a new request does not appear straight away.
        </p>

        <button onClick={loadNotifications} className="btn btn-ghost" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh notifications'}
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderColor: pendingBookings.length > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
          <p className="small muted">Booking approvals</p>
          <h3>{pendingBookings.length}</h3>
          <p className="muted small">New bookings waiting for approval</p>
        </div>

        <div className="card" style={{ borderColor: pendingRequests.length > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
          <p className="small muted">Reschedule requests</p>
          <h3>{pendingRequests.length}</h3>
          <p className="muted small">Customer changes waiting for approval</p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Loading notifications...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!loading && actionCount === 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>No pending actions</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Booking approvals and customer reschedule requests will appear here when they need your attention.
          </p>
        </div>
      )}

      {!loading && pendingBookings.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <p className="small muted">Action required</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>
              Pending booking approvals
            </h2>
            <p className="muted small" style={{ marginTop: '0.35rem' }}>
              These customers requested bookings while manual approval was enabled. Accepting confirms the appointment.
            </p>
          </div>

          {pendingBookings.map((booking) => {
            const isWorking = actionLoadingId === `booking-${booking.id}`

            return (
              <div key={booking.id} className="card" style={{ borderColor: 'rgba(255,107,53,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <p className="small" style={{ color: 'var(--accent)' }}>
                        New booking request
                      </p>

                      <span
                        className="small"
                        style={{
                          background: statusBackground('pending'),
                          color: statusColor('pending'),
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        Waiting approval
                      </span>
                    </div>

                    <h3 style={{ marginTop: '0.25rem' }}>
                      {booking.customer_name || 'Customer'}
                    </h3>

                    <p className="small muted">
                      Business: {booking.businesses?.name || 'Business'}
                    </p>

                    <p className="small muted">
                      Service: {booking.services?.name || 'Service'}
                    </p>

                    <p className="small muted">
                      Staff: {booking.staff_members?.name || 'Staff not recorded'}
                      {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                    </p>

                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.8rem',
                        borderRadius: 'var(--radius)',
                        background: 'rgba(255,107,53,0.08)',
                        border: '1px solid rgba(255,107,53,0.28)'
                      }}
                    >
                      <p className="small muted">Requested appointment time</p>
                      <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                      <p className="small muted" style={{ marginTop: '0.3rem' }}>
                        This time is reserved until you accept or decline the request.
                      </p>
                    </div>

                    <p className="small muted" style={{ marginTop: '0.75rem' }}>
                      Duration: {booking.duration_minutes} minutes
                    </p>

                    <p className="small muted">
                      Email: {booking.customer_email || 'Not provided'}
                    </p>

                    <p className="small muted">
                      Phone: {booking.customer_phone || 'Not provided'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <button
                      onClick={() => acceptBooking(booking)}
                      disabled={isWorking}
                      className="btn btn-accent"
                    >
                      {isWorking ? 'Working...' : 'Accept booking'}
                    </button>

                    <button
                      onClick={() => declineBooking(booking)}
                      disabled={isWorking}
                      className="btn btn-danger"
                    >
                      Decline booking
                    </button>

                    <Link
                      href={`/dashboard/bookings?businessId=${booking.business_id}`}
                      className="btn btn-ghost"
                    >
                      View bookings
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && pendingRequests.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <p className="small muted">Action required</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>
              Pending reschedule requests
            </h2>
          </div>

          {pendingRequests.map((request) => {
            const isWorking = actionLoadingId === `request-${request.id}`

            return (
              <div key={request.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <p className="small" style={{ color: 'var(--accent)' }}>
                        Latest pending reschedule request
                      </p>

                      <span
                        className="small"
                        style={{
                          background: 'rgba(255,107,53,0.12)',
                          color: 'var(--accent)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        Waiting approval
                      </span>
                    </div>

                    <h3 style={{ marginTop: '0.25rem' }}>
                      {request.bookings?.customer_name || 'Customer'}
                    </h3>

                    <p className="small muted">
                      Business: {request.businesses?.name || 'Business'}
                    </p>

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
                          {request.current_start_at
                            ? new Date(request.current_start_at).toLocaleString()
                            : request.bookings?.start_at
                              ? new Date(request.bookings.start_at).toLocaleString()
                              : 'Not recorded'}
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: '0.8rem',
                          borderRadius: 'var(--radius)',
                          background: 'var(--accent-dim)',
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

                    {request.message && (
                      <p className="small muted" style={{ marginTop: '0.5rem' }}>
                        Message: {request.message}
                      </p>
                    )}

                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
                      Requested: {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <button
                      onClick={() => acceptRequest(request)}
                      disabled={isWorking}
                      className="btn btn-accent"
                    >
                      {isWorking ? 'Working...' : 'Accept new time'}
                    </button>

                    <button
                      onClick={() => declineRequest(request)}
                      disabled={isWorking}
                      className="btn btn-danger"
                    >
                      Decline request
                    </button>

                    <Link
                      href={`/dashboard/bookings?businessId=${request.business_id}`}
                      className="btn btn-ghost"
                    >
                      View bookings
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && pastRequests.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <p className="small muted">History</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>
              Previous reschedule requests
            </h2>
          </div>

          {pastRequests.map((request) => (
            <div
              key={request.id}
              className="card"
              style={{ opacity: request.status === 'cancelled' ? 0.65 : 0.85 }}
            >
              <div style={{ flex: 1, minWidth: 260 }}>
                <strong>{request.bookings?.customer_name || 'Customer'}</strong>

                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Service: {request.bookings?.services?.name || 'Service'}
                </p>

                <p className="small muted">
                  Requested time: {new Date(request.requested_start_at).toLocaleString()}
                </p>

                <p className="small muted">
                  Requested: {new Date(request.created_at).toLocaleString()}
                </p>

                <p className="small" style={{ color: statusColor(request.status) }}>
                  Status: {statusLabel(request.status)}
                </p>

                {request.response_message && (
                  <p className="small muted">
                    Response: {request.response_message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}