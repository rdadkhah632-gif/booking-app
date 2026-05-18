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
  pendingBookings: number
  notifications: number
  sentAdminNotifications: number
}

type OwnedBusiness = {
  id: string
  user_id?: string | null
  name: string
  published?: boolean | null
  subscription_status?: string | null
  subscription_plan?: string | null
  trial_ends_at?: string | null
}

type StaffLink = {
  id: string
  user_id?: string | null
  business_id?: string | null
  name?: string | null
  email?: string | null
  role_title?: string | null
  active?: boolean | null
  business?: OwnedBusiness | null
}

type RecentBooking = {
  id: string
  customer_user_id?: string | null
  business_id?: string | null
  service_name?: string | null
  status?: string | null
  start_at?: string | null
  created_at?: string | null
  business?: OwnedBusiness | null
}

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'business', label: 'Business' }
]

function formatDate(value?: string | null) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

function roleLabel(role?: string | null) {
  if (!role) return 'Customer'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function profileDisplayName(profile?: ProfileRow | null) {
  if (!profile) return 'No user selected'
  return profile.full_name || profile.email || profile.id
}

export default function AdminUsersPage() {
  const router = useRouter()

  const [adminProfile, setAdminProfile] = useState<ProfileRow | null>(null)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [businesses, setBusinesses] = useState<OwnedBusiness[]>([])
  const [staffLinks, setStaffLinks] = useState<StaffLink[]>([])
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [countsByUser, setCountsByUser] = useState<Record<string, UserCounts>>({})
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [advancedConfirmText, setAdvancedConfirmText] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filteredProfiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return profiles.filter((profile) => {
      const counts = getCounts(profile.id)

      const matchesSearch = !term || [
        profile.email,
        profile.full_name,
        profile.phone,
        profile.role,
        profile.id
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))

      const matchesRole = roleFilter === 'all' || (profile.role || 'customer') === roleFilter

      const matchesAccount =
        accountFilter === 'all' ||
        (accountFilter === 'admin' && profile.is_admin) ||
        (accountFilter === 'normal' && !profile.is_admin) ||
        (accountFilter === 'business_owner' && counts.businesses > 0) ||
        (accountFilter === 'staff' && counts.staffProfiles > 0) ||
        (accountFilter === 'has_bookings' && counts.bookings > 0) ||
        (accountFilter === 'needs_attention' && (counts.notifications > 0 || counts.pendingBookings > 0))

      return matchesSearch && matchesRole && matchesAccount
    })
  }, [profiles, countsByUser, searchTerm, roleFilter, accountFilter])

  const visibleProfiles = filteredProfiles.slice(0, 75)

  const summary = useMemo(() => {
    return {
      total: profiles.length,
      admins: profiles.filter((profile) => profile.is_admin).length,
      customers: profiles.filter((profile) => (profile.role || 'customer') === 'customer').length,
      businesses: profiles.filter((profile) => (profile.role || 'customer') === 'business').length,
      businessOwners: profiles.filter((profile) => getCounts(profile.id).businesses > 0).length,
      staffLinked: profiles.filter((profile) => getCounts(profile.id).staffProfiles > 0).length,
      needsAttention: profiles.filter((profile) => {
        const counts = getCounts(profile.id)
        return counts.notifications > 0 || counts.pendingBookings > 0
      }).length
    }
  }, [profiles, countsByUser])

  const selectedUserBusinesses = useMemo(() => {
    if (!selectedUser) return []
    return businesses.filter((business) => business.user_id === selectedUser.id)
  }, [businesses, selectedUser])

  const selectedStaffLinks = useMemo(() => {
    if (!selectedUser) return []
    return staffLinks.filter((staff) => staff.user_id === selectedUser.id)
  }, [staffLinks, selectedUser])

  const selectedBookings = useMemo(() => {
    if (!selectedUser) return []
    return recentBookings.filter((booking) => booking.customer_user_id === selectedUser.id).slice(0, 8)
  }, [recentBookings, selectedUser])

  function getCounts(userId?: string | null) {
    if (!userId) {
      return {
        businesses: 0,
        staffProfiles: 0,
        bookings: 0,
        pendingBookings: 0,
        notifications: 0,
        sentAdminNotifications: 0
      }
    }

    return countsByUser[userId] || {
      businesses: 0,
      staffProfiles: 0,
      bookings: 0,
      pendingBookings: 0,
      notifications: 0,
      sentAdminNotifications: 0
    }
  }

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
        setStaffLinks([])
        setRecentBookings([])
        setSelectedUser(null)
        setLoading(false)
        return
      }

      setAdminProfile(adminData as ProfileRow)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, phone, is_admin, created_at')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (profileError) throw profileError

      const rows = (profileData || []) as ProfileRow[]
      setProfiles(rows)

      const userIds = rows.map((profile) => profile.id)

      const { data: businessData } = userIds.length > 0
        ? await supabase
            .from('businesses')
            .select('id, user_id, name, published, subscription_status, subscription_plan, trial_ends_at')
            .in('user_id', userIds)
        : { data: [] as any[] }

      const ownedBusinesses = (businessData || []) as OwnedBusiness[]
      setBusinesses(ownedBusinesses)

      const { data: staffData } = userIds.length > 0
        ? await supabase
            .from('staff_members')
            .select('id, user_id, business_id, name, email, role_title, active')
            .in('user_id', userIds)
        : { data: [] as any[] }

      const staffRows = (staffData || []) as StaffLink[]
      const businessMap = ownedBusinesses.reduce((map: Record<string, OwnedBusiness>, business) => {
        map[business.id] = business
        return map
      }, {})

      const enrichedStaffRows = staffRows.map((staff) => ({
        ...staff,
        business: staff.business_id ? businessMap[staff.business_id] || null : null
      }))

      setStaffLinks(enrichedStaffRows)

      const { data: bookingData } = userIds.length > 0
        ? await supabase
            .from('bookings')
            .select('id, customer_user_id, business_id, service_name, status, start_at, created_at')
            .in('customer_user_id', userIds)
            .order('created_at', { ascending: false })
            .limit(500)
        : { data: [] as any[] }

      const bookingRows = ((bookingData || []) as RecentBooking[]).map((booking) => ({
        ...booking,
        business: booking.business_id ? businessMap[booking.business_id] || null : null
      }))

      setRecentBookings(bookingRows)

      await loadCounts(userIds, ownedBusinesses, enrichedStaffRows, bookingRows)

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

  async function loadCounts(
    userIds: string[],
    ownedBusinesses: OwnedBusiness[],
    staffRows: StaffLink[],
    bookingRows: RecentBooking[]
  ) {
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
        pendingBookings: 0,
        notifications: 0,
        sentAdminNotifications: 0
      }
    })

    ownedBusinesses.forEach((business) => {
      if (business.user_id && nextCounts[business.user_id]) {
        nextCounts[business.user_id].businesses += 1
      }
    })

    staffRows.forEach((staff) => {
      if (staff.user_id && nextCounts[staff.user_id]) {
        nextCounts[staff.user_id].staffProfiles += 1
      }
    })

    bookingRows.forEach((booking) => {
      if (booking.customer_user_id && nextCounts[booking.customer_user_id]) {
        nextCounts[booking.customer_user_id].bookings += 1
        if (['pending', 'requested', 'awaiting_approval'].includes(String(booking.status || '').toLowerCase())) {
          nextCounts[booking.customer_user_id].pendingBookings += 1
        }
      }
    })

    const { data: notificationData } = await supabase
      .from('notifications')
      .select('id, user_id, type, read_at')
      .in('user_id', userIds)

    ;(notificationData || []).forEach((row: any) => {
      if (row.user_id && nextCounts[row.user_id]) {
        if (!row.read_at) nextCounts[row.user_id].notifications += 1
        if (String(row.type || '').startsWith('admin_') || ['trial_reminder', 'billing_notice', 'support_notice', 'platform_update'].includes(String(row.type || ''))) {
          nextCounts[row.user_id].sentAdminNotifications += 1
        }
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
    setShowAdvancedControls(false)
    setAdvancedConfirmText('')
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

  async function saveSelectedProfile() {
    if (!selectedUser) return

    setSavingProfile(true)
    setError(null)
    setSuccess(null)

    const payload = {
      full_name: selectedUser.full_name?.trim() || null,
      phone: selectedUser.phone?.trim() || null
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', selectedUser.id)

    setSavingProfile(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(`Saved profile details for ${selectedUser.email || selectedUser.id}.`)

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === selectedUser.id ? { ...profile, ...payload } : profile
      )
    )

    setSelectedUser((current) => current ? { ...current, ...payload } : current)
  }

  async function saveAccessControls() {
    if (!selectedUser) return

    if (advancedConfirmText !== 'CONFIRM') {
      setError('Type CONFIRM before changing role or admin access.')
      return
    }

    const confirmed = confirm(`Apply role/admin access changes to ${selectedUser.email || selectedUser.id}?`)
    if (!confirmed) return

    setSavingAccess(true)
    setError(null)
    setSuccess(null)

    const payload = {
      role: selectedUser.role || 'customer',
      is_admin: Boolean(selectedUser.is_admin)
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', selectedUser.id)

    setSavingAccess(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setAdvancedConfirmText('')
    setSuccess(`Updated access controls for ${selectedUser.email || selectedUser.id}.`)

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === selectedUser.id ? { ...profile, ...payload } : profile
      )
    )

    setSelectedUser((current) => current ? { ...current, ...payload } : current)
  }

  function stageCustomerAdmin() {
    if (!selectedUser) return
    setSelectedUser({
      ...selectedUser,
      role: 'customer',
      is_admin: true
    })
  }

  function stageCustomerOnly() {
    if (!selectedUser) return
    setSelectedUser({
      ...selectedUser,
      role: 'customer',
      is_admin: false
    })
  }

  function stageBusinessRole() {
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
            <p className="muted">Loading Mirëbook account lookup...</p>
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
                <Link href="/" className="btn btn-ghost">Back to Mirëbook</Link>
                <button type="button" className="btn btn-danger" onClick={logout}>Log out</button>
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const selectedCounts = selectedUser ? getCounts(selectedUser.id) : getCounts(null)

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="admin-shell">
          <div className="admin-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook operator</p>
              <h1 className="page-title">Account lookup</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Find users, inspect account context, message them, and use protected access controls only when needed.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/admin" className="btn btn-ghost">Overview</Link>
              <Link href="/admin/businesses" className="btn btn-ghost">Businesses</Link>
              <Link href="/admin/notifications" className="btn btn-ghost">Notifications</Link>
              <button type="button" className="btn btn-accent" onClick={loadAdminUsers}>Refresh</button>
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
              <p className="small muted">Users loaded</p>
              <h2>{summary.total}</h2>
              <p className="small muted">Searchable account records</p>
            </div>
            <div className="card">
              <p className="small muted">Admins</p>
              <h2>{summary.admins}</h2>
              <p className="small muted">Operator accounts</p>
            </div>
            <div className="card">
              <p className="small muted">Business owners</p>
              <h2>{summary.businessOwners}</h2>
              <p className="small muted">{summary.businesses} business role profiles</p>
            </div>
            <div className="card">
              <p className="small muted">Needs attention</p>
              <h2>{summary.needsAttention}</h2>
              <p className="small muted">Unread notices or pending bookings</p>
            </div>
          </div>

          <div className="admin-layout-grid">
            <div className="card admin-list-card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Accounts</p>
                  <h2>Search users</h2>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Showing {visibleProfiles.length} of {filteredProfiles.length} matching accounts.
                  </p>
                </div>
              </div>

              <div className="admin-filter-grid">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search email, name, phone, role or user ID..."
                />

                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                  <option value="all">All account types</option>
                  <option value="admin">Admins only</option>
                  <option value="normal">Non-admins only</option>
                  <option value="business_owner">Business owners</option>
                  <option value="staff">Staff linked</option>
                  <option value="has_bookings">Has bookings</option>
                  <option value="needs_attention">Needs attention</option>
                </select>
              </div>

              {filteredProfiles.length > 75 && (
                <div className="admin-hint-box">
                  <p className="small muted">
                    Refine search to narrow the list. Large account lists are intentionally limited for admin performance.
                  </p>
                </div>
              )}

              {visibleProfiles.length === 0 ? (
                <div className="admin-empty">
                  <h3>No matching users</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Clear search or change filters.
                  </p>
                </div>
              ) : (
                <div className="admin-user-list">
                  {visibleProfiles.map((profile) => {
                    const counts = getCounts(profile.id)

                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => selectUser(profile)}
                        className={profile.id === selectedUserId ? 'admin-user-row admin-user-row-active' : 'admin-user-row'}
                      >
                        <span>
                          <strong>{profile.email || 'No email'}</strong>
                          <span className="small muted">{profile.full_name || 'No name'} · {roleLabel(profile.role)}</span>
                          <span className="small muted">Joined {formatDate(profile.created_at)}</span>
                        </span>

                        <span className="admin-row-meta">
                          {profile.is_admin && <span className="admin-pill admin-pill-accent">Admin</span>}
                          <span className={counts.businesses > 0 ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                            {counts.businesses} business{counts.businesses === 1 ? '' : 'es'}
                          </span>
                          <span className={counts.staffProfiles > 0 ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                            {counts.staffProfiles} staff link{counts.staffProfiles === 1 ? '' : 's'}
                          </span>
                          {(counts.notifications > 0 || counts.pendingBookings > 0) && (
                            <span className="admin-pill admin-pill-warning">Needs attention</span>
                          )}
                          <span className="small muted">{counts.bookings} bookings · {counts.notifications} unread</span>
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
                    Choose an account to inspect user context, send notices or safely update access.
                  </p>
                </div>
              ) : (
                <>
                  <div className="admin-editor-header">
                    <div>
                      <p className="small muted">Selected account</p>
                      <h2>{profileDisplayName(selectedUser)}</h2>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        {selectedUser.email || 'No email'} · joined {formatDate(selectedUser.created_at)}
                      </p>
                    </div>

                    <div className="admin-actions">
                      <Link href={`/admin/notifications?userId=${selectedUser.id}`} className="btn btn-ghost">Notify user</Link>
                      <button type="button" className="btn btn-accent" onClick={saveSelectedProfile} disabled={savingProfile}>
                        {savingProfile ? 'Saving...' : 'Save profile'}
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
                      <p className="small muted">Support and messaging</p>
                      <strong>Send this user a platform notification</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        Use this for support replies, account issues, trial updates or platform announcements.
                      </p>
                    </div>
                    <Link href={`/admin/notifications?userId=${selectedUser.id}`} className="btn btn-ghost">Notify user</Link>
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
                              {business.trial_ends_at && (
                                <p className="small muted">Trial ends: {formatDate(business.trial_ends_at)}</p>
                              )}
                            </div>
                            <div className="admin-actions">
                              <Link href={`/explore/${business.id}`} className="btn btn-ghost">Public page</Link>
                              <Link href={`/admin/businesses?businessId=${business.id}`} className="btn btn-accent">Manage business</Link>
                              <Link href={`/admin/notifications?businessId=${business.id}`} className="btn btn-ghost">Notify business</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedStaffLinks.length > 0 && (
                    <div className="admin-linked-businesses">
                      <p className="small muted">Staff links</p>
                      <div className="admin-linked-list">
                        {selectedStaffLinks.map((staff) => (
                          <div key={staff.id} className="admin-linked-business">
                            <div>
                              <strong>{staff.name || staff.email || 'Staff profile'}</strong>
                              <p className="small muted">
                                {staff.role_title || 'Staff'} · {staff.active ? 'active' : 'hidden'}
                              </p>
                              <p className="small muted">
                                Business: {staff.business?.name || 'Unknown business'}
                              </p>
                            </div>
                            {staff.business_id && (
                              <Link href={`/admin/businesses?businessId=${staff.business_id}`} className="btn btn-ghost">Open business</Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBookings.length > 0 && (
                    <div className="admin-linked-businesses">
                      <p className="small muted">Recent customer bookings</p>
                      <div className="admin-linked-list">
                        {selectedBookings.map((booking) => (
                          <div key={booking.id} className="admin-linked-business">
                            <div>
                              <strong>{booking.service_name || 'Booking'}</strong>
                              <p className="small muted">
                                {booking.business?.name || 'Unknown business'} · {booking.status || 'unknown'}
                              </p>
                              <p className="small muted">
                                {formatDateTime(booking.start_at || booking.created_at)}
                              </p>
                            </div>
                            {booking.business_id && (
                              <Link href={`/admin/businesses?businessId=${booking.business_id}`} className="btn btn-ghost">Open business</Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="admin-access-box">
                    <div className="admin-section-header">
                      <div>
                        <p className="small muted">Protected access controls</p>
                        <h3>Role and admin access</h3>
                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          Keep this collapsed unless fixing an account issue. Type CONFIRM before saving role/admin changes.
                        </p>
                      </div>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowAdvancedControls((value) => !value)}>
                        {showAdvancedControls ? 'Hide access controls' : 'Show access controls'}
                      </button>
                    </div>

                    {showAdvancedControls && (
                      <div className="admin-access-inner">
                        <div className="admin-editor-grid">
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

                        <div className="admin-quick-actions">
                          <button type="button" className="btn btn-ghost" onClick={stageCustomerOnly}>Stage customer only</button>
                          <button type="button" className="btn btn-ghost" onClick={stageBusinessRole}>Stage business role</button>
                          <button type="button" className="btn btn-accent" onClick={stageCustomerAdmin}>Stage customer + admin</button>
                        </div>

                        <div className="admin-warning-box">
                          <p className="small muted">High-risk change</p>
                          <p className="small muted" style={{ marginTop: '0.35rem' }}>
                            Role/admin changes can affect access immediately. Type CONFIRM below, then save.
                          </p>
                          <input
                            value={advancedConfirmText}
                            onChange={(event) => setAdvancedConfirmText(event.target.value)}
                            placeholder="Type CONFIRM"
                            style={{ marginTop: '0.75rem' }}
                          />
                          <button type="button" className="btn btn-danger" onClick={saveAccessControls} disabled={savingAccess} style={{ marginTop: '0.75rem' }}>
                            {savingAccess ? 'Saving access...' : 'Save access controls'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="admin-save-footer">
                    <div>
                      <p className="small muted">Current selection</p>
                      <strong>{roleLabel(selectedUser.role)} · {selectedUser.is_admin ? 'Admin enabled' : 'No admin access'}</strong>
                    </div>
                    <button type="button" className="btn btn-accent" onClick={saveSelectedProfile} disabled={savingProfile}>
                      {savingProfile ? 'Saving...' : 'Save profile details'}
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
          grid-template-columns: minmax(300px, 0.82fr) minmax(0, 1.18fr);
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
          max-height: 760px;
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

        .admin-pill-warning {
          background: rgba(255,190,11,0.12);
          color: var(--warning);
          border-color: rgba(255,190,11,0.22);
        }

        .admin-empty,
        .admin-hint-box,
        .admin-account-snapshot,
        .admin-linked-businesses,
        .admin-notify-box,
        .admin-warning-box,
        .admin-access-box {
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

        .admin-access-box {
          border-color: rgba(255,190,11,0.25);
        }

        .admin-access-inner {
          display: grid;
          gap: 1rem;
          margin-top: 1rem;
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
          .admin-notify-box a,
          .admin-linked-business a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}