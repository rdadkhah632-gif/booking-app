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
  description?: string | null
  city?: string | null
  country?: string | null
  category?: string | null
  published?: boolean | null
  created_at?: string | null
  billing_email?: string | null
  subscription_status?: string | null
  subscription_plan?: string | null
  subscription_price_monthly?: number | null
  trial_ends_at?: string | null
  auto_accept_bookings?: boolean | null
  booking_interval_minutes?: number | null
  min_notice_minutes?: number | null
  max_advance_days?: number | null
  profiles?: {
    id?: string | null
    email?: string | null
    full_name?: string | null
  } | {
    id?: string | null
    email?: string | null
    full_name?: string | null
  }[] | null
}

type BusinessCounts = {
  services: number
  staff: number
  bookings: number
}

const STATUS_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' }
]

const PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
  { value: 'custom', label: 'Custom' }
]

function ownerEmail(business: BusinessRow) {
  const profile = Array.isArray(business.profiles) ? business.profiles[0] : business.profiles
  return profile?.email || 'No owner email'
}

function ownerName(business: BusinessRow) {
  const profile = Array.isArray(business.profiles) ? business.profiles[0] : business.profiles
  return profile?.full_name || 'No owner name'
}
function ownerId(business: BusinessRow) {
  const profile = Array.isArray(business.profiles) ? business.profiles[0] : business.profiles
  return profile?.id || business.user_id || ''
}

function formatMoney(value?: number | null) {
  return `£${Number(value || 0).toFixed(2)}`
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString()
}

function statusLabel(value?: string | null) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label || 'Trial'
}

function planLabel(value?: string | null) {
  return PLAN_OPTIONS.find((option) => option.value === value)?.label || 'Starter'
}

