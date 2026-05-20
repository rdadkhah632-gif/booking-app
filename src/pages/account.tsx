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

function roleLabel(role?: string | null) {
  if (!role) return 'Customer'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function AccountPage() {
  const router = useRouter()
  const { locale, setLocale, t } = useI18n()

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
    if (isAdmin) labels.push(t('account.access.operator', 'Operator'))
    if (ownsBusiness) labels.push(t('account.access.businessOwner', 'Business owner'))
    if (hasStaffAccess) labels.push(t('account.access.staff', 'Staff'))
    labels.push(t('account.access.customer', 'Customer'))
    return labels.join(' + ')
  }, [isAdmin, ownsBusiness, hasStaffAccess, t])

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
      setError(profileError?.message || t('account.error.loadProfile', 'Could not load account profile.'))
      setLoading(false)
      return
    }

    const currentProfile = profileData as Profile
    const profileLanguage: Locale = currentProfile.preferred_language === 'sq' ? 'sq' : 'en'

    setProfile(currentProfile)
    setFullName(currentProfile.full_name || '')
    setPhone(currentProfile.phone || '')
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
    setLocale(preferredLanguage)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(t('account.saveSuccess', 'Mirëbook account details updated.'))
    await loadProfile()
  }

  function publicBusinessHref() {
    return primaryBusinessId ? `/explore/${primaryBusinessId}` : '/dashboard/businesses'
  }

  function staffBusinessName() {
    return staffProfile?.business_name || t('account.linkedBusiness', 'Linked business')
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
            <p className="muted">{t('account.loading', 'Loading your Mirëbook account...')}</p>
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
                <p className="small muted">{t('account.kicker', 'Account')}</p>
                <h1 className="page-title">{t('account.pageTitle', 'My account')}</h1>
                <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                  {t('account.pageSubtitle', 'Manage your name, phone number and language preference. Business booking rules are managed separately in Business settings.')}
                </p>
              </div>

              <div className="account-header-actions">
                <Link href="/support" className="btn btn-ghost">{t('nav.support', 'Support')}</Link>
                <button onClick={logout} className="btn btn-danger">{t('auth.logout', 'Log out')}</button>
              </div>
            </div>

            {message && (
              <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)' }}>
                <p style={{ color: 'var(--success)' }}>{message}</p>
              </div>
            )}

            <form onSubmit={saveProfile} className="card account-form-card account-primary-card">
              <div>
                <p className="small muted">{t('account.primaryKicker', 'Personal settings')}</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>{t('account.personalDetails', 'Personal details')}</h2>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {t('account.accountOnlyBody', 'These settings belong to your login account. They do not change your business profile, services, staff or booking rules.')}
                </p>
              </div>

              <div className="account-form-grid">
                <div>
                  <label className="small muted">{t('account.fullName', 'Full name')}</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('account.fullNamePlaceholder', 'Your full name')}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  />
                </div>

                <div>
                  <label className="small muted">{t('common.phone', 'Phone')}</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('account.phonePlaceholder', 'Phone number')}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  />
                </div>

                <div>
                  <label className="small muted">{t('account.languagePreference', 'Language preference')}</label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => {
                      const nextLanguage = e.target.value as Locale
                      setPreferredLanguage(nextLanguage)
                      setLocale(nextLanguage)
                    }}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  >
                    <option value="en">{t('language.english', 'English')}</option>
                    <option value="sq">{t('language.albanian', 'Albanian')}</option>
                  </select>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {t('account.languageBody', 'This language is saved to your account and used across translated Mirëbook pages when you sign in.')}
                  </p>
                </div>
              </div>

              <button type="submit" disabled={saving} className="btn btn-accent">
                {saving ? t('account.saving', 'Saving...') : t('account.saveChanges', 'Save changes')}
              </button>
            </form>

            <div className="card" style={{ borderColor: 'rgba(255,107,53,0.25)' }}>
              <p className="small muted">{t('account.businessSettingsKicker', 'Business settings are separate')}</p>
              <h3 style={{ marginTop: '0.25rem' }}>{t('account.businessSettingsTitle', 'Need to change your business setup?')}</h3>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {t('account.businessSettingsBody', 'Use Business settings for booking rules, approval mode, policies, billing, services, staff and public business details.')}
              </p>
              <Link href="/dashboard/settings" className="btn btn-ghost" style={{ marginTop: '0.75rem' }}>
                {t('dashboardSettings.pageTitle', 'Business settings')}
              </Link>
            </div>

            {isAdmin && (
              <div className="card operator-account-card">
                <div className="operator-account-row">
                  <div>
                    <p className="small" style={{ color: 'var(--accent)' }}>{t('account.operator.kicker', 'Operator access')}</p>
                    <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                      {t('account.operator.title', 'Mirëbook operator tools')}
                    </h2>
                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
                      {t('account.operator.body', 'Use this for business onboarding, trial access, pricing, account lookup and platform notifications. Customer and business dashboards are separate.')}
                    </p>
                  </div>

                  <div className="operator-account-actions">
                    <Link href="/admin" className="btn btn-accent">{t('account.operator.dashboard', 'Operator dashboard')}</Link>
                    <Link href="/admin/businesses" className="btn btn-ghost">{t('dashboardBusinesses.stats.businesses', 'Businesses')}</Link>
                    <Link href="/admin/users" className="btn btn-ghost">{t('account.operator.users', 'Users')}</Link>
                    <Link href="/admin/notifications" className="btn btn-ghost">{t('dashboardHome.openNotifications', 'Notifications')}</Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid-2 account-summary-grid">
              <div className="card">
                <p className="small muted">{t('account.email', 'Email')}</p>
                <strong>{profile.email}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {t('account.emailBody', 'Used for login, booking confirmations, staff linking and future email notifications.')}
                </p>
              </div>

              <div className="card">
                <p className="small muted">{t('account.accessSummary', 'Access summary')}</p>
                <strong>{workspaceLabel}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {t('account.profileRole', 'Profile role')}: {roleLabel(profile.role)}. {t('account.accessBody', 'Access is decided by your linked customer, business, staff and operator records.')}
                </p>
              </div>

              <div className="card" style={{ borderColor: ownsBusiness ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
                <p className="small muted">{t('account.businessAccess', 'Business access')}</p>
                <strong>
                  {ownsBusiness
                    ? `${ownedBusinesses.length} ${t('account.businessProfile', 'business profile')}${ownedBusinesses.length === 1 ? '' : 's'}`
                    : t('account.noBusinessProfile', 'No business profile')}
                </strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {ownsBusiness
                    ? `${stats.pendingBusinessActions} ${t('account.businessAction', 'business action')}${stats.pendingBusinessActions === 1 ? '' : 's'} ${t('account.currentlyPending', 'currently pending.')}`
                    : t('account.noBusinessProfileBody', 'Create or join a business only when you are onboarding a real business.')}
                </p>
              </div>

              <div className="card" style={{ borderColor: hasStaffAccess ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
                <p className="small muted">{t('account.staffAccess', 'Staff access')}</p>
                <strong>{hasStaffAccess ? t('account.linkedStaffProfile', 'Linked staff profile') : t('dashboardStaff.card.notLinked', 'Not linked')}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {hasStaffAccess
                    ? `${staffProfile?.name} · ${staffProfile?.role_title || staffProfile?.permission_role || t('account.access.staff', 'Staff')} ${t('account.at', 'at')} ${staffBusinessName()}`
                    : t('account.staffAccessBody', 'Staff access appears here when a business links this login to a staff profile.')}
                </p>
              </div>

              <div className="card">
                <p className="small muted">{t('account.customerActivity', 'Customer activity')}</p>
                <strong>{stats.bookings} {t('support.business.bookings', 'booking')}{stats.bookings === 1 ? '' : 's'}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {stats.pendingCustomerBookings} {t('account.pendingCustomerBookings', 'pending customer booking')}{stats.pendingCustomerBookings === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="card">
                <p className="small muted">{t('dashboardHome.openNotifications', 'Notifications')}</p>
                <strong>{stats.unreadNotifications + stats.adminNotifications} {t('account.unread', 'unread')}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {stats.businessNotifications} {t('account.businessNotice', 'business notice')}{stats.businessNotifications === 1 ? '' : 's'} · {stats.adminNotifications} {t('account.operatorNotice', 'operator notice')}{stats.adminNotifications === 1 ? '' : 's'}.
                </p>
              </div>
            </div>


            <div className="card support-card">
              <div>
                <p className="small muted">{t('account.helpKicker', 'Help and language')}</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>{t('nav.support', 'Support')}</h2>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {t('account.supportBody', 'Customer, business and staff support routes are separated. Your saved language preference will be used across translated Mirëbook pages.')}
                </p>
              </div>

              <div className="workspace-actions">
                <Link href="/support" className="btn btn-ghost">{t('account.contactSupport', 'Contact support')}</Link>
                <span className="language-pill" title={t('account.savedLanguage', 'Saved account language')}>{preferredLanguage === 'sq' ? 'SQ' : 'EN'}</span>
                <button onClick={logout} className="btn btn-danger">{t('auth.logout', 'Log out')}</button>
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

        .account-primary-card {
          border-color: rgba(45,212,191,0.25);
        }

        .account-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          align-items: start;
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

          .account-form-grid {
            grid-template-columns: 1fr;
          }

          .language-pill {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}