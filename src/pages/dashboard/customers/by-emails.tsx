import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import DashboardLayout from '@/components/DashboardLayout'

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
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
  services?: {
    name: string
    price?: number | null
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

export default function CustomerByEmailPage() {
  const router = useRouter()
  const { email, businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCustomerByEmail() {
    if (!email || Array.isArray(email)) return

    setPageLoading(true)
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
        .select('id, name')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (businessesError) throw businessesError

      const owned = ownedBusinesses || []
      setBusinesses(owned)

      if (owned.length === 0) {
        setBookings([])
        setSelectedBusiness(null)
        setPageLoading(false)
        return
      }

      let businessScope = owned

      if (businessId && !Array.isArray(businessId)) {
        const selected = owned.find((business) => business.id === businessId)

        if (!selected) {
          throw new Error('You do not have access to this business.')
        }

        setSelectedBusiness(selected)
        businessScope = [selected]
      } else if (owned.length === 1) {
        setSelectedBusiness(owned[0])
        businessScope = [owned[0]]
      } else {
        setSelectedBusiness(null)
      }

      const businessIds = businessScope.map((business) => business.id)

      const { data: bookingData, error: bookingError } = await supabase
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
        .ilike('customer_email', email)
        .in('business_id', businessIds)
        .order('start_at', { ascending: false })

      if (bookingError) throw bookingError

      const normalisedBookings = (bookingData || []).map((booking: any) => ({
        ...booking,
        services: Array.isArray(booking.services) ? booking.services[0] || null : booking.services,
        staff_members: Array.isArray(booking.staff_members) ? booking.staff_members[0] || null : booking.staff_members
      }))

      setBookings(normalisedBookings)
      setPageLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load customer details.')
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadCustomerByEmail()
  }, [router.isReady, email, businessId])

  const customer = useMemo(() => {
    const latest = bookings[0]

    return {
      name: latest?.customer_name || 'Customer',
      email: typeof email === 'string' ? email : latest?.customer_email || '',
      phone: latest?.customer_phone || ''
    }
  }, [bookings, email])

  const stats = useMemo(() => {
    const now = new Date()

    const upcoming = bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= now
    )

    const pending = bookings.filter((booking) => booking.status === 'pending')

    const completed = bookings.filter((booking) => booking.status === 'completed')

    const cancelled = bookings.filter((booking) => booking.status === 'cancelled')

    const history = bookings.filter((booking) =>
      booking.status === 'completed' ||
      booking.status === 'cancelled' ||
      (booking.status === 'confirmed' && new Date(booking.start_at) < now)
    )

    const estimatedCompletedValue = completed.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0)
    }, 0)

    const estimatedTotalValue = bookings.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0)
    }, 0)

    const nextAppointment = [...upcoming]
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0] || null

    const lastAppointment = [...history]
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())[0] || null

    const serviceMap = bookings.reduce<Record<string, { name: string; count: number }>>((acc, booking) => {
      const name = booking.services?.name || 'Unknown service'

      if (!acc[name]) {
        acc[name] = { name, count: 0 }
      }

      acc[name].count += 1
      return acc
    }, {})

    const favouriteService = Object.values(serviceMap)
      .sort((a, b) => b.count - a.count)[0] || null

    return {
      total: bookings.length,
      upcoming,
      pending,
      completed,
      cancelled,
      history,
      estimatedCompletedValue,
      estimatedTotalValue,
      nextAppointment,
      lastAppointment,
      favouriteService
    }
  }, [bookings])

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
    if (status === 'completed') return 'var(--success)'
    if (status === 'cancelled') return 'var(--warning)'
    return 'var(--text-muted)'
  }

  function statusBackground(status: string) {
    if (status === 'pending') return 'rgba(255,107,53,0.12)'
    if (status === 'confirmed') return 'rgba(45,212,191,0.12)'
    if (status === 'completed') return 'rgba(45,212,191,0.12)'
    if (status === 'cancelled') return 'rgba(255,190,11,0.12)'
    return 'var(--surface-2)'
  }

  function bookingTime(booking: Booking) {
    const start = new Date(booking.start_at)
    const end = booking.end_at
      ? new Date(booking.end_at)
      : new Date(start.getTime() + booking.duration_minutes * 60000)

    return `${start.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })} · ${start.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })} - ${end.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`
  }

  function renderBookingCard(booking: Booking) {
    return (
      <div key={booking.id} className="card" style={{ background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
              <strong>{booking.services?.name || 'Service not recorded'}</strong>

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

            <p className="small muted">{bookingTime(booking)}</p>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              Staff: {booking.staff_members?.name || 'Staff not recorded'}
              {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
            </p>

            <p className="small muted">
              Duration: {booking.duration_minutes} minutes · £{Number(booking.services?.price || 0).toFixed(2)}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {booking.customer_user_id && (
              <Link href={`/dashboard/customers/${booking.customer_user_id}?businessId=${booking.business_id}`} className="btn btn-ghost">
                Account profile
              </Link>
            )}

            {booking.status === 'confirmed' && new Date(booking.start_at) >= new Date() && (
              <>
                <Link href={`/reschedule-booking?id=${booking.id}`} className="btn btn-ghost">
                  Reschedule
                </Link>

                <Link href={`/dashboard/bookings?businessId=${booking.business_id}`} className="btn btn-ghost">
                  View in bookings
                </Link>
              </>
            )}

            {(booking.status === 'completed' || booking.status === 'cancelled') && (
              <span className="small" style={{ color: statusColor(booking.status) }}>
                Locked record
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout
      title="Customer details"
      subtitle={selectedBusiness ? `Customer history for ${selectedBusiness.name}` : 'Customer booking history found by email.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading customer details...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>No businesses found</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Create a business before viewing customer history.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Business setup
          </Link>
        </div>
      )}

      {!pageLoading && bookings.length === 0 && businesses.length > 0 && (
        <div className="card">
          <h3>No customer history found</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            No booking history was found for this email address in the selected business scope.
          </p>
          <Link href="/dashboard/bookings" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Back to bookings
          </Link>
        </div>
      )}

      {!pageLoading && bookings.length > 0 && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.07))',
              borderColor: 'rgba(255,107,53,0.22)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <p className="small muted">Customer profile</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  {customer.name}
                </h2>

                <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.65rem' }}>
                  <p className="small muted">Email: {customer.email || 'Not provided'}</p>
                  <p className="small muted">Phone: {customer.phone || 'Not provided'}</p>
                  <p className="small muted">Matched by: email address</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="btn btn-accent">
                    Email customer
                  </a>
                )}

                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="btn btn-ghost">
                    Call customer
                  </a>
                )}

                <Link href={selectedBusiness ? `/dashboard/bookings?businessId=${selectedBusiness.id}` : '/dashboard/bookings'} className="btn btn-ghost">
                  Back to bookings
                </Link>
              </div>
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(255,190,11,0.28)', background: 'rgba(255,190,11,0.06)' }}>
            <p className="small" style={{ color: 'var(--warning)' }}>Email-matched customer</p>
            <strong>This history is matched by email, not by account ID.</strong>
            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              If the customer later books while logged into a registered account, their account profile can be opened directly from future bookings.
            </p>
          </div>

          <div className="grid-2">
            <div className="card">
              <p className="small muted">Total bookings</p>
              <h3>{stats.total}</h3>
              <p className="muted small">All booking activity found for this email</p>
            </div>

            <div className="card">
              <p className="small muted">Upcoming</p>
              <h3>{stats.upcoming.length}</h3>
              <p className="muted small">Confirmed future appointments</p>
            </div>

            <div className="card">
              <p className="small muted">Completed value</p>
              <h3>£{stats.estimatedCompletedValue.toFixed(2)}</h3>
              <p className="muted small">Estimated from completed appointment prices</p>
            </div>

            <div className="card">
              <p className="small muted">Favourite service</p>
              <h3>{stats.favouriteService?.name || 'No clear favourite'}</h3>
              <p className="muted small">
                {stats.favouriteService
                  ? `${stats.favouriteService.count} booking${stats.favouriteService.count === 1 ? '' : 's'}`
                  : 'More bookings needed'}
              </p>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <p className="small muted">Next appointment</p>
              {stats.nextAppointment ? (
                <>
                  <h3 style={{ marginTop: '0.25rem' }}>
                    {stats.nextAppointment.services?.name || 'Service'}
                  </h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {bookingTime(stats.nextAppointment)}
                  </p>
                  <Link href={`/dashboard/bookings?businessId=${stats.nextAppointment.business_id}`} className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                    Open booking manager
                  </Link>
                </>
              ) : (
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  No upcoming confirmed appointment.
                </p>
              )}
            </div>

            <div className="card">
              <p className="small muted">Last appointment</p>
              {stats.lastAppointment ? (
                <>
                  <h3 style={{ marginTop: '0.25rem' }}>
                    {stats.lastAppointment.services?.name || 'Service'}
                  </h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {bookingTime(stats.lastAppointment)}
                  </p>
                  <p className="small" style={{ color: statusColor(stats.lastAppointment.status), marginTop: '0.45rem' }}>
                    {statusLabel(stats.lastAppointment.status)}
                  </p>
                </>
              ) : (
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  No past appointment record yet.
                </p>
              )}
            </div>
          </div>

          {stats.pending.length > 0 && (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">Needs action</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Pending requests</h2>
              </div>

              {stats.pending.map(renderBookingCard)}
            </section>
          )}

          {stats.upcoming.length > 0 && (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">Schedule</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Upcoming appointments</h2>
              </div>

              {stats.upcoming.map(renderBookingCard)}
            </section>
          )}

          {stats.history.length > 0 && (
            <section style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p className="small muted">History</p>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Past and locked bookings</h2>
              </div>

              {stats.history.map(renderBookingCard)}
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}