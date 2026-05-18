import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  email?: string | null
  full_name?: string | null
}

type StaffProfile = {
  id: string
  business_id?: string | null
  name?: string | null
  email?: string | null
  role_title?: string | null
  permission_role?: string | null
  active?: boolean | null
  business_name?: string | null
}

const STAFF_SUBJECTS = [
  'Cannot access staff account',
  'Availability is wrong',
  'Schedule or appointments issue',
  'Linked to wrong business',
  'Staff email/linking issue',
  'Notifications issue',
  'Other staff issue'
]

export default function StaffSupportPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(STAFF_SUBJECTS[0])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadContext()
  }, [])

  async function loadContext() {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login?redirectTo=/support/staff')
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', session.user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setName(profileData.full_name || '')
      setEmail(profileData.email || '')
    }

    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, business_id, name, email, role_title, permission_role, active')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    let resolvedStaff = staffData as StaffProfile | null

    if (resolvedStaff?.business_id) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', resolvedStaff.business_id)
        .maybeSingle()

      resolvedStaff = {
        ...resolvedStaff,
        business_name: businessData?.name || null
      }
    }

    setStaffProfile(resolvedStaff)
    setLoading(false)
  }

  async function submitSupportMessage(e: React.FormEvent) {
    e.preventDefault()

    if (!profile) {
      setError('You need to be logged in to send a support message.')
      return
    }

    if (!subject.trim() || !message.trim()) {
      setError('Choose a subject and write a message before sending.')
      return
    }

    setSending(true)
    setError(null)
    setSuccess(null)

    const { error: insertError } = await supabase
      .from('support_messages')
      .insert({
        user_id: profile.id,
        business_id: staffProfile?.business_id || null,
        account_type: 'staff',
        name: name.trim() || staffProfile?.name || profile.full_name || null,
        email: email.trim() || staffProfile?.email || profile.email || null,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
        priority: subject.includes('Cannot access') || subject.includes('wrong business') ? 'high' : 'normal'
      })

    setSending(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccess('Your staff support request has been sent.')
    setMessage('')
    setSubject(STAFF_SUBJECTS[0])
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="support-shell">
          <div className="card support-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>Staff support</p>
            <h1 className="page-title">Help with staff access and schedule issues</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              Use this for staff login, linked account issues, availability problems, schedule visibility or being connected to the wrong business.
            </p>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">Loading staff context...</p>
            </div>
          )}

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

          {!loading && (
            <div className="support-grid">
              <form onSubmit={submitSupportMessage} className="card support-form-card">
                <div>
                  <p className="small muted">Support request</p>
                  <h2>Send staff support message</h2>
                </div>

                {staffProfile && (
                  <div className="staff-context-box">
                    <p className="small muted">Linked staff profile</p>
                    <strong>{staffProfile.name || name || 'Staff member'}</strong>
                    <p className="small muted" style={{ marginTop: '0.35rem' }}>
                      {staffProfile.role_title || staffProfile.permission_role || 'Staff'} · {staffProfile.business_name || 'Linked business'} · {staffProfile.active ? 'active' : 'hidden'}
                    </p>
                  </div>
                )}

                {!staffProfile && (
                  <div className="staff-context-box warning">
                    <p className="small muted">No linked staff profile found</p>
                    <strong>This login is not currently linked to a staff profile.</strong>
                    <p className="small muted" style={{ marginTop: '0.35rem' }}>
                      Ask the business owner to add your email to their staff profile, or send this support request for help.
                    </p>
                  </div>
                )}

                <div className="support-form-grid">
                  <div>
                    <label className="small muted">Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={{ marginTop: '0.4rem' }} />
                  </div>

                  <div>
                    <label className="small muted">Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" style={{ marginTop: '0.4rem' }} />
                  </div>

                  <div className="full-span">
                    <label className="small muted">What is this about?</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginTop: '0.4rem' }}>
                      {STAFF_SUBJECTS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Explain the staff issue. Include business name, date/time or availability details if useful."
                      rows={7}
                      style={{ marginTop: '0.4rem' }}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-accent" disabled={sending}>
                  {sending ? 'Sending...' : 'Send staff support request'}
                </button>
              </form>

              <div className="card support-side-card">
                <p className="small muted">Useful staff links</p>
                <h2>Quick actions</h2>

                <div className="support-link-list">
                  <Link href="/staff" className="support-link-row">
                    <span>
                      <strong>Staff schedule</strong>
                      <small>View assigned appointments and daily schedule.</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/staff/availability" className="support-link-row">
                    <span>
                      <strong>Availability</strong>
                      <small>Update your staff working availability.</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/account" className="support-link-row">
                    <span>
                      <strong>Account</strong>
                      <small>Check your account details and linked workspaces.</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/support/business" className="support-link-row">
                    <span>
                      <strong>Business support</strong>
                      <small>Use this if the issue belongs to the business owner setup.</small>
                    </span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .support-shell {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .support-hero {
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .support-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          gap: 1rem;
          align-items: start;
        }

        .support-form-card,
        .support-side-card {
          display: grid;
          gap: 1rem;
        }

        .support-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .full-span {
          grid-column: 1 / -1;
        }

        .staff-context-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .staff-context-box.warning {
          border-color: rgba(255,190,11,0.28);
          background: rgba(255,190,11,0.06);
        }

        .support-link-list {
          display: grid;
          gap: 0.75rem;
        }

        .support-link-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .support-link-row small {
          display: block;
          margin-top: 0.2rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        @media (max-width: 860px) {
          .support-grid,
          .support-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}