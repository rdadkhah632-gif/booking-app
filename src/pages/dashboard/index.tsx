import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
  published: boolean
  category?: string | null
  city?: string | null
}

type Booking = {
  id: string
  business_id: string
  customer_name: string
  start_at: string
  duration_minutes: number
  service_id?: string | null
  status: string
  businesses?: {
    name: string
  } | null
  services?: {
    id?: string
    name: string
    price?: number | null
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

type Service = {
  id: string
  business_id: string
  active: boolean
}

type StaffMember = {
  id: string
  business_id: string
  active: boolean
}

type AvailabilityRow = {
  id: string
  business_id: string
  is_closed?: boolean | null
}

export default function DashboardHome() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([])

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
      .select('id, name, published, category, city')
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
      setServices([])
      setStaffMembers([])
      setAvailabilityRows([])
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
        service_id,
        status,
        businesses ( name ),
        services ( id, name, price ),
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

    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    if (serviceError) {
      setError(serviceError.message)
      setLoading(false)
      return
    }

    setServices(serviceData || [])

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    if (staffError) {
      setError(staffError.message)
      setLoading(false)
      return
    }

    setStaffMembers(staffData || [])

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('id, business_id, is_closed')
      .in('business_id', businessIds)

    if (availabilityError) {
      setError(availabilityError.message)
      setLoading(false)
      return
    }

    setAvailabilityRows(availabilityData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadDashboard()
      }
    }

    window.addEventListener('focus', loadDashboard)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', loadDashboard)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [])

  const now = new Date()

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

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

  const dashboardAnalytics = useMemo(() => {
    const last30Days = new Date()
    last30Days.setDate(last30Days.getDate() - 30)

    const recentBookings = bookings.filter((booking) => new Date(booking.start_at) >= last30Days)
    const recentCompleted = recentBookings.filter((booking) => booking.status === 'completed')
    const recentConfirmed = recentBookings.filter((booking) => booking.status === 'confirmed')
    const recentCancelled = recentBookings.filter((booking) => booking.status === 'cancelled')

    const estimatedRevenue = recentCompleted.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0)
    }, 0)

    const estimatedUpcomingValue = recentConfirmed.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0)
    }, 0)

    const serviceCounts = recentBookings.reduce<Record<string, { name: string; count: number; value: number }>>((acc, booking) => {
      const serviceName = booking.services?.name || 'Unknown service'
      const serviceKey = booking.services?.id || booking.service_id || serviceName

      if (!acc[serviceKey]) {
        acc[serviceKey] = {
          name: serviceName,
          count: 0,
          value: 0
        }
      }

      acc[serviceKey].count += 1
      acc[serviceKey].value += Number(booking.services?.price || 0)
      return acc
    }, {})

    const topServices = Object.values(serviceCounts)
      .sort((a, b) => b.count - a.count || b.value - a.value)
      .slice(0, 3)

    const averageBookingValue = recentBookings.length > 0
      ? recentBookings.reduce((total, booking) => total + Number(booking.services?.price || 0), 0) / recentBookings.length
      : 0

    return {
      recentBookings,
      recentCompleted,
      recentConfirmed,
      recentCancelled,
      estimatedRevenue,
      estimatedUpcomingValue,
      topServices,
      averageBookingValue
    }
  }, [bookings])

  const pendingRescheduleCount = useMemo(() => {
    const uniqueBookings = new Set(
      requests
        .filter((request) => request.status === 'pending')
        .map((request) => request.booking_id)
    )

    return uniqueBookings.size
  }, [requests])

  const pendingActionCount = pendingBookings.length + pendingRescheduleCount
  const publishedCount = businesses.filter((business) => business.published).length
  const hiddenCount = businesses.length - publishedCount
  const activeServices = services.filter((service) => service.active).length
  const activeStaff = staffMembers.filter((staff) => staff.active).length
  const openWorkingDays = availabilityRows.filter((row) => row.is_closed !== true).length

  const completionRate = dashboardAnalytics.recentBookings.length > 0
    ? Math.round((dashboardAnalytics.recentCompleted.length / dashboardAnalytics.recentBookings.length) * 100)
    : 0

  const setupReadyBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      const hasServices = services.some((service) => service.business_id === business.id && service.active)
      const hasStaff = staffMembers.some((staff) => staff.business_id === business.id && staff.active)
      const hasHours = availabilityRows.some((row) => row.business_id === business.id && row.is_closed !== true)

      return hasServices && hasStaff && hasHours
    }).length
  }, [businesses, services, staffMembers, availabilityRows])

  const setupWarnings = useMemo(() => {
    const warnings: { title: string; body: string; href: string; cta: string }[] = []

    if (businesses.length === 0) {
      warnings.push({
        title: 'Create your business profile',
        body: 'You need a business profile before customers can book anything.',
        href: '/dashboard/businesses',
        cta: 'Create profile'
      })
      return warnings
    }

    if (activeServices === 0) {
      warnings.push({
        title: 'Add customer-facing services',
        body: 'Customers need at least one active service before they can book.',
        href: '/dashboard/services',
        cta: 'Add services'
      })
    }

    if (activeStaff === 0) {
      warnings.push({
        title: 'Add active staff',
        body: 'Bookings need staff members assigned to services and working hours.',
        href: '/dashboard/staff',
        cta: 'Add staff'
      })
    }

    if (openWorkingDays === 0) {
      warnings.push({
        title: 'Set working hours',
        body: 'At least one open business day is recommended before publishing.',
        href: '/dashboard/availability',
        cta: 'Set hours'
      })
    }

    if (publishedCount === 0 && businesses.length > 0) {
      warnings.push({
        title: 'Publish when ready',
        body: 'Hidden businesses do not appear in the marketplace.',
        href: '/dashboard/businesses',
        cta: 'Review profile'
      })
    }

    return warnings
  }, [businesses.length, activeServices, activeStaff, openWorkingDays, publishedCount])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p className="small muted">
          Dashboard refreshes when you return to this tab. Use refresh if a customer action does not appear straight away.
        </p>

        <button onClick={loadDashboard} className="btn btn-ghost" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh dashboard'}
        </button>

        <Link href="/dashboard/analytics" className="btn btn-accent">
          View analytics
        </Link>
      </div>

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

        <div className="card" style={{ borderColor: pendingActionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
          <p className="small muted">Action required</p>
          <h3>{pendingActionCount}</h3>
          <p className="muted small">
            {pendingBookings.length} booking approval{pendingBookings.length === 1 ? '' : 's'} · {pendingRescheduleCount} reschedule request{pendingRescheduleCount === 1 ? '' : 's'}
          </p>
          <Link href="/dashboard/notifications" className={pendingActionCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'} style={{ marginTop: '1rem' }}>
            Open notifications
          </Link>
        </div>

        <div className="card">
          <p className="small muted">Last 30 days</p>
          <h3>{dashboardAnalytics.recentBookings.length}</h3>
          <p className="muted small">Total booking activity</p>
        </div>

        <div className="card" style={{ borderColor: 'rgba(45,212,191,0.25)' }}>
          <p className="small muted">Estimated completed value</p>
          <h3>£{dashboardAnalytics.estimatedRevenue.toFixed(2)}</h3>
          <p className="muted small">Based on completed appointments in the last 30 days</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', borderColor: pendingActionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <p className="small muted">Priority queue</p>
            <h3 style={{ marginTop: '0.25rem' }}>
              {pendingActionCount > 0 ? 'You have customer actions to review' : 'No pending customer actions'}
            </h3>
            <p className="small muted" style={{ marginTop: '0.5rem' }}>
              Pending booking approvals and reschedule requests should be handled quickly so customers know where they stand.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/dashboard/notifications" className={pendingActionCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'}>
              Review notifications
            </Link>
            <Link href="/dashboard/bookings" className="btn btn-ghost">
              Appointment manager
            </Link>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <p className="small muted">Analytics preview</p>
            <h3 style={{ marginTop: '0.25rem' }}>Business performance snapshot</h3>
            <p className="small muted" style={{ marginTop: '0.45rem' }}>
              These figures are estimated from bookings and service prices. Payment revenue can replace this later when deposits/payments are added.
            </p>
          </div>

          <Link href="/dashboard/analytics" className="btn btn-accent">
            Open full analytics
          </Link>
        </div>

        <div className="grid-2">
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="small muted">Completed rate</p>
            <h3>{completionRate}%</h3>
            <p className="small muted">Completed bookings / last 30 days activity</p>
          </div>

          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="small muted">Upcoming value</p>
            <h3>£{dashboardAnalytics.estimatedUpcomingValue.toFixed(2)}</h3>
            <p className="small muted">Estimated value of confirmed upcoming appointments</p>
          </div>

          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="small muted">Average booking value</p>
            <h3>£{dashboardAnalytics.averageBookingValue.toFixed(2)}</h3>
            <p className="small muted">Average listed service price in recent booking activity</p>
          </div>

          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="small muted">Top service</p>
            <h3>{dashboardAnalytics.topServices[0]?.name || 'No data yet'}</h3>
            <p className="small muted">
              {dashboardAnalytics.topServices[0]
                ? `${dashboardAnalytics.topServices[0].count} booking${dashboardAnalytics.topServices[0].count === 1 ? '' : 's'} in recent activity`
                : 'Add bookings to see your most popular service'}
            </p>
          </div>
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

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderColor: setupReadyBusinesses === businesses.length && businesses.length > 0 ? 'rgba(45,212,191,0.25)' : 'rgba(255,190,11,0.25)' }}>
          <p className="small muted">Setup readiness</p>
          <h3>{setupReadyBusinesses}/{businesses.length}</h3>
          <p className="muted small">Businesses with active services, staff and working hours</p>
        </div>

        <div className="card">
          <p className="small muted">Services</p>
          <h3>{activeServices}</h3>
          <p className="muted small">Active customer-facing services</p>
        </div>

        <div className="card">
          <p className="small muted">Staff</p>
          <h3>{activeStaff}</h3>
          <p className="muted small">Active staff members</p>
        </div>

        <div className="card">
          <p className="small muted">Open days</p>
          <h3>{openWorkingDays}</h3>
          <p className="muted small">Business working days configured</p>
        </div>
      </div>

      {setupWarnings.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <p className="small muted">Setup guidance</p>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>Recommended next steps</h2>
          </div>

          {setupWarnings.map((warning) => (
            <div key={warning.title} className="card" style={{ borderColor: 'rgba(255,190,11,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <strong>{warning.title}</strong>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>{warning.body}</p>
                </div>

                <Link href={warning.href} className="btn btn-accent">
                  {warning.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

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

          <Link href="/dashboard/analytics" className="btn btn-ghost">
            Analytics
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

          <Link href="/dashboard/notifications" className="btn btn-ghost">
            Notifications
          </Link>

          <Link href="/explore" className="btn btn-ghost">
            Preview marketplace
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}