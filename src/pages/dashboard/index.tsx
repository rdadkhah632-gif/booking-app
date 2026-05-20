import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import DashboardHomeHeader from '@/components/dashboard-home/DashboardHomeHeader'
import DashboardSummaryCards from '@/components/dashboard-home/DashboardSummaryCards'
import PriorityQueueCard from '@/components/dashboard-home/PriorityQueueCard'
import SchedulePreviewCard from '@/components/dashboard-home/SchedulePreviewCard'
import SetupGuidanceList from '@/components/dashboard-home/SetupGuidanceList'
import {
  AvailabilityRow,
  Booking,
  BookingRequest,
  Business,
  ScheduleDay,
  Service,
  SetupWarning,
  StaffMember
} from '@/components/dashboard-home/dashboardHomeTypes'
import { useI18n } from '@/lib/useI18n'

export default function DashboardHome() {
  const router = useRouter()
  const { t } = useI18n()

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
      const serviceName = booking.services?.name || t('dashboardHome.unknownService', 'Unknown service')
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
  const activeServices = services.filter((service) => service.active).length
  const activeStaff = staffMembers.filter((staff) => staff.active).length
  const openWorkingDays = availabilityRows.filter((row) => row.is_closed !== true).length


  const setupWarnings = useMemo(() => {
    const warnings: SetupWarning[] = []

    if (businesses.length === 0) {
      warnings.push({
        title: t('dashboardHome.warnings.createProfile.title', 'Create your business profile'),
        body: t('dashboardHome.warnings.createProfile.body', 'You need a business profile before customers can book through Mirëbook.'),
        href: '/dashboard/businesses',
        cta: t('dashboardHome.warnings.createProfile.cta', 'Create profile')
      })
      return warnings
    }

    if (activeServices === 0) {
      warnings.push({
        title: t('dashboardHome.warnings.services.title', 'Add customer-facing services'),
        body: t('dashboardHome.warnings.services.body', 'Customers need at least one active service before they can book.'),
        href: '/dashboard/services',
        cta: t('dashboardHome.warnings.services.cta', 'Add services')
      })
    }

    if (activeStaff === 0) {
      warnings.push({
        title: t('dashboardHome.warnings.staff.title', 'Add active staff'),
        body: t('dashboardHome.warnings.staff.body', 'Bookings need staff members assigned to services and working hours.'),
        href: '/dashboard/staff',
        cta: t('dashboardHome.warnings.staff.cta', 'Add staff')
      })
    }

    if (openWorkingDays === 0) {
      warnings.push({
        title: t('dashboardHome.warnings.hours.title', 'Set working hours'),
        body: t('dashboardHome.warnings.hours.body', 'At least one open business day is recommended before publishing.'),
        href: '/dashboard/availability',
        cta: t('dashboardHome.warnings.hours.cta', 'Set hours')
      })
    }

    if (publishedCount === 0 && businesses.length > 0) {
      warnings.push({
        title: t('dashboardHome.warnings.publish.title', 'Publish when ready'),
        body: t('dashboardHome.warnings.publish.body', 'Hidden businesses do not appear in the marketplace.'),
        href: '/dashboard/businesses',
        cta: t('dashboardHome.warnings.publish.cta', 'Review profile')
      })
    }

    return warnings
  }, [businesses.length, activeServices, activeStaff, openWorkingDays, publishedCount, t])

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
        label: index === 0 ? t('dashboardHome.schedule.today', 'Today') : index === 1 ? t('dashboardHome.schedule.tomorrow', 'Tomorrow') : date.toLocaleDateString(undefined, { weekday: 'short' }),
        shortLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        bookings: dayBookings
      }
    })
  }, [bookings, t])

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

  if (loading) {
    return (
      <DashboardLayout title={t('common.loading', 'Loading...')}>
        <p className="muted">{t('dashboardHome.checkingAccount', 'Checking your account...')}</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={t('dashboardHome.title', 'Business overview')}
      subtitle={t('dashboardHome.subtitle', 'A quick view of today’s appointments, customer actions and setup reminders.')}
    >
      <DashboardHomeHeader loading={loading} onRefresh={loadDashboard} />

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {businesses.length === 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>{t('dashboardHome.empty.title', 'Create your first business')}</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {t('dashboardHome.empty.body', 'Add a business profile, then create services, staff and working hours before publishing it to Mirëbook customers.')}
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            {t('dashboardHome.empty.cta', 'Create business profile')}
          </Link>
        </div>
      )}

      <DashboardSummaryCards
        todayCount={todayBookings.length}
        pendingActionCount={pendingActionCount}
        pendingBookingsCount={pendingBookings.length}
        pendingRescheduleCount={pendingRescheduleCount}
        analytics={dashboardAnalytics}
        bookingsLinkForView={bookingsLinkForView}
      />

      <PriorityQueueCard
        pendingActionCount={pendingActionCount}
        bookingsLinkForView={bookingsLinkForView}
      />


      <SchedulePreviewCard
        scheduleDays={scheduleDays}
        bookingsLinkForDate={bookingsLinkForDate}
      />
      <SetupGuidanceList warnings={setupWarnings} />
    </DashboardLayout>
  )
}