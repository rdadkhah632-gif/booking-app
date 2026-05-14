import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

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
  start_at?: string | null
  duration_minutes?: number | null
  status?: string | null
  businesses?: RelatedBusiness | RelatedBusiness[] | null
  services?: RelatedService | RelatedService[] | null
  staff_members?: RelatedStaff | RelatedStaff[] | null
}

type BookingRequest = {
  id: string
  booking_id: string
  status: string
  requested_start_at: string
  requested_duration_minutes: number
  response_message?: string | null
  created_at: string
  updated_at?: string | null
  bookings?: RequestBooking | RequestBooking[] | null
  requested_staff?: RelatedStaff | RelatedStaff[] | null
}

type Booking = {
  id: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: RelatedBusiness | RelatedBusiness[] | null
  services?: RelatedService | RelatedService[] | null
  staff_members?: RelatedStaff | RelatedStaff[] | null
}

type NotificationRow = {
  id: string
  user_id?: string | null
  business_id?: string | null
  booking_id?: string | null
  booking_request_id?: string | null
  audience: string
  type: string
  title: string
  message?: string | null
  action_url?: string | null
  read_at?: string | null
  created_at?: string | null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function requestBooking(request: BookingRequest) {
  return firstRelation(request.bookings)
}

function bookingBusinessName(booking?: Booking | RequestBooking | null) {
  if (!booking) return 'Business'
  return firstRelation(booking.businesses)?.name || 'Business'
}

function bookingServiceName(booking?: Booking | RequestBooking | null) {
  if (!booking) return 'Service'
  return firstRelation(booking.services)?.name || 'Service'
}

function bookingStaffName(booking?: Booking | RequestBooking | null) {
  if (!booking) return 'Staff not recorded'

  const staff = firstRelation(booking.staff_members)
  if (!staff) return 'Staff not recorded'

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`
}

function requestedStaffName(request: BookingRequest) {
  const staff = firstRelation(request.requested_staff)
  if (!staff) return 'Staff not recorded'

  return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`
}

export default function CustomerNotifications() {
  const router = useRouter()

  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [markingRead, setMarkingRead] = useState(false)
  const [email, setEmail] = useState('')
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

      setEmail(session.user.email || '')

    
const { data: notificationData, error: notificationError } = await supabase
  .from('notifications')
  .select('id, user_id, business_id, booking_id, booking_request_id, audience, type, title, message, action_url, read_at, created_at')
  .eq('user_id', session.user.id)
  .order('created_at', { ascending: false })
  .limit(30)

if (notificationError) throw notificationError

setNotifications((notificationData || []) as NotificationRow[])

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

      if (requestError) throw requestError

      const normalisedRequests = (requestData || []).map((request: any) => ({
        ...request,
        requested_staff: Array.isArray(request.requested_staff)
          ? request.requested_staff[0] || null
          : request.requested_staff,
        bookings: Array.isArray(request.bookings)
          ? request.bookings[0] || null
          : request.bookings
      }))

      setRequests(normalisedRequests as BookingRequest[])

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
        .order('start_at', { ascending: false })

      if (bookingError) throw bookingError

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

      setBookings(normalisedBookings as Booking[])
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

  function statusLabel(status: string, type?: 'booking' | 'reschedule') {
    if (status === 'pending') return type === 'booking' ? 'Booking waiting approval' : 'Waiting for business approval'
    if (status === 'accepted') return 'Reschedule accepted'
    if (status === 'declined') return 'Reschedule declined'
    if (status === 'cancelled') return type === 'booking' ? 'Booking cancelled / not accepted' : 'Superseded / replaced'
    if (status === 'completed') return 'Appointment completed'
    if (status === 'confirmed') return 'Confirmed appointment'
    return status
  }

  function statusColor(status: string) {
    if (status === 'pending') return 'var(--accent)'
    if (status === 'accepted') return 'var(--success)'
    if (status === 'confirmed') return 'var(--success)'
    if (status === 'declined') return 'var(--warning)'
    if (status === 'cancelled') return 'var(--warning)'
    if (status === 'completed') return 'var(--accent)'
    return 'var(--text-muted)'
  }

  function statusBackground(status: string) {
    if (status === 'pending') return 'rgba(255,107,53,0.12)'
    if (status === 'accepted') return 'rgba(45,212,191,0.12)'
    if (status === 'confirmed') return 'rgba(45,212,191,0.12)'
    if (status === 'declined') return 'rgba(255,190,11,0.12)'
    if (status === 'cancelled') return 'rgba(255,190,11,0.12)'
    if (status === 'completed') return 'rgba(255,107,53,0.12)'
    return 'var(--surface-2)'
  }

  async function markAllNotificationsRead() {
    const unreadNotificationRows = notifications.filter((notification) => !notification.read_at)
    if (unreadNotificationRows.length === 0) return

    setMarkingRead(true)
    setError(null)

    const readAt = new Date().toISOString()

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .in('id', unreadNotificationRows.map((notification) => notification.id))

    setMarkingRead(false)

    if (error) {
      setError(error.message)
      return
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || readAt
      }))
    )
  }

  async function markNotificationRead(notification: NotificationRow) {
    if (notification.read_at) return

    const readAt = new Date().toISOString()

    setNotifications((current) =>
      current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item)
    )

    await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', notification.id)
  }

  function notificationTone(notification: NotificationRow) {
    if (notification.type.includes('confirmed') || notification.type.includes('accepted')) return 'success'
    if (notification.type.includes('declined') || notification.type.includes('cancelled')) return 'warning'
    if (notification.type.includes('requested') || notification.type.includes('approval')) return 'accent'
    return 'muted'
  }

  function notificationBorder(notification: NotificationRow) {
    const tone = notificationTone(notification)
    if (tone === 'success') return 'rgba(45,212,191,0.28)'
    if (tone === 'warning') return 'rgba(255,190,11,0.28)'
    if (tone === 'accent') return 'rgba(255,107,53,0.28)'
    return 'var(--border)'
  }

  function notificationBackground(notification: NotificationRow) {
    if (notification.read_at) return 'var(--surface)'
    const tone = notificationTone(notification)
    if (tone === 'success') return 'rgba(45,212,191,0.06)'
    if (tone === 'warning') return 'rgba(255,190,11,0.06)'
    if (tone === 'accent') return 'rgba(255,107,53,0.06)'
    return 'var(--surface)'
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

  const pendingBookingRequests = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

  const resolvedBookingUpdates = useMemo(() => {
    return bookings
      .filter((booking) => booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'cancelled')
      .slice(0, 12)
  }, [bookings])

  const pendingRescheduleRequests = latestRequestsByBooking.filter((request) => request.status === 'pending')
  const resolvedRescheduleRequests = latestRequestsByBooking.filter((request) => request.status !== 'pending')

  const actionCount = pendingBookingRequests.length + pendingRescheduleRequests.length
  const historyCount = resolvedBookingUpdates.length + resolvedRescheduleRequests.length
  const unreadCount = notifications.filter((notification) => !notification.read_at).length
const recentNotifications = notifications.slice(0, 12)

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '36px 24px 70px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="small muted">Mirëbook customer notifications</p>

          <h1 className="page-title">
            Customer notifications
          </h1>

          <p className="page-sub" style={{ marginTop: '0.5rem' }}>
            {email
              ? `Signed in as ${email}`
              : 'Track booking approvals, reschedule decisions and appointment updates.'}
          </p>

          <div className="customer-notification-actions">
            <Link href="/my-bookings" className="btn btn-accent">
              My bookings
            </Link>

            <button onClick={loadNotifications} className="btn btn-ghost" disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh notifications'}
            </button>

            <Link href="/explore" className="btn btn-ghost">
              Explore Mirëbook
            </Link>

            <button onClick={markAllNotificationsRead} className="btn btn-ghost" disabled={markingRead || unreadCount === 0}>
              {markingRead ? 'Marking read...' : unreadCount > 0 ? `Mark ${unreadCount} read` : 'All read'}
            </button>
          </div>

          <p className="small muted" style={{ marginTop: '0.75rem' }}>
            Mirëbook refreshes this page when you return to the tab. Use refresh if a recent booking update does not appear straight away.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ borderColor: actionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
            <p className="small muted">Waiting approval</p>
            <h3>{actionCount}</h3>
            <p className="muted small">Booking and reschedule requests waiting for business action</p>
          </div>

          <div className="card">
            <p className="small muted">History</p>
            <h3>{historyCount}</h3>
            <p className="muted small">Resolved requests and booking updates</p>
          </div>

          <div className="card" style={{ borderColor: unreadCount > 0 ? 'rgba(45,212,191,0.28)' : 'var(--border)' }}>
            <p className="small muted">Unread</p>
            <h3>{unreadCount}</h3>
            <p className="muted small">Unread Mirëbook notification updates</p>
          </div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">Loading Mirëbook notifications...</p>
          </div>
        )}

        {!loading && actionCount === 0 && historyCount === 0 && recentNotifications.length === 0 && (
          <div className="card">
            <h3>No notifications yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Booking approvals, reschedule decisions and completed appointments will appear here when businesses update your appointments.
            </p>

            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Explore Mirëbook
            </Link>
          </div>
        )}

        {!loading && recentNotifications.length > 0 && (
          <div className="customer-notification-section">
            <div>
              <p className="small muted">Notification inbox</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Recent Mirëbook updates
              </h2>
              <p className="muted small" style={{ marginTop: '0.35rem' }}>
                These are real notification records created by booking and reschedule activity.
              </p>
            </div>

            {recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className="card"
                style={{
                  borderColor: notificationBorder(notification),
                  background: notificationBackground(notification)
                }}
              >
                <div className="customer-notification-card-row">
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <strong>{notification.title}</strong>

                      <span
                        className="small"
                        style={{
                          background: notification.read_at ? 'var(--surface-2)' : 'var(--accent-dim)',
                          color: notification.read_at ? 'var(--text-muted)' : 'var(--accent)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999,
                          border: '1px solid var(--border)'
                        }}
                      >
                        {notification.read_at ? 'Read' : 'Unread'}
                      </span>
                    </div>

                    {notification.message && (
                      <p className="small muted">{notification.message}</p>
                    )}

                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
                      {notification.created_at ? new Date(notification.created_at).toLocaleString() : 'Recently'}
                    </p>
                  </div>

                  <div className="customer-notification-card-actions">
                    {notification.action_url && (
                      <Link
                        href={notification.action_url}
                        className="btn btn-accent"
                        onClick={() => markNotificationRead(notification)}
                      >
                        Open
                      </Link>
                    )}

                    {!notification.read_at && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => markNotificationRead(notification)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && pendingBookingRequests.length > 0 && (
          <div className="customer-notification-section">
            <div>
              <p className="small muted">Action status</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Booking requests waiting approval
              </h2>
              <p className="muted small" style={{ marginTop: '0.35rem' }}>
                These appointments are not confirmed yet. The business needs to accept or decline them.
              </p>
            </div>

            {pendingBookingRequests.map((booking) => (
              <div
                key={booking.id}
                className="card"
                style={{
                  borderColor: 'rgba(255,107,53,0.35)',
                  background: 'var(--accent-dim)'
                }}
              >
                <div className="customer-notification-card-row">
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <strong>{bookingBusinessName(booking)}</strong>

                      <span
                        className="small"
                        style={{
                          background: statusBackground(booking.status),
                          color: statusColor(booking.status),
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        {statusLabel(booking.status, 'booking')}
                      </span>
                    </div>

                    <p className="small muted">
                      Service: {bookingServiceName(booking)}
                    </p>

                    <p className="small muted">
                      Staff: {bookingStaffName(booking)}
                    </p>

                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.8rem',
                        borderRadius: 'var(--radius)',
                        background: 'rgba(255,107,53,0.10)',
                        border: '1px solid rgba(255,107,53,0.35)'
                      }}
                    >
                      <p className="small muted">Requested appointment time</p>
                      <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                      <p className="small muted" style={{ marginTop: '0.3rem' }}>
                        This time is reserved while waiting for business approval.
                      </p>
                    </div>
                  </div>

                  <div className="customer-notification-card-actions">
                    <Link href="/my-bookings" className="btn btn-accent">
                      View booking
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && pendingRescheduleRequests.length > 0 && (
          <div className="customer-notification-section">
            <div>
              <p className="small muted">Action status</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Reschedule requests waiting approval
              </h2>
            </div>

            {pendingRescheduleRequests.map((request) => {
              const linkedBooking = requestBooking(request)

              return (
                <div
                  key={request.id}
                  className="card"
                  style={{
                    borderColor: 'rgba(255,107,53,0.35)',
                    background: 'var(--accent-dim)'
                  }}
                >
                  <div className="customer-notification-card-row">
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <strong>{bookingBusinessName(linkedBooking)}</strong>

                        <span
                          className="small"
                          style={{
                            background: statusBackground(request.status),
                            color: statusColor(request.status),
                            padding: '0.2rem 0.55rem',
                            borderRadius: 999
                          }}
                        >
                          {statusLabel(request.status, 'reschedule')}
                        </span>
                      </div>

                      <p className="small muted">
                        Service: {bookingServiceName(linkedBooking)}
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
                            {linkedBooking?.start_at
                              ? new Date(linkedBooking.start_at).toLocaleString()
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
                        Requested staff: {requestedStaffName(request)}
                      </p>

                      <p className="small muted">
                        Requested duration: {request.requested_duration_minutes} minutes
                      </p>

                      <p className="small muted" style={{ marginTop: '0.5rem' }}>
                        Your original booking remains confirmed until the business accepts this request.
                      </p>
                    </div>

                    <div className="customer-notification-card-actions">
                      <Link href="/my-bookings" className="btn btn-accent">
                        View booking
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && resolvedRescheduleRequests.length > 0 && (
          <div className="customer-notification-section">
            <div>
              <p className="small muted">Request history</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Reschedule updates
              </h2>
            </div>

            {resolvedRescheduleRequests.map((request) => {
              const linkedBooking = requestBooking(request)

              return (
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
                  <div className="customer-notification-card-row">
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <strong>{bookingBusinessName(linkedBooking)}</strong>

                        <span
                          className="small"
                          style={{
                            background: statusBackground(request.status),
                            color: statusColor(request.status),
                            padding: '0.2rem 0.55rem',
                            borderRadius: 999
                          }}
                        >
                          {statusLabel(request.status, 'reschedule')}
                        </span>
                      </div>

                      <p className="small muted">
                        Service: {bookingServiceName(linkedBooking)}
                      </p>

                      <p className="small muted">
                        Requested time: {new Date(request.requested_start_at).toLocaleString()}
                      </p>

                      <p className="small muted">
                        Requested staff: {requestedStaffName(request)}
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
              )
            })}
          </div>
        )}

        {!loading && resolvedBookingUpdates.length > 0 && (
          <div className="customer-notification-section">
            <div>
              <p className="small muted">Booking history</p>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Booking updates
              </h2>
            </div>

            {resolvedBookingUpdates.map((booking) => (
              <div
                key={booking.id}
                className="card"
                style={{
                  opacity: booking.status === 'cancelled' ? 0.7 : 1,
                  borderColor: booking.status === 'confirmed'
                    ? 'rgba(45,212,191,0.28)'
                    : booking.status === 'completed'
                      ? 'rgba(255,107,53,0.28)'
                      : booking.status === 'cancelled'
                        ? 'rgba(255,190,11,0.28)'
                        : 'var(--border)'
                }}
              >
                <div className="customer-notification-card-row">
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <strong>{bookingBusinessName(booking)}</strong>

                      <span
                        className="small"
                        style={{
                          background: statusBackground(booking.status),
                          color: statusColor(booking.status),
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        {statusLabel(booking.status, 'booking')}
                      </span>
                    </div>

                    <p className="small muted">
                      Service: {bookingServiceName(booking)}
                    </p>

                    <p className="small muted">
                      Staff: {bookingStaffName(booking)}
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

      <style jsx>{`
        .customer-notification-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .customer-notification-section {
          display: grid;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .customer-notification-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .customer-notification-card-actions {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .customer-notification-actions :global(.btn),
          .customer-notification-actions button,
          .customer-notification-actions a,
          .customer-notification-card-actions :global(.btn),
          .customer-notification-card-actions button,
          .customer-notification-card-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}