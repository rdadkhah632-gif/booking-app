import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'

type Business = {
  id: string
  name: string
  published: boolean
  created_at?: string
}

export default function Businesses() {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadBusinesses() {
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }

    setBusinesses(data || [])
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
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>Your businesses</h1>

      <form onSubmit={createBusiness} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          style={{ flex: 1, padding: '0.75rem' }}
          placeholder="Business name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button style={{ padding: '0.75rem 1rem' }} disabled={loading} type="submit">
          {loading ? 'Adding...' : 'Add business'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {businesses.length === 0 && (
        <p>No businesses yet. Create one above.</p>
      )}

      {businesses.map((business) => (
        <div
          key={business.id}
          style={{
            border: '1px solid #ddd',
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '8px'
          }}
        >
          <strong>{business.name}</strong>

          <p style={{ marginTop: '0.5rem' }}>
            Status: {business.published ? 'Live / visible to customers' : 'Hidden / not visible'}
          </p>

          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Booking link:{' '}
            <a href={`/explore/${business.id}`}>
              /explore/{business.id}
            </a>
          </div>

          <button
            onClick={() => togglePublished(business)}
            style={{ marginTop: '1rem', padding: '0.5rem 0.75rem' }}
          >
            {business.published ? 'Unpublish business' : 'Publish business'}
          </button>
        </div>
      ))}
    </main>
  )
}