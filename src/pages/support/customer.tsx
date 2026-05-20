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
  phone?: string | null
}

const CUSTOMER_SUBJECT_KEYS = [
  'support.customer.subject.pending',
  'support.customer.subject.cancel',
  'support.customer.subject.noResponse',
  'support.customer.subject.wrongDetails',
  'support.customer.subject.account',
  'support.customer.subject.notifications',
  'support.customer.subject.other'
]

export default function CustomerSupportPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(CUSTOMER_SUBJECT_KEYS[0])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login?redirectTo=/support/customer')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setProfile(data)
      setName(data.full_name || '')
      setEmail(data.email || '')
    }

    setLoading(false)
  }

  async function submitSupportMessage(e: React.FormEvent) {
    e.preventDefault()

    if (!profile) {
      setError(t('support.customer.loginRequired'))
      return
    }

    if (!subject.trim() || !message.trim()) {
      setError(t('support.customer.validation'))
      return
    }

    setSending(true)
    setError(null)
    setSuccess(null)

    const { error: insertError } = await supabase
      .from('support_messages')
      .insert({
        user_id: profile.id,
        account_type: 'customer',
        name: name.trim() || profile.full_name || null,
        email: email.trim() || profile.email || null,
        subject: t(subject).trim(),
        message: message.trim(),
        status: 'open',
        priority: subject === 'support.customer.subject.noResponse' ? 'high' : 'normal'
      })

    setSending(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccess(t('support.customer.success'))
    setMessage('')
    setSubject(CUSTOMER_SUBJECT_KEYS[0])
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="support-shell">
          <div className="card support-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>{t('nav.customerSupport')}</p>
            <h1 className="page-title">{t('support.customer.heroTitle')}</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              {t('support.customer.heroBody')}
            </p>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">{t('support.customer.loading')}</p>
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
                  <p className="small muted">{t('support.customer.formKicker')}</p>
                  <h2>{t('support.customer.formTitle')}</h2>
                </div>

                <div className="support-form-grid">
                  <div>
                    <label className="small muted">{t('common.name')}</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('support.customer.namePlaceholder')} style={{ marginTop: '0.4rem' }} />
                  </div>

                  <div>
                    <label className="small muted">{t('common.email')}</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('support.customer.emailPlaceholder')} style={{ marginTop: '0.4rem' }} />
                  </div>

                  <div className="full-span">
                    <label className="small muted">{t('support.customer.subjectLabel')}</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginTop: '0.4rem' }}>
                      {CUSTOMER_SUBJECT_KEYS.map((item) => (
                        <option key={item} value={item}>{t(item)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">{t('support.customer.messageLabel')}</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('support.customer.messagePlaceholder')}
                      rows={7}
                      style={{ marginTop: '0.4rem' }}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-accent" disabled={sending}>
                  {sending ? t('support.customer.sending') : t('support.customer.sendButton')}
                </button>
              </form>

              <div className="card support-side-card">
                <p className="small muted">{t('support.customer.linksKicker')}</p>
                <h2>{t('support.customer.quickActions')}</h2>

                <div className="support-link-list">
                  <Link href="/my-bookings" className="support-link-row">
                    <span>
                      <strong>{t('nav.myBookings')}</strong>
                      <small>{t('support.customer.bookingsBody')}</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/notifications" className="support-link-row">
                    <span>
                      <strong>{t('nav.notifications')}</strong>
                      <small>{t('support.customer.notificationsBody')}</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/explore" className="support-link-row">
                    <span>
                      <strong>{t('nav.explore')}</strong>
                      <small>{t('support.customer.exploreBody')}</small>
                    </span>
                    <span>→</span>
                  </Link>

                  <Link href="/account" className="support-link-row">
                    <span>
                      <strong>{t('nav.account')}</strong>
                      <small>{t('support.customer.accountBody')}</small>
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
