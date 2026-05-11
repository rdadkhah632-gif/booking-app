import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
}

type Booking = {
  id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_at: string
  end_at?: string
  duration_minutes: number
  status: string
  services?: {
    name: string
    price: number
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

export default function Bookings() {
  const router = useRouter()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])

  const [pageLoading, setPageLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      const selected = owned.find((b) => b.id === businessId)

      if (!selected) {
        throw new Error('You do not have access to this business.')
      }

      return selected
    }

    if (owned.length === 1) return owned[0]

    return null
  }

  async function loadBookings() {
    setError(null)
    setPageLoading(true)

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
          *,
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
  }, [router.isReady, businessId])

  async function acceptPendingBooking(id: string) {
    const confirmed = confirm('Accept this booking request and confirm the appointment?')
    if (!confirmed) return

    setActionLoadingId(id)
    setError(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
    router.replace(
      business ? `/dashboard/bookings?businessId=${business.id}&action=accepted` : '/dashboard/bookings?action=accepted',
      undefined,
      { shallow: true }
    )
  }

  async function declinePendingBooking(id: string) {
    const confirmed = confirm('Decline this booking request? The customer will see it as cancelled/not accepted.')
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
    router.replace(
      business ? `/dashboard/bookings?businessId=${business.id}&action=declined` : '/dashboard/bookings?action=declined',
      undefined,
      { shallow: true }
    )
  }

  async function cancelBooking(id: string) {
    const confirmed = confirm('Cancel this booking? This will also show as cancelled to the customer.')
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

  async function completeBooking(id: string) {
    const confirmed = confirm('Mark this appointment as completed?')
    if (!confirmed) return

    setActionLoadingId(id)
    setError(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
  }

  function statusLabel(status: string) {
    if (status === 'pending') return 'Pending approval'
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

  const now = new Date()

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= now
    )
  }, [bookings])

  const historicalBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'cancelled' ||
      booking.status === 'completed' ||
      (booking.status === 'confirmed' && new Date(booking.start_at) < now)
    )
  }, [bookings])

  function renderBookingCard(booking: Booking, mode: 'pending' | 'confirmed' | 'history') {
    const isLocked = booking.status === 'cancelled' || booking.status === 'completed' || mode === 'history'
    const isWorking = actionLoadingId === booking.id

    return (
      <div
        key={booking.id}
        className="card"
        style={{
          opacity: isLocked ? 0.76 : 1,
          borderColor: booking.status === 'pending'
            ? 'rgba(255,107,53,0.35)'
            : booking.status === 'completed'
              ? 'rgba(255,107,53,0.28)'
              : booking.status === 'cancelled'
                ? 'rgba(255,190,11,0.25)'
                : 'var(--border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <strong>{booking.customer_name || 'Customer'}</strong>
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
              Service: {booking.services?.name || 'No service recorded'}
            </p>

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
                {booking.status === 'pending' ? 'Requested appointment time' : 'Appointment time'}
              </p>
              <strong>{new Date(booking.start_at).toLocaleString()}</strong>
              {booking.status === 'pending' && (
                <p className="small muted" style={{ marginTop: '0.3rem' }}>
                  This time is reserved while waiting for your approval.
                </p>
              )}
            </div>

            <p className="small muted" style={{ marginTop: '0.6rem' }}>
              Duration: {booking.duration_minutes} minutes
            </p>

            <p className="small muted">
              Email: {booking.customer_email || 'Not provided'}
            </p>

            <p className="small muted">
              Phone: {booking.customer_phone || 'Not provided'}
            </p>

            <p
              className="small"
              style={{ color: statusColor(booking.status), marginTop: '0.5rem' }}
            >
              Status: {statusLabel(booking.status)}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {booking.status === 'pending' && (
              <>
                <button onClick={() => acceptPendingBooking(booking.id)} className="btn btn-accent" disabled={isWorking}>
                  {isWorking ? 'Working...' : 'Accept booking'}
                </button>

                <button onClick={() => declinePendingBooking(booking.id)} className="btn btn-danger" disabled={isWorking}>
                  Decline booking
                </button>
              </>
            )}

            {booking.status === 'confirmed' && mode !== 'history' && (
              <>
                <button onClick={() => completeBooking(booking.id)} className="btn btn-accent" disabled={isWorking}>
                  {isWorking ? 'Working...' : 'Mark appointment completed'}
                </button>

                <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                  Reschedule
                </Link>

                <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger" disabled={isWorking}>
                  Cancel booking
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
    <DashboardLayout
      title="Bookings"
      subtitle={business ? `Viewing bookings for ${business.name}` : 'Choose which business bookings to view.'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p className="small muted">
          Bookings refresh when you return to this tab. Use refresh if a new booking does not appear straight away.
        </p>

        <button onClick={loadBookings} className="btn btn-ghost" disabled={pageLoading}>
          {pageLoading ? 'Refreshing...' : 'Refresh bookings'}
        </button>
      </div>

      {router.query.action === 'accepted' && (
        <div className="card" style={{ borderColor: 'rgba(45,212,191,0.28)', background: 'rgba(45,212,191,0.06)', marginBottom: '1rem' }}>
          <p className="small" style={{ color: 'var(--success)' }}>Booking accepted</p>
          <strong>The booking request has been confirmed.</strong>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            The appointment now appears as a confirmed booking for the customer.
          </p>
        </div>
      )}

      {router.query.action === 'declined' && (
        <div className="card" style={{ borderColor: 'rgba(255,190,11,0.28)', background: 'rgba(255,190,11,0.06)', marginBottom: '1rem' }}>
          <p className="small" style={{ color: 'var(--warning)' }}>Booking declined</p>
          <strong>The booking request has been declined.</strong>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            The customer will see this request as cancelled/not accepted.
          </p>
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
          <div style={{ padding: '0.25rem 0 0.5rem' }}>
            <p className="small muted" style={{ marginBottom: '0.35rem' }}>
              Multiple businesses found
            </p>
            <h3 style={{ marginBottom: '0.35rem' }}>
              Choose a business to continue
            </h3>
            <p className="muted">
              Select one of the business cards below. The next page will show bookings for that specific business.
            </p>
          </div>

          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/bookings?businessId=${b.id}`}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div>
                <strong>{b.name}</strong>
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
            Customer bookings for this business will appear here.
          </p>
        </div>
      )}

      {!pageLoading && business && bookings.length > 0 && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="grid-2">
            <div className="card" style={{ borderColor: pendingBookings.length > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
              <p className="small muted">Needs approval</p>
              <h3>{pendingBookings.length}</h3>
              <p className="muted small">Pending booking requests</p>
            </div>

            <div className="card">
              <p className="small muted">Upcoming confirmed</p>
              <h3>{confirmedUpcomingBookings.length}</h3>
              <p className="muted small">Confirmed future appointments</p>
            </div>
          </div>

          {pendingBookings.length > 0 && (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">Action required</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Pending booking approvals</h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  These customers requested a booking while manual approval is enabled. Accepting confirms the appointment.
                </p>
              </div>

              {pendingBookings.map((booking) => renderBookingCard(booking, 'pending'))}
            </section>
          )}

          {confirmedUpcomingBookings.length > 0 && (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">Schedule</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Upcoming confirmed appointments</h2>
              </div>

              {confirmedUpcomingBookings.map((booking) => renderBookingCard(booking, 'confirmed'))}
            </section>
          )}

          {historicalBookings.length > 0 && (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">History</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Completed / cancelled / past appointments</h2>
              </div>

              {historicalBookings.map((booking) => renderBookingCard(booking, 'history'))}
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}