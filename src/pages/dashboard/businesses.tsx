import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  published: boolean
  auto_accept_bookings?: boolean
  created_at?: string
}

export default function Businesses() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null)
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

    if (!newName.trim()) return

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
        name: newName.trim(),
        user_id: session.user.id,
        published: false
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setNewName('')
    await loadBusinesses()
    setLoading(false)
  }

  function updateLocalBusiness(id: string, field: keyof Business, value: string | boolean | boolean) {
    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === id ? { ...business, [field]: value } : business
      )
    )
  }

  async function saveBusiness(business: Business) {
    setSavingBusinessId(business.id)
    setError(null)

    const { error } = await supabase
      .from('businesses')
      .update({
        name: business.name,
        description: business.description || null,
        category: business.category || null,
        city: business.city || null,
        country: business.country || null,
        address: business.address || null,
        phone: business.phone || null,
        auto_accept_bookings: business.auto_accept_bookings ?? true
      })
      .eq('id', business.id)

    if (error) {
      setError(error.message)
      setSavingBusinessId(null)
      return
    }

    setSavingBusinessId(null)
    await loadBusinesses()
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
      subtitle="Edit your business details, publish your profile, and manage services, staff, working hours and bookings."
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
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
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
            Create your first business above. Then add services, staff, working hours and publish it to the marketplace.
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
                  {business.name || 'Untitled business'}
                </h3>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  <span
                    className="small"
                    style={{
                      background: business.published ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                      color: business.published ? 'var(--success)' : 'var(--warning)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 999
                    }}
                  >
                    {business.published ? 'Live / visible to customers' : 'Hidden / not visible'}
                  </span>

                  <span
                    className="small"
                    style={{
                      background: business.auto_accept_bookings ?? true ? 'rgba(45,212,191,0.12)' : 'rgba(255,107,53,0.12)',
                      color: business.auto_accept_bookings ?? true ? 'var(--success)' : 'var(--accent)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 999
                    }}
                  >
                    {business.auto_accept_bookings ?? true ? 'Auto-accept bookings' : 'Manual booking approval'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => togglePublished(business)}
                className={business.published ? 'btn btn-ghost' : 'btn btn-accent'}
              >
                {business.published ? 'Unpublish' : 'Publish'}
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem'
            }}>
              <input
                placeholder="Business name"
                value={business.name || ''}
                onChange={(e) => updateLocalBusiness(business.id, 'name', e.target.value)}
              />

              <input
                placeholder="Category e.g. Barber, Dentist, Salon"
                value={business.category || ''}
                onChange={(e) => updateLocalBusiness(business.id, 'category', e.target.value)}
              />

              <input
                placeholder="City"
                value={business.city || ''}
                onChange={(e) => updateLocalBusiness(business.id, 'city', e.target.value)}
              />

              <input
                placeholder="Country"
                value={business.country || ''}
                onChange={(e) => updateLocalBusiness(business.id, 'country', e.target.value)}
              />

              <input
                placeholder="Address"
                value={business.address || ''}
                onChange={(e) => updateLocalBusiness(business.id, 'address', e.target.value)}
              />

              <input
                placeholder="Phone"
                value={business.phone || ''}
                onChange={(e) => updateLocalBusiness(business.id, 'phone', e.target.value)}
              />
            </div>

            <textarea
              placeholder="Description shown to customers"
              value={business.description || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'description', e.target.value)}
              rows={3}
            />

            <div
              className="card"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                padding: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <p className="small muted">Booking approval</p>
                  <h3 style={{ marginTop: '0.25rem' }}>
                    {business.auto_accept_bookings ?? true ? 'Auto-accept customer bookings' : 'Manually approve customer bookings'}
                  </h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    When auto-accept is on, customers receive instant booking confirmation. When it is off, new bookings will need business approval before they are confirmed.
                  </p>
                </div>

                <label
                  className="btn btn-ghost"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <input
                    type="checkbox"
                    checked={business.auto_accept_bookings ?? true}
                    onChange={(e) => updateLocalBusiness(business.id, 'auto_accept_bookings', e.target.checked)}
                  />
                  Auto-accept
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => saveBusiness(business)}
                className="btn btn-accent"
                disabled={savingBusinessId === business.id}
              >
                {savingBusinessId === business.id ? 'Saving...' : 'Save profile and booking settings'}
              </button>

              <Link
                href={`/dashboard/services?businessId=${business.id}`}
                className="btn btn-ghost"
              >
                Manage services
              </Link>

              <Link
                href={`/dashboard/staff?businessId=${business.id}`}
                className="btn btn-ghost"
              >
                Staff
              </Link>

              <Link
                href={`/dashboard/availability?businessId=${business.id}`}
                className="btn btn-ghost"
              >
                Working hours
              </Link>

              <Link
                href={`/dashboard/bookings?businessId=${business.id}`}
                className="btn btn-ghost"
              >
                View bookings
              </Link>

              <Link
                href={`/explore/${business.id}`}
                className="btn btn-ghost"
              >
                Public page
              </Link>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}