export default function AdminBusinessesPage() {
  const router = useRouter()

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRow | null>(null)
  const [countsByBusiness, setCountsByBusiness] = useState<Record<string, BusinessCounts>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [publishedFilter, setPublishedFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filteredBusinesses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return businesses.filter((business) => {
      const matchesSearch = !term || [
        business.name,
        business.city,
        business.country,
        business.category,
        ownerEmail(business),
        ownerName(business),
        business.billing_email
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))

      const matchesStatus = statusFilter === 'all' || (business.subscription_status || 'trial') === statusFilter

      const matchesPublished =
        publishedFilter === 'all' ||
        (publishedFilter === 'published' && business.published) ||
        (publishedFilter === 'draft' && !business.published)

      return matchesSearch && matchesStatus && matchesPublished
    })
  }, [businesses, searchTerm, statusFilter, publishedFilter])

  const summary = useMemo(() => {
    return {
      total: businesses.length,
      published: businesses.filter((business) => business.published).length,
      active: businesses.filter((business) => business.subscription_status === 'active').length,
      trial: businesses.filter((business) => (business.subscription_status || 'trial') === 'trial').length,
      monthlyValue: businesses.reduce((total, business) => {
        if (business.subscription_status !== 'active') return total
        return total + Number(business.subscription_price_monthly || 0)
      }, 0)
    }
  }, [businesses])

  async function loadAdminBusinesses() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/admin/businesses')
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
        setSelectedBusiness(null)
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
          description,
          city,
          country,
          category,
          published,
          created_at,
          billing_email,
          subscription_status,
          subscription_plan,
          subscription_price_monthly,
          trial_ends_at,
          auto_accept_bookings,
          booking_interval_minutes,
          min_notice_minutes,
          max_advance_days,
          profiles (
            id,
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      if (businessError) throw businessError

      const rows = (businessData || []) as unknown as BusinessRow[]
      setBusinesses(rows)

      await loadCounts(rows.map((business) => business.id))

      const queryBusinessId = typeof router.query.businessId === 'string' ? router.query.businessId : ''
      const nextSelected =
        rows.find((business) => business.id === queryBusinessId) ||
        rows[0] ||
        null

      if (nextSelected) {
        setSelectedBusinessId(nextSelected.id)
        setSelectedBusiness(nextSelected)
      } else {
        setSelectedBusinessId('')
        setSelectedBusiness(null)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load admin businesses.')
      setLoading(false)
    }
  }

  async function loadCounts(businessIds: string[]) {
    if (businessIds.length === 0) {
      setCountsByBusiness({})
      return
    }

    const nextCounts: Record<string, BusinessCounts> = {}

    businessIds.forEach((businessId) => {
      nextCounts[businessId] = {
        services: 0,
        staff: 0,
        bookings: 0
      }
    })

    const { data: serviceData } = await supabase
      .from('services')
      .select('id, business_id')
      .in('business_id', businessIds)

    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, business_id')
      .in('business_id', businessIds)

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, business_id')
      .in('business_id', businessIds)

    ;(serviceData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].services += 1
      }
    })

    ;(staffData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].staff += 1
      }
    })

    ;(bookingData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].bookings += 1
      }
    })

    setCountsByBusiness(nextCounts)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadAdminBusinesses()
  }, [router.isReady])

  function selectBusiness(business: BusinessRow) {
    setSelectedBusinessId(business.id)
    setSelectedBusiness(business)
    setSuccess(null)
    setError(null)
    router.replace(`/admin/businesses?businessId=${business.id}`, undefined, { shallow: true })
  }

  function updateSelected<K extends keyof BusinessRow>(key: K, value: BusinessRow[K]) {
    setSelectedBusiness((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: value
      }
    })
  }

  async function saveSelectedBusiness() {
    if (!selectedBusiness) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      published: Boolean(selectedBusiness.published),
      billing_email: selectedBusiness.billing_email?.trim() || null,
      subscription_status: selectedBusiness.subscription_status || 'trial',
      subscription_plan: selectedBusiness.subscription_plan || 'starter',
      subscription_price_monthly: Number(selectedBusiness.subscription_price_monthly || 0),
      trial_ends_at: selectedBusiness.trial_ends_at || null,
      auto_accept_bookings: Boolean(selectedBusiness.auto_accept_bookings),
      booking_interval_minutes: Number(selectedBusiness.booking_interval_minutes || 30),
      min_notice_minutes: Number(selectedBusiness.min_notice_minutes || 120),
      max_advance_days: Number(selectedBusiness.max_advance_days || 60)
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', selectedBusiness.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(`Saved admin changes for ${selectedBusiness.name}.`)

    setBusinesses((current) =>
      current.map((business) =>
        business.id === selectedBusiness.id
          ? {
              ...business,
              ...payload
            }
          : business
      )
    )

    setSelectedBusiness((current) => current ? { ...current, ...payload } : current)
  }

  async function quickSetTrial(days: number) {
    if (!selectedBusiness) return

    const trialDate = new Date()
    trialDate.setDate(trialDate.getDate() + days)
    trialDate.setHours(23, 59, 59, 999)

    setSelectedBusiness({
      ...selectedBusiness,
      subscription_status: 'trial',
      trial_ends_at: trialDate.toISOString()
    })
  }

  async function togglePublished() {
    if (!selectedBusiness) return

    setSelectedBusiness({
      ...selectedBusiness,
      published: !selectedBusiness.published
    })
  }

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
            <p className="muted">Loading Mirëbook business admin...</p>
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
              <h1 className="page-title" style={{ marginTop: '0.35rem' }}>No access</h1>
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                This page is only for Mirëbook admin users.
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
              <h1 className="page-title">Business admin</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Manage early business onboarding, trial periods, custom pricing, publishing and billing status.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/admin" className="btn btn-ghost">
                Admin overview
              </Link>

              <Link href="/admin/users" className="btn btn-ghost">
                Users
              </Link>

              <Link href="/admin/notifications" className="btn btn-ghost">
                Notifications
              </Link>

              <button type="button" className="btn btn-ghost" onClick={loadAdminBusinesses}>
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)' }}>
              <p style={{ color: 'var(--success)' }}>{success}</p>
            </div>
          )}

          <div className="grid-4">
            <div className="card">
              <p className="small muted">Total businesses</p>
              <h2>{summary.total}</h2>
              <p className="small muted">Loaded into admin</p>
            </div>

            <div className="card">
              <p className="small muted">Published</p>
              <h2>{summary.published}</h2>
              <p className="small muted">{summary.total - summary.published} hidden/draft</p>
            </div>

            <div className="card">
              <p className="small muted">Trial accounts</p>
              <h2>{summary.trial}</h2>
              <p className="small muted">{summary.active} active subscriptions</p>
            </div>

            <div className="card">
              <p className="small muted">Active monthly value</p>
              <h2>{formatMoney(summary.monthlyValue)}</h2>
              <p className="small muted">Active businesses only</p>
            </div>
          </div>

          <div className="admin-layout-grid">
            <div className="card admin-list-card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Businesses</p>
                  <h2>Find account</h2>
                </div>
              </div>

              <div className="admin-filter-grid">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, city, owner, billing email..."
                />

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select value={publishedFilter} onChange={(event) => setPublishedFilter(event.target.value)}>
                  <option value="all">Published + draft</option>
                  <option value="published">Published only</option>
                  <option value="draft">Draft only</option>
                </select>
              </div>

              {filteredBusinesses.length === 0 ? (
                <div className="admin-empty">
                  <h3>No matching businesses</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Clear search or change filters.
                  </p>
                </div>
              ) : (
                <div className="admin-business-list">
                  {filteredBusinesses.map((business) => {
                    const counts = countsByBusiness[business.id] || { services: 0, staff: 0, bookings: 0 }

                    return (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => selectBusiness(business)}
                        className={business.id === selectedBusinessId ? 'admin-business-row admin-business-row-active' : 'admin-business-row'}
                      >
                        <span>
                          <strong>{business.name}</strong>
                          <span className="small muted">
                            {[business.category, business.city, business.country].filter(Boolean).join(' · ') || 'No category/location'}
                          </span>
                          <span className="small muted">
                            {ownerEmail(business)}
                          </span>
                          {ownerId(business) && (
                            <span className="small muted">
                              Owner ID: {ownerId(business).slice(0, 8)}…
                            </span>
                          )}
                        </span>

                        <span className="admin-row-meta">
                          <span className={business.published ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                            {business.published ? 'Published' : 'Draft'}
                          </span>
                          <span className="admin-pill admin-pill-accent">
                            {statusLabel(business.subscription_status)}
                          </span>
                          <span className="small muted">
                            {counts.services} services · {counts.staff} staff · {counts.bookings} bookings
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card admin-editor-card">
              {!selectedBusiness ? (
                <div className="admin-empty">
                  <h3>Select a business</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Choose a business to manage its trial, subscription and publishing controls.
                  </p>
                </div>
              ) : (
                <>
                  <div className="admin-editor-header">
                    <div>
                      <p className="small muted">Selected business</p>
                      <h2>{selectedBusiness.name}</h2>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        Owner: {ownerName(selectedBusiness)} · {ownerEmail(selectedBusiness)}
                      </p>
                    </div>

                    <div className="admin-actions">
                      <Link href={`/explore/${selectedBusiness.id}`} className="btn btn-ghost">
                        Public page
                      </Link>
                      {ownerId(selectedBusiness) && (
                        <Link href={`/admin/users?userId=${ownerId(selectedBusiness)}`} className="btn btn-ghost">
                          Owner account
                        </Link>
                      )}
                      <Link href={`/admin/notifications?businessId=${selectedBusiness.id}`} className="btn btn-ghost">
                        Notify
                      </Link>

                      <button type="button" className="btn btn-accent" onClick={saveSelectedBusiness} disabled={saving}>
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </div>

                  <div className="admin-editor-grid">
                    <div>
                      <label className="small muted">Published status</label>
                      <button
                        type="button"
                        className={selectedBusiness.published ? 'admin-toggle admin-toggle-on' : 'admin-toggle'}
                        onClick={togglePublished}
                      >
                        {selectedBusiness.published ? 'Published on marketplace' : 'Hidden / draft'}
                      </button>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        Use this to manually hide a business while onboarding or if there is an issue.
                      </p>
                    </div>

                    <div>
                      <label className="small muted">Subscription status</label>
                      <select
                        value={selectedBusiness.subscription_status || 'trial'}
                        onChange={(event) => updateSelected('subscription_status', event.target.value)}
                        style={{ marginTop: '0.4rem' }}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Plan</label>
                      <select
                        value={selectedBusiness.subscription_plan || 'starter'}
                        onChange={(event) => updateSelected('subscription_plan', event.target.value)}
                        style={{ marginTop: '0.4rem' }}
                      >
                        {PLAN_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Monthly price</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={selectedBusiness.subscription_price_monthly ?? 0}
                        onChange={(event) => updateSelected('subscription_price_monthly', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      />
                    </div>

                    <div>
                      <label className="small muted">Trial ends</label>
                      <input
                        type="date"
                        value={selectedBusiness.trial_ends_at ? selectedBusiness.trial_ends_at.slice(0, 10) : ''}
                        onChange={(event) => {
                          updateSelected(
                            'trial_ends_at',
                            event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : null
                          )
                        }}
                        style={{ marginTop: '0.4rem' }}
                      />
                    </div>

                    <div>
                      <label className="small muted">Billing email</label>
                      <input
                        type="email"
                        value={selectedBusiness.billing_email || ''}
                        onChange={(event) => updateSelected('billing_email', event.target.value)}
                        placeholder="billing@example.com"
                        style={{ marginTop: '0.4rem' }}
                      />
                    </div>

                    <div>
                      <label className="small muted">Auto-accept bookings</label>
                      <select
                        value={selectedBusiness.auto_accept_bookings ? 'yes' : 'no'}
                        onChange={(event) => updateSelected('auto_accept_bookings', event.target.value === 'yes')}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value="yes">Yes, instant confirm</option>
                        <option value="no">No, manual approval</option>
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Booking interval minutes</label>
                      <select
                        value={selectedBusiness.booking_interval_minutes || 30}
                        onChange={(event) => updateSelected('booking_interval_minutes', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Minimum notice</label>
                      <select
                        value={selectedBusiness.min_notice_minutes || 120}
                        onChange={(event) => updateSelected('min_notice_minutes', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value={0}>No minimum</option>
                        <option value={60}>1 hour</option>
                        <option value={120}>2 hours</option>
                        <option value={240}>4 hours</option>
                        <option value={1440}>24 hours</option>
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Max advance booking</label>
                      <select
                        value={selectedBusiness.max_advance_days || 60}
                        onChange={(event) => updateSelected('max_advance_days', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                        <option value={180}>180 days</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-quick-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => quickSetTrial(30)}>
                      Give 30 day trial
                    </button>

                    <button type="button" className="btn btn-ghost" onClick={() => quickSetTrial(60)}>
                      Give 60 day trial
                    </button>

                    <button type="button" className="btn btn-ghost" onClick={() => {
                      updateSelected('subscription_status', 'active')
                      updateSelected('trial_ends_at', null)
                    }}>
                      Mark active
                    </button>

                    <button type="button" className="btn btn-danger" onClick={() => updateSelected('subscription_status', 'paused')}>
                      Pause access status
                    </button>
                  </div>

                  <div className="admin-readiness-box">
                    <p className="small muted">Operational snapshot</p>
                    <div className="grid-3" style={{ marginTop: '0.75rem' }}>
                      <div>
                        <strong>{countsByBusiness[selectedBusiness.id]?.services || 0}</strong>
                        <p className="small muted">Services</p>
                      </div>
                      <div>
                        <strong>{countsByBusiness[selectedBusiness.id]?.staff || 0}</strong>
                        <p className="small muted">Staff</p>
                      </div>
                      <div>
                        <strong>{countsByBusiness[selectedBusiness.id]?.bookings || 0}</strong>
                        <p className="small muted">Bookings</p>
                      </div>
                    </div>
                  </div>
                  <div className="admin-owner-box">
                    <div>
                      <p className="small muted">Owner account</p>
                      <strong>{ownerName(selectedBusiness)}</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        {ownerEmail(selectedBusiness)}
                      </p>
                    </div>

                    {ownerId(selectedBusiness) && (
                      <Link href={`/admin/users?userId=${ownerId(selectedBusiness)}`} className="btn btn-ghost">
                        Manage owner
                      </Link>
                    )}
                    <Link href={`/admin/notifications?businessId=${selectedBusiness.id}`} className="btn btn-ghost">
                      Send notice
                    </Link>
                  </div>

                  <div className="admin-save-footer">
                    <div>
                      <p className="small muted">Current state</p>
                      <strong>
                        {selectedBusiness.published ? 'Published' : 'Draft'} · {statusLabel(selectedBusiness.subscription_status)} · {planLabel(selectedBusiness.subscription_plan)} · {formatMoney(selectedBusiness.subscription_price_monthly)} / month
                      </strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        Trial ends: {formatDate(selectedBusiness.trial_ends_at)}
                      </p>
                    </div>

                    <button type="button" className="btn btn-accent" onClick={saveSelectedBusiness} disabled={saving}>
                      {saving ? 'Saving...' : 'Save admin changes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .admin-shell {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .admin-header,
        .admin-section-header,
        .admin-editor-header,
        .admin-save-footer {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .admin-actions,
        .admin-business-actions,
        .admin-quick-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .admin-layout-grid {
          display: grid;
          grid-template-columns: minmax(300px, 0.85fr) minmax(0, 1.15fr);
          gap: 1rem;
          align-items: start;
        }

        .admin-list-card,
        .admin-editor-card {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .admin-filter-grid {
          display: grid;
          gap: 0.75rem;
        }

        .admin-business-list {
          display: grid;
          gap: 0.75rem;
          max-height: 720px;
          overflow: auto;
          padding-right: 0.25rem;
        }

        .admin-business-row {
          width: 100%;
          text-align: left;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          padding: 1rem;
          display: grid;
          gap: 0.65rem;
        }

        .admin-business-row-active {
          border-color: rgba(255,107,53,0.42);
          background: rgba(255,107,53,0.08);
        }

        .admin-business-row span {
          display: grid;
          gap: 0.2rem;
        }

        .admin-row-meta {
          display: flex !important;
          gap: 0.45rem !important;
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
          width: fit-content;
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

        .admin-empty {
          padding: 1rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }

        .admin-editor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 1rem;
        }

        .admin-toggle {
          width: 100%;
          margin-top: 0.4rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          border-radius: var(--radius);
          padding: 0.8rem 1rem;
          font-weight: 700;
          text-align: left;
        }

        .admin-toggle-on {
          border-color: rgba(6,214,160,0.28);
          background: var(--success-dim);
          color: var(--success);
        }

        .admin-quick-actions {
          justify-content: flex-start;
          padding-top: 0.25rem;
        }

                        .admin-readiness-box,
        .admin-owner-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .admin-owner-box {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .admin-save-footer {
          background: rgba(255,107,53,0.06);
          border: 1px solid rgba(255,107,53,0.22);
          border-radius: var(--radius);
          padding: 1rem;
          align-items: center;
        }

        @media (max-width: 980px) {
          .admin-layout-grid {
            grid-template-columns: 1fr;
          }

          .admin-business-list {
            max-height: none;
          }
        }

        @media (max-width: 640px) {
          .admin-header,
          .admin-section-header,
          .admin-editor-header,
          .admin-save-footer,
          .admin-owner-box {
            display: grid;
          }

          .admin-actions,
          .admin-business-actions,
          .admin-quick-actions,
          .admin-actions :global(.btn),
          .admin-business-actions :global(.btn),
          .admin-quick-actions :global(.btn),
          .admin-save-footer :global(.btn),
          .admin-owner-box :global(.btn),
          .admin-actions a,
          .admin-business-actions a,
          .admin-quick-actions button,
          .admin-save-footer button,
          .admin-owner-box a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}