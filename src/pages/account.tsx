import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Role = 'customer' | 'business'

type Profile = {
  id: string
  email: string
  role: Role
  full_name?: string | null
  phone?: string | null
}

type StaffProfile = {
  id: string
  business_id: string
  name: string
  email?: string | null
  role_title?: string | null
  permission_role?: string | null
  invite_status?: string | null
  businesses?: {
    name: string
  } | {
    name: string
  }[] | null
}

export default function AccountPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [actualRole, setActualRole] = useState<Role>('customer')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessCount, setBusinessCount] = useState(0)
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null)
  const [bookingCount, setBookingCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fixingRole, setFixingRole] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadProfile() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, phone')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profileData) {
      setError(profileError?.message || 'Could not load account profile.')
      setLoading(false)
      return
    }

    const { data: ownedBusinesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)

    const ownsBusiness = !!ownedBusinesses && ownedBusinesses.length > 0
    setBusinessCount(ownedBusinesses?.length || 0)

    const { data: staffData } = await supabase
      .from('staff_members')
      .select(`
        id,
        business_id,
        name,
        email,
        role_title,
        permission_role,
        invite_status,
        businesses (
          name
        )
      `)
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    setStaffProfile(staffData as unknown as StaffProfile | null)

    const { data: customerBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('customer_user_id', session.user.id)
      .limit(100)

    setBookingCount(customerBookings?.length || 0)

    const { data: customerNotifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('read', false)
      .limit(100)

    setNotificationCount(customerNotifications?.length || 0)

    const resolvedRole: Role =
      profileData.role === 'business' || ownsBusiness
        ? 'business'
        : 'customer'

    setActualRole(resolvedRole)
    setProfile({
      ...profileData,
      role: resolvedRole
    })

    setFullName(profileData.full_name || '')
    setPhone(profileData.phone || '')
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()

    if (!profile) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null
      })
      .eq('id', profile.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Mirëbook account updated.')
    await loadProfile()
  }

  async function fixBusinessRole() {
    if (!profile) return

    setFixingRole(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'business' })
      .eq('id', profile.id)

    setFixingRole(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Account role fixed to business. Your dashboard and navigation will now use business mode.')
    await loadProfile()
  }

  function staffBusinessName() {
    if (!staffProfile?.businesses) return 'Linked business'
    return Array.isArray(staffProfile.businesses)
      ? staffProfile.businesses[0]?.name || 'Linked business'
      : staffProfile.businesses.name || 'Linked business'
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
            <div>
              <p className="small muted">Account settings</p>

              <h1 className="page-title">
                Your profile
              </h1>

              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Manage your Mirëbook profile, contact details and shortcuts across customer, business and staff workspaces.
              </p>
            </div>

            <div className="grid-2 account-summary-grid">
              <div className="card">
                <p className="small muted">Email</p>
                <strong>{profile.email}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  This email is used for login, customer bookings, staff linking and future Mirëbook notifications.
                </p>
              </div>

              <div className="card" style={{ borderColor: actualRole === 'business' ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
                <p className="small muted">Primary account type</p>
                <strong style={{ textTransform: 'capitalize' }}>
                  {actualRole}
                </strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {actualRole === 'business'
                    ? `${businessCount} business profile${businessCount === 1 ? '' : 's'} connected to this account.`
                    : 'Customer mode lets you book, reschedule and track appointments.'}
                </p>

                {actualRole === 'business' && profile.role !== 'business' && (
                  <>
                    <p className="small" style={{ color: 'var(--warning)', marginTop: '0.5rem' }}>
                      This account owns a business, but its profile role is still marked as customer.
                    </p>

                    <button
                      onClick={fixBusinessRole}
                      disabled={fixingRole}
                      className="btn btn-accent"
                      style={{ marginTop: '0.75rem' }}
                    >
                      {fixingRole ? 'Fixing...' : 'Fix role to business'}
                    </button>
                  </>
                )}
              </div>

              <div className="card" style={{ borderColor: staffProfile ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
                <p className="small muted">Staff access</p>
                <strong>{staffProfile ? 'Linked' : 'Not linked'}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {staffProfile
                    ? `${staffProfile.name} · ${staffProfile.role_title || staffProfile.permission_role || 'Staff member'} at ${staffBusinessName()}`
                    : 'Staff access appears here when a business links your email to a staff profile.'}
                </p>

                {staffProfile && (
                  <Link href="/staff" className="btn btn-ghost" style={{ marginTop: '0.75rem' }}>
                    Open staff workspace
                  </Link>
                )}
              </div>

              <div className="card">
                <p className="small muted">Customer activity</p>
                <strong>{bookingCount} booking{bookingCount === 1 ? '' : 's'}</strong>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {notificationCount} unread notification{notificationCount === 1 ? '' : 's'} on this account.
                </p>
                <Link href="/my-bookings" className="btn btn-ghost" style={{ marginTop: '0.75rem' }}>
                  View my bookings
                </Link>
              </div>
            </div>

            <form onSubmit={saveProfile} className="card" style={{ display: 'grid', gap: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Contact details
              </h2>
              <p className="small muted">
                These details help pre-fill booking forms and support future customer, business and staff notification emails.
              </p>

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

              <button type="submit" disabled={saving} className="btn btn-accent">
                {saving ? 'Saving...' : 'Save account details'}
              </button>

              {message && (
                <p className="small" style={{ color: 'var(--success)' }}>{message}</p>
              )}
            </form>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
                Workspace shortcuts
              </h2>
              <p className="small muted" style={{ marginBottom: '1rem' }}>
                Jump into the Mirëbook areas connected to this account. You can use customer mode even if you also own a business or work as staff.
              </p>
              <div className="account-shortcut-actions">
                {actualRole === 'business' ? (
                  <>
                    <Link href="/dashboard" className="btn btn-accent">
                      Business dashboard
                    </Link>

                    <Link href="/dashboard/businesses" className="btn btn-ghost">
                      Manage businesses
                    </Link>

                    <Link href="/dashboard/bookings" className="btn btn-ghost">
                      Bookings
                    </Link>

                    <Link href="/dashboard/analytics" className="btn btn-ghost">
                      Analytics
                    </Link>

                    <Link href="/dashboard/notifications" className="btn btn-ghost">
                      Notifications
                    </Link>

                    <Link href="/explore" className="btn btn-ghost">
                      Preview Mirëbook
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/my-bookings" className="btn btn-accent">
                      My bookings
                    </Link>

                    <Link href="/notifications" className="btn btn-ghost">
                      Notifications
                    </Link>

                    <Link href="/explore" className="btn btn-ghost">
                      Browse businesses
                    </Link>

                    <Link href="/register" className="btn btn-ghost">
                      Add business or staff access
                    </Link>
                  </>
                )}

                {staffProfile && (
                  <>
                    <Link href="/staff" className="btn btn-accent">
                      Staff workspace
                    </Link>

                    <Link href="/staff/availability" className="btn btn-ghost">
                      Staff availability
                    </Link>
                  </>
                )}

                <button onClick={logout} className="btn btn-danger">
                  Log out
                </button>
              </div>
            </div>

            <div className="card" style={{ borderColor: 'rgba(255,190,11,0.22)' }}>
              <p className="small muted">Role note</p>
              <h3 style={{ marginTop: '0.25rem' }}>
                How roles work in Mirëbook
              </h3>
              <p className="small muted" style={{ marginTop: '0.5rem' }}>
                Your main profile role is still simple, but Mirëbook now also checks business ownership and linked staff profiles. That means one login can book as a customer, manage a business, or open a staff schedule when linked.
              </p>
            </div>
          </div>
        )}
      </section>
      <style jsx>{`
        .account-page-shell {
          max-width: 960px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .account-summary-grid {
          align-items: stretch;
        }

        .account-shortcut-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 620px) {
          .account-shortcut-actions :global(.btn),
          .account-shortcut-actions button,
          .account-shortcut-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}