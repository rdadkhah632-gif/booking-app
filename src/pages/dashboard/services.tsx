import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'

type Business = {
  id: string
  name: string
}

type Service = {
  id: string
  business_id: string
  name: string
  duration_minutes: number
  price: number
  active: boolean
}

export default function Services() {
  const router = useRouter()

  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])

  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', session.user.id)
      .limit(1)

    if (businessError) {
      setError(businessError.message)
      return
    }

    if (!businesses || businesses.length === 0) {
      setBusiness(null)
      return
    }

    const selectedBusiness = businesses[0]
    setBusiness(selectedBusiness)

    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', selectedBusiness.id)
      .order('created_at', { ascending: false })

    if (serviceError) {
      setError(serviceError.message)
      return
    }

    setServices(serviceData || [])
  }

  useEffect(() => {
    loadData()
  }, [])

  async function addService(e: React.FormEvent) {
    e.preventDefault()

    if (!business) {
      setError('Create a business profile first.')
      return
    }

    if (!name.trim()) {
      setError('Service name is required.')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase
      .from('services')
      .insert({
        business_id: business.id,
        name: name.trim(),
        duration_minutes: duration,
        price,
        active: true
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setName('')
    setDuration(30)
    setPrice(0)

    await loadData()
    setLoading(false)
  }

  async function toggleService(service: Service) {
    const { error } = await supabase
      .from('services')
      .update({ active: !service.active })
      .eq('id', service.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadData()
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>Manage services</h1>

      {!business && (
        <p>
          You need to create a business first. Go to /dashboard/businesses.
        </p>
      )}

      {business && (
        <>
          <p>Business: <strong>{business.name}</strong></p>

          <form onSubmit={addService} style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
            <input
              placeholder="Service name e.g. Haircut, Dental Checkup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ padding: '0.75rem' }}
            />

            <input
              type="number"
              placeholder="Duration in minutes"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={5}
              required
              style={{ padding: '0.75rem' }}
            />

            <input
              type="number"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              min={0}
              step="0.01"
              required
              style={{ padding: '0.75rem' }}
            />

            <button type="submit" disabled={loading} style={{ padding: '0.75rem' }}>
              {loading ? 'Adding...' : 'Add service'}
            </button>
          </form>

          {error && <p style={{ color: 'red' }}>{error}</p>}

          <h2>Your services</h2>

          {services.length === 0 && <p>No services yet.</p>}

          {services.map((service) => (
            <div
              key={service.id}
              style={{
                border: '1px solid #ddd',
                padding: '1rem',
                marginBottom: '1rem',
                borderRadius: '8px'
              }}
            >
              <strong>{service.name}</strong>
              <p>{service.duration_minutes} minutes</p>
              <p>£{Number(service.price).toFixed(2)}</p>
              <p>Status: {service.active ? 'Active' : 'Hidden'}</p>

              <button onClick={() => toggleService(service)}>
                {service.active ? 'Hide service' : 'Show service'}
              </button>
            </div>
          ))}
        </>
      )}
    </main>
  )
}