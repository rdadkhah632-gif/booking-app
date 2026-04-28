import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Booking = {
  id: string
  business_id: string
  service_id: string
  customer_user_id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: {
    id: string
    name: string
    user_id: string
  } | null
  services?: {
    id: string
    name: string
    duration_minutes: number
    price: number
  } | null
}

type Role = 'customer' | 'business' | null

export default function RescheduleBooking() {
  const router = useRouter()
  const { id } = router.query

  const [booking, setBooking] = useState<Booking | null>(null)
  const [availability, setAvailability] = useState<any[]>([])
  const [existingBookings, setExistingBookings] = useState<any[]>([])

  const [role, setRole] = useState<Role>(null)
  const [date, setDate] = useState('')
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPage() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    if (!id || Array.isArray(id)) {
      setError('Missing booking reference.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const userRole = profile?.role === 'business' ? 'business' : 'customer'
    setRole(userRole)

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        businesses (
          id,
          name,
          user_id
        ),
        services (
          id,
          name,
          duration_minutes,
          price
        )
      `)
      .eq('id', id)
      .single()

    if (bookingError || !bookingData) {
      setError(bookingError?.message || 'Booking not found.')
      setLoading(false)
      return
    }

    const isCustomerOwner = bookingData.customer_user_id === session.user.id
    const isBusinessOwner = bookingData.businesses?.user_id === session.user.id

    if (!isCustomerOwner && !isBusinessOwner) {
      setError('You do not have permission to reschedule this booking.')
      setLoading(false)
      return
    }

    if (bookingData.status === 'cancelled') {
      setError('Cancelled bookings cannot be rescheduled.')
      setLoading(false)
      return
    }

    setBooking(bookingData)

    const originalDate = new Date(bookingData.start_at)
    const yyyy = originalDate.getFullYear()
    const mm = String(originalDate.getMonth() + 1).padStart(2, '0')
    const dd = String(originalDate.getDate()).padStart(2, '0')
    setDate(`${yyyy}-${mm}-${dd}`)

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .eq('business_id', bookingData.business_id)

    if (availabilityError) {
      setError(availabilityError.message)
      setLoading(false)
      return
    }

    setAvailability(availabilityData || [])

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', bookingData.business_id)
      .eq('status', 'confirmed')

    setExistingBookings(bookingsData || [])

    setLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, id])

  function generateSlots() {
    if (!booking || !booking.services || !date) {
      setTimeSlots([])
      return
    }

    const selectedDate = new Date(date)
    const day = selectedDate.getDay()

    const dayAvailability = availability.find((row) => row.day_of_week === day)

    if (!dayAvailability || dayAvailability.is_closed) {
      setTimeSlots([])
      return
    }

    const slots: string[] = []

    let start = new Date(`${date}T${dayAvailability.start_time}`)
    const end = new Date(`${date}T${dayAvailability.end_time}`)
    const duration = booking.services.duration_minutes || booking.duration_minutes

    while (start.getTime() + duration * 60000 <= end.getTime()) {
      const slotStart = new Date(start)
      const slotEnd = new Date(start.getTime() + duration * 60000)
      const timeString = slotStart.toTimeString().slice(0, 5)

      const overlapsBooking = existingBookings.some((existing) => {
        if (existing.id === booking.id) return false

        const bookingStart = new Date(existing.start_at)
        const bookingEnd = existing.end_at
          ? new Date(existing.end_at)
          : new Date(bookingStart.getTime() + existing.duration_minutes * 60000)

        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      if (!overlapsBooking) {
        slots.push(timeString)
      }

      start = new Date(start.getTime() + duration * 60000)
    }

    setTimeSlots(slots)
  }

  useEffect(() => {
    generateSlots()
  }, [booking, date, availability, existingBookings])

  async function saveReschedule(e: React.FormEvent) {
    e.preventDefault()

    if (!booking || !selectedTime) return

    setSaving(true)
    setError(null)

    const newStartAt = new Date(`${date}T${selectedTime}:00`).toISOString()
    const newDuration = booking.services?.duration_minutes || booking.duration_minutes

    const { error } = await supabase
      .from('bookings')
      .update({
        start_at: newStartAt,
        duration_minutes: newDuration,
        status: 'confirmed'
      })
      .eq('id', booking.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    if (role === 'business') {
      router.push(`/dashboard/bookings?businessId=${booking.business_id}`)
    } else {
      router.push('/my-bookings')
    }
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        {loading && (
          <div className="card">
            <p className="muted">Loading booking...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
            <h1 className="page-title">Cannot reschedule</h1>
            <p style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>{error}</p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <Link href="/my-bookings" className="btn btn-accent">
                My bookings
              </Link>

              <Link href="/dashboard" className="btn btn-ghost">
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && booking && (
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: '1rem' }}>
            <div>
              <p className="small muted">Modify appointment</p>
              <h1 className="page-title">Reschedule booking</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Choose a new available date and time.
              </p>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
                Current booking
              </h2>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <p className="small muted">Business</p>
                  <strong>{booking.businesses?.name || 'Business'}</strong>
                </div>

                <div>
                  <p className="small muted">Service</p>
                  <strong>{booking.services?.name || 'Service'}</strong>
                </div>

                <div>
                  <p className="small muted">Current time</p>
                  <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                </div>

                <div>
                  <p className="small muted">Customer</p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                </div>
              </div>
            </div>

            <form onSubmit={saveReschedule} className="card" style={{ display: 'grid', gap: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                New time
              </h2>

              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setSelectedTime('')
                }}
                required
              />

              <div>
                <label className="small muted">Available times</label>

                {timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No available slots for this date.
                  </p>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                  gap: '0.5rem',
                  marginTop: '0.75rem'
                }}>
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 999,
                        border: selectedTime === slot ? '1px solid rgba(255,107,53,0.5)' : '1px solid var(--border)',
                        background: selectedTime === slot ? 'var(--accent)' : 'var(--surface-2)',
                        color: selectedTime === slot ? 'var(--bg)' : 'var(--text)'
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !selectedTime}
                className="btn btn-accent"
              >
                {saving ? 'Saving...' : 'Save new time'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/my-bookings" className="btn btn-ghost">
                Back to my bookings
              </Link>

              {booking.business_id && (
                <Link href={`/dashboard/bookings?businessId=${booking.business_id}`} className="btn btn-ghost">
                  Back to business bookings
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}