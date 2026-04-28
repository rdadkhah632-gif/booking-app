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

export default function AccountPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [actualRole, setActualRole] = useState<Role>('customer')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
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

    setMessage('Account updated.')
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

    setMessage('Account role fixed to business.')
    await loadProfile()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        {loading && (
          <div className="card">
            <p className="muted">Loading account...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {!loading && profile && (
          <div style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gap: '1rem'
          }}>
            <div>
              <p className="small muted">Account settings</p>

              <h1 className="page-title">
                Your profile
              </h1>

              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Manage your account details and jump back into your {actualRole === 'business' ? 'business dashboard' : 'customer bookings'}.
              </p>
            </div>

            <div className="grid-2">
              <div className="card">
                <p className="small muted">Email</p>
                <strong>{profile.email}</strong>
              </div>

              <div className="card">
                <p className="small muted">Account type</p>
                <strong style={{ textTransform: 'capitalize' }}>
                  {actualRole}
                </strong>

                {actualRole === 'business' && profile.role !== 'business' && (
                  <>
                    <p className="small muted" style={{ marginTop: '0.5rem' }}>
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
            </div>

            <form onSubmit={saveProfile} className="card" style={{ display: 'grid', gap: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                Personal details
              </h2>

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
                <p style={{ color: 'var(--success)' }}>{message}</p>
              )}
            </form>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
                Quick actions
              </h2>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {actualRole === 'business' ? (
                  <>
                    <Link href="/dashboard" className="btn btn-accent">
                      Business dashboard
                    </Link>

                    <Link href="/dashboard/businesses" className="btn btn-ghost">
                      Manage businesses
                    </Link>

                    <Link href="/dashboard/services" className="btn btn-ghost">
                      Services
                    </Link>

                    <Link href="/dashboard/availability" className="btn btn-ghost">
                      Working hours
                    </Link>

                    <Link href="/dashboard/bookings" className="btn btn-ghost">
                      Bookings
                    </Link>

                    <Link href="/explore" className="btn btn-ghost">
                      View marketplace
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/my-bookings" className="btn btn-accent">
                      My bookings
                    </Link>

                    <Link href="/explore" className="btn btn-ghost">
                      Browse businesses
                    </Link>
                  </>
                )}

                <button onClick={logout} className="btn btn-danger">
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}