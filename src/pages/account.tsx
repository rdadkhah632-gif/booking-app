import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'
import { useI18n } from '@/lib/useI18n'
import { Locale } from '@/lib/i18n'

type Role = 'customer' | 'business' | 'staff'

type Profile = {
  id: string
  email: string
  role: Role | string | null
  full_name?: string | null
  phone?: string | null
  preferred_language?: Locale | string | null
  is_admin?: boolean | null
}

type BusinessRow = {
  id: string
  name: string
  published?: boolean | null
  subscription_status?: string | null
  subscription_plan?: string | null
  trial_ends_at?: string | null
}

type StaffProfile = {
  id: string
  business_id: string
  name: string
  email?: string | null
  role_title?: string | null
  permission_role?: string | null
  invite_status?: string | null
  business_name?: string | null
}

type AccountStats = {
  bookings: number
  unreadNotifications: number
  businessNotifications: number
  adminNotifications: number
  pendingCustomerBookings: number
  pendingBusinessActions: number
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString()
}

function roleLabel(role?: string | null) {
  if (!role) return 'Customer'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function AccountPage() {
  const router = useRouter()
  const { locale, setLocale } = useI18n()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [ownedBusinesses, setOwnedBusinesses] = useState<BusinessRow[]>([])
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(null)
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null)
  const [stats, setStats] = useState<AccountStats>({
    bookings: 0,
    unreadNotifications: 0,
    businessNotifications: 0,
    adminNotifications: 0,
    pendingCustomerBookings: 0,
    pendingBusinessActions: 0
  })
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>('en')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const ownsBusiness = ownedBusinesses.length > 0
  const hasStaffAccess = !!staffProfile
  const isAdmin = !!profile?.is_admin

  const workspaceLabel = useMemo(() => {
    const labels: string[] = []
    if (isAdmin) labels.push('Operator')
    if (ownsBusiness) labels.push('Business owner')
    if (hasStaffAccess) labels.push('Staff')
    labels.push('Customer')
    return labels.join(' + ')
  }, [isAdmin, ownsBusiness, hasStaffAccess])

  async function loadProfile() {
    setLoading(true)
    setError(null)
    setMessage(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, phone, preferred_language, is_admin')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profileData) {
      setError(profileError?.message || 'Could not load account profile.')
      setLoading(false)
      return
    }

    const currentProfile = profileData as Profile
    setProfile(currentProfile)
    setFullName(currentProfile.full_name || '')
    setPhone(currentProfile.phone || '')
    const profileLanguage = currentProfile.preferred_language === 'sq' ? 'sq' : 'en'
    setPreferredLanguage(profileLanguage)
    setLocale(profileLanguage)

    const { data: businessData } = await supabase
      .from('businesses')
      .select('id, name, published, subscription_status, subscription_plan, trial_ends_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const loadedBusinesses = (businessData || []) as BusinessRow[]
    setOwnedBusinesses(loadedBusinesses)
    setPrimaryBusinessId(loadedBusinesses[0]?.id || null)

    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, business_id, name, email, role_title, permission_role, invite_status')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    let resolvedStaffProfile: StaffProfile | null = staffData as StaffProfile | null

    if (resolvedStaffProfile?.business_id) {
      const { data: staffBusiness } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', resolvedStaffProfile.business_id)
        .maybeSingle()

      resolvedStaffProfile = {
        ...resolvedStaffProfile,
        business_name: staffBusiness?.name || null
      }
    }

    setStaffProfile(resolvedStaffProfile)

    await loadStats(session.user.id, loadedBusinesses.map((business) => business.id), !!currentProfile.is_admin)

    setLoading(false)
  }

  async function loadStats(userId: string, businessIds: string[], adminUser: boolean) {
    const { data: customerBookings } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('customer_user_id', userId)
      .limit(200)

    const { data: notifications } = await supabase
      .from('notifications')
      .select('id, audience, read_at')
      .eq('user_id', userId)
      .limit(200)

    let pendingBusinessActions = 0

    if (businessIds.length > 0) {
      const { count: pendingBookingsCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('business_id', businessIds)
        .eq('status', 'pending')

      const { data: pendingRequests } = await supabase
        .from('booking_requests')
        .select('booking_id')
        .in('business_id', businessIds)
        .eq('status', 'pending')

      const uniquePendingReschedules = new Set((pendingRequests || []).map((request) => request.booking_id)).size
      pendingBusinessActions = (pendingBookingsCount || 0) + uniquePendingReschedules
    }

    let adminNotifications = 0

    if (adminUser) {
      const { count: adminUnreadCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('audience', 'admin')
        .is('read_at', null)

      adminNotifications = adminUnreadCount || 0
    }

    const notificationRows = notifications || []
    const bookingRows = customerBookings || []

    setStats({
      bookings: bookingRows.length,
      unreadNotifications: notificationRows.filter((row: any) => !row.read_at).length,
      businessNotifications: notificationRows.filter((row: any) => !row.read_at && row.audience === 'business').length,
      adminNotifications,
      pendingCustomerBookings: bookingRows.filter((row: any) => row.status === 'pending').length,
      pendingBusinessActions
    })
  }

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    setPreferredLanguage(locale)
  }, [locale])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()

    if (!profile) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        preferred_language: preferredLanguage
      })
      .eq('id', profile.id)

    setSaving(false)
    await setLocale(preferredLanguage)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage('Mirëbook account details updated.')
    await loadProfile()
  }

  function publicBusinessHref() {
    return primaryBusinessId ? `/explore/${primaryBusinessId}` : '/dashboard/businesses'
  }

  function staffBusinessName() {
    return staffProfile?.business_name || 'Linked business'
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        {loading && (
          <div className="card">
            <p className="muted">Loading your Mirëbook account...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {!loading && profile && (
          <div className="account-page-shell">
            <div className="account-header">
              <div>
                <p className="small muted">Account settings</p>
                <h1 className="page-title">Your profile</h1>
                <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                  Manage your personal contact details and open the workspaces connected to this login. Operator, business, staff and customer areas stay separated.
                </p>
              </div>

              <div className="account-header-actions">
                <Link href="/support" className="btn btn-ghost">Support</Link>
                <button onClick={logout} className="btn btn-danger">Log out</button>
              </div>
            </div>

            {message && (
              <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)' }}>
                <p style={{ color: 'var(--success)' }}>{message}</p>
              </div>
            )}

            {isAdmin && (
              <div className="card operator-account-card">
                <div className="operator-account-row">
                  <div>
                    <p className="small" style={{ color: 'var(--accent)' }}>Operator access</p>
                    <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                      Mirëbook operator workspace
                    </h2>
                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
                      Use this for business onboarding, trial access, pricing, account lookup and platform notifications. Normal customer and business dashboards are separate.
                    </p>
                  </div>

                  <div className="operator-account-actions">
                    <Link href="/admin" className="btn btn-accent">Operator dashboard</Link>
                    <Link href="/admin/businesses" className="btn btn-ghost">Businesses</Link>
                    <Link href="/admin/users" className="btn btn-ghost">Users</Link>
                    <Link href="/admin/notifications" className="btn btn-ghost">Notifications</Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid-2 account-summary-grid">
              <div className="card">
                <p className="small muted">Email</p>
                <strong>{profile.email}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  Used for login, booking confirmations, staff linking and future email notifications.
                </p>
              </div>

              <div className="card">
                <p className="small muted">Connected workspaces</p>
                <strong>{workspaceLabel}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  Profile role: {roleLabel(profile.role)}. Access is decided by your linked customer, business, staff and operator records.
                </p>
              </div>

              <div className="card" style={{ borderColor: ownsBusiness ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
                <p className="small muted">Business access</p>
                <strong>{ownsBusiness ? `${ownedBusinesses.length} business profile${ownedBusinesses.length === 1 ? '' : 's'}` : 'No business profile'}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {ownsBusiness
                    ? `${stats.pendingBusinessActions} business action${stats.pendingBusinessActions === 1 ? '' : 's'} currently pending.`
                    : 'Create or join a business workspace only when you are onboarding a business.'}
                </p>
              </div>

              <div className="card" style={{ borderColor: hasStaffAccess ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
                <p className="small muted">Staff access</p>
                <strong>{hasStaffAccess ? 'Linked staff profile' : 'Not linked'}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {hasStaffAccess
                    ? `${staffProfile?.name} · ${staffProfile?.role_title || staffProfile?.permission_role || 'Staff member'} at ${staffBusinessName()}`
                    : 'Staff access appears here when a business links this login to a staff profile.'}
                </p>
              </div>

              <div className="card">
                <p className="small muted">Customer activity</p>
                <strong>{stats.bookings} booking{stats.bookings === 1 ? '' : 's'}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {stats.pendingCustomerBookings} pending customer booking{stats.pendingCustomerBookings === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="card">
                <p className="small muted">Notifications</p>
                <strong>{stats.unreadNotifications + stats.adminNotifications} unread</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {stats.businessNotifications} business notice{stats.businessNotifications === 1 ? '' : 's'} · {stats.adminNotifications} operator notice{stats.adminNotifications === 1 ? '' : 's'}.
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="card account-form-card">
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>Contact details</h2>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  Keep this simple. Role/admin access is controlled from the operator area, not from the account page.
                </p>
              </div>

              <div>
                <label className="small muted">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />
              </div>

              <div>
                <label className="small muted">Phone number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />
              </div>

              <div>
                <label className="small muted">Preferred language</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => {
                    const nextLanguage = e.target.value as Locale
                    setPreferredLanguage(nextLanguage)
                    setLocale(nextLanguage)
                  }}
                  style={{ width: '100%', marginTop: '0.4rem' }}
                >
                  <option value="en">English</option>
                  <option value="sq">Shqip</option>
                </select>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  This is saved to your account and used when you sign in on another device.
                </p>
              </div>

              <button type="submit" disabled={saving} className="btn btn-accent">
                {saving ? 'Saving...' : 'Save account details'}
              </button>
            </form>

            <div className="card workspace-card">
              <div className="workspace-card-header">
                <div>
                  <p className="small muted">Workspaces</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>Open a workspace</h2>
                  <p className="small muted" style={{ marginTop: '0.4rem' }}>
                    Each workspace has its own navigation so the app does not mix customer, staff, business and operator tasks.
                  </p>
                </div>
              </div>

              <div className="workspace-section-list">
                {isAdmin && (
                  <div className="workspace-section operator-section">
                    <div>
                      <strong>Operator</strong>
                      <p className="small muted">Business control, account lookup and platform messaging.</p>
                    </div>
                    <div className="workspace-actions">
                      <Link href="/admin" className="btn btn-accent">Dashboard</Link>
                      <Link href="/admin/businesses" className="btn btn-ghost">Businesses</Link>
                      <Link href="/admin/users" className="btn btn-ghost">Users</Link>
                      <Link href="/admin/notifications" className="btn btn-ghost">Notifications</Link>
                    </div>
                  </div>
                )}

                {ownsBusiness && (
                  <div className="workspace-section">
                    <div>
                      <strong>Business owner</strong>
                      <p className="small muted">Bookings, setup, services, staff and public business page.</p>
                    </div>
                    <div className="workspace-actions">
                      <Link href="/dashboard" className="btn btn-accent">Dashboard</Link>
                      <Link href="/dashboard/bookings" className="btn btn-ghost">Bookings</Link>
                      <Link href="/dashboard/businesses" className="btn btn-ghost">Setup</Link>
                      <Link href="/dashboard/notifications" className="btn btn-ghost">Needs action</Link>
                      <Link href={publicBusinessHref()} className="btn btn-ghost">Public page</Link>
                    </div>
                  </div>
                )}

                {hasStaffAccess && (
                  <div className="workspace-section">
                    <div>
                      <strong>Staff</strong>
                      <p className="small muted">Staff schedule and availability for {staffBusinessName()}.</p>
                    </div>
                    <div className="workspace-actions">
                      <Link href="/staff" className="btn btn-accent">Schedule</Link>
                      <Link href="/staff/availability" className="btn btn-ghost">Availability</Link>
                    </div>
                  </div>
                )}

                <div className="workspace-section">
                  <div>
                    <strong>Customer</strong>
                    <p className="small muted">Browse businesses, manage bookings and read customer notifications.</p>
                  </div>
                  <div className="workspace-actions">
                    <Link href="/explore" className="btn btn-accent">Explore</Link>
                    <Link href="/my-bookings" className="btn btn-ghost">My bookings</Link>
                    <Link href="/notifications" className="btn btn-ghost">Notifications</Link>
                  </div>
                </div>
              </div>
            </div>

            {ownedBusinesses.length > 0 && (
              <div className="card">
                <div className="workspace-card-header">
                  <div>
                    <p className="small muted">Business profiles</p>
                    <h2 style={{ fontFamily: 'var(--font-display)' }}>Your businesses</h2>
                  </div>
                </div>

                <div className="business-list">
                  {ownedBusinesses.map((business) => (
                    <div key={business.id} className="business-row">
                      <div>
                        <strong>{business.name}</strong>
                        <p className="small muted" style={{ marginTop: '0.3rem' }}>
                          {business.published ? 'Published' : 'Draft'} · {business.subscription_status || 'trial'} · {business.subscription_plan || 'starter'}
                          {business.trial_ends_at ? ` · trial ends ${formatDate(business.trial_ends_at)}` : ''}
                        </p>
                      </div>
                      <div className="workspace-actions">
                        <Link href={`/explore/${business.id}`} className="btn btn-ghost">Public page</Link>
                        <Link href={`/dashboard/businesses?businessId=${business.id}`} className="btn btn-accent">Manage</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card support-card">
              <div>
                <p className="small muted">Help and language</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>Support</h2>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  Customer, business and staff support routes are separated. Your preferred language is now saved above and will be used across translated Mirëbook pages when you sign in.
                </p>
              </div>

              <div className="workspace-actions">
                <Link href="/support" className="btn btn-ghost">Contact support</Link>
                <span className="language-pill" title="Saved account language">{preferredLanguage === 'sq' ? 'SQ' : 'EN'}</span>
                <button onClick={logout} className="btn btn-danger">Log out</button>
              </div>
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .account-page-shell {
          max-width: 1040px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .account-header,
        .operator-account-row,
        .workspace-card-header,
        .workspace-section,
        .business-row,
        .support-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .account-header-actions,
        .operator-account-actions,
        .workspace-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .account-summary-grid {
          align-items: stretch;
        }

        .operator-account-card {
          border-color: rgba(255,107,53,0.28);
          background: linear-gradient(135deg, rgba(255,107,53,0.08), rgba(45,212,191,0.04));
        }

        .account-form-card {
          display: grid;
          gap: 1rem;
        }

        .workspace-card,
        .workspace-section-list,
        .business-list {
          display: grid;
          gap: 1rem;
        }

        .workspace-section,
        .business-row {
          border: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .operator-section {
          border-color: rgba(255,107,53,0.26);
          background: rgba(255,107,53,0.06);
        }

        .support-card {
          border-color: rgba(255,190,11,0.22);
        }

        .language-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.2rem;
          height: 2.35rem;
          padding: 0 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 700;
        }

        @media (max-width: 700px) {
          .account-header,
          .operator-account-row,
          .workspace-card-header,
          .workspace-section,
          .business-row,
          .support-card {
            display: grid;
          }

          .account-header-actions,
          .operator-account-actions,
          .workspace-actions,
          .account-header-actions :global(.btn),
          .operator-account-actions :global(.btn),
          .workspace-actions :global(.btn),
          .account-header-actions button,
          .operator-account-actions a,
          .workspace-actions a,
          .workspace-actions button {
            width: 100%;
            justify-content: center;
          }

          .language-pill {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}