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

type UserSummary = {
  id: string
  email?: string | null
  role?: string | null
  is_admin?: boolean | null
  created_at?: string | null
}

type BusinessCounts = {
  services: number
  activeServices: number
  staff: number
  activeStaff: number
  staffServiceAssignments: number
  bookings: number
  pendingBookings: number
}

type NotificationSummary = {
  unread: number
  adminSent: number
  supportNotice: number
}

function statusLabel(status?: string | null) {
  if (!status) return 'Trial'
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatMoney(value?: number | null) {
  return `£${Number(value || 0).toFixed(2)}`
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString()
}

function daysUntil(value?: string | null) {
  if (!value) return null
  const target = new Date(value).getTime()
  const now = new Date().getTime()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export default function AdminIndexPage() {
  const router = useRouter()

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [countsByBusiness, setCountsByBusiness] = useState<Record<string, BusinessCounts>>({})
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummary>({ unread: 0, adminSent: 0, supportNotice: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function getCounts(businessId?: string | null) {
    if (!businessId) {
      return {
        services: 0,
        activeServices: 0,
        staff: 0,
        activeStaff: 0,
        staffServiceAssignments: 0,
        bookings: 0,
        pendingBookings: 0
      }
    }

    return countsByBusiness[businessId] || {
      services: 0,
      activeServices: 0,
      staff: 0,
      activeStaff: 0,
      staffServiceAssignments: 0,
      bookings: 0,
      pendingBookings: 0
    }
  }

  function readinessIssues(business: BusinessRow) {
    const counts = getCounts(business.id)
    const issues: string[] = []

    if (!business.name?.trim()) issues.push('name')
    if (!business.category?.trim()) issues.push('category')
    if (!business.city?.trim()) issues.push('city')
    if (counts.activeServices === 0) issues.push('active service')
    if (counts.activeStaff === 0) issues.push('active staff')
    if (counts.staffServiceAssignments === 0) issues.push('staff assignment')

    return issues
  }

  function needsAttention(business: BusinessRow) {
    const counts = getCounts(business.id)
    const trialDays = daysUntil(business.trial_ends_at)

    return (
      readinessIssues(business).length > 0 ||
      counts.pendingBookings > 0 ||
      business.subscription_status === 'past_due' ||
      business.subscription_status === 'paused' ||
      ((business.subscription_status || 'trial') === 'trial' && trialDays !== null && trialDays <= 7)
    )
  }

  const summary = useMemo(() => {
    const published = businesses.filter((business) => business.published).length
    const draft = businesses.length - published
    const trial = businesses.filter((business) => (business.subscription_status || 'trial') === 'trial').length
    const active = businesses.filter((business) => business.subscription_status === 'active').length
    const paused = businesses.filter((business) => business.subscription_status === 'paused' || business.subscription_status === 'past_due').length
    const attention = businesses.filter((business) => needsAttention(business)).length
    const monthlyTotal = businesses.reduce((total, business) => {
      if (business.subscription_status !== 'active') return total
      return total + Number(business.subscription_price_monthly || 0)
    }, 0)

    return {
      users: users.length,
      admins: users.filter((user) => user.is_admin).length,
      businessRoleUsers: users.filter((user) => user.role === 'business').length,
      businesses: businesses.length,
      published,
      draft,
      trial,
      active,
      paused,
      attention,
      monthlyTotal
    }
  }, [businesses, users, countsByBusiness])

  const attentionBusinesses = useMemo(() => {
    return businesses
      .filter((business) => needsAttention(business))
      .slice(0, 8)
  }, [businesses, countsByBusiness])

  const trialEndingBusinesses = useMemo(() => {
    return businesses
      .filter((business) => (business.subscription_status || 'trial') === 'trial')
      .map((business) => ({ business, days: daysUntil(business.trial_ends_at) }))
      .filter((row) => row.days !== null)
      .sort((a, b) => Number(a.days) - Number(b.days))
      .slice(0, 8)
  }, [businesses])

  const latestBusinesses = useMemo(() => {
    return businesses.slice(0, 8)
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
        setUsers([])
        setCountsByBusiness({})
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
        .limit(500)

      if (businessError) throw businessError

      const loadedBusinesses = (businessData || []) as BusinessRow[]
      setBusinesses(loadedBusinesses)

      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, email, role, is_admin, created_at')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (userError) throw userError

      setUsers((userData || []) as UserSummary[])

      await loadCounts(loadedBusinesses.map((business) => business.id))
      await loadNotificationSummary()

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load admin dashboard.')
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
        activeServices: 0,
        staff: 0,
        activeStaff: 0,
        staffServiceAssignments: 0,
        bookings: 0,
        pendingBookings: 0
      }
    })

    const { data: serviceData } = await supabase
      .from('services')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, business_id, status')
      .in('business_id', businessIds)

    const staffIds = (staffData || []).map((row: any) => row.id).filter(Boolean)

    const { data: staffServiceData } = staffIds.length > 0
      ? await supabase
          .from('staff_services')
          .select('id, staff_member_id')
          .in('staff_member_id', staffIds)
      : { data: [] as any[] }

    const staffBusinessMap = (staffData || []).reduce((map: Record<string, string>, row: any) => {
      if (row.id && row.business_id) map[row.id] = row.business_id
      return map
    }, {})

    ;(serviceData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].services += 1
        if (row.active) nextCounts[row.business_id].activeServices += 1
      }
    })

    ;(staffData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].staff += 1
        if (row.active) nextCounts[row.business_id].activeStaff += 1
      }
    })

    ;(bookingData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].bookings += 1
        if (['pending', 'requested', 'awaiting_approval'].includes(String(row.status || '').toLowerCase())) {
          nextCounts[row.business_id].pendingBookings += 1
        }
      }
    })

    ;(staffServiceData || []).forEach((row: any) => {
      const businessId = staffBusinessMap[row.staff_member_id]
      if (businessId && nextCounts[businessId]) {
        nextCounts[businessId].staffServiceAssignments += 1
      }
    })

    setCountsByBusiness(nextCounts)
  }

  async function loadNotificationSummary() {
    const { data: notificationData } = await supabase
      .from('notifications')
      .select('id, type, read_at')
      .limit(1000)

    const rows = notificationData || []

    setNotificationSummary({
      unread: rows.filter((row: any) => !row.read_at).length,
      adminSent: rows.filter((row: any) => String(row.type || '').startsWith('admin_') || ['trial_reminder', 'billing_notice', 'support_notice', 'platform_update'].includes(String(row.type || ''))).length,
      supportNotice: rows.filter((row: any) => row.type === 'support_notice').length
    })
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
            <p className="muted">Loading Mirëbook operator dashboard...</p>
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
                This area is for Mirëbook operator users only.
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
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook operator</p>
              <h1 className="page-title">Operator dashboard</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Control onboarding, trials, subscriptions, users, platform messaging and launch readiness from one admin workspace.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/admin/businesses" className="btn btn-accent">
                Businesses
              </Link>

              <Link href="/admin/users" className="btn btn-ghost">
                Users
              </Link>

              <Link href="/admin/notifications" className="btn btn-ghost">
                Notifications
              </Link>

              <Link href="/admin/support" className="btn btn-ghost">
                Support
              </Link>

              <button type="button" className="btn btn-ghost" onClick={loadAdmin}>
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          <div className="grid-4">
            <div className="card admin-metric-card">
              <p className="small muted">Businesses</p>
              <h2>{summary.businesses}</h2>
              <p className="small muted">{summary.published} published · {summary.draft} draft</p>
            </div>

            <div className="card admin-metric-card" style={{ borderColor: summary.attention > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
              <p className="small muted">Needs attention</p>
              <h2>{summary.attention}</h2>
              <p className="small muted">Setup, trial, billing or pending action</p>
            </div>

            <div className="card admin-metric-card">
              <p className="small muted">Trial / active</p>
              <h2>{summary.trial} / {summary.active}</h2>
              <p className="small muted">{summary.paused} paused or past due</p>
            </div>

            <div className="card admin-metric-card">
              <p className="small muted">Active monthly value</p>
              <h2>{formatMoney(summary.monthlyTotal)}</h2>
              <p className="small muted">Based on active businesses only</p>
            </div>
          </div>

          <div className="grid-4">
            <div className="card admin-metric-card">
              <p className="small muted">Users</p>
              <h2>{summary.users}</h2>
              <p className="small muted">{summary.admins} admin account{summary.admins === 1 ? '' : 's'}</p>
            </div>

            <div className="card admin-metric-card">
              <p className="small muted">Business-role users</p>
              <h2>{summary.businessRoleUsers}</h2>
              <p className="small muted">Users marked as business accounts</p>
            </div>

            <div className="card admin-metric-card">
              <p className="small muted">Unread notifications</p>
              <h2>{notificationSummary.unread}</h2>
              <p className="small muted">Across loaded notification records</p>
            </div>

            <Link href="/admin/support" className="card admin-metric-card admin-metric-link-card">
              <p className="small muted">Support inbox</p>
              <h2>{notificationSummary.supportNotice}</h2>
              <p className="small muted">Support notices and user help requests</p>
            </Link>
          </div>

          <div className="grid-3">
            <Link href="/admin/businesses" className="card admin-control-card">
              <p className="small muted">Business control</p>
              <h3>Businesses, trials and pricing</h3>
              <p className="small muted" style={{ marginTop: '0.4rem' }}>
                Manage publishing, custom prices, subscription state, trial periods and business readiness.
              </p>
            </Link>

            <Link href="/admin/users" className="card admin-control-card">
              <p className="small muted">Account lookup</p>
              <h3>Users and support context</h3>
              <p className="small muted" style={{ marginTop: '0.4rem' }}>
                Search accounts, inspect linked businesses/bookings and safely manage protected access controls.
              </p>
            </Link>

            <Link href="/admin/notifications" className="card admin-control-card">
              <p className="small muted">Platform messaging</p>
              <h3>Notifications and promotions</h3>
              <p className="small muted" style={{ marginTop: '0.4rem' }}>
                Send user, business-owner, admin-only or bulk operational notices with safer targeting.
              </p>
            </Link>

            <Link href="/admin/support" className="card admin-control-card admin-support-control-card">
              <p className="small muted">Support operations</p>
              <h3>Support inbox and replies</h3>
              <p className="small muted" style={{ marginTop: '0.4rem' }}>
                Review customer, staff and business help requests, then reply from the operator workspace.
              </p>
            </Link>
          </div>

          <div className="admin-dashboard-grid">
            <div className="card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Attention queue</p>
                  <h2>Businesses to review</h2>
                </div>

                <Link href="/admin/businesses?attention=attention" className="btn btn-ghost">
                  Open business control
                </Link>
              </div>

              {attentionBusinesses.length === 0 ? (
                <div className="admin-empty">
                  <h3>No attention items found</h3>
                  <p className="muted" style={{ marginTop: '0.4rem' }}>
                    No loaded business currently has readiness, billing, trial or pending-booking attention flags.
                  </p>
                </div>
              ) : (
                <div className="admin-business-list">
                  {attentionBusinesses.map((business) => {
                    const counts = getCounts(business.id)
                    const issues = readinessIssues(business)
                    const trialDays = daysUntil(business.trial_ends_at)

                    return (
                      <div key={business.id} className="admin-business-card">
                        <div>
                          <div className="admin-business-title-row">
                            <strong>{business.name}</strong>
                            <span className={business.published ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                              {business.published ? 'Published' : 'Draft'}
                            </span>
                            <span className="admin-pill admin-pill-warning">
                              Review
                            </span>
                          </div>

                          <p className="small muted" style={{ marginTop: '0.35rem' }}>
                            {[business.category, business.city, business.country].filter(Boolean).join(' · ') || 'No location/category set'}
                          </p>

                          <p className="small muted" style={{ marginTop: '0.35rem' }}>
                            {issues.length > 0 ? `Missing: ${issues.join(', ')}` : 'Setup fields look complete'} · {counts.pendingBookings} pending booking{counts.pendingBookings === 1 ? '' : 's'}
                          </p>

                          {trialDays !== null && (business.subscription_status || 'trial') === 'trial' && (
                            <p className="small muted" style={{ marginTop: '0.35rem' }}>
                              Trial: {trialDays >= 0 ? `${trialDays} day${trialDays === 1 ? '' : 's'} left` : 'ended'}
                            </p>
                          )}
                        </div>

                        <div className="admin-business-actions">
                          <Link href={`/admin/businesses?businessId=${business.id}`} className="btn btn-accent">Manage</Link>
                          <Link href={`/admin/notifications?businessId=${business.id}`} className="btn btn-ghost">Notify</Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Trial monitoring</p>
                  <h2>Trials ending soon</h2>
                </div>

                <Link href="/admin/notifications" className="btn btn-ghost">
                  Send reminders
                </Link>
              </div>

              {trialEndingBusinesses.length === 0 ? (
                <div className="admin-empty">
                  <h3>No dated trials loaded</h3>
                  <p className="muted" style={{ marginTop: '0.4rem' }}>
                    Trial end dates will appear here once they are set from the business control centre.
                  </p>
                </div>
              ) : (
                <div className="admin-business-list">
                  {trialEndingBusinesses.map(({ business, days }) => (
                    <div key={business.id} className="admin-business-card compact">
                      <div>
                        <div className="admin-business-title-row">
                          <strong>{business.name}</strong>
                          <span className={Number(days) <= 7 ? 'admin-pill admin-pill-warning' : 'admin-pill admin-pill-accent'}>
                            {Number(days) >= 0 ? `${days} day${days === 1 ? '' : 's'} left` : 'Ended'}
                          </span>
                        </div>
                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          Ends {formatDate(business.trial_ends_at)} · {business.subscription_plan || 'starter'}
                        </p>
                      </div>

                      <div className="admin-business-actions">
                        <Link href={`/admin/businesses?businessId=${business.id}`} className="btn btn-ghost">Manage</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

            {latestBusinesses.length === 0 ? (
              <div className="admin-empty">
                <h3>No businesses found yet</h3>
                <p className="muted" style={{ marginTop: '0.4rem' }}>
                  Businesses will appear here once they create profiles.
                </p>
              </div>
            ) : (
              <div className="admin-business-list">
                {latestBusinesses.map((business) => (
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
                        {business.trial_ends_at ? ` · trial ends ${formatDate(business.trial_ends_at)}` : ''}
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

                      <Link href={`/admin/notifications?businessId=${business.id}`} className="btn btn-ghost">
                        Notify
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card admin-roadmap-card">
            <p className="small muted">Launch readiness note</p>
            <h3 style={{ marginTop: '0.25rem' }}>This is the internal Mirëbook operator workspace.</h3>
            <p className="small muted" style={{ marginTop: '0.5rem' }}>
              Business controls, user lookup, platform notifications, trial management and support inbox features should stay here rather than inside customer, staff or business-owner workspaces.
            </p>
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

        .admin-dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
          gap: 1rem;
          align-items: start;
        }

        .admin-metric-card {
          min-height: 118px;
        }

        .admin-metric-link-card {
          display: block;
          transition: border-color 0.2s, transform 0.2s;
        }

        .admin-metric-link-card:hover,
        .admin-support-control-card:hover {
          border-color: rgba(45,212,191,0.35);
          transform: translateY(-1px);
        }

        .admin-control-card {
          display: block;
          min-height: 150px;
          transition: border-color 0.2s, transform 0.2s;
        }

        .admin-control-card:hover {
          border-color: rgba(255,107,53,0.35);
          transform: translateY(-1px);
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

        .admin-business-card.compact {
          padding: 0.85rem;
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

        .admin-pill-warning {
          background: rgba(255,190,11,0.12);
          color: var(--warning);
          border-color: rgba(255,190,11,0.22);
        }

        .admin-roadmap-card {
          border-color: rgba(255,190,11,0.25);
        }

        @media (max-width: 980px) {
          .admin-dashboard-grid {
            grid-template-columns: 1fr;
          }
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