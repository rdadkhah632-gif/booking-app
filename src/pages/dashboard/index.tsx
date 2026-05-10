import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
  published: boolean
}

type Booking = {
  id: string
  business_id: string
  customer_name: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: {
    name: string
  } | null
  services?: {
    name: string
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

type BookingRequest = {
  id: string
  booking_id: string
  business_id: string
  status: string
  created_at: string
}

export default function DashboardHome() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [requests, setRequests] = useState<BookingRequest[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setError(null)

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

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, published')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (businessError) {
      setError(businessError.message)
      setLoading(false)
      return
    }

    const ownedBusinesses = businessData || []
    setBusinesses(ownedBusinesses)

    const businessIds = ownedBusinesses.map((business) => business.id)

    if (businessIds.length === 0) {
      setBookings([])
      setRequests([])
      setLoading(false)
      return
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        business_id,
        customer_name,
        start_at,
        duration_minutes,
        status,
        businesses ( name ),
        services ( name ),
        staff_members ( name, role_title )
      `)
      .in('business_id', businessIds)
      .order('start_at', { ascending: true })

    if (bookingError) {
      setError(bookingError.message)
      setLoading(false)
      return
    }

    const normalisedBookings = (bookingData || []).map((booking: any) => ({
      ...booking,
      businesses: Array.isArray(booking.businesses) ? booking.businesses[0] || null : booking.businesses,
      services: Array.isArray(booking.services) ? booking.services[0] || null : booking.services,
      staff_members: Array.isArray(booking.staff_members) ? booking.staff_members[0] || null : booking.staff_members
    }))

    setBookings(normalisedBookings)

    const { data: requestData, error: requestError } = await supabase
      .from('booking_requests')
      .select('id, booking_id, business_id, status, created_at')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })

    if (requestError) {
      setError(requestError.message)
      setLoading(false)
      return
    }

    setRequests(requestData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const now = new Date()

  const todayBookings = useMemo(() => {
    const today = new Date()

    return bookings.filter((booking) => {
      const date = new Date(booking.start_at)
      return (
        booking.status === 'confirmed' &&
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      )
    })
  }, [bookings])

  const nextBooking = useMemo(() => {
    return bookings.find((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= now
    )
  }, [bookings])

  const upcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= now
    )
  }, [bookings])

  const completedBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'completed')
  }, [bookings])

  const cancelledBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'cancelled')
  }, [bookings])

  const pendingRequestCount = useMemo(() => {
    const uniqueBookings = new Set(
      requests
        .filter((request) => request.status === 'pending')
        .map((request) => request.booking_id)
    )

    return uniqueBookings.size
  }, [requests])

  const publishedCount = businesses.filter((business) => business.published).length
  const hiddenCount = businesses.length - publishedCount

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <p className="muted">Checking your account...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Business overview"
      subtitle="See what needs attention today, then jump into bookings, setup and customer requests."
    >
      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {businesses.length === 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>Create your first business</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Add a business profile, then create services, staff and working hours before publishing it to customers.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Create business profile
          </Link>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <p className="small muted">Today</p>
          <h3>{todayBookings.length}</h3>
          <p className="muted small">Confirmed bookings today</p>
        </div>

        <div className="card" style={{ borderColor: pendingRequestCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
          <p className="small muted">Action required</p>
          <h3>{pendingRequestCount}</h3>
          <p className="muted small">Pending customer requests</p>
          <Link href="/dashboard/notifications" className={pendingRequestCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'} style={{ marginTop: '1rem' }}>
            Open notifications
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p className="small muted">Next appointment</p>
            {nextBooking ? (
              <>
                <h3 style={{ marginTop: '0.25rem' }}>{nextBooking.customer_name}</h3>
                <p className="small muted">
                  {new Date(nextBooking.start_at).toLocaleString()}
                </p>
                <p className="small muted">
                  {nextBooking.businesses?.name || 'Business'} · {nextBooking.services?.name || 'Service'}
                </p>
                <p className="small muted">
                  Staff: {nextBooking.staff_members?.name || 'Staff not recorded'}
                  {nextBooking.staff_members?.role_title ? ` — ${nextBooking.staff_members.role_title}` : ''}
                </p>
              </>
            ) : (
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                No upcoming confirmed appointments found.
              </p>
            )}
          </div>

          <Link href="/dashboard/bookings" className="btn btn-accent">
            View bookings
          </Link>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <p className="small muted">Upcoming</p>
          <h3>{upcomingBookings.length}</h3>
          <p className="muted small">Confirmed future bookings</p>
        </div>

        <div className="card">
          <p className="small muted">Completed</p>
          <h3>{completedBookings.length}</h3>
          <p className="muted small">Appointments marked completed</p>
        </div>

        <div className="card">
          <p className="small muted">Cancelled</p>
          <h3>{cancelledBookings.length}</h3>
          <p className="muted small">Cancelled bookings</p>
        </div>

        <div className="card">
          <p className="small muted">Businesses</p>
          <h3>{publishedCount}/{businesses.length}</h3>
          <p className="muted small">
            Published businesses{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="small muted">Setup shortcuts</p>
        <h3 style={{ marginTop: '0.25rem' }}>Manage your business setup</h3>
        <p className="muted small" style={{ marginTop: '0.5rem' }}>
          Keep your profile, services, staff and hours up to date so customers can book confidently.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Link href="/dashboard/businesses" className="btn btn-accent">
            Business profile
          </Link>

          <Link href="/dashboard/services" className="btn btn-ghost">
            Services
          </Link>

          <Link href="/dashboard/staff" className="btn btn-ghost">
            Staff
          </Link>

          <Link href="/dashboard/availability" className="btn btn-ghost">
            Working hours
          </Link>

          <Link href="/explore" className="btn btn-ghost">
            Preview marketplace
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}