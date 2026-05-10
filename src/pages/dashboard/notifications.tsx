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

      setRequests(data || [])
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load notifications.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
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

  return (
    <DashboardLayout
      title="Notifications"
      subtitle="Review booking updates, customer reschedule requests and recent actions."
    >
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
            Customer reschedule requests will appear here.
          </p>
        </div>
      )}

      {!loading && pendingRequests.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>
            Pending requests
          </h2>

          {pendingRequests.map((request) => (
            <div key={request.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p className="small" style={{ color: 'var(--accent)' }}>
                    Latest pending reschedule request
                  </p>

                  <h3 style={{ marginTop: '0.25rem' }}>
                    {request.bookings?.customer_name || 'Customer'}
                  </h3>

                  <p className="small muted">
                    Business: {request.businesses?.name || 'Business'}
                  </p>

                  <p className="small muted">
                    Service: {request.bookings?.services?.name || 'Service'}
                  </p>

                  <p className="small muted">
                    Current time: {request.current_start_at ? new Date(request.current_start_at).toLocaleString() : 'Not recorded'}
                  </p>

                  <p className="small muted">
                    Requested time: {new Date(request.requested_start_at).toLocaleString()}
                  </p>

                  <p className="small muted">
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
                    {actionLoadingId === request.id ? 'Working...' : 'Accept'}
                  </button>

                  <button
                    onClick={() => declineRequest(request)}
                    disabled={actionLoadingId === request.id}
                    className="btn btn-danger"
                  >
                    Decline
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
          <h2 style={{ fontFamily: 'var(--font-display)' }}>
            Previous requests
          </h2>

          {pastRequests.map((request) => (
            <div
              key={request.id}
              className="card"
              style={{ opacity: 0.75 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{request.bookings?.customer_name || 'Customer'}</strong>

                  <p className="small muted">
                    Requested time: {new Date(request.requested_start_at).toLocaleString()}
                  </p>

                  <p className="small muted">
                    Requested: {new Date(request.created_at).toLocaleString()}
                  </p>

                  <p className="small muted">
                    Status: {request.status}
                  </p>

                  {request.response_message && (
                    <p className="small muted">
                      Response: {request.response_message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}