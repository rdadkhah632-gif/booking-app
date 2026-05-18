import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'

type ProfileRow = {
  id: string
  email?: string | null
  role?: string | null
  full_name?: string | null
  phone?: string | null
  is_admin?: boolean | null
  created_at?: string | null
}

type UserCounts = {
  businesses: number
  staffProfiles: number
  bookings: number
  notifications: number
}

type OwnedBusiness = {
  id: string
  user_id?: string | null
  name: string
  published?: boolean | null
  subscription_status?: string | null
  subscription_plan?: string | null
}

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'business', label: 'Business' }
]

function formatDate(value?: string | null) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleDateString()
}

function roleLabel(role?: string | null) {
  if (!role) return 'Customer'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function AdminUsersPage() {
  const router = useRouter()

  const [adminProfile, setAdminProfile] = useState<ProfileRow | null>(null)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [businesses, setBusinesses] = useState<OwnedBusiness[]>([])
  const [countsByUser, setCountsByUser] = useState<Record<string, UserCounts>>({})
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [adminFilter, setAdminFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filteredProfiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return profiles.filter((profile) => {
      const counts = countsByUser[profile.id] || {
        businesses: 0,
        staffProfiles: 0,
        bookings: 0,
        notifications: 0
      }

      const matchesSearch = !term || [
        profile.email,
        profile.full_name,
        profile.phone,
        profile.role
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))

      const matchesRole = roleFilter === 'all' || (profile.role || 'customer') === roleFilter

      const matchesAdmin =
        adminFilter === 'all' ||
        (adminFilter === 'admin' && profile.is_admin) ||
        (adminFilter === 'normal' && !profile.is_admin) ||
        (adminFilter === 'business_owner' && counts.businesses > 0) ||
        (adminFilter === 'staff' && counts.staffProfiles > 0)

      return matchesSearch && matchesRole && matchesAdmin
    })
  }, [profiles, countsByUser, searchTerm, roleFilter, adminFilter])

  const summary = useMemo(() => {
    return {
      total: profiles.length,
      admins: profiles.filter((profile) => profile.is_admin).length,
      customers: profiles.filter((profile) => (profile.role || 'customer') === 'customer').length,
      businesses: profiles.filter((profile) => (profile.role || 'customer') === 'business').length,
      businessOwners: profiles.filter((profile) => (countsByUser[profile.id]?.businesses || 0) > 0).length,
      staffLinked: profiles.filter((profile) => (countsByUser[profile.id]?.staffProfiles || 0) > 0).length
    }
  }, [profiles, countsByUser])

  const selectedUserBusinesses = useMemo(() => {
    if (!selectedUser) return []
    return businesses.filter((business) => business.user_id === selectedUser.id)
  }, [businesses, selectedUser])

  async function loadAdminUsers() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/admin/users')
        return
      }

      const { data: adminData, error: adminError } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, phone, is_admin, created_at')
        .eq('id', session.user.id)
        .single()

      if (adminError) throw adminError

      if (!adminData?.is_admin) {
        setAdminProfile(adminData as ProfileRow)
        setProfiles([])
        setBusinesses([])
        setSelectedUser(null)
        setLoading(false)
        return
      }

      setAdminProfile(adminData as ProfileRow)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, phone, is_admin, created_at')
        .order('created_at', { ascending: false })
        .limit(300)

      if (profileError) throw profileError

      const rows = (profileData || []) as ProfileRow[]
      setProfiles(rows)

      const userIds = rows.map((profile) => profile.id)

      const { data: businessData } = await supabase
        .from('businesses')
        .select('id, user_id, name, published, subscription_status, subscription_plan')
        .in('user_id', userIds)

      const ownedBusinesses = (businessData || []) as OwnedBusiness[]
      setBusinesses(ownedBusinesses)

      await loadCounts(userIds, ownedBusinesses)

      const queryUserId = typeof router.query.userId === 'string' ? router.query.userId : ''
      const nextSelected =
        rows.find((profile) => profile.id === queryUserId) ||
        rows.find((profile) => profile.id === session.user.id) ||
        rows[0] ||
        null

      if (nextSelected) {
        setSelectedUserId(nextSelected.id)
        setSelectedUser(nextSelected)
      } else {
        setSelectedUserId('')
        setSelectedUser(null)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load admin users.')
      setLoading(false)
    }
  }

  async function loadCounts(userIds: string[], ownedBusinesses: OwnedBusiness[]) {
    if (userIds.length === 0) {
      setCountsByUser({})
      return
    }

    const nextCounts: Record<string, UserCounts> = {}

    userIds.forEach((userId) => {
      nextCounts[userId] = {
        businesses: 0,
        staffProfiles: 0,
        bookings: 0,
        notifications: 0
      }
    })

    ownedBusinesses.forEach((business) => {
      if (business.user_id && nextCounts[business.user_id]) {
        nextCounts[business.user_id].businesses += 1
      }
    })

    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, user_id')
      .in('user_id', userIds)

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, customer_user_id')
      .in('customer_user_id', userIds)

    const { data: notificationData } = await supabase
      .from('notifications')
      .select('id, user_id')
      .in('user_id', userIds)
      .is('read_at', null)

    ;(staffData || []).forEach((row: any) => {
      if (row.user_id && nextCounts[row.user_id]) {
        nextCounts[row.user_id].staffProfiles += 1
      }
    })

    ;(bookingData || []).forEach((row: any) => {
      if (row.customer_user_id && nextCounts[row.customer_user_id]) {
        nextCounts[row.customer_user_id].bookings += 1
      }
    })

    ;(notificationData || []).forEach((row: any) => {
      if (row.user_id && nextCounts[row.user_id]) {
        nextCounts[row.user_id].notifications += 1
      }
    })

    setCountsByUser(nextCounts)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadAdminUsers()
  }, [router.isReady])

  function selectUser(profile: ProfileRow) {
    setSelectedUserId(profile.id)
    setSelectedUser(profile)
    setError(null)
    setSuccess(null)
    router.replace(`/admin/users?userId=${profile.id}`, undefined, { shallow: true })
  }

  function updateSelected<K extends keyof ProfileRow>(key: K, value: ProfileRow[K]) {
    setSelectedUser((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: value
      }
    })
  }

  async function saveSelectedUser() {
    if (!selectedUser) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      full_name: selectedUser.full_name?.trim() || null,
      phone: selectedUser.phone?.trim() || null,
      role: selectedUser.role || 'customer',
      is_admin: Boolean(selectedUser.is_admin)
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', selectedUser.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(`Saved changes for ${selectedUser.email || selectedUser.id}.`)

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === selectedUser.id
          ? {
              ...profile,
              ...payload
            }
          : profile
      )
    )

    setSelectedUser((current) => current ? { ...current, ...payload } : current)
  }

  function resetSelectedToCustomerAdmin() {
    if (!selectedUser) return
    setSelectedUser({
      ...selectedUser,
      role: 'customer',
      is_admin: true
    })
  }

  function resetSelectedToCustomer() {
    if (!selectedUser) return
    setSelectedUser({
      ...selectedUser,
      role: 'customer',
      is_admin: false
    })
  }

  function markSelectedBusinessRole() {
    if (!selectedUser) return
    setSelectedUser({
      ...selectedUser,
      role: 'business'
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
            <p className="muted">Loading Mirëbook user admin...</p>
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

  const selectedCounts = selectedUser
    ? countsByUser[selectedUser.id] || {
        businesses: 0,
        staffProfiles: 0,
        bookings: 0,
        notifications: 0
      }
    : {
        businesses: 0,
        staffProfiles: 0,
        bookings: 0,
        notifications: 0
      }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="admin-shell">
          <div className="admin-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook internal</p>
              <h1 className="page-title">User admin</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Manage user roles, admin access, account cleanup and linked business/staff/customer usage.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/admin" className="btn btn-ghost">
                Admin overview
              </Link>

              <Link href="/admin/businesses" className="btn btn-ghost">
                Businesses
              </Link>

              <Link href="/admin/notifications" className="btn btn-ghost">
                Notifications
              </Link>

              <button type="button" className="btn btn-ghost" onClick={loadAdminUsers}>
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
              <p className="small muted">Users</p>
              <h2>{summary.total}</h2>
              <p className="small muted">Profiles loaded</p>
            </div>

            <div className="card">
              <p className="small muted">Admins</p>
              <h2>{summary.admins}</h2>
              <p className="small muted">Internal operator accounts</p>
            </div>

            <div className="card">
              <p className="small muted">Business owners</p>
              <h2>{summary.businessOwners}</h2>
              <p className="small muted">{summary.businesses} business-role profiles</p>
            </div>

            <div className="card">
              <p className="small muted">Staff linked</p>
              <h2>{summary.staffLinked}</h2>
              <p className="small muted">Users with staff profile links</p>
            </div>
          </div>

          <div className="admin-layout-grid">
            <div className="card admin-list-card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Accounts</p>
                  <h2>Find user</h2>
                </div>
              </div>

              <div className="admin-filter-grid">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search email, name, phone, role..."
                />

                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select value={adminFilter} onChange={(event) => setAdminFilter(event.target.value)}>
                  <option value="all">All account types</option>
                  <option value="admin">Admins only</option>
                  <option value="normal">Non-admins only</option>
                  <option value="business_owner">Business owners</option>
                  <option value="staff">Staff linked</option>
                </select>
              </div>

              {filteredProfiles.length === 0 ? (
                <div className="admin-empty">
                  <h3>No matching users</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Clear search or change filters.
                  </p>
                </div>
              ) : (
                <div className="admin-user-list">
                  {filteredProfiles.map((profile) => {
                    const counts = countsByUser[profile.id] || {
                      businesses: 0,
                      staffProfiles: 0,
                      bookings: 0,
                      notifications: 0
                    }

                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => selectUser(profile)}
                        className={profile.id === selectedUserId ? 'admin-user-row admin-user-row-active' : 'admin-user-row'}
                      >
                        <span>
                          <strong>{profile.email || 'No email'}</strong>
                          <span className="small muted">
                            {profile.full_name || 'No name'} · {roleLabel(profile.role)}
                          </span>
                          <span className="small muted">
                            Joined {formatDate(profile.created_at)}
                          </span>
                        </span>

                        <span className="admin-row-meta">
                          {profile.is_admin && (
                            <span className="admin-pill admin-pill-accent">
                              Admin
                            </span>
                          )}
                          <span className={counts.businesses > 0 ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                            {counts.businesses} business{counts.businesses === 1 ? '' : 'es'}
                          </span>
                          <span className={counts.staffProfiles > 0 ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                            {counts.staffProfiles} staff link{counts.staffProfiles === 1 ? '' : 's'}
                          </span>
                          <span className="small muted">
                            {counts.bookings} bookings · {counts.notifications} unread
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card admin-editor-card">
              {!selectedUser ? (
                <div className="admin-empty">
                  <h3>Select a user</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Choose an account to manage role, admin access and account cleanup.
                  </p>
                </div>
              ) : (
                <>
                  <div className="admin-editor-header">
                    <div>
                      <p className="small muted">Selected user</p>
                      <h2>{selectedUser.email || 'No email'}</h2>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        {selectedUser.full_name || 'No name'} · joined {formatDate(selectedUser.created_at)}
                      </p>
                    </div>

                    <div className="admin-actions">
                      <Link href={`/admin/notifications?userId=${selectedUser.id}`} className="btn btn-ghost">
                        Notify user
                      </Link>

                      <button type="button" className="btn btn-accent" onClick={saveSelectedUser} disabled={saving}>
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </div>

                  <div className="admin-editor-grid">
                    <div>
                      <label className="small muted">Full name</label>
                      <input
                        value={selectedUser.full_name || ''}
                        onChange={(event) => updateSelected('full_name', event.target.value)}
                        placeholder="Full name"
                        style={{ marginTop: '0.4rem' }}
                      />
                    </div>

                    <div>
                      <label className="small muted">Phone</label>
                      <input
                        value={selectedUser.phone || ''}
                        onChange={(event) => updateSelected('phone', event.target.value)}
                        placeholder="Phone number"
                        style={{ marginTop: '0.4rem' }}
                      />
                    </div>

                    <div>
                      <label className="small muted">Profile role</label>
                      <select
                        value={selectedUser.role || 'customer'}
                        onChange={(event) => updateSelected('role', event.target.value)}
                        style={{ marginTop: '0.4rem' }}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Admin access</label>
                      <select
                        value={selectedUser.is_admin ? 'yes' : 'no'}
                        onChange={(event) => updateSelected('is_admin', event.target.value === 'yes')}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value="no">No admin access</option>
                        <option value="yes">Admin access enabled</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-account-snapshot">
                    <p className="small muted">Account snapshot</p>

                    <div className="grid-4" style={{ marginTop: '0.75rem' }}>
                      <div>
                        <strong>{selectedCounts.businesses}</strong>
                        <p className="small muted">Businesses owned</p>
                      </div>

                      <div>
                        <strong>{selectedCounts.staffProfiles}</strong>
                        <p className="small muted">Staff links</p>
                      </div>

                      <div>
                        <strong>{selectedCounts.bookings}</strong>
                        <p className="small muted">Customer bookings</p>
                      </div>

                      <div>
                        <strong>{selectedCounts.notifications}</strong>
                        <p className="small muted">Unread notifications</p>
                      </div>
                    </div>
                  </div>
                  <div className="admin-notify-box">
                    <div>
                      <p className="small muted">Platform messaging</p>
                      <strong>Send this user an admin notification</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        Use this for support notices, account issues, trial updates or platform announcements.
                      </p>
                    </div>

                    <Link href={`/admin/notifications?userId=${selectedUser.id}`} className="btn btn-ghost">
                      Notify user
                    </Link>
                  </div>

                  {selectedUserBusinesses.length > 0 && (
                    <div className="admin-linked-businesses">
                      <p className="small muted">Owned businesses</p>

                      <div className="admin-linked-list">
                        {selectedUserBusinesses.map((business) => (
                          <div key={business.id} className="admin-linked-business">
                            <div>
                              <strong>{business.name}</strong>
                              <p className="small muted">
                                {business.published ? 'Published' : 'Draft'} · {business.subscription_status || 'trial'} · {business.subscription_plan || 'starter'}
                              </p>
                            </div>

                            <div className="admin-actions">
                              <Link href={`/explore/${business.id}`} className="btn btn-ghost">
                                Public page
                              </Link>

                              <Link href={`/admin/businesses?businessId=${business.id}`} className="btn btn-accent">
                                Manage business
                              </Link>
                              <Link href={`/admin/notifications?businessId=${business.id}`} className="btn btn-ghost">
                                Notify business
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="admin-quick-actions">
                    <button type="button" className="btn btn-ghost" onClick={resetSelectedToCustomer}>
                      Reset to customer
                    </button>

                    <button type="button" className="btn btn-ghost" onClick={markSelectedBusinessRole}>
                      Mark business role
                    </button>

                    <button type="button" className="btn btn-accent" onClick={resetSelectedToCustomerAdmin}>
                      Make customer + admin
                    </button>
                  </div>

                  <div className="admin-warning-box">
                    <p className="small muted">Safe admin note</p>
                    <p className="small muted" style={{ marginTop: '0.4rem' }}>
                      This page changes profile flags only. Destructive actions like deleting users, deleting businesses or transferring ownership should remain separate admin actions with stronger confirmation screens.
                    </p>
                  </div>

                  <div className="admin-save-footer">
                    <div>
                      <p className="small muted">Current selection</p>
                      <strong>
                        {roleLabel(selectedUser.role)} · {selectedUser.is_admin ? 'Admin enabled' : 'No admin access'}
                      </strong>
                    </div>

                    <button type="button" className="btn btn-accent" onClick={saveSelectedUser} disabled={saving}>
                      {saving ? 'Saving...' : 'Save user changes'}
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
        .admin-save-footer,
        .admin-linked-business {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .admin-actions,
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

        .admin-user-list {
          display: grid;
          gap: 0.75rem;
          max-height: 720px;
          overflow: auto;
          padding-right: 0.25rem;
        }

        .admin-user-row {
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

        .admin-user-row-active {
          border-color: rgba(255,107,53,0.42);
          background: rgba(255,107,53,0.08);
        }

        .admin-user-row span {
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
        }

                .admin-empty,
        .admin-account-snapshot,
        .admin-linked-businesses,
        .admin-notify-box,
        .admin-warning-box {
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

        .admin-linked-list {
          display: grid;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .admin-linked-business {
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: var(--radius);
          padding: 0.9rem;
        }
        .admin-notify-box {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          border-color: rgba(255,107,53,0.22);
          background: rgba(255,107,53,0.06);
        }

        .admin-quick-actions {
          justify-content: flex-start;
        }

        .admin-warning-box {
          border-color: rgba(255,190,11,0.25);
          background: rgba(255,190,11,0.06);
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

          .admin-user-list {
            max-height: none;
          }
        }

        @media (max-width: 640px) {
          .admin-header,
          .admin-section-header,
          .admin-editor-header,
                    .admin-save-footer,
          .admin-linked-business,
          .admin-notify-box {
            display: grid;
          }

                    .admin-actions,
          .admin-quick-actions,
          .admin-actions :global(.btn),
          .admin-quick-actions :global(.btn),
          .admin-save-footer :global(.btn),
          .admin-notify-box :global(.btn),
          .admin-actions a,
          .admin-quick-actions button,
          .admin-save-footer button,
          .admin-notify-box a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}