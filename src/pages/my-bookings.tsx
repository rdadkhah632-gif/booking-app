import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'

type Booking = {
  id: string
  customer_name: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: { name: string } | null
  services?: { name: string; price: number } | null
}

export default function MyBookings() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      setUserId(session.user.id)

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          businesses ( name ),
          services ( name, price )
        `)
        .eq('customer_user_id', session.user.id)
        .order('start_at', { ascending: true })

      if (error) {
        setError(error.message)
        return
      }

      setBookings(data || [])
    }

    init()
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

    setBookings((prev) =>
      prev.map((b) => b.id === id ? { ...b, status: 'cancelled' } : b)
    )
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>My bookings</h1>

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
          <strong>{booking.businesses?.name || 'Business'}</strong>

          <p>Service: {booking.services?.name || 'Service not recorded'}</p>

          <p>
            Price: £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
          </p>

          <p>
            Time: {new Date(booking.start_at).toLocaleString()}
          </p>

          <p>
            Duration: {booking.duration_minutes} minutes
          </p>

          <p>Status: {booking.status}</p>

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