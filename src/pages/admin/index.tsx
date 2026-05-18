import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'

type AdminProfile = {
  id: string
  email?: string | null
  is_admin?: boolean | null
}

type BusinessRow = {
  id: string
  user_id?: string | null
  name: string
  city?: string | null
  country?: string | null
  category?: string | null
  published?: boolean | null
  created_at?: string | null
  subscription_status?: string | null
  subscription_plan?: string | null
  subscription_price_monthly?: number | null
  trial_ends_at?: string | null
  billing_email?: string | null
}

function statusLabel(status?: string | null) {
  if (!status) return 'trial'
  return status.replace(/_/g, ' ')
}

function formatMoney(value?: number | null) {
  return `£${Number(value || 0).toFixed(2)}`
}

export default function AdminIndexPage() {
  const router = useRouter()

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const publishedCount = useMemo(() => {
    return businesses.filter((business) => business.published).length
  }, [businesses])

  const draftCount = useMemo(() => {
    return businesses.filter((business) => !business.published).length
  }, [businesses])

  const trialCount = useMemo(() => {
    return businesses.filter((business) => (business.subscription_status || 'trial') === 'trial').length
  }, [businesses])

  const activeCount = useMemo(() => {
    return businesses.filter((business) => business.subscription_status === 'active').length
  }, [businesses])

  const monthlyTotal = useMemo(() => {
    return businesses.reduce((total, business) => {
      if (business.subscription_status !== 'active') return total
      return total + Number(business.subscription_price_monthly || 0)
    }, 0)
  }, [businesses])

  async function loadAdmin() {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/admin')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, is_admin')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError

      if (!profileData?.is_admin) {
        setAdminProfile(profileData as AdminProfile)
        setBusinesses([])
        setLoading(false)
        return
      }

      setAdminProfile(profileData as AdminProfile)

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select(`
          id,
          user_id,
          name,
          city,
          country,
          category,
          published,
          created_at,
          subscription_status,
          subscription_plan,
          subscription_price_monthly,
          trial_ends_at,
          billing_email
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (businessError) throw businessError

      setBusinesses((businessData || []) as BusinessRow[])
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load admin dashboard.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdmin()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
          <div className="card">
            <p className="muted">Loading Mirëbook admin...</p>
          </div>
        </section>
      </main>
    )
  }

  if (!adminProfile?.is_admin) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
          <div className="admin-shell">
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p className="small" style={{ color: 'var(--danger)' }}>Admin only</p>
              <h1 className="page-title" style={{ marginTop: '0.35rem' }}>
                You do not have access to this page
              </h1>
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                This area is for Mirëbook admin users only.
              </p>

              <div className="admin-actions">
                <Link href="/" className="btn btn-ghost">
                  Back to Mirëbook
                </Link>

                <button type="button" className="btn btn-danger" onClick={logout}>
                  Log out
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="admin-shell">
          <div className="admin-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook internal</p>
              <h1 className="page-title">Admin dashboard</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Control early onboarding, free trials, business subscription status and launch readiness.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/dashboard" className="btn btn-ghost">
                Business dashboard
              </Link>

              <Link href="/admin/businesses" className="btn btn-accent">
                Manage businesses
              </Link>
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          <div className="grid-4">
            <div className="card">
              <p className="small muted">Businesses</p>
              <h2>{businesses.length}</h2>
              <p className="small muted">Total profiles loaded</p>
            </div>

            <div className="card">
              <p className="small muted">Published</p>
              <h2>{publishedCount}</h2>
              <p className="small muted">{draftCount} hidden/draft</p>
            </div>

            <div className="card">
              <p className="small muted">Trials</p>
              <h2>{trialCount}</h2>
              <p className="small muted">{activeCount} active subscriptions</p>
            </div>

            <div className="card">
              <p className="small muted">Active monthly value</p>
              <h2>{formatMoney(monthlyTotal)}</h2>
              <p className="small muted">Based on active businesses only</p>
            </div>
          </div>

          <div className="card">
            <div className="admin-section-header">
              <div>
                <p className="small muted">Recent businesses</p>
                <h2>Latest onboarding profiles</h2>
              </div>

              <button type="button" className="btn btn-ghost" onClick={loadAdmin}>
                Refresh
              </button>
            </div>

            {businesses.length === 0 ? (
              <div className="admin-empty">
                <h3>No businesses found yet</h3>
                <p className="muted" style={{ marginTop: '0.4rem' }}>
                  Businesses will appear here once they create profiles.
                </p>
              </div>
            ) : (
              <div className="admin-business-list">
                {businesses.slice(0, 10).map((business) => (
                  <div key={business.id} className="admin-business-card">
                    <div>
                      <div className="admin-business-title-row">
                        <strong>{business.name}</strong>
                        <span className={business.published ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                          {business.published ? 'Published' : 'Draft'}
                        </span>
                        <span className="admin-pill admin-pill-accent">
                          {statusLabel(business.subscription_status)}
                        </span>
                      </div>

                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        {[business.category, business.city, business.country].filter(Boolean).join(' · ') || 'No location/category set'}
                      </p>

                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        {business.subscription_plan || 'starter'} · {formatMoney(business.subscription_price_monthly)} / month
                        {business.trial_ends_at ? ` · trial ends ${new Date(business.trial_ends_at).toLocaleDateString()}` : ''}
                      </p>

                      {business.billing_email && (
                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          Billing: {business.billing_email}
                        </p>
                      )}
                    </div>

                    <div className="admin-business-actions">
                      <Link href={`/explore/${business.id}`} className="btn btn-ghost">
                        Public page
                      </Link>

                      <Link href={`/admin/businesses?businessId=${business.id}`} className="btn btn-accent">
                        Manage
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ borderColor: 'rgba(255,190,11,0.25)' }}>
            <p className="small muted">Admin note</p>
            <h3 style={{ marginTop: '0.25rem' }}>This is internal groundwork, not customer-facing.</h3>
            <p className="small muted" style={{ marginTop: '0.5rem' }}>
              Use this area to control early trials, custom monthly prices and onboarding status before Stripe or a full billing provider is connected.
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .admin-shell {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .admin-header,
        .admin-section-header,
        .admin-business-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .admin-actions,
        .admin-business-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .admin-empty {
          padding: 1rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          margin-top: 1rem;
        }

        .admin-business-list {
          display: grid;
          gap: 0.85rem;
          margin-top: 1rem;
        }

        .admin-business-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .admin-business-title-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .admin-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.16rem 0.55rem;
          font-size: 0.76rem;
          font-weight: 700;
          border: 1px solid var(--border);
        }

        .admin-pill-success {
          background: var(--success-dim);
          color: var(--success);
          border-color: rgba(6,214,160,0.22);
        }

        .admin-pill-muted {
          background: var(--surface);
          color: var(--text-muted);
        }

        .admin-pill-accent {
          background: var(--accent-dim);
          color: var(--accent);
          border-color: rgba(255,107,53,0.22);
          text-transform: capitalize;
        }

        @media (max-width: 640px) {
          .admin-header,
          .admin-section-header,
          .admin-business-card {
            display: grid;
          }

          .admin-actions,
          .admin-business-actions,
          .admin-actions :global(.btn),
          .admin-business-actions :global(.btn),
          .admin-actions a,
          .admin-business-actions a,
          .admin-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}