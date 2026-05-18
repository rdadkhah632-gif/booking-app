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

type ProfileRow = {
  id: string
  email?: string | null
  full_name?: string | null
  phone?: string | null
  role?: string | null
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
  subscription_status?: string | null
  owner?: ProfileRow | null
}

type NotificationRow = {
  id: string
  user_id?: string | null
  business_id?: string | null
  audience: string
  type: string
  title: string
  message?: string | null
  action_url?: string | null
  read_at?: string | null
  created_at?: string | null
}

type NotificationDisplayRow = NotificationRow & {
  profile?: ProfileRow | null
  business?: BusinessRow | null
}

const TARGET_OPTIONS = [
  { value: 'single_user', label: 'Single user' },
  { value: 'single_business', label: 'Single business owner' },
  { value: 'all_business_owners', label: 'All business owners' },
  { value: 'all_users', label: 'All users' },
  { value: 'admins_only', label: 'Admins only' }
]

const TYPE_OPTIONS = [
  { value: 'admin_announcement', label: 'Announcement' },
  { value: 'admin_promotion', label: 'Promotion / offer' },
  { value: 'trial_reminder', label: 'Trial reminder' },
  { value: 'billing_notice', label: 'Billing notice' },
  { value: 'support_notice', label: 'Support notice' },
  { value: 'platform_update', label: 'Platform update' }
]

function profileLabel(profile: ProfileRow) {
  const name = profile.full_name ? ` · ${profile.full_name}` : ''
  const role = profile.is_admin ? ' · admin' : profile.role ? ` · ${profile.role}` : ''
  return `${profile.email || 'No email'}${name}${role}`
}

function businessOwnerEmail(business: BusinessRow) {
  return business.owner?.email || 'No owner email'
}

function businessOwnerId(business: BusinessRow) {
  return business.owner?.id || business.user_id || ''
}

function businessLabel(business: BusinessRow) {
  const location = [business.city, business.country].filter(Boolean).join(', ')
  return `${business.name}${location ? ` · ${location}` : ''} · ${businessOwnerEmail(business)}`
}

function defaultActionForTarget(targetMode: string, businessId?: string) {
  if (targetMode === 'single_business' && businessId) return '/dashboard/notifications'
  if (targetMode === 'all_business_owners') return '/dashboard/notifications'
  if (targetMode === 'admins_only') return '/admin'
  return '/notifications'
}

export default function AdminNotificationsPage() {
  const router = useRouter()

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [recentNotifications, setRecentNotifications] = useState<NotificationDisplayRow[]>([])

  const [targetMode, setTargetMode] = useState('single_user')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [notificationType, setNotificationType] = useState('admin_announcement')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [audience, setAudience] = useState('general')
  const [userSearch, setUserSearch] = useState('')
  const [businessSearch, setBusinessSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const businessOwners = useMemo(() => {
    const seen = new Set<string>()

    return businesses
      .map((business) => business.owner)
      .filter((owner): owner is ProfileRow => Boolean(owner?.id))
      .filter((owner) => {
        if (seen.has(owner.id)) return false
        seen.add(owner.id)
        return true
      })
  }, [businesses])

  const admins = useMemo(() => {
    return profiles.filter((profile) => profile.is_admin)
  }, [profiles])

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    const rows = profiles.filter((profile) => {
      if (!term) return true
      return [profile.email, profile.full_name, profile.phone, profile.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })

    return rows.slice(0, 60)
  }, [profiles, userSearch])

  const filteredBusinesses = useMemo(() => {
    const term = businessSearch.trim().toLowerCase()
    const rows = businesses.filter((business) => {
      if (!term) return true
      return [
        business.name,
        business.city,
        business.country,
        business.category,
        business.subscription_status,
        businessOwnerEmail(business),
        business.owner?.full_name
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })

    return rows.slice(0, 60)
  }, [businesses, businessSearch])

  const selectedUser = useMemo(() => {
    return profiles.find((profile) => profile.id === selectedUserId) || null
  }, [profiles, selectedUserId])

  const selectedBusiness = useMemo(() => {
    return businesses.find((business) => business.id === selectedBusinessId) || null
  }, [businesses, selectedBusinessId])

  const targetCount = useMemo(() => {
    if (targetMode === 'single_user') return selectedUserId ? 1 : 0
    if (targetMode === 'single_business') return selectedBusinessId && selectedBusiness?.owner ? 1 : 0
    if (targetMode === 'all_business_owners') return businessOwners.length
    if (targetMode === 'all_users') return profiles.length
    if (targetMode === 'admins_only') return admins.length
    return 0
  }, [targetMode, selectedUserId, selectedBusinessId, selectedBusiness, businessOwners.length, profiles.length, admins.length])

  const canSend = title.trim().length > 0 && message.trim().length > 0 && targetCount > 0

  async function loadAdminNotifications() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/admin/notifications')
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
        setProfiles([])
        setBusinesses([])
        setRecentNotifications([])
        setLoading(false)
        return
      }

      setAdminProfile(profileData as AdminProfile)

      const { data: profileRows, error: profileRowsError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, role, is_admin')
        .order('email', { ascending: true })
        .limit(1000)

      if (profileRowsError) throw profileRowsError

      const loadedProfiles = (profileRows || []) as ProfileRow[]
      const profileMap = loadedProfiles.reduce((map: Record<string, ProfileRow>, profile) => {
        map[profile.id] = profile
        return map
      }, {})

      const { data: businessRows, error: businessRowsError } = await supabase
        .from('businesses')
        .select('id, user_id, name, city, country, category, published, subscription_status')
        .order('name', { ascending: true })
        .limit(1000)

      if (businessRowsError) throw businessRowsError

      const loadedBusinesses = ((businessRows || []) as BusinessRow[]).map((business) => ({
        ...business,
        owner: business.user_id ? profileMap[business.user_id] || null : null
      }))

      const { data: notificationRows, error: notificationRowsError } = await supabase
        .from('notifications')
        .select('id, user_id, business_id, audience, type, title, message, action_url, read_at, created_at')
        .in('type', TYPE_OPTIONS.map((option) => option.value))
        .order('created_at', { ascending: false })
        .limit(60)

      if (notificationRowsError) throw notificationRowsError

      const businessMap = loadedBusinesses.reduce((map: Record<string, BusinessRow>, business) => {
        map[business.id] = business
        return map
      }, {})

      const displayNotifications = ((notificationRows || []) as NotificationRow[]).map((notification) => ({
        ...notification,
        profile: notification.user_id ? profileMap[notification.user_id] || null : null,
        business: notification.business_id ? businessMap[notification.business_id] || null : null
      }))

      setProfiles(loadedProfiles)
      setBusinesses(loadedBusinesses)
      setRecentNotifications(displayNotifications)

      const queryUserId = typeof router.query.userId === 'string' ? router.query.userId : ''
      const queryBusinessId = typeof router.query.businessId === 'string' ? router.query.businessId : ''

      if (queryUserId && loadedProfiles.some((profile) => profile.id === queryUserId)) {
        setTargetMode('single_user')
        setSelectedUserId(queryUserId)
        setAudience('general')
        setActionUrl('/notifications')
      } else if (!selectedUserId && loadedProfiles[0]?.id) {
        setSelectedUserId(loadedProfiles[0].id)
      }

      if (queryBusinessId && loadedBusinesses.some((business) => business.id === queryBusinessId)) {
        const business = loadedBusinesses.find((item) => item.id === queryBusinessId) || null
        setTargetMode('single_business')
        setSelectedBusinessId(queryBusinessId)
        setSelectedUserId(business ? businessOwnerId(business) : '')
        setAudience('business')
        setActionUrl('/dashboard/notifications')
      } else if (!selectedBusinessId && loadedBusinesses[0]?.id) {
        setSelectedBusinessId(loadedBusinesses[0].id)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load admin notifications.')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadAdminNotifications()
  }, [router.isReady])

  function setTargetModeSafely(nextMode: string) {
    setTargetMode(nextMode)

    if (nextMode === 'single_business' || nextMode === 'all_business_owners') {
      setAudience('business')
      setActionUrl(defaultActionForTarget(nextMode, selectedBusinessId))
      return
    }

    if (nextMode === 'admins_only') {
      setAudience('admin')
      setActionUrl('/admin')
      return
    }

    setAudience('general')
    setActionUrl(defaultActionForTarget(nextMode))
  }

  function buildNotificationRows() {
    const cleanTitle = title.trim()
    const cleanMessage = message.trim()
    const cleanActionUrl = actionUrl.trim() || defaultActionForTarget(targetMode, selectedBusinessId)

    if (targetMode === 'single_user') {
      return [{
        user_id: selectedUserId,
        business_id: null,
        audience,
        type: notificationType,
        title: cleanTitle,
        message: cleanMessage,
        action_url: cleanActionUrl
      }]
    }

    if (targetMode === 'single_business') {
      const business = businesses.find((item) => item.id === selectedBusinessId)
      const ownerUserId = business ? businessOwnerId(business) : ''

      return [{
        user_id: ownerUserId || null,
        business_id: selectedBusinessId,
        audience: audience === 'general' ? 'business' : audience,
        type: notificationType,
        title: cleanTitle,
        message: cleanMessage,
        action_url: cleanActionUrl || '/dashboard/notifications'
      }]
    }

    if (targetMode === 'all_business_owners') {
      return businessOwners.map((profile) => ({
        user_id: profile.id,
        business_id: null,
        audience: audience === 'general' ? 'business' : audience,
        type: notificationType,
        title: cleanTitle,
        message: cleanMessage,
        action_url: cleanActionUrl || '/dashboard/notifications'
      }))
    }

    if (targetMode === 'all_users') {
      return profiles.map((profile) => ({
        user_id: profile.id,
        business_id: null,
        audience,
        type: notificationType,
        title: cleanTitle,
        message: cleanMessage,
        action_url: cleanActionUrl || '/notifications'
      }))
    }

    if (targetMode === 'admins_only') {
      return admins.map((profile) => ({
        user_id: profile.id,
        business_id: null,
        audience: 'admin',
        type: notificationType,
        title: cleanTitle,
        message: cleanMessage,
        action_url: cleanActionUrl || '/admin'
      }))
    }

    return []
  }

  async function sendNotification() {
    if (!canSend) {
      setError('Choose a target and add a title and message before sending.')
      return
    }

    const confirmed = confirm(`Send this notification to ${targetCount} recipient${targetCount === 1 ? '' : 's'}?`)
    if (!confirmed) return

    setSending(true)
    setError(null)
    setSuccess(null)

    const rows = buildNotificationRows()

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(rows)

    setSending(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccess(`Notification sent to ${rows.length} recipient${rows.length === 1 ? '' : 's'}.`)
    setTitle('')
    setMessage('')
    setActionUrl(defaultActionForTarget(targetMode, selectedBusinessId))
    await loadAdminNotifications()
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
            <p className="muted">Loading Mirëbook notification admin...</p>
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

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="admin-shell">
          <div className="admin-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook operator</p>
              <h1 className="page-title">Platform notifications</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Send operational notices, trial reminders, promotions and support updates without relying on business dashboards.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/admin" className="btn btn-ghost">Overview</Link>
              <Link href="/admin/businesses" className="btn btn-ghost">Businesses</Link>
              <Link href="/admin/users" className="btn btn-ghost">Users</Link>
              <button type="button" className="btn btn-accent" onClick={loadAdminNotifications}>Refresh</button>
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
              <h2>{profiles.length}</h2>
              <p className="small muted">Searchable recipients</p>
            </div>
            <div className="card">
              <p className="small muted">Businesses loaded</p>
              <h2>{businesses.length}</h2>
              <p className="small muted">Business targets</p>
            </div>
            <div className="card">
              <p className="small muted">Business owners</p>
              <h2>{businessOwners.length}</h2>
              <p className="small muted">Unique owner accounts</p>
            </div>
            <div className="card">
              <p className="small muted">Current target</p>
              <h2>{targetCount}</h2>
              <p className="small muted">Recipients selected</p>
            </div>
          </div>

          <div className="admin-layout-grid">
            <div className="card admin-compose-card">
              <div>
                <p className="small muted">Compose</p>
                <h2>Send notification</h2>
              </div>

              <div className="admin-form-grid">
                <div>
                  <label className="small muted">Target</label>
                  <select value={targetMode} onChange={(event) => setTargetModeSafely(event.target.value)} style={{ marginTop: '0.4rem' }}>
                    {TARGET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {targetMode === 'single_user' && (
                  <div className="admin-target-select-block">
                    <label className="small muted">Find user</label>
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search email, name, phone or role..."
                      style={{ marginTop: '0.4rem' }}
                    />
                    <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} style={{ marginTop: '0.55rem' }}>
                      {filteredUsers.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profileLabel(profile)}</option>
                      ))}
                    </select>
                    {profiles.length > 60 && !userSearch && (
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        Showing first 60 users. Search to narrow results.
                      </p>
                    )}
                    {selectedUserId && (
                      <div className="admin-inline-actions">
                        <Link href={`/admin/users?userId=${selectedUserId}`} className="btn btn-ghost">Open user</Link>
                      </div>
                    )}
                  </div>
                )}

                {targetMode === 'single_business' && (
                  <div className="admin-target-select-block">
                    <label className="small muted">Find business</label>
                    <input
                      value={businessSearch}
                      onChange={(event) => setBusinessSearch(event.target.value)}
                      placeholder="Search business, owner, city or category..."
                      style={{ marginTop: '0.4rem' }}
                    />
                    <select
                      value={selectedBusinessId}
                      onChange={(event) => {
                        const nextBusinessId = event.target.value
                        const business = businesses.find((item) => item.id === nextBusinessId) || null
                        setSelectedBusinessId(nextBusinessId)
                        setSelectedUserId(business ? businessOwnerId(business) : '')
                        setActionUrl('/dashboard/notifications')
                      }}
                      style={{ marginTop: '0.55rem' }}
                    >
                      {filteredBusinesses.map((business) => (
                        <option key={business.id} value={business.id}>{businessLabel(business)}</option>
                      ))}
                    </select>
                    {businesses.length > 60 && !businessSearch && (
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        Showing first 60 businesses. Search to narrow results.
                      </p>
                    )}
                    {selectedBusinessId && (
                      <div className="admin-inline-actions">
                        <Link href={`/admin/businesses?businessId=${selectedBusinessId}`} className="btn btn-ghost">Open business</Link>
                        <Link href={`/explore/${selectedBusinessId}`} className="btn btn-ghost">Public page</Link>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="small muted">Notification type</label>
                  <select value={notificationType} onChange={(event) => setNotificationType(event.target.value)} style={{ marginTop: '0.4rem' }}>
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="small muted">Audience label</label>
                  <select value={audience} onChange={(event) => setAudience(event.target.value)} style={{ marginTop: '0.4rem' }}>
                    <option value="general">General</option>
                    <option value="customer">Customer</option>
                    <option value="business">Business</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="small muted">Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Example: Trial extended"
                    style={{ marginTop: '0.4rem' }}
                  />
                </div>

                <div>
                  <label className="small muted">Action URL</label>
                  <input
                    value={actionUrl}
                    onChange={(event) => setActionUrl(event.target.value)}
                    placeholder={defaultActionForTarget(targetMode, selectedBusinessId)}
                    style={{ marginTop: '0.4rem' }}
                  />
                </div>

                <div className="admin-message-field">
                  <label className="small muted">Message</label>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write the message that should appear in the notification centre."
                    rows={5}
                    style={{ marginTop: '0.4rem' }}
                  />
                </div>
              </div>

              <div className="admin-preview-box">
                <p className="small muted">Preview</p>
                <h3>{title.trim() || 'Notification title'}</h3>
                <p className="small muted" style={{ marginTop: '0.45rem' }}>
                  {message.trim() || 'Notification message preview will appear here.'}
                </p>
                <p className="small muted" style={{ marginTop: '0.45rem' }}>
                  Target: {TARGET_OPTIONS.find((option) => option.value === targetMode)?.label} · {targetCount} recipient{targetCount === 1 ? '' : 's'}
                </p>
              </div>

              {(targetMode === 'single_user' || targetMode === 'single_business') && (
                <div className="admin-target-box">
                  <p className="small muted">Selected target</p>
                  <strong>
                    {targetMode === 'single_user'
                      ? selectedUser?.email || 'Selected user'
                      : selectedBusiness?.name || 'Selected business'}
                  </strong>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {targetMode === 'single_business'
                      ? `Owner: ${selectedBusiness ? businessOwnerEmail(selectedBusiness) : 'Unknown owner'}`
                      : selectedUser?.full_name || selectedUser?.role || 'No extra details saved'}
                  </p>
                </div>
              )}

              {(targetMode === 'all_users' || targetMode === 'all_business_owners' || targetMode === 'admins_only') && (
                <div className="admin-bulk-warning">
                  <p className="small muted">Bulk send confirmation</p>
                  <strong>{targetCount} recipients will receive this notification.</strong>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Bulk messages should be used for platform notices, trial reminders, promotions or operational updates only.
                  </p>
                </div>
              )}

              <div className="admin-send-footer">
                <div>
                  <p className="small muted">Ready to send?</p>
                  <strong>{targetCount} recipient{targetCount === 1 ? '' : 's'} selected</strong>
                </div>

                <button type="button" className="btn btn-accent" onClick={sendNotification} disabled={sending || !canSend}>
                  {sending ? 'Sending...' : 'Send notification'}
                </button>
              </div>
            </div>

            <div className="card admin-recent-card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Recent admin notifications</p>
                  <h2>Sent notices</h2>
                </div>
              </div>

              {recentNotifications.length === 0 ? (
                <div className="admin-empty">
                  <h3>No admin notifications yet</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Messages sent from this admin page will appear here.
                  </p>
                </div>
              ) : (
                <div className="admin-recent-list">
                  {recentNotifications.map((notification) => (
                    <div key={notification.id} className="admin-recent-item">
                      <div>
                        <div className="admin-recent-title-row">
                          <strong>{notification.title}</strong>
                          <span className="admin-pill admin-pill-accent">
                            {notification.type.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {notification.message && (
                          <p className="small muted" style={{ marginTop: '0.35rem' }}>
                            {notification.message}
                          </p>
                        )}

                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          {notification.profile?.email || notification.business?.name || notification.audience}
                          {' · '}
                          {notification.created_at ? new Date(notification.created_at).toLocaleString() : 'Recently'}
                          {notification.read_at ? ' · read' : ' · unread'}
                        </p>
                      </div>

                      <div className="admin-inline-actions">
                        {notification.profile?.id && (
                          <Link href={`/admin/users?userId=${notification.profile.id}`} className="btn btn-ghost">User</Link>
                        )}
                        {notification.business?.id && (
                          <Link href={`/admin/businesses?businessId=${notification.business.id}`} className="btn btn-ghost">Business</Link>
                        )}
                        {notification.action_url && (
                          <Link href={notification.action_url} className="btn btn-ghost">Open action</Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
        .admin-send-footer,
        .admin-recent-item {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .admin-actions,
        .admin-inline-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .admin-layout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(330px, 0.92fr);
          gap: 1rem;
          align-items: start;
        }

        .admin-compose-card,
        .admin-recent-card {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .admin-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .admin-target-select-block {
          grid-column: 1 / -1;
        }

        .admin-message-field {
          grid-column: 1 / -1;
        }

        .admin-preview-box,
        .admin-target-box,
        .admin-bulk-warning,
        .admin-empty {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .admin-bulk-warning {
          border-color: rgba(255,190,11,0.28);
          background: rgba(255,190,11,0.06);
        }

        .admin-send-footer {
          background: rgba(255,107,53,0.06);
          border: 1px solid rgba(255,107,53,0.22);
          border-radius: var(--radius);
          padding: 1rem;
          align-items: center;
        }

        .admin-recent-list {
          display: grid;
          gap: 0.75rem;
        }

        .admin-recent-item {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .admin-recent-title-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
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

        .admin-pill-accent {
          background: var(--accent-dim);
          color: var(--accent);
          border-color: rgba(255,107,53,0.22);
          text-transform: capitalize;
        }

        @media (max-width: 980px) {
          .admin-layout-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .admin-header,
          .admin-section-header,
          .admin-send-footer,
          .admin-recent-item {
            display: grid;
          }

          .admin-actions,
          .admin-inline-actions,
          .admin-actions :global(.btn),
          .admin-inline-actions :global(.btn),
          .admin-send-footer :global(.btn),
          .admin-recent-item :global(.btn),
          .admin-actions a,
          .admin-inline-actions a,
          .admin-send-footer button,
          .admin-recent-item a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}