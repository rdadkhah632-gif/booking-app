import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

type Profile = {
  id: string
  email?: string | null
  full_name?: string | null
}

type Business = {
  id: string
  name: string
  published?: boolean | null
  subscription_status?: string | null
}

const BUSINESS_SUBJECT_KEYS = [
  'support.business.subject.setup',
  'support.business.subject.services',
  'support.business.subject.approval',
  'support.business.subject.customerBooking',
  'support.business.subject.subscription',
  'support.business.subject.imageUpload',
  'support.business.subject.account',
  'support.business.subject.other'
]

export default function BusinessSupportPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessId, setBusinessId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(BUSINESS_SUBJECT_KEYS[0])
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
      router.replace('/login?redirectTo=/support/business')
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

    const { data: businessData } = await supabase
      .from('businesses')
      .select('id, name, published, subscription_status')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    const rows = (businessData || []) as Business[]
    setBusinesses(rows)
    setBusinessId(rows[0]?.id || '')

    setLoading(false)
  }

  async function submitSupportMessage(e: React.FormEvent) {
    e.preventDefault()

    if (!profile) {
      setError(t('support.business.loginRequired'))
      return
    }

    if (!subject.trim() || !message.trim()) {
      setError(t('support.business.validation'))
      return
    }

    setSending(true)
    setError(null)
    setSuccess(null)

    const { error: insertError } = await supabase
      .from('support_messages')
      .insert({
        user_id: profile.id,
        business_id: businessId || null,
        account_type: 'business',
        name: name.trim() || profile.full_name || null,
        email: email.trim() || profile.email || null,
        subject: t(subject).trim(),
        message: message.trim(),
        status: 'open',
        priority: subject === 'support.business.subject.approval' || subject === 'support.business.subject.subscription' ? 'high' : 'normal'
      })

    setSending(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccess(t('support.business.success'))
    setMessage('')
    setSubject(BUSINESS_SUBJECT_KEYS[0])
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="support-shell">
          <div className="card support-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>{t('nav.businessSupport')}</p>
            <h1 className="page-title">{t('support.business.heroTitle')}</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              {t('support.business.heroBody')}
            </p>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">{t('support.business.loading')}</p>
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
                  <p className="small muted">{t('support.business.formKicker')}</p>
                  <h2>{t('support.business.formTitle')}</h2>
                </div>

                <div className="support-form-grid">
                  <div>
                    <label className="small muted">{t('common.name')}</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('support.business.namePlaceholder')} style={{ marginTop: '0.4rem' }} />
                  </div>

                  <div>
                    <label className="small muted">{t('common.email')}</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('support.business.emailPlaceholder')} style={{ marginTop: '0.4rem' }} />
                  </div>

                  <div className="full-span">
                    <label className="small muted">{t('common.business')}</label>
                    <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} style={{ marginTop: '0.4rem' }}>
                      {businesses.length === 0 && <option value="">{t('support.business.noBusiness')}</option>}
                      {businesses.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name} · {business.published ? t('support.business.status.published') : t('support.business.status.draft')} · {business.subscription_status || t('support.business.status.trial')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">{t('support.business.subjectLabel')}</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginTop: '0.4rem' }}>
                      {BUSINESS_SUBJECT_KEYS.map((item) => (
                        <option key={item} value={item}>{t(item)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">{t('support.business.messageLabel')}</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('support.business.messagePlaceholder')}
                      rows={7}
                      style={{ marginTop: '0.4rem' }}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-accent" disabled={sending}>
                  {sending ? t('support.business.sending') : t('support.business.sendButton')}
                </button>
              </form>

              <div className="card support-side-card">
                <p className="small muted">{t('support.business.linksKicker')}</p>
                <h2>{t('support.business.quickActions')}</h2>

                <div className="support-link-list">
                  <Link href="/dashboard/businesses" className="support-link-row">
                    <span>
                      <strong>{t('support.business.setupHub')}</strong>
                      <small>{t('support.business.setupHubBody')}</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/dashboard/bookings" className="support-link-row">
                    <span>
                      <strong>{t('support.business.bookings')}</strong>
                      <small>{t('support.business.bookingsBody')}</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/dashboard/services" className="support-link-row">
                    <span>
                      <strong>{t('support.business.services')}</strong>
                      <small>{t('support.business.servicesBody')}</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/dashboard/staff" className="support-link-row">
                    <span>
                      <strong>{t('support.business.staff')}</strong>
                      <small>{t('support.business.staffBody')}</small>
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