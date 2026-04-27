import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Business {
  id: string
  name: string
}

export default function BookBusiness() {
  const router = useRouter()
  const { businessId } = router.query
  const [business, setBusiness] = useState<Business | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [serviceId, setServiceId] = useState<string>('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId || Array.isArray(businessId)) return
    const fetchBusiness = async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single()
      if (!error) {
        setBusiness(data as Business)
      }
    }
    fetchBusiness()
  }, [businessId])

  const handleBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!businessId || Array.isArray(businessId)) return
    // Combine date and time into ISO timestamp
    const startAt = new Date(`${bookingDate}T${bookingTime}:00`).toISOString()
    const { error } = await supabase.from('bookings').insert({
      business_id: businessId,
      customer_name: customerName,
      service_id: serviceId || null,
      start_at: startAt,
      duration_minutes: 30
    })
    if (error) {
      setError(error.message)
    } else {
      alert('Booking created!')
      setCustomerName('')
      setBookingDate('')
      setBookingTime('')
    }
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        {business ? `Book an appointment at ${business.name}` : 'Loading...'}
      </h1>
      <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '24rem' }}>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="customerName" style={{ marginBottom: '0.25rem' }}>Your name</label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="bookingDate" style={{ marginBottom: '0.25rem' }}>Date</label>
          <input
            id="bookingDate"
            type="date"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            required
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="bookingTime" style={{ marginBottom: '0.25rem' }}>Time</label>
          <input
            id="bookingTime"
            type="time"
            value={bookingTime}
            onChange={(e) => setBookingTime(e.target.value)}
            required
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <button type="submit" style={{ padding: '0.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}>
          Book
        </button>
      </form>
    </main>
  )
}