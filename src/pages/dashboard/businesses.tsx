import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
  description?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  published: boolean
  created_at?: string
}

export default function Businesses() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadBusinesses() {
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

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setPageLoading(false)
      return
    }

    setBusinesses(data || [])
    setPageLoading(false)
  }

  useEffect(() => {
    loadBusinesses()
  }, [])

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) return

    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { error } = await supabase
      .from('businesses')
      .insert({
        name: name.trim(),
        user_id: session.user.id,
        published: false
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setName('')
    await loadBusinesses()
    setLoading(false)
  }

  async function togglePublished(business: Business) {
    setError(null)

    const { error } = await supabase
      .from('businesses')
      .update({ published: !business.published })
      .eq('id', business.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadBusinesses()
  }

  return (
    <DashboardLayout
      title="Business profile"
      subtitle="Choose which business you want to manage, publish your profile, and access its services, hours and bookings."
    >
      <form
        onSubmit={createBusiness}
        className="card"
        style={{
          display: 'grid',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <h3>Add a new business</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.75rem'
        }}>
          <input
            placeholder="Business name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button className="btn btn-accent" disabled={loading} type="submit">
            {loading ? 'Adding...' : 'Add business'}
          </button>
        </div>
      </form>

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {pageLoading && (
        <div className="card">
          <p className="muted">Loading your businesses...</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>No businesses yet</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Create your first business above. Then add services, working hours and publish it to the marketplace.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {businesses.map((business) => (
          <div
            key={business.id}
            className="card"
            style={{
              display: 'grid',
              gap: '1rem'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              alignItems: 'flex-start',
              flexWrap: 'wrap'
            }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>
                  {business.name}
                </h3>

                <p className="small muted">
                  {[business.address, business.city, business.country].filter(Boolean).join(', ') || 'Location not added yet'}
                </p>

                <p
                  className="small"
                  style={{
                    marginTop: '0.5rem',
                    color: business.published ? 'var(--success)' : 'var(--warning)'
                  }}
                >
                  {business.published ? 'Live / visible to customers' : 'Hidden / not visible'}
                </p>
              </div>

              <button
                onClick={() => togglePublished(business)}
                className={business.published ? 'btn btn-ghost' : 'btn btn-accent'}
              >
                {business.published ? 'Unpublish' : 'Publish'}
              </button>
            </div>

            <div className="grid-2">
              <Link
                href={`/dashboard/services?businessId=${business.id}`}
                className="card"
                style={{ background: 'var(--surface-2)' }}
              >
                <strong>Manage services</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Add prices, durations and active services for this business.
                </p>
              </Link>

              <Link
                href={`/dashboard/availability?businessId=${business.id}`}
                className="card"
                style={{ background: 'var(--surface-2)' }}
              >
                <strong>Working hours</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Set the available days and opening times for this business.
                </p>
              </Link>

              <Link
                href={`/dashboard/bookings?businessId=${business.id}`}
                className="card"
                style={{ background: 'var(--surface-2)' }}
              >
                <strong>View bookings</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  See customer bookings and cancel appointments.
                </p>
              </Link>

              <Link
                href={`/explore/${business.id}`}
                className="card"
                style={{ background: 'var(--surface-2)' }}
              >
                <strong>Public booking page</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Preview what customers see when booking this business.
                </p>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}