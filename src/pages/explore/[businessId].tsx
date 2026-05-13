import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Service = {
  id: string
  name: string
  duration_minutes: number
  price: number
  description?: string | null
  image_url?: string | null
}

type StaffMember = {
  id: string
  name: string
  role_title?: string | null
}

type StaffService = {
  staff_member_id: string
  service_id: string
}

type StaffAvailability = {
  staff_member_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  image_url?: string | null
  auto_accept_bookings?: boolean
}

type Booking = {
  id: string
  staff_member_id: string
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
}

type UserRole = 'customer' | 'business' | null

type StaffPreference = 'any' | 'specific'

type SlotOption = {
  time: string
  staffIds: string[]
}
type CalendarDay = {
  date: Date
  dateString: string
  isCurrentMonth: boolean
  isToday: boolean
  isPast: boolean
  label: string
  shortLabel: string
}

export default function BusinessBookingPage() {
  const router = useRouter()
  const { businessId } = router.query

  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([])

  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [staffPreference, setStaffPreference] = useState<StaffPreference>('any')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [timeSlots, setTimeSlots] = useState<SlotOption[]>([])
  const [selectedTime, setSelectedTime] = useState('')
  
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getCustomerSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setAuthChecked(true)
        return
      }

      setCustomerUserId(session.user.id)
      setCustomerEmail(session.user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, phone')
        .eq('id', session.user.id)
        .single()

      if (profile?.full_name) setCustomerName(profile.full_name)
      if (profile?.phone) setCustomerPhone(profile.phone)

      setUserRole(profile?.role === 'business' ? 'business' : 'customer')
      setAuthChecked(true)
    }

    getCustomerSession()
  }, [])

  async function loadBookingPage() {
    if (!businessId || Array.isArray(businessId)) return

    setPageLoading(true)
    setError(null)

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('published', true)
      .single()

    if (businessError) {
      setError(businessError.message)
      setPageLoading(false)
      return
    }

    setBusiness(businessData)

    const { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (servicesError) {
      setError(servicesError.message)
      setPageLoading(false)
      return
    }

    setServices(servicesData || [])

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, name, role_title')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (staffError) {
      setError(staffError.message)
      setPageLoading(false)
      return
    }

    setStaffMembers(staffData || [])

    const staffIds = (staffData || []).map((staff) => staff.id)

    if (staffIds.length > 0) {
      const { data: staffServiceData, error: staffServiceError } = await supabase
        .from('staff_services')
        .select('staff_member_id, service_id')
        .in('staff_member_id', staffIds)

      if (staffServiceError) {
        setError(staffServiceError.message)
        setPageLoading(false)
        return
      }

      setStaffServices(staffServiceData || [])

      const { data: staffAvailabilityData, error: staffAvailabilityError } = await supabase
        .from('staff_availability')
        .select('staff_member_id, day_of_week, start_time, end_time, is_closed')
        .in('staff_member_id', staffIds)

      if (staffAvailabilityError) {
        setError(staffAvailabilityError.message)
        setPageLoading(false)
        return
      }

      setStaffAvailability(staffAvailabilityData || [])
    } else {
      setStaffServices([])
      setStaffAvailability([])
    }

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .eq('business_id', businessId)

    if (availabilityError) {
      setError(availabilityError.message)
      setPageLoading(false)
      return
    }

    setAvailability(availabilityData || [])

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, staff_member_id, start_at, end_at, duration_minutes, status')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed'])

    setBookings(bookingsData || [])
    setPageLoading(false)
  }

  useEffect(() => {
    loadBookingPage()
  }, [businessId])

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadBookingPage()
      }
    }

    window.addEventListener('focus', loadBookingPage)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', loadBookingPage)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [businessId])

    function formatDateInputValue(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function sameDate(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  function moveCalendarMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function resetCalendarToToday() {
    const today = new Date()
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      date.setHours(0, 0, 0, 0)

      const dateString = formatDateInputValue(date)
      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()
      const isToday = sameDate(date, today)
      const isPast = date < today

      return {
        date,
        dateString,
        isCurrentMonth,
        isToday,
        isPast,
        label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        shortLabel: String(date.getDate())
      }
    })
  }, [calendarMonth])

  const selectedStaff = useMemo(() => {
    return staffMembers.find((staff) => staff.id === selectedStaffId) || null
  }, [staffMembers, selectedStaffId])

  const selectableStaff = useMemo(() => {
    if (!selectedService) return []

    return staffMembers.filter((staff) =>
      staffServices.some(
        (link) =>
          link.staff_member_id === staff.id &&
          link.service_id === selectedService.id
      )
    )
  }, [selectedService, staffMembers, staffServices])
  const availableStaffForSelectedDate = useMemo(() => {
    if (!selectedService || !selectedDate) return []

    return selectableStaff
      .map((staff) => ({
        staff,
        status: getStaffStatus(staff),
        slots: generateSlotsForStaff(staff.id)
      }))
      .filter((item) => item.status.available && item.slots.length > 0)
  }, [selectedService, selectedDate, selectableStaff, staffAvailability, bookings])

  const bookableServiceCount = services.filter((service) =>
    staffServices.some((link) => link.service_id === service.id)
  ).length

  function businessIcon() {
    if (business?.category?.toLowerCase().includes('dent')) return '🦷'
    if (business?.category?.toLowerCase().includes('barber')) return '💈'
    if (business?.category?.toLowerCase().includes('salon')) return '✂️'
    if (business?.category?.toLowerCase().includes('restaurant')) return '🍽️'
    return '✨'
  }

  function getStaffDayAvailability(staffId: string, dateValue: string) {
    if (!dateValue) return null

    const day = new Date(`${dateValue}T12:00:00`).getDay()

    return staffAvailability.find(
      (row) =>
        row.staff_member_id === staffId &&
        row.day_of_week === day
    ) || null
  }

  function generateSlotsForStaff(staffId: string) {
    if (!selectedDate || !selectedService) return []

    const dayAvailability = getStaffDayAvailability(staffId, selectedDate)
    if (!dayAvailability || dayAvailability.is_closed) return []

    const slots: string[] = []
    let start = new Date(`${selectedDate}T${dayAvailability.start_time}`)
    const end = new Date(`${selectedDate}T${dayAvailability.end_time}`)
    const now = new Date()

    while (start.getTime() + selectedService.duration_minutes * 60000 <= end.getTime()) {
      const slotStart = new Date(start)
      const slotEnd = new Date(start.getTime() + selectedService.duration_minutes * 60000)
      const timeString = slotStart.toTimeString().slice(0, 5)
      const isPastSlot = slotStart < now

      const overlapsBooking = bookings.some((booking) => {
        if (booking.staff_member_id !== staffId) return false

        const bookingStart = new Date(booking.start_at)
        const bookingEnd = booking.end_at
          ? new Date(booking.end_at)
          : new Date(bookingStart.getTime() + booking.duration_minutes * 60000)

        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      if (!isPastSlot && !overlapsBooking) {
        slots.push(timeString)
      }

      start = new Date(start.getTime() + selectedService.duration_minutes * 60000)
    }

    return slots
  }

  function getStaffStatus(staff: StaffMember) {
    if (!selectedDate) {
      return { available: false, label: 'Choose date first' }
    }

    const dayAvailability = getStaffDayAvailability(staff.id, selectedDate)

    if (!dayAvailability || dayAvailability.is_closed) {
      return { available: false, label: 'Unavailable / day off' }
    }

    const hasSlots = generateSlotsForStaff(staff.id).length > 0

    if (!hasSlots) {
      return { available: false, label: 'Fully booked' }
    }

    return {
      available: true,
      label: `${dayAvailability.start_time.slice(0, 5)} - ${dayAvailability.end_time.slice(0, 5)}`
    }
  }

  function generateTimeSlots() {
    if (!selectedDate || !selectedService) {
      setTimeSlots([])
      return
    }

    if (staffPreference === 'specific') {
      if (!selectedStaffId) {
        setTimeSlots([])
        return
      }

      setTimeSlots(generateSlotsForStaff(selectedStaffId).map((slot) => ({
        time: slot,
        staffIds: [selectedStaffId]
      })))
      return
    }

    const mergedSlots = selectableStaff.reduce<Record<string, string[]>>((acc, staff) => {
      const slots = generateSlotsForStaff(staff.id)

      slots.forEach((slot) => {
        if (!acc[slot]) acc[slot] = []
        acc[slot].push(staff.id)
      })

      return acc
    }, {})

    setTimeSlots(
      Object.entries(mergedSlots)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, staffIds]) => ({ time, staffIds }))
    )
  }

  useEffect(() => {
    generateTimeSlots()
  }, [selectedDate, selectedService, selectedStaffId, staffPreference, staffAvailability, bookings, selectableStaff])

  function staffForSlot(slotTime: string) {
    const slot = timeSlots.find((item) => item.time === slotTime)
    if (!slot) return []

    return selectableStaff.filter((staff) => slot.staffIds.includes(staff.id))
  }

  function resolveStaffForBooking() {
    if (staffPreference === 'specific') return selectedStaffId

    const slot = timeSlots.find((item) => item.time === selectedTime)
    return slot?.staffIds[0] || ''
  }

  function selectedStaffSummary() {
    if (staffPreference === 'any') {
      if (!selectedTime) return 'Any available staff'

      const staffForSelectedSlot = staffForSlot(selectedTime)
      if (staffForSelectedSlot.length === 0) return 'Any available staff'

      return staffForSelectedSlot.length === 1
        ? `Assigned automatically: ${staffForSelectedSlot[0].name}`
        : `${staffForSelectedSlot.length} staff available for this time`
    }

    return selectedStaff ? `Staff: ${selectedStaff.name}` : 'No staff selected'
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault()

    if (!authChecked) return

    if (!customerUserId || userRole !== 'customer') {
      setError(`Please login or create a customer account to book with ${business?.name || 'this business'}.`)
      return
    }

    if (!businessId || Array.isArray(businessId) || !selectedService || !selectedTime) return

    const staffMemberIdForBooking = resolveStaffForBooking()

    if (!staffMemberIdForBooking) {
      setError('Please choose an available staff member or select an available time with Any staff.')
      return
    }

    setLoading(true)
    setError(null)

    const freshSlots = generateSlotsForStaff(staffMemberIdForBooking)

    if (!freshSlots.includes(selectedTime)) {
      setLoading(false)
      setError('This time is no longer available. Please choose another slot.')
      setSelectedTime('')
      return
    }

    const startAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const bookingStatus = business?.auto_accept_bookings === false ? 'pending' : 'confirmed'

    const { error } = await supabase
      .from('bookings')
      .insert({
        business_id: businessId,
        service_id: selectedService.id,
        staff_member_id: staffMemberIdForBooking,
        customer_user_id: customerUserId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim().toLowerCase(),
        customer_phone: customerPhone.trim() || null,
        start_at: startAt,
        duration_minutes: selectedService.duration_minutes,
        status: bookingStatus
      })

    setLoading(false)

    if (error) {
      if (error.message.includes('prevent_overlapping_bookings')) {
        setError('This time slot has just been booked. Please choose another.')
      } else {
        setError(error.message)
      }
      await loadBookingPage()
      return
    }

    const { data: latestBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('business_id', businessId)
      .eq('customer_user_id', customerUserId)
      .eq('start_at', startAt)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestBooking?.id) {
      router.push(`/booking-confirmation?id=${latestBooking.id}`)
    } else {
      router.push(bookingStatus === 'pending' ? '/my-bookings?bookingRequested=1' : '/my-bookings')
    }
  }
  if (pageLoading) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <p className="muted">Loading booking page...</p>
          </div>
        </section>
      </main>
    )
  }

  if (!business) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <h1 className="page-title">Business not found</h1>
            <p className="page-sub">This business may be hidden, unpublished or unavailable.</p>
            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Back to explore
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  const canSubmit = Boolean(
    selectedService &&
    selectedDate &&
    (staffPreference === 'any' || selectedStaffId) &&
    selectedTime &&
    customerUserId &&
    userRole === 'customer'
  )

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '36px 24px 70px' }}>
        <Link href="/explore" className="muted small">
          ← Back to results
        </Link>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginTop: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>

            {(!customerUserId || userRole !== 'customer') && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <Link href="/login" className="btn btn-accent">
                  Login to book
                </Link>

                <Link href="/register" className="btn btn-ghost">
                  Create customer account
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: '1.5rem', overflow: 'hidden', padding: 0 }}>
          {business.image_url ? (
            <div
              style={{
                minHeight: 210,
                backgroundImage: `linear-gradient(rgba(11, 18, 32, 0.2), rgba(11, 18, 32, 0.75)), url(${business.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '1.5rem'
              }}
            >
              <div>
                <p className="small" style={{ color: 'var(--accent)' }}>
                  {business.category || 'Bookable business'}
                </p>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1.05 }}>
                  {business.name}
                </h1>
              </div>
            </div>
          ) : (
            <div
              style={{
                minHeight: 190,
                background: 'linear-gradient(135deg, rgba(255,107,53,0.18), rgba(45,212,191,0.10))',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 22,
                    background: 'var(--accent-dim)',
                    border: '1px solid rgba(255,107,53,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.1rem'
                  }}
                >
                  {businessIcon()}
                </div>

                <div>
                  <p className="small" style={{ color: 'var(--accent)' }}>
                    {business.category || 'Bookable business'}
                  </p>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', lineHeight: 1.05 }}>
                    {business.name}
                  </h1>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              <span
                className="small"
                style={{
                  background: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.12)' : 'rgba(45,212,191,0.12)',
                  color: business.auto_accept_bookings === false ? 'var(--accent)' : 'var(--success)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999
                }}
              >
                {business.auto_accept_bookings === false ? 'Manual approval' : 'Instant confirmation'}
              </span>

              <span
                className="small"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)'
                }}
              >
                {bookableServiceCount} bookable service{bookableServiceCount === 1 ? '' : 's'}
              </span>

              <span
                className="small"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)'
                }}
              >
                Real-time slots
              </span>
            </div>

            <p className="muted">
              {business.description || 'Book available appointments with this business.'}
            </p>

            <div style={{ display: 'grid', gap: '0.4rem', marginTop: '1rem' }}>
              <p className="small muted">
                {[business.address, business.city, business.country].filter(Boolean).join(', ') || 'Location not added'}
              </p>

              {business.phone && (
                <p className="small muted">
                  Phone: {business.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 430px',
            gap: '2rem',
            alignItems: 'start',
            marginTop: '1.5rem'
          }}
        >
          <section>
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                  marginBottom: '1rem'
                }}
              >
                <div>
                  <p className="small muted">Step 1</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>
                    Choose a service
                  </h2>
                </div>

                {selectedService && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSelectedService(null)
                      setSelectedDate('')
                      setStaffPreference('any')
                      setSelectedStaffId('')
                      setSelectedTime('')
                    }}
                  >
                    Change service
                  </button>
                )}
              </div>

              {services.length === 0 && (
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <h3>No services available yet</h3>
                  <p className="muted" style={{ marginTop: '0.35rem' }}>
                    This business is published, but it does not have active services ready for booking yet.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {services.map((service) => {
                  const assignedStaffCount = staffServices.filter((link) => link.service_id === service.id).length
                  const isSelected = selectedService?.id === service.id

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedService(service)
                        setSelectedDate('')
                        setStaffPreference('any')
                        setSelectedStaffId('')
                        setSelectedTime('')
                      }}
                      style={{
                        textAlign: 'left',
                        background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: isSelected ? '1px solid rgba(255,107,53,0.45)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: service.image_url ? 0 : '1rem',
                        color: 'var(--text)',
                        overflow: 'hidden'
                      }}
                    >
                      {service.image_url && (
                        <div
                          style={{
                            minHeight: 120,
                            backgroundImage: `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${service.image_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        />
                      )}

                      <div style={{ padding: service.image_url ? '1rem' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <strong>{service.name}</strong>
                          <strong>£{Number(service.price).toFixed(2)}</strong>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                          <span className="small muted">{service.duration_minutes} minutes</span>
                          <span className="small muted">{assignedStaffCount} staff member{assignedStaffCount === 1 ? '' : 's'}</span>
                        </div>

                        {service.description && (
                          <p className="small muted" style={{ marginTop: '0.55rem' }}>
                            {service.description}
                          </p>
                        )}

                        {assignedStaffCount === 0 && (
                          <p className="small" style={{ color: 'var(--warning)', marginTop: '0.55rem' }}>
                            This service is not bookable yet because no staff are assigned.
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <aside className="card" style={{ position: 'sticky', top: 96 }}>
            <div style={{ marginBottom: '1rem' }}>
              <p className="small muted">Book with {business.name}</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.35rem' }}>
                {business.auto_accept_bookings === false ? 'Request appointment' : 'Book appointment'}
              </h2>
              <p className="small muted">
                                Choose a service, staff preference, date and available time.
              </p>
            </div>

            <div
              className="card"
              style={{
                background: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.08)' : 'rgba(45,212,191,0.06)',
                borderColor: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.28)' : 'rgba(45,212,191,0.22)',
                marginBottom: '1rem',
                padding: '0.85rem'
              }}
            >
              <p className="small" style={{ color: business.auto_accept_bookings === false ? 'var(--accent)' : 'var(--success)' }}>
                {business.auto_accept_bookings === false ? 'Booking approval required' : 'Instant confirmation'}
              </p>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {business.auto_accept_bookings === false
                  ? 'This business reviews new booking requests before confirming them.'
                  : 'This business confirms new bookings instantly.'}
              </p>
            </div>

            {!customerUserId && (
              <div className="card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
                <strong>Login required</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  You can browse services, but you need a customer account to confirm a booking.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <Link href="/login" className="btn btn-accent">
                    Login
                  </Link>

                  <Link href="/register" className="btn btn-ghost">
                    Register
                  </Link>
                </div>
              </div>
            )}

            {userRole === 'business' && (
              <div className="card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
                <strong>Business account detected</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Business accounts manage bookings from the dashboard. Use a customer account to book appointments.
                </p>

                <Link href="/dashboard" className="btn btn-accent" style={{ marginTop: '0.75rem' }}>
                  Go to dashboard
                </Link>
              </div>
            )}

            <form onSubmit={createBooking} className="form-grid">
              <div>
                <label className="small muted">Selected service</label>
                <div className="card" style={{ background: 'var(--surface-2)', marginTop: '0.4rem', padding: '0.85rem' }}>
                  {selectedService ? (
                    <>
                      <strong>{selectedService.name}</strong>
                      <p className="small muted">
                        {selectedService.duration_minutes} mins · £{Number(selectedService.price).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="muted small">Choose a service from the list.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="small muted">Choose date</label>

                {!selectedService && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a service first to choose a booking date.
                  </p>
                )}

                {selectedService && (
                  <div className="card" style={{ background: 'var(--surface-2)', padding: '0.9rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <button type="button" onClick={() => moveCalendarMonth(-1)} className="btn btn-ghost" style={{ padding: '0.5rem 0.7rem' }}>
                        ←
                      </button>

                      <div style={{ textAlign: 'center' }}>
                        <strong>{monthLabel(calendarMonth)}</strong>
                        <p className="small muted">Scroll through months and pick a day</p>
                      </div>

                      <button type="button" onClick={() => moveCalendarMonth(1)} className="btn btn-ghost" style={{ padding: '0.5rem 0.7rem' }}>
                        →
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                      <button type="button" onClick={resetCalendarToToday} className="btn btn-ghost" style={{ padding: '0.45rem 0.75rem' }}>
                        Back to this month
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', marginBottom: '0.35rem' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <p key={day} className="small muted" style={{ textAlign: 'center', fontWeight: 700 }}>
                          {day}
                        </p>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.35rem' }}>
                      {calendarDays.map((day) => {
                        const isSelected = selectedDate === day.dateString

                        return (
                          <button
                            key={day.dateString}
                            type="button"
                            disabled={day.isPast}
                            onClick={() => {
                              setSelectedDate(day.dateString)
                              setSelectedStaffId('')
                              setSelectedTime('')
                            }}
                            title={day.label}
                            style={{
                              minHeight: 42,
                              borderRadius: 12,
                              border: isSelected ? '1px solid rgba(255,107,53,0.65)' : day.isToday ? '1px solid rgba(45,212,191,0.45)' : '1px solid var(--border)',
                              background: isSelected ? 'var(--accent)' : day.isToday ? 'rgba(45,212,191,0.10)' : 'var(--surface)',
                              color: isSelected ? 'var(--bg)' : day.isCurrentMonth ? 'var(--text)' : 'var(--text-muted)',
                              opacity: day.isPast ? 0.32 : day.isCurrentMonth ? 1 : 0.55,
                              cursor: day.isPast ? 'not-allowed' : 'pointer',
                              fontWeight: isSelected || day.isToday ? 800 : 500
                            }}
                          >
                            {day.shortLabel}
                          </button>
                        )
                      })}
                    </div>

                    {selectedDateLabel && (
                      <p className="small muted" style={{ marginTop: '0.75rem' }}>
                        Selected: <strong style={{ color: 'var(--text)' }}>{selectedDateLabel}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="small muted">Staff preference</label>

                {!selectedService && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a service first.
                  </p>
                )}

                {selectedService && !selectedDate && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a date to see staff options.
                  </p>
                )}

                {selectedService && selectedDate && selectableStaff.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No staff are assigned to this service yet.
                  </p>
                )}

                {selectedService && selectedDate && selectableStaff.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setStaffPreference('any')
                          setSelectedStaffId('')
                          setSelectedTime('')
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '0.85rem',
                          borderRadius: 'var(--radius)',
                          border: staffPreference === 'any' ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                          background: staffPreference === 'any' ? 'var(--accent-dim)' : 'var(--surface-2)',
                          color: 'var(--text)'
                        }}
                      >
                        <strong>Any staff</strong>
                        <p className="small muted" style={{ marginTop: '0.25rem' }}>
                          Show the earliest available slots across all staff.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStaffPreference('specific')
                          setSelectedStaffId('')
                          setSelectedTime('')
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '0.85rem',
                          borderRadius: 'var(--radius)',
                          border: staffPreference === 'specific' ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                          background: staffPreference === 'specific' ? 'var(--accent-dim)' : 'var(--surface-2)',
                          color: 'var(--text)'
                        }}
                      >
                        <strong>Choose staff</strong>
                        <p className="small muted" style={{ marginTop: '0.25rem' }}>
                          Pick a specific person for this booking.
                        </p>
                      </button>
                    </div>

                    {staffPreference === 'any' && (
                      <div className="card" style={{ background: 'var(--surface-2)', padding: '0.85rem' }}>
                        <p className="small muted">Any staff availability</p>
                        <strong>{availableStaffForSelectedDate.length} staff available</strong>
                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          {availableStaffForSelectedDate.length > 0
                            ? availableStaffForSelectedDate.map((item) => item.staff.name).join(', ')
                            : 'No available staff for this service/date.'}
                        </p>
                      </div>
                    )}

                    {staffPreference === 'specific' && (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {selectableStaff.map((staff) => {
                          const status = getStaffStatus(staff)
                          const isSelected = selectedStaffId === staff.id

                          return (
                            <button
                              key={staff.id}
                              type="button"
                              disabled={!status.available}
                              onClick={() => {
                                setSelectedStaffId(staff.id)
                                setSelectedTime('')
                              }}
                              style={{
                                opacity: status.available ? 1 : 0.45,
                                textAlign: 'left',
                                padding: '0.85rem',
                                borderRadius: 'var(--radius)',
                                border: isSelected ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                                color: 'var(--text)'
                              }}
                            >
                              <strong>{staff.name}</strong>
                              <p className="small muted">
                                {staff.role_title || 'Staff member'}
                              </p>
                              <p
                                className="small"
                                style={{
                                  color: status.available ? 'var(--success)' : 'var(--warning)'
                                }}
                              >
                                {status.label}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="small muted">Available times</label>

                {selectedDateLabel && selectedService && (
                  <p className="small muted" style={{ marginTop: '0.25rem' }}>
                    {selectedDateLabel} · {staffPreference === 'any' ? 'Any available staff' : selectedStaff ? `with ${selectedStaff.name}` : 'Choose staff'}
                  </p>
                )}

                {staffPreference === 'specific' && !selectedStaffId && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select an available staff member first, or use Any staff.
                  </p>
                )}

                {selectedService && selectedDate && timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No free slots for this selection on this date.
                  </p>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                    gap: '0.5rem',
                    marginTop: '0.5rem'
                  }}
                >
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 999,
                        border: selectedTime === slot.time ? '1px solid rgba(255,107,53,0.5)' : '1px solid var(--border)',
                        background: selectedTime === slot.time ? 'var(--accent)' : 'var(--surface-2)',
                        color: selectedTime === slot.time ? 'var(--bg)' : 'var(--text)'
                      }}
                    >
                      <span>{slot.time}</span>
                      {staffPreference === 'any' && slot.staffIds.length > 1 && (
                        <span style={{ display: 'block', fontSize: '0.68rem', opacity: 0.8 }}>
                          {slot.staffIds.length} staff
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ background: 'var(--surface-2)', padding: '0.85rem' }}>
                <p className="small muted">Summary</p>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {selectedService ? `${selectedService.name} · ${selectedService.duration_minutes} mins · £${Number(selectedService.price).toFixed(2)}` : 'No service selected'}
                </p>
                <p className="small muted">
                  {selectedDateLabel || 'No date selected'}{selectedTime ? ` · ${selectedTime}` : ''}
                </p>
                <p className="small muted">
                  {selectedStaffSummary()}
                </p>
              </div>

              <input
                type="text"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                disabled={!customerUserId || userRole !== 'customer'}
              />

              <input
                type="email"
                placeholder="Your email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                disabled
              />

              <input
                type="tel"
                placeholder="Your phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={!customerUserId || userRole !== 'customer'}
              />

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="btn btn-accent"
              >
                {loading
                  ? business.auto_accept_bookings === false ? 'Sending request...' : 'Booking...'
                  : business.auto_accept_bookings === false ? 'Request booking' : 'Confirm booking'}
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  )
}