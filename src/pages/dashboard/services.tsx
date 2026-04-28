import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

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
  const { businessId } = router.query

  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])

  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState(0)

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setError(null)
    setPageLoading(true)

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

    if (!businessId || Array.isArray(businessId)) {
      setBusiness(null)
      setServices([])
      setPageLoading(false)
      return
    }

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .eq('user_id', session.user.id)
      .single()

    if (businessError || !businessData) {
      setError(businessError?.message || 'Business not found.')
      setBusiness(null)
      setServices([])
      setPageLoading(false)
      return
    }

    setBusiness(businessData)

    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessData.id)
      .order('created_at', { ascending: false })

    if (serviceError) {
      setError(serviceError.message)
      setPageLoading(false)
      return
    }

    setServices(serviceData || [])
    setPageLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadData()
  }, [router.isReady, businessId])

  async function addService(e: React.FormEvent) {
    e.preventDefault()

    if (!business) {
      setError('Select a business first from Business Profile.')
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
    <DashboardLayout
      title="Manage services"
      subtitle={business ? `Editing services for ${business.name}` : 'Choose a business from Business Profile first.'}
    >
      {!businessId && (
        <div className="card">
          <h3>No business selected</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Go to Business Profile and choose Manage services under the business you want to edit.
          </p>
          <button
            className="btn btn-accent"
            style={{ marginTop: '1rem' }}
            onClick={() => router.push('/dashboard/businesses')}
          >
            Go to Business Profile
          </button>
        </div>
      )}

      {pageLoading && (
        <div className="card">
          <p className="muted">Loading services...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!pageLoading && business && (
        <>
          <form onSubmit={addService} className="card" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <h3>Add service</h3>

            <input
              placeholder="Service name e.g. Haircut, Dental Checkup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              type="number"
              placeholder="Duration in minutes"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={5}
              required
            />

            <input
              type="number"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              min={0}
              step="0.01"
              required
            />

            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading ? 'Adding...' : 'Add service'}
            </button>
          </form>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {services.length === 0 && (
              <div className="card">
                <p className="muted">No services yet for this business.</p>
              </div>
            )}

            {services.map((service) => (
              <div key={service.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{service.name}</strong>
                    <p className="small muted">{service.duration_minutes} minutes</p>
                    <p className="small muted">£{Number(service.price).toFixed(2)}</p>
                    <p className="small" style={{ color: service.active ? 'var(--success)' : 'var(--warning)' }}>
                      {service.active ? 'Active' : 'Hidden'}
                    </p>
                  </div>

                  <button onClick={() => toggleService(service)} className="btn btn-ghost">
                    {service.active ? 'Hide service' : 'Show service'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}