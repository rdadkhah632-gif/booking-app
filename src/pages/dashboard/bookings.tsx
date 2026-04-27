import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'

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
}

export default function Bookings() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadBookings() {
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', session.user.id)

    if (businessError) {
      setError(businessError.message)
      return
    }

    const businessIds = (businesses || []).map((b) => b.id)

    if (businessIds.length === 0) {
      setBookings([])
      return
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          price
        )
      `)
      .in('business_id', businessIds)
      .order('start_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    setBookings(data || [])
  }

  useEffect(() => {
    loadBookings()
  }, [])

  async function cancelBooking(id: string) {
    const confirmed = confirm('Cancel this booking?')
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

  return (
    <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1>Bookings</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {bookings.length === 0 && <p>No bookings yet.</p>}

      {bookings.map((booking) => (
        <div
          key={booking.id}
          style={{
            border: '1px solid #ddd',
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            opacity: booking.status === 'cancelled' ? 0.5 : 1
          }}
        >
          <strong>{booking.customer_name}</strong>

          <p>
            Service: {booking.services?.name || 'No service recorded'}
          </p>

          <p>
            Price: £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
          </p>

          <p>
            Time: {new Date(booking.start_at).toLocaleString()}
          </p>

          <p>
            Duration: {booking.duration_minutes} minutes
          </p>

          <p>
            Email: {booking.customer_email || 'Not provided'}
          </p>

          <p>
            Phone: {booking.customer_phone || 'Not provided'}
          </p>

          <p>
            Status: {booking.status}
          </p>

          {booking.status !== 'cancelled' && (
            <button onClick={() => cancelBooking(booking.id)}>
              Cancel booking
            </button>
          )}
        </div>
      ))}
    </main>
  )
}