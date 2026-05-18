import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type RangeFilter = 'today' | 'tomorrow' | 'week' | 'upcoming' | 'history' | 'custom'

type Business = {
  id: string
  name: string
}

type Booking = {
  id: string
  business_id: string
  customer_user_id?: string | null
  customer_name: string
  customer_email?: string | null
  customer_phone?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
  created_at?: string | null
  services?: {
    name: string
    price: number
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function startOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export default function Bookings() {
  const router = useRouter()
  const { businessId, date, status, view } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])

  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('today')
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()))
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [pageLoading, setPageLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function buildBookingsQuery(next?: {
    nextBusinessId?: string
    nextFilter?: RangeFilter
    nextDate?: string
    nextStatus?: string
  }) {
    const query: Record<string, string> = {}
    const effectiveBusinessId = next?.nextBusinessId || business?.id || (typeof businessId === 'string' ? businessId : '')
    const effectiveFilter = next?.nextFilter || rangeFilter
    const effectiveDate = next?.nextDate || selectedDate
    const effectiveStatus = next?.nextStatus ?? statusFilter

    if (effectiveBusinessId) query.businessId = effectiveBusinessId

    if (effectiveFilter === 'custom') {
      query.date = effectiveDate
    } else {
      query.view = effectiveFilter
    }

    if (effectiveStatus !== 'all') query.status = effectiveStatus

    return query
  }

  function replaceBookingsQuery(next?: {
    nextBusinessId?: string
    nextFilter?: RangeFilter
    nextDate?: string
    nextStatus?: string
  }) {
    router.replace(
      {
        pathname: '/dashboard/bookings',
        query: buildBookingsQuery(next)
      },
      undefined,
      { shallow: true }
    )
  }

  function updateBookingView(nextFilter: RangeFilter, nextDate?: string) {
    const effectiveDate = nextDate || selectedDate
    setSelectedDate(effectiveDate)
    setRangeFilter(nextFilter)

    replaceBookingsQuery({
      nextFilter,
      nextDate: effectiveDate
    })
  }

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', sessionUserId)
      .order('created_at', { ascending: false })

    if (businessesError) throw businessesError

    const owned = ownedBusinesses || []
    setBusinesses(owned)

    if (owned.length === 0) return null

    if (businessId && !Array.isArray(businessId)) {
      const selected = owned.find((item) => item.id === businessId)

      if (!selected) {
        throw new Error('You do not have access to this business.')
      }

      return selected
    }

    if (owned.length === 1) return owned[0]

    return null
  }

  async function loadBookings(options?: { keepSuccess?: boolean }) {
    setError(null)
    if (!options?.keepSuccess) setSuccess(null)
    setPageLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const selectedBusiness = await getBusinessContext(session.user.id)

      if (!selectedBusiness) {
        setBusiness(null)
        setBookings([])
        setPageLoading(false)
        return
      }

      setBusiness(selectedBusiness)

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          business_id,
          customer_user_id,
          customer_name,
          customer_email,
          customer_phone,
          customer_notes,
          internal_notes,
          start_at,
          end_at,
          duration_minutes,
          status,
          created_at,
          services (
            name,
            price
          ),
          staff_members (
            name,
            role_title
          )
        `)
        .eq('business_id', selectedBusiness.id)
        .order('start_at', { ascending: true })

      if (error) throw error

      const normalisedBookings = (data || []).map((booking: any) => ({
        ...booking,
        services: Array.isArray(booking.services) ? booking.services[0] || null : booking.services,
        staff_members: Array.isArray(booking.staff_members) ? booking.staff_members[0] || null : booking.staff_members
      }))

      setBookings(normalisedBookings)
      setPageLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load bookings.')
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadBookings()
  }, [router.isReady, businessId])

  useEffect(() => {
    if (!router.isReady) return

    function refreshOnFocus() {
      loadBookings()
    }

    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadBookings()
      }
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [router.isReady, businessId])

  useEffect(() => {
    if (!router.isReady) return

    const validViews: RangeFilter[] = ['today', 'tomorrow', 'week', 'upcoming', 'history', 'custom']
    const validStatuses = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSelectedDate(date)
      setRangeFilter('custom')
      return
    }

    if (typeof view === 'string' && validViews.includes(view as RangeFilter)) {
      setRangeFilter(view as RangeFilter)
    }

    if (typeof status === 'string' && validStatuses.includes(status)) {
      setStatusFilter(status)
    } else if (typeof status === 'undefined') {
      setStatusFilter('all')
    }
  }, [router.isReady, date, status, view])

  async function createCustomerNotification(params: {
    booking: Booking
    type: string
    title: string
    message: string
    actionUrl: string
  }) {
    if (!params.booking.customer_user_id) return

    await supabase.from('notifications').insert({
      user_id: params.booking.customer_user_id,
      business_id: params.booking.business_id,
      booking_id: params.booking.id,
      audience: 'customer',
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl
    })
  }

  function updateLocalBookingStatus(bookingId: string, nextStatus: string) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status: nextStatus } : booking
      )
    )
  }

  function serviceName(booking: Booking) {
    return booking.services?.name || 'your appointment'
  }

  function appointmentDateTime(booking: Booking) {
    return new Date(booking.start_at).toLocaleString()
  }

  async function acceptPendingBooking(booking: Booking) {
    const confirmed = confirm('Accept this booking request and confirm the appointment?')
    if (!confirmed) return

    setActionLoadingId(booking.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id)
      .eq('business_id', booking.business_id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalBookingStatus(booking.id, 'confirmed')

    await createCustomerNotification({
      booking,
      type: 'booking_confirmed',
      title: 'Booking accepted',
      message: `Your booking for ${serviceName(booking)} has been accepted and confirmed for ${appointmentDateTime(booking)}.`,
      actionUrl: `/booking-confirmation?id=${booking.id}`
    })

    setSuccess('Booking accepted. The customer has been notified and the appointment is now confirmed.')
    await loadBookings({ keepSuccess: true })
  }

  async function declinePendingBooking(booking: Booking) {
    const confirmed = confirm('Decline this booking request? The customer will see it as cancelled/not accepted.')
    if (!confirmed) return

    setActionLoadingId(booking.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)
      .eq('business_id', booking.business_id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalBookingStatus(booking.id, 'cancelled')

    await createCustomerNotification({
      booking,
      type: 'booking_declined',
      title: 'Booking declined',
      message: `Your booking request for ${serviceName(booking)} on ${appointmentDateTime(booking)} was declined.`,
      actionUrl: '/my-bookings'
    })

    setSuccess('Booking declined. The customer has been notified and the request is no longer pending.')
    await loadBookings({ keepSuccess: true })
  }

  async function cancelBooking(booking: Booking) {
    const confirmed = confirm('Cancel this booking? This will also show as cancelled to the customer.')
    if (!confirmed) return

    setActionLoadingId(booking.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)
      .eq('business_id', booking.business_id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalBookingStatus(booking.id, 'cancelled')

    await createCustomerNotification({
      booking,
      type: 'booking_cancelled',
      title: 'Booking cancelled',
      message: `Your booking for ${serviceName(booking)} on ${appointmentDateTime(booking)} was cancelled by the business.`,
      actionUrl: '/my-bookings'
    })

    setSuccess('Booking cancelled. The customer has been notified and the booking is now locked as cancelled.')
    await loadBookings({ keepSuccess: true })
  }

  async function completeBooking(booking: Booking) {
    const confirmed = confirm('Mark this appointment as completed?')
    if (!confirmed) return

    setActionLoadingId(booking.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', booking.id)
      .eq('business_id', booking.business_id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalBookingStatus(booking.id, 'completed')

    await createCustomerNotification({
      booking,
      type: 'booking_completed',
      title: 'Appointment completed',
      message: `Your appointment for ${serviceName(booking)} on ${appointmentDateTime(booking)} has been marked as completed.`,
      actionUrl: '/my-bookings'
    })

    setSuccess('Booking marked as completed. The customer has been notified and the booking is now locked in history.')
    await loadBookings({ keepSuccess: true })
  }

  function statusLabel(value: string) {
    if (value === 'pending') return 'Pending approval'
    if (value === 'confirmed') return 'Confirmed appointment'
    if (value === 'completed') return 'Completed appointment'
    if (value === 'cancelled') return 'Cancelled booking'
    return value
  }

  function statusColor(value: string) {
    if (value === 'pending') return 'var(--accent)'
    if (value === 'confirmed') return 'var(--success)'
    if (value === 'completed') return 'var(--success)'
    if (value === 'cancelled') return 'var(--warning)'
    return 'var(--text-muted)'
  }

  function statusBackground(value: string) {
    if (value === 'pending') return 'rgba(255,107,53,0.12)'
    if (value === 'confirmed') return 'rgba(45,212,191,0.12)'
    if (value === 'completed') return 'rgba(45,212,191,0.12)'
    if (value === 'cancelled') return 'rgba(255,190,11,0.12)'
    return 'var(--surface-2)'
  }

  function dateRangeForFilter(filter: RangeFilter) {
    const today = startOfDay(new Date())

    if (filter === 'today') {
      return { start: today, end: endOfDay(today), label: 'Today' }
    }

    if (filter === 'tomorrow') {
      const tomorrow = addDays(today, 1)
      return { start: tomorrow, end: endOfDay(tomorrow), label: 'Tomorrow' }
    }

    if (filter === 'week') {
      return { start: today, end: endOfDay(addDays(today, 6)), label: 'Next 7 days' }
    }

    if (filter === 'custom') {
      const selected = new Date(`${selectedDate}T12:00:00`)
      return { start: startOfDay(selected), end: endOfDay(selected), label: selected.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) }
    }

    return { start: null, end: null, label: filter === 'history' ? 'History' : 'All upcoming' }
  }

  const now = new Date()

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

  const todayBookings = useMemo(() => {
    const range = dateRangeForFilter('today')
    if (!range.start || !range.end) return []

    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.start_at)
      return bookingDate >= range.start! && bookingDate <= range.end!
    })
  }, [bookings])

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= now
    )
  }, [bookings, now])

  const historicalBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'cancelled' ||
      booking.status === 'completed' ||
      (booking.status === 'confirmed' && new Date(booking.start_at) < now)
    )
  }, [bookings, now])

  const filteredBookings = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const range = dateRangeForFilter(rangeFilter)

    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.start_at)

      const matchesStatus = statusFilter === 'all' ? true : booking.status === statusFilter
      const matchesSearch = !search
        ? true
        : [
            booking.customer_name,
            booking.customer_email,
            booking.customer_phone,
            booking.services?.name,
            booking.staff_members?.name
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search)

      let matchesRange = true

      if (rangeFilter === 'history') {
        matchesRange = booking.status === 'cancelled' || booking.status === 'completed' || (booking.status === 'confirmed' && bookingDate < now)
      } else if (rangeFilter === 'upcoming') {
        matchesRange = booking.status === 'pending' || (booking.status === 'confirmed' && bookingDate >= now)
      } else if (range.start && range.end) {
        matchesRange = bookingDate >= range.start && bookingDate <= range.end
      }

      return matchesStatus && matchesSearch && matchesRange
    })
  }, [bookings, rangeFilter, selectedDate, statusFilter, searchTerm, now])

  const groupedFilteredBookings = useMemo(() => {
    const groups = filteredBookings.reduce<Record<string, Booking[]>>((acc, booking) => {
      const key = new Date(booking.start_at).toISOString().slice(0, 10)
      if (!acc[key]) acc[key] = []
      acc[key].push(booking)
      return acc
    }, {})

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (rangeFilter === 'history') return b.localeCompare(a)
        return a.localeCompare(b)
      })
      .map(([dateKey, rows]) => ({
        dateKey,
        label: new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
        bookings: rows.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      }))
  }, [filteredBookings, rangeFilter])

  const selectedRange = dateRangeForFilter(rangeFilter)

  const activeFilterSummary = [
    selectedRange.label,
    statusFilter === 'all' ? 'All statuses' : statusLabel(statusFilter),
    searchTerm.trim() ? `Search: ${searchTerm.trim()}` : ''
  ].filter(Boolean).join(' · ')

  function customerHistoryLink(booking: Booking) {
    if (booking.customer_user_id) {
      return `/dashboard/customers/${booking.customer_user_id}?businessId=${business?.id || booking.business_id}`
    }

    return `/dashboard/customers/by-email?email=${encodeURIComponent(booking.customer_email || '')}&businessId=${business?.id || booking.business_id}`
  }

  function renderBookingCard(booking: Booking) {
    const isLocked = booking.status === 'cancelled' || booking.status === 'completed'
    const isWorking = actionLoadingId === booking.id
    const start = new Date(booking.start_at)
    const end = booking.end_at ? new Date(booking.end_at) : new Date(start.getTime() + booking.duration_minutes * 60000)

    return (
      <div
        key={booking.id}
        className="card booking-manager-card"
        style={{
          opacity: isLocked ? 0.78 : 1,
          borderColor: booking.status === 'pending'
            ? 'rgba(255,107,53,0.35)'
            : booking.status === 'completed'
              ? 'rgba(45,212,191,0.22)'
              : booking.status === 'cancelled'
                ? 'rgba(255,190,11,0.25)'
                : 'var(--border)'
        }}
      >
        <div className="booking-manager-card-inner">
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="booking-card-heading-row">
              <Link href={customerHistoryLink(booking)} style={{ color: 'var(--text)', fontWeight: 800 }}>
                {booking.customer_name || 'Customer'}
              </Link>

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
              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {booking.duration_minutes} minutes
            </p>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              Service: {booking.services?.name || 'No service recorded'} · £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
            </p>

            <p className="small muted">
              Staff: {booking.staff_members?.name || 'Staff not recorded'}
              {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
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
                {booking.status === 'pending' ? 'Requested appointment time' : 'Appointment time'}
              </p>
              <strong>{start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              {booking.status === 'pending' && (
                <p className="small muted" style={{ marginTop: '0.3rem' }}>
                  This time is reserved while waiting for your approval.
                </p>
              )}
            </div>

            {(booking.customer_notes || booking.internal_notes) && (
              <div className="booking-note-box">
                {booking.customer_notes && (
                  <>
                    <p className="small muted">Customer note</p>
                    <p className="small" style={{ marginTop: '0.25rem' }}>{booking.customer_notes}</p>
                  </>
                )}

                {booking.internal_notes && (
                  <>
                    <p className="small muted" style={{ marginTop: booking.customer_notes ? '0.75rem' : 0 }}>Internal note</p>
                    <p className="small" style={{ marginTop: '0.25rem' }}>{booking.internal_notes}</p>
                  </>
                )}
              </div>
            )}

            <div className="booking-contact-actions">
              <Link href={customerHistoryLink(booking)} className="btn btn-ghost">
                Customer details
              </Link>

              {booking.customer_email && (
                <a href={`mailto:${booking.customer_email}`} className="btn btn-ghost">
                  Email
                </a>
              )}

              {booking.customer_phone && (
                <a href={`tel:${booking.customer_phone}`} className="btn btn-ghost">
                  Call
                </a>
              )}
            </div>
          </div>

          <div className="booking-manager-actions">
            {booking.status === 'pending' && (
              <>
                <button onClick={() => acceptPendingBooking(booking)} className="btn btn-accent" disabled={isWorking}>
                  {isWorking ? 'Working...' : 'Accept booking'}
                </button>

                <button onClick={() => declinePendingBooking(booking)} className="btn btn-danger" disabled={isWorking}>
                  Decline booking
                </button>
              </>
            )}

            {booking.status === 'confirmed' && !isLocked && (
              <>
                <button onClick={() => completeBooking(booking)} className="btn btn-accent" disabled={isWorking}>
                  {isWorking ? 'Working...' : 'Mark completed'}
                </button>

                <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                  Reschedule
                </Link>

                <button onClick={() => cancelBooking(booking)} className="btn btn-danger" disabled={isWorking}>
                  Cancel
                </button>
              </>
            )}

            {isLocked && booking.status !== 'pending' && (
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
                  {booking.status === 'completed' ? 'Locked completed record' : 'Locked cancelled record'}
                </p>
                <p className="small muted" style={{ marginTop: '0.3rem' }}>
                  This booking can no longer be changed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout
      title="Bookings"
      subtitle={business ? `Manage Mirëbook bookings for ${business.name}` : 'Choose which business bookings to view.'}
    >
      <div className="booking-top-toolbar">
        <p className="small muted">
          Use the date, status and search filters to manage appointments, approvals and booking history as the business grows.
        </p>

        <div className="booking-top-toolbar-actions">
          <button onClick={() => loadBookings()} className="btn btn-ghost" disabled={pageLoading}>
            {pageLoading ? 'Refreshing...' : 'Refresh bookings'}
          </button>

          <Link href="/dashboard/notifications" className="btn btn-ghost">
            Needs action
          </Link>

          <Link href="/support/business" className="btn btn-ghost">
            Business support
          </Link>
        </div>
      </div>

      {success && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(45,212,191,0.28)',
            background: 'rgba(45,212,191,0.06)',
            marginBottom: '1rem'
          }}
        >
          <div className="booking-success-row">
            <div>
              <p className="small" style={{ color: 'var(--success)' }}>Action completed</p>
              <strong>{success}</strong>
            </div>

            <button type="button" className="btn btn-ghost" onClick={() => setSuccess(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {pageLoading && (
        <div className="card">
          <p className="muted">Loading bookings...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>No business found</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Create a business profile first, then customer bookings will appear here.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Create business
          </Link>
        </div>
      )}

      {!pageLoading && !business && businesses.length > 1 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="card">
            <p className="small muted">Multiple businesses found</p>
            <h3 style={{ marginTop: '0.25rem' }}>Choose a business to continue</h3>
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              Select one business to view its bookings.
            </p>
          </div>

          {businesses.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/bookings?businessId=${item.id}&view=today`}
              className="card business-select-card"
            >
              <div>
                <strong>{item.name}</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  View bookings for this business.
                </p>
              </div>

              <span className="btn btn-accent">
                View bookings
              </span>
            </Link>
          ))}
        </div>
      )}

      {!pageLoading && business && bookings.length === 0 && (
        <div className="card">
          <h3>No bookings yet</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Customer bookings for this business will appear here once your public page is published and customers start booking.
          </p>

          <div className="booking-empty-actions">
            <Link href="/dashboard/businesses" className="btn btn-ghost">
              Check setup
            </Link>

            <Link href={business ? `/explore/${business.id}` : '/explore'} className="btn btn-ghost">
              View public page
            </Link>

            <Link href="/support/business" className="btn btn-ghost">
              Business support
            </Link>
          </div>
        </div>
      )}

      {!pageLoading && business && bookings.length > 0 && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="grid-2">
            <button type="button" className="card booking-summary-button" onClick={() => {
              setStatusFilter('pending')
              updateBookingView('upcoming')
              replaceBookingsQuery({ nextFilter: 'upcoming', nextStatus: 'pending' })
            }} style={{ borderColor: pendingBookings.length > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
              <p className="small muted">Needs approval</p>
              <h3>{pendingBookings.length}</h3>
              <p className="muted small">Pending booking requests</p>
            </button>

            <button type="button" className="card booking-summary-button" onClick={() => updateBookingView('today')}>
              <p className="small muted">Today</p>
              <h3>{todayBookings.length}</h3>
              <p className="muted small">Appointments and requests today</p>
            </button>

            <button type="button" className="card booking-summary-button" onClick={() => {
              setStatusFilter('confirmed')
              updateBookingView('upcoming')
              replaceBookingsQuery({ nextFilter: 'upcoming', nextStatus: 'confirmed' })
            }}>
              <p className="small muted">Upcoming confirmed</p>
              <h3>{confirmedUpcomingBookings.length}</h3>
              <p className="muted small">Confirmed future appointments</p>
            </button>

            <button type="button" className="card booking-summary-button" onClick={() => updateBookingView('history')}>
              <p className="small muted">History</p>
              <h3>{historicalBookings.length}</h3>
              <p className="muted small">Completed, cancelled or past appointments</p>
            </button>

            <div className="card" style={{ borderColor: filteredBookings.length > 0 ? 'rgba(45,212,191,0.22)' : 'var(--border)' }}>
              <p className="small muted">Current view</p>
              <h3>{filteredBookings.length}</h3>
              <p className="muted small">Bookings matching the filters</p>
            </div>
          </div>

          <div className="card">
            <div className="booking-calendar-header">
              <div>
                <p className="small muted">Calendar view</p>
                <h3>{selectedRange.label}</h3>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Start with today, jump to a specific date, or open a filtered Mirëbook view from the dashboard calendar.
                </p>
              </div>

              <Link href="/dashboard/analytics" className="btn btn-ghost">
                View analytics
              </Link>
            </div>

            <div className="booking-filter-button-row">
              {[
                { key: 'today', label: 'Today' },
                { key: 'tomorrow', label: 'Tomorrow' },
                { key: 'week', label: 'Next 7 days' },
                { key: 'upcoming', label: 'All upcoming' },
                { key: 'history', label: 'History' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => updateBookingView(item.key as RangeFilter)}
                  className={rangeFilter === item.key ? 'btn btn-accent' : 'btn btn-ghost'}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="booking-filter-grid">
              <label className="small muted">
                Jump to date
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => updateBookingView('custom', e.target.value)}
                  style={{ marginTop: '0.35rem' }}
                />
              </label>

              <label className="small muted">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const nextStatus = e.target.value
                    setStatusFilter(nextStatus)
                    replaceBookingsQuery({ nextStatus })
                  }}
                  style={{ marginTop: '0.35rem', width: '100%' }}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending approval</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label className="small muted">
                Search customer/service/staff
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search bookings"
                  style={{ marginTop: '0.35rem' }}
                />
              </label>
            </div>

            <div className="booking-active-filter-bar">
              <div>
                <p className="small muted">Active view</p>
                <strong>{activeFilterSummary}</strong>
              </div>

              {(statusFilter !== 'all' || searchTerm.trim() || rangeFilter !== 'today') && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    updateBookingView('today')
                    replaceBookingsQuery({ nextFilter: 'today', nextStatus: 'all' })
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {filteredBookings.length === 0 && (
            <div className="card">
              <h3>No bookings in this view</h3>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Try another date, status or search term. If this came from the dashboard schedule preview, the selected date is already applied through the URL.
              </p>
            </div>
          )}

          {groupedFilteredBookings.map((group) => (
            <section key={group.dateKey} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">{group.bookings.length} booking{group.bookings.length === 1 ? '' : 's'}</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>{group.label}</h2>
              </div>

              {group.bookings.map((booking) => renderBookingCard(booking))}
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        .booking-top-toolbar,
        .booking-success-row,
        .booking-calendar-header,
        .business-select-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .booking-top-toolbar-actions,
        .booking-empty-actions,
        .booking-filter-button-row,
        .booking-contact-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .booking-empty-actions {
          margin-top: 1rem;
        }

        .booking-filter-button-row {
          margin-bottom: 1rem;
        }

        .booking-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
        }

        .booking-summary-button {
          width: 100%;
          text-align: left;
          color: var(--text);
          cursor: pointer;
        }

        .booking-summary-button:hover {
          border-color: rgba(255,107,53,0.35);
          transform: translateY(-1px);
        }

        .booking-active-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-top: 1rem;
          padding: 0.9rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        .booking-manager-card-inner {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .booking-card-heading-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 0.35rem;
        }

        .booking-note-box {
          margin-top: 0.75rem;
          padding: 0.8rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        .booking-contact-actions {
          margin-top: 0.7rem;
        }

        .booking-manager-actions {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 700px) {
          .booking-top-toolbar,
          .booking-success-row,
          .booking-calendar-header,
          .business-select-card,
          .booking-manager-card-inner,
          .booking-active-filter-bar {
            display: grid;
          }

          .booking-top-toolbar-actions,
          .booking-empty-actions,
          .booking-filter-button-row,
          .booking-contact-actions,
          .booking-manager-actions {
            justify-content: stretch;
          }

          .booking-top-toolbar-actions :global(.btn),
          .booking-top-toolbar-actions button,
          .booking-top-toolbar-actions a,
          .booking-empty-actions :global(.btn),
          .booking-empty-actions a,
          .booking-filter-button-row :global(.btn),
          .booking-filter-button-row button,
          .booking-contact-actions :global(.btn),
          .booking-contact-actions a,
          .booking-manager-actions :global(.btn),
          .booking-manager-actions button,
          .booking-manager-actions a,
          .booking-success-row :global(.btn),
          .booking-success-row button,
          .booking-calendar-header :global(.btn),
          .booking-calendar-header a,
          .business-select-card :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}