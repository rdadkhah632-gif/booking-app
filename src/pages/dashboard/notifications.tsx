import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type RelatedBusiness = {
  name: string
}

type RelatedService = {
  name: string
  price?: number | null
}

type RelatedStaff = {
  name: string
  role_title?: string | null
}

type RequestBooking = {
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  start_at?: string | null
  duration_minutes?: number | null
  status?: string | null
  services?: RelatedService | RelatedService[] | null
  staff_members?: RelatedStaff | RelatedStaff[] | null
}

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
  bookings?: RequestBooking | RequestBooking[] | null
  businesses?: RelatedBusiness | RelatedBusiness[] | null
  requested_staff?: RelatedStaff | RelatedStaff[] | null
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
  businesses?: RelatedBusiness | RelatedBusiness[] | null
  services?: RelatedService | RelatedService[] | null
  staff_members?: RelatedStaff | RelatedStaff[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function requestBooking(request: BookingRequest) {
  return firstRelation(request.bookings)
}

function businessName(value?: Booking | BookingRequest | RequestBooking | null) {
  if (!value) return 'Business'

  if ('businesses' in value) {
    return firstRelation(value.businesses)?.name || 'Business'
  }

  return 'Business'
}

function serviceName(value?: Booking | RequestBooking | null) {
  if (!value) return 'Service'
  return firstRelation(value.services)?.name || 'Service'
}

function staffName(value?: Booking | RequestBooking | null) {
  if (!value) return 'Staff not recorded'

  const staff = firstRelation(value.staff_members)
  if (!staff) return 'Staff not recorded'

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`
}

function requestedStaffName(request: BookingRequest) {
  const staff = firstRelation(request.requested_staff)
  if (!staff) return 'Staff not recorded'

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`
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
        router.replace('/login?redirectTo=/dashboard/notifications')
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

      setBookings(normalisedBookings as Booking[])

      const { data: requestData, error: requestError } = await supabase
        .from('booking_requests')
        .select(`
          id,
          booking_id,
          business_id,
          customer_user_id,
          requested_by,
          request_type,
          status,
          current_start_at,
          requested_start_at,
          current_staff_member_id,
          requested_staff_member_id,
          requested_duration_minutes,
          message,
          response_message,
          created_at,
          updated_at,
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

      setRequests(normalisedRequests as BookingRequest[])
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
      .in('business_id', businessIds)

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
      .in('business_id', businessIds)

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
      .in('business_id', businessIds)

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
      .in('business_id', businessIds)

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
      .in('business_id', businessIds)

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
      .in('business_id', businessIds)

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
      title="Needs action"
      subtitle="Review Mirëbook booking approvals, customer reschedule requests and actions that need your attention."
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <p className="small" style={{ color: banner.tone === 'success' ? 'var(--success)' : 'var(--warning)' }}>
                {banner.title}
              </p>
              <strong>{banner.body}</strong>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => router.replace('/dashboard/notifications', undefined, { shallow: true })}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="business-notification-toolbar">
        <p className="small muted">
          Mirëbook refreshes this page when you return to the tab. Use refresh if a new request does not appear straight away.
        </p>

        <div className="business-notification-toolbar-actions">
          <button onClick={loadNotifications} className="btn btn-ghost" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh notifications'}
          </button>

          <Link href="/dashboard/bookings?view=upcoming&status=pending" className="btn btn-accent">
            Pending bookings
          </Link>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
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

        <div className="card" style={{ borderColor: actionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
          <p className="small muted">Total action required</p>
          <h3>{actionCount}</h3>
          <p className="muted small">Items needing business review</p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Loading Mirëbook notifications...</p>
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

          <Link href="/dashboard/bookings?view=today" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
            Open today’s bookings
          </Link>
        </div>
      )}

      {!loading && pendingBookings.length > 0 && (
        <div className="business-notification-section">
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
                <div className="business-notification-card-row">
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
                      Business: {businessName(booking)}
                    </p>

                    <p className="small muted">
                      Service: {serviceName(booking)}
                    </p>

                    <p className="small muted">
                      Staff: {staffName(booking)}
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

                  <div className="business-notification-card-actions">
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
                      href={`/dashboard/bookings?businessId=${booking.business_id}&view=upcoming&status=pending`}
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
        <div className="business-notification-section">
          <div>
            <p className="small muted">Action required</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>
              Pending reschedule requests
            </h2>
          </div>

          {pendingRequests.map((request) => {
            const isWorking = actionLoadingId === `request-${request.id}`
            const linkedBooking = requestBooking(request)

            return (
              <div key={request.id} className="card">
                <div className="business-notification-card-row">
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
                      {linkedBooking?.customer_name || 'Customer'}
                    </h3>

                    <p className="small muted">
                      Business: {businessName(request)}
                    </p>

                    <p className="small muted">
                      Service: {serviceName(linkedBooking)}
                    </p>

                    <div className="business-notification-time-grid">
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
                            : linkedBooking?.start_at
                              ? new Date(linkedBooking.start_at).toLocaleString()
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
                      Requested staff: {requestedStaffName(request)}
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

                  <div className="business-notification-card-actions">
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
                      href={`/dashboard/bookings?businessId=${request.business_id}&view=upcoming`}
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
        <div className="business-notification-section">
          <div>
            <p className="small muted">History</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>
              Previous reschedule requests
            </h2>
          </div>

          {pastRequests.map((request) => {
            const linkedBooking = requestBooking(request)

            return (
              <div
                key={request.id}
                className="card"
                style={{ opacity: request.status === 'cancelled' ? 0.65 : 0.85 }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  <strong>{linkedBooking?.customer_name || 'Customer'}</strong>

                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Service: {serviceName(linkedBooking)}
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
            )
          })}
        </div>
      )}

      <style jsx>{`
        .business-notification-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .business-notification-toolbar-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .business-notification-section {
          display: grid;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .business-notification-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .business-notification-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: flex-end;
        }

        .business-notification-time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .business-notification-toolbar-actions,
          .business-notification-card-actions {
            width: 100%;
            justify-content: stretch;
          }

          .business-notification-toolbar-actions :global(.btn),
          .business-notification-toolbar-actions button,
          .business-notification-toolbar-actions a,
          .business-notification-card-actions :global(.btn),
          .business-notification-card-actions button,
          .business-notification-card-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}