import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import { supabase } from '@/lib/supabaseClient'

type BusinessBilling = {
  id: string
  name: string
  published?: boolean | null
  subscription_status?: string | null
  subscription_plan?: string | null
  subscription_price_monthly?: number | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  trial_ends_at?: string | null
  billing_email?: string | null
}

const PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
  { value: 'custom', label: 'Custom' }
]

const STATUS_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' }
]

function defaultBilling(business: BusinessBilling): BusinessBilling {
  return {
    ...business,
    subscription_status: business.subscription_status || 'trial',
    subscription_plan: business.subscription_plan || 'starter',
    subscription_price_monthly: Number(business.subscription_price_monthly || 0),
    billing_email: business.billing_email || '',
    trial_ends_at: business.trial_ends_at || null
  }
}

function statusTone(status?: string | null) {
  if (status === 'active') return 'success'
  if (status === 'trial') return 'accent'
  if (status === 'past_due') return 'warning'
  if (status === 'paused') return 'muted'
  if (status === 'cancelled') return 'warning'
  return 'muted'
}

function statusLabel(status?: string | null) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Not set'
}

function planLabel(plan?: string | null) {
  return PLAN_OPTIONS.find((option) => option.value === plan)?.label || 'Starter'
}

export default function DashboardBillingPage() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<BusinessBilling[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [billing, setBilling] = useState<BusinessBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedBusiness = useMemo(() => {
    return businesses.find((business) => business.id === selectedBusinessId) || null
  }, [businesses, selectedBusinessId])

  const billingReadiness = useMemo(() => {
    if (!billing) return 0

    const checks = [
      Boolean(billing.billing_email?.trim()),
      Boolean(billing.subscription_status),
      Boolean(billing.subscription_plan),
      billing.subscription_price_monthly !== null && billing.subscription_price_monthly !== undefined
    ]

    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [billing])

  async function loadBilling() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/dashboard/billing')
        return
      }

      const { data, error } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          published,
          subscription_status,
          subscription_plan,
          subscription_price_monthly,
          stripe_customer_id,
          stripe_subscription_id,
          trial_ends_at,
          billing_email
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const ownedBusinesses = (data || []) as BusinessBilling[]
      setBusinesses(ownedBusinesses)

      const queryBusinessId = typeof router.query.businessId === 'string'
        ? router.query.businessId
        : ''

      const nextSelectedBusiness =
        ownedBusinesses.find((business) => business.id === queryBusinessId) ||
        ownedBusinesses[0] ||
        null

      if (nextSelectedBusiness) {
        setSelectedBusinessId(nextSelectedBusiness.id)
        setBilling(defaultBilling(nextSelectedBusiness))
      } else {
        setSelectedBusinessId('')
        setBilling(null)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load billing details.')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadBilling()
  }, [router.isReady])

  function selectBusiness(businessId: string) {
    const business = businesses.find((item) => item.id === businessId)
    if (!business) return

    setSelectedBusinessId(business.id)
    setBilling(defaultBilling(business))
    router.replace(`/dashboard/billing?businessId=${business.id}`, undefined, { shallow: true })
  }

  function updateBilling<K extends keyof BusinessBilling>(key: K, value: BusinessBilling[K]) {
    setBilling((current) => {
      if (!current) return current

      return {
        ...current,
        [key]: value
      }
    })
  }

  async function saveBillingGroundwork() {
    if (!billing) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      subscription_status: billing.subscription_status || 'trial',
      subscription_plan: billing.subscription_plan || 'starter',
      subscription_price_monthly: Number(billing.subscription_price_monthly || 0),
      billing_email: billing.billing_email?.trim() || null,
      trial_ends_at: billing.trial_ends_at || null
    }

    const { error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', billing.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Mirëbook billing groundwork saved.')
    await loadBilling()
  }

  function stripeStatusText() {
    if (!billing) return 'No business selected.'

    if (billing.stripe_subscription_id) {
      return 'Stripe subscription reference is stored for this business.'
    }

    if (billing.stripe_customer_id) {
      return 'Stripe customer reference is stored, but no subscription reference is linked yet.'
    }

    return 'Stripe is not connected yet. This page is groundwork for business subscriptions, not customer booking payments.'
  }

  return (
    <DashboardLayout
      title="Billing"
      subtitle={selectedBusiness ? `Manage Mirëbook subscription groundwork for ${selectedBusiness.name}.` : 'Prepare business subscription billing for Mirëbook.'}
    >
      {loading && (
        <div className="card">
          <p className="muted">Loading Mirëbook billing details...</p>
        </div>
      )}

      {!loading && businesses.length === 0 && (
        <div className="card">
          <p className="small" style={{ color: 'var(--warning)' }}>No business profile found</p>
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.35rem' }}>
            Create a business first
          </h2>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Billing becomes available after you create a Mirëbook business profile.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Open setup hub
          </Link>
        </div>
      )}

      {!loading && businesses.length > 0 && billing && (
        <>
          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--success)' }}>{success}</p>
            </div>
          )}

          <div className="billing-hero card">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Business subscription billing</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                Mirëbook billing groundwork
              </h2>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Customers should not pay to book appointments. This page is for future business subscription billing, where businesses pay Mirëbook monthly.
              </p>
            </div>

            <div className="billing-hero-actions">
              <Link href="/dashboard/settings" className="btn btn-ghost">
                Business settings
              </Link>
              <button className="btn btn-accent" onClick={saveBillingGroundwork} disabled={saving}>
                {saving ? 'Saving...' : 'Save billing groundwork'}
              </button>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <p className="small muted">Selected business</p>
              <h3>{selectedBusiness?.name || 'Business'}</h3>
              <p className="muted small">
                {selectedBusiness?.published ? 'Published on Mirëbook' : 'Hidden / draft'}
              </p>
            </div>

            <div className="card" style={{ borderColor: statusTone(billing.subscription_status) === 'success' ? 'rgba(45,212,191,0.28)' : 'var(--border)' }}>
              <p className="small muted">Subscription status</p>
              <h3>{statusLabel(billing.subscription_status)}</h3>
              <p className="muted small">{planLabel(billing.subscription_plan)} plan</p>
            </div>

            <div className="card">
              <p className="small muted">Billing readiness</p>
              <h3>{billingReadiness}%</h3>
              <p className="muted small">Groundwork fields filled in</p>
            </div>
          </div>

          {businesses.length > 1 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <p className="small muted">Manage another business</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                Choose billing profile
              </h2>

              <div className="billing-business-list">
                {businesses.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    className={business.id === selectedBusinessId ? 'billing-business-card billing-business-card-active' : 'billing-business-card'}
                    onClick={() => selectBusiness(business.id)}
                  >
                    <strong>{business.name}</strong>
                    <span>{business.published ? 'Published' : 'Hidden / draft'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="billing-grid">
            <div className="card billing-card">
              <div>
                <p className="small muted">Billing email</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Payment contact
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  This should be the email used for future invoices, receipts and subscription notices.
                </p>
              </div>

              <input
                type="email"
                value={billing.billing_email || ''}
                onChange={(e) => updateBilling('billing_email', e.target.value)}
                placeholder="billing@example.com"
              />
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">Plan</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Business plan
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Pricing can stay flexible while you onboard early Albanian and international businesses.
                </p>
              </div>

              <select
                value={billing.subscription_plan || 'starter'}
                onChange={(e) => updateBilling('subscription_plan', e.target.value)}
              >
                {PLAN_OPTIONS.map((plan) => (
                  <option key={plan.value} value={plan.value}>{plan.label}</option>
                ))}
              </select>
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">Monthly price</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Business subscription amount
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  This is an internal groundwork field for now. Stripe charging is not wired yet.
                </p>
              </div>

              <input
                type="number"
                min={0}
                step="0.01"
                value={billing.subscription_price_monthly ?? 0}
                onChange={(e) => updateBilling('subscription_price_monthly', Number(e.target.value))}
                placeholder="0.00"
              />
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">Status</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Subscription state
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  This can later control access, trial banners, payment reminders and subscription enforcement.
                </p>
              </div>

              <select
                value={billing.subscription_status || 'trial'}
                onChange={(e) => updateBilling('subscription_status', e.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">Trial end date</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Free trial tracking
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Useful for early onboarding offers, such as first month free or manual trial extensions.
                </p>
              </div>

              <input
                type="date"
                value={billing.trial_ends_at ? billing.trial_ends_at.slice(0, 10) : ''}
                onChange={(e) => {
                  updateBilling(
                    'trial_ends_at',
                    e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null
                  )
                }}
              />
            </div>

            <div className="card billing-card">
              <div>
                <p className="small muted">Stripe readiness</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Payment provider status
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  {stripeStatusText()}
                </p>
              </div>

              <div className="billing-provider-box">
                <p className="small muted">Stripe customer</p>
                <strong>{billing.stripe_customer_id || 'Not connected'}</strong>

                <p className="small muted" style={{ marginTop: '0.75rem' }}>Stripe subscription</p>
                <strong>{billing.stripe_subscription_id || 'Not connected'}</strong>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.5rem', borderColor: 'rgba(255,190,11,0.28)' }}>
            <p className="small muted">Important payment model</p>
            <h3 style={{ marginTop: '0.25rem' }}>Customers do not pay Mirëbook to book appointments</h3>
            <p className="muted small" style={{ marginTop: '0.5rem' }}>
              Mirëbook’s payment model should be business subscription billing. Businesses pay a monthly fee to use the platform. Customer booking payments, deposits or appointment checkout are not part of the current plan.
            </p>
          </div>

          <div className="billing-final-actions">
            <Link href="/dashboard/businesses" className="btn btn-ghost">
              Setup hub
            </Link>

            <Link href="/dashboard/settings" className="btn btn-ghost">
              Business settings
            </Link>

            <button className="btn btn-accent" onClick={saveBillingGroundwork} disabled={saving}>
              {saving ? 'Saving...' : 'Save billing groundwork'}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .billing-hero {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .billing-hero-actions,
        .billing-final-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .billing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        .billing-card {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .billing-business-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .billing-business-card {
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          padding: 1rem;
          text-align: left;
          cursor: pointer;
        }

        .billing-business-card span {
          display: block;
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-top: 0.25rem;
        }

        .billing-business-card-active {
          border-color: rgba(255,107,53,0.45);
          background: var(--accent-dim);
        }

        .billing-provider-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .billing-final-actions {
          margin-top: 1.5rem;
          justify-content: flex-start;
        }

        @media (max-width: 640px) {
          .billing-hero,
          .billing-final-actions {
            display: grid;
          }

          .billing-hero-actions,
          .billing-final-actions,
          .billing-hero-actions :global(.btn),
          .billing-final-actions :global(.btn),
          .billing-hero-actions button,
          .billing-final-actions button,
          .billing-hero-actions a,
          .billing-final-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}