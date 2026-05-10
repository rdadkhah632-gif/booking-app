import { useEffect, useState } from 'react'
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

      setBookings(data || [])
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

  async function cancelBooking(id: string) {
    const confirmed = confirm('Cancel this booking? This will also show as cancelled to the customer.')
    if (!confirmed) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
  }

  async function completeBooking(id: string) {
    const confirmed = confirm('Mark this appointment as completed?')
    if (!confirmed) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
  }

  function statusLabel(status: string) {
    if (status === 'confirmed') return 'Confirmed appointment'
    if (status === 'completed') return 'Completed appointment'
    if (status === 'cancelled') return 'Cancelled booking'
    return status
  }

  function statusColor(status: string) {
    if (status === 'confirmed') return 'var(--success)'
    if (status === 'completed') return 'var(--accent)'
    if (status === 'cancelled') return 'var(--warning)'
    return 'var(--text-muted)'
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
        <div style={{ display: 'grid', gap: '1rem' }}>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="card"
              style={{
                opacity: booking.status === 'cancelled' || booking.status === 'completed' ? 0.72 : 1,
                borderColor: booking.status === 'completed'
                  ? 'rgba(255,107,53,0.28)'
                  : booking.status === 'cancelled'
                    ? 'rgba(255,190,11,0.25)'
                    : 'var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <strong>{booking.customer_name}</strong>
                    <span
                      className="small"
                      style={{
                        background: booking.status === 'completed'
                          ? 'rgba(255,107,53,0.12)'
                          : booking.status === 'cancelled'
                            ? 'rgba(255,190,11,0.12)'
                            : 'rgba(45,212,191,0.12)',
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
                    Staff: {booking.staff_members?.name || 'Any available staff'}
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
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <p className="small muted">
                      Appointment time
                    </p>
                    <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                  </div>

                  <p className="small muted">
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
                  {booking.status === 'confirmed' ? (
                    <>
                      <button onClick={() => completeBooking(booking.id)} className="btn btn-accent">
                        Mark appointment completed
                      </button>

                      <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                        Reschedule
                      </Link>

                      <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger">
                        Cancel booking
                      </button>
                    </>
                  ) : (
                    <span
                      className="small"
                      style={{ color: statusColor(booking.status) }}
                    >
                      {booking.status === 'completed'
                        ? 'Locked: completed appointment'
                        : 'Locked: cancelled booking'}
                    </span>
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