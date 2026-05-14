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
  created_at?: string
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

type ScheduleDay = {
  date: Date
  dateString: string
  label: string
  shortLabel: string
  bookings: Booking[]
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
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => formatDateValue(new Date()))

  function formatDateValue(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
        created_at,
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
  const primaryBusinessId = businesses[0]?.id
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
        body: 'You need a business profile before customers can book through Mirëbook.',
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

  const scheduleDays = useMemo<ScheduleDay[]>(() => {
    const today = startOfDay(new Date())

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index)
      const dateString = formatDateValue(date)

      const dayBookings = bookings
        .filter((booking) => {
          const bookingDate = new Date(booking.start_at)
          return booking.status === 'confirmed' && bookingDate >= startOfDay(date) && bookingDate <= endOfDay(date)
        })
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

      return {
        date,
        dateString,
        label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'short' }),
        shortLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        bookings: dayBookings
      }
    })
  }, [bookings])

  const selectedScheduleDay = useMemo(() => {
    const existing = scheduleDays.find((day) => day.dateString === selectedScheduleDate)

    if (existing) return existing

    const selected = new Date(`${selectedScheduleDate}T12:00:00`)

    const dayBookings = bookings
      .filter((booking) => {
        const bookingDate = new Date(booking.start_at)
        return booking.status === 'confirmed' && bookingDate >= startOfDay(selected) && bookingDate <= endOfDay(selected)
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

    return {
      date: selected,
      dateString: selectedScheduleDate,
      label: selected.toLocaleDateString(undefined, { weekday: 'long' }),
      shortLabel: selected.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      bookings: dayBookings
    }
  }, [scheduleDays, selectedScheduleDate, bookings])

  function bookingsLinkForDate(dateString: string, businessId?: string) {
    return `/dashboard/bookings?${new URLSearchParams({
      ...(businessId || primaryBusinessId ? { businessId: businessId || primaryBusinessId } : {}),
      date: dateString
    }).toString()}`
  }

  function bookingsLinkForView(view: string, status?: string, businessId?: string) {
    return `/dashboard/bookings?${new URLSearchParams({
      ...(businessId || primaryBusinessId ? { businessId: businessId || primaryBusinessId } : {}),
      view,
      ...(status ? { status } : {})
    }).toString()}`
  }

  function bookingTimeLabel(booking: Booking) {
    const start = new Date(booking.start_at)
    const end = new Date(start.getTime() + booking.duration_minutes * 60000)

    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

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
      subtitle="See today’s Mirëbook activity, customer actions, schedule previews and business performance in one place."
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p className="small muted">
          Mirëbook refreshes this dashboard when you return to the tab. Use refresh if a customer action does not appear straight away.
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
            Add a business profile, then create services, staff and working hours before publishing it to Mirëbook customers.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Create business profile
          </Link>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Link href={bookingsLinkForView('today')} className="card dashboard-summary-card">
          <p className="small muted">Today</p>
          <h3>{todayBookings.length}</h3>
          <p className="muted small">Confirmed bookings today</p>
        </Link>

        <div className="card dashboard-summary-card" style={{ borderColor: pendingActionCount > 0 ? 'rgba(255,107,53,0.35)' : 'var(--border)' }}>
          <p className="small muted">Action required</p>
          <h3>{pendingActionCount}</h3>
          <p className="muted small">
            {pendingBookings.length} booking approval{pendingBookings.length === 1 ? '' : 's'} · {pendingRescheduleCount} reschedule request{pendingRescheduleCount === 1 ? '' : 's'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link href="/dashboard/notifications" className={pendingActionCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'}>
              Open notifications
            </Link>
            <Link href={bookingsLinkForView('upcoming', 'pending')} className="btn btn-ghost">
              Pending bookings
            </Link>
          </div>
        </div>

        <Link href="/dashboard/analytics" className="card dashboard-summary-card">
          <p className="small muted">Last 30 days</p>
          <h3>{dashboardAnalytics.recentBookings.length}</h3>
          <p className="muted small">Total booking activity</p>
        </Link>

        <Link href="/dashboard/analytics" className="card dashboard-summary-card" style={{ borderColor: 'rgba(45,212,191,0.25)' }}>
          <p className="small muted">Estimated completed value</p>
          <h3>£{dashboardAnalytics.estimatedRevenue.toFixed(2)}</h3>
          <p className="muted small">Based on completed appointments in the last 30 days</p>
        </Link>
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
            <Link href={bookingsLinkForView('upcoming')} className="btn btn-ghost">
              Booking manager
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
              These figures are estimated from Mirëbook bookings and service prices. Payment revenue can replace this later when deposits/payments are added.
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <p className="small muted">Schedule preview</p>
            <h3 style={{ marginTop: '0.25rem' }}>Upcoming calendar</h3>
            <p className="small muted" style={{ marginTop: '0.45rem' }}>
              Pick a day to preview confirmed appointments, then open the booking manager already filtered to that exact date.
            </p>
          </div>

          <div className="dashboard-schedule-controls">
            <input
              type="date"
              value={selectedScheduleDate}
              onChange={(e) => setSelectedScheduleDate(e.target.value)}
              style={{ minWidth: 180 }}
            />

            <Link href={bookingsLinkForDate(selectedScheduleDate)} className="btn btn-accent">
              Open selected day
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {scheduleDays.map((day) => {
            const isSelected = selectedScheduleDate === day.dateString

            return (
              <button
                key={day.dateString}
                type="button"
                onClick={() => setSelectedScheduleDate(day.dateString)}
                style={{
                  textAlign: 'left',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius)',
                  border: isSelected ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                  color: 'var(--text)'
                }}
              >
                <strong>{day.label}</strong>
                <p className="small muted" style={{ marginTop: '0.2rem' }}>{day.shortLabel}</p>
                <p className="small" style={{ color: day.bookings.length > 0 ? 'var(--accent)' : 'var(--text-muted)', marginTop: '0.45rem' }}>
                  {day.bookings.length} booking{day.bookings.length === 1 ? '' : 's'}
                </p>
              </button>
            )
          })}
        </div>

        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: selectedScheduleDay.bookings.length > 0 ? '1rem' : 0 }}>
            <div>
              <p className="small muted">Selected day</p>
              <h3 style={{ marginTop: '0.25rem' }}>
                {selectedScheduleDay.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
            </div>

            <Link href={bookingsLinkForDate(selectedScheduleDay.dateString, selectedScheduleDay.bookings[0]?.business_id)} className="btn btn-ghost">
              View filtered day
            </Link>
          </div>

          {selectedScheduleDay.bookings.length === 0 && (
            <div>
              <p className="muted">No confirmed appointments found for this day.</p>
              <Link href={bookingsLinkForDate(selectedScheduleDay.dateString)} className="btn btn-ghost" style={{ marginTop: '0.75rem' }}>
                Open this date in bookings
              </Link>
            </div>
          )}

          {selectedScheduleDay.bookings.length > 0 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {selectedScheduleDay.bookings.slice(0, 5).map((booking) => (
                <Link
                  key={booking.id}
                  href={bookingsLinkForDate(selectedScheduleDay.dateString, booking.business_id)}
                  className="card"
                  style={{ background: 'var(--surface)', padding: '0.9rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{bookingTimeLabel(booking)} · {booking.customer_name}</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        {booking.businesses?.name || 'Business'} · {booking.services?.name || 'Service'}
                      </p>
                    </div>

                    <p className="small muted">
                      {booking.staff_members?.name || 'Staff not recorded'}
                    </p>
                  </div>
                </Link>
              ))}

              {selectedScheduleDay.bookings.length > 5 && (
                <Link href={bookingsLinkForDate(selectedScheduleDay.dateString, selectedScheduleDay.bookings[0]?.business_id)} className="btn btn-ghost">
                  View all {selectedScheduleDay.bookings.length} bookings
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Link href={bookingsLinkForView('upcoming', 'confirmed')} className="card dashboard-summary-card">
          <p className="small muted">Upcoming</p>
          <h3>{upcomingBookings.length}</h3>
          <p className="muted small">Confirmed future bookings</p>
        </Link>

        <Link href={bookingsLinkForView('history', 'completed')} className="card dashboard-summary-card">
          <p className="small muted">Completed</p>
          <h3>{completedBookings.length}</h3>
          <p className="muted small">Appointments marked completed</p>
        </Link>

        <Link href={bookingsLinkForView('history', 'cancelled')} className="card dashboard-summary-card">
          <p className="small muted">Cancelled</p>
          <h3>{cancelledBookings.length}</h3>
          <p className="muted small">Cancelled bookings</p>
        </Link>

        <Link href="/dashboard/businesses" className="card dashboard-summary-card">
          <p className="small muted">Businesses</p>
          <h3>{publishedCount}/{businesses.length}</h3>
          <p className="muted small">
            Published businesses{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
          </p>
        </Link>
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
        <p className="small muted">Workspace shortcuts</p>
        <h3 style={{ marginTop: '0.25rem' }}>Keep the business moving</h3>
        <p className="muted small" style={{ marginTop: '0.5rem' }}>
          Setup tasks live inside Business profile. This overview keeps the main daily actions close: bookings, notifications, analytics and marketplace preview.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Link href={bookingsLinkForView('today')} className="btn btn-accent">
            Today’s bookings
          </Link>

          <Link href="/dashboard/notifications" className="btn btn-ghost">
            Notifications
          </Link>

          <Link href="/dashboard/analytics" className="btn btn-ghost">
            Analytics
          </Link>

          <Link href="/explore" className="btn btn-ghost">
            Preview Mirëbook
          </Link>
        </div>
      </div>
      <style jsx>{`
        .dashboard-summary-card {
          color: var(--text);
          text-decoration: none;
          cursor: pointer;
        }

        .dashboard-summary-card:hover {
          border-color: rgba(255,107,53,0.35);
          transform: translateY(-1px);
        }

        .dashboard-schedule-controls {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 560px) {
          .dashboard-schedule-controls,
          .dashboard-schedule-controls :global(.btn),
          .dashboard-schedule-controls input {
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}