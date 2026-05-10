import { useEffect, useState } from 'react'
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
  bookings?: {
    customer_name: string
    customer_email?: string | null
    customer_phone?: string | null
    services?: {
      name: string
      price: number
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

export default function BusinessNotifications() {
  const router = useRouter()

  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadRequests() {
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

      const businessIds = (ownedBusinesses || []).map((business) => business.id)

      if (businessIds.length === 0) {
        setRequests([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('booking_requests')
        .select(`
          *,
          bookings (
            customer_name,
            customer_email,
            customer_phone,
            services (
              name,
              price
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
        .in('business_id', businessIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const normalisedRequests = (data || []).map((request: any) => ({
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
    loadRequests()
  }, [])

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadRequests()
      }
    }

    window.addEventListener('focus', loadRequests)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', loadRequests)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [])

  async function acceptRequest(request: BookingRequest) {
    const confirmed = confirm('Accept this reschedule request? The booking will be updated to the requested time.')
    if (!confirmed) return

    setActionLoadingId(request.id)
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

    await loadRequests()
    router.replace('/dashboard/notifications?action=accepted', undefined, { shallow: true })
  }

  async function declineRequest(request: BookingRequest) {
    const responseMessage = prompt('Optional message to customer:', 'Sorry, that time is not available.')
    if (responseMessage === null) return

    setActionLoadingId(request.id)
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

    await loadRequests()
    router.replace('/dashboard/notifications?action=declined', undefined, { shallow: true })
  }

  const pendingRequests = Object.values(
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

  const latestPendingIds = new Set(pendingRequests.map((request) => request.id))

  const pastRequests = requests.filter(
    (request) => request.status !== 'pending' || !latestPendingIds.has(request.id)
  )

  function statusLabel(status: string) {
    if (status === 'accepted') return 'Accepted'
    if (status === 'declined') return 'Declined'
    if (status === 'cancelled') return 'Superseded / cancelled'
    return status
  }

  function statusColor(status: string) {
    if (status === 'accepted') return 'var(--success)'
    if (status === 'declined') return 'var(--warning)'
    if (status === 'cancelled') return 'var(--text-muted)'
    return 'var(--accent)'
  }

  return (
    <DashboardLayout
      title="Notifications"
      subtitle="Review customer reschedule requests and booking updates that need your attention."
    >
      {router.query.action === 'accepted' && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(45,212,191,0.28)',
            background: 'rgba(45,212,191,0.06)',
            marginBottom: '1rem'
          }}
        >
          <p className="small" style={{ color: 'var(--success)' }}>Request accepted</p>
          <strong>The booking has been updated to the customer’s requested time.</strong>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            The request has moved into history and any older pending requests for the same booking have been cancelled.
          </p>
        </div>
      )}

      {router.query.action === 'declined' && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(255,190,11,0.28)',
            background: 'rgba(255,190,11,0.06)',
            marginBottom: '1rem'
          }}
        >
          <p className="small" style={{ color: 'var(--warning)' }}>Request declined</p>
          <strong>The customer’s requested time was declined.</strong>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            The original booking remains unchanged.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p className="small muted">
          Notifications refresh when you return to this tab. Use refresh if a new request does not appear straight away.
        </p>

        <button onClick={loadRequests} className="btn btn-ghost" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh notifications'}
        </button>
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

      {!loading && pendingRequests.length === 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>No pending requests</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Customer reschedule requests will appear here when they need approval. If a customer has just sent a request, use refresh or return to this tab to update the list.
          </p>
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

          {pendingRequests.map((request) => (
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
                        {request.current_start_at ? new Date(request.current_start_at).toLocaleString() : 'Not recorded'}
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
                    disabled={actionLoadingId === request.id}
                    className="btn btn-accent"
                  >
                    {actionLoadingId === request.id ? 'Working...' : 'Accept new time'}
                  </button>

                  <button
                    onClick={() => declineRequest(request)}
                    disabled={actionLoadingId === request.id}
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
          ))}
        </div>
      )}

      {!loading && pastRequests.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <p className="small muted">History</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>
              Previous requests
            </h2>
          </div>

          {pastRequests.map((request) => (
            <div
              key={request.id}
              className="card"
              style={{ opacity: 0.75 }}
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