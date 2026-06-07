import AuthNav from '@/components/AuthNav'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

type SupportMessage = {
  id: string
  subject?: string | null
  category?: string | null
  message?: string | null
  status?: string | null
  priority?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function statusLabel(status: string | null | undefined, t: (key: string, fallback?: string) => string) {
  const value = String(status || 'open').toLowerCase()

  if (value === 'open') return t('support.status.open', 'Open')
  if (value === 'waiting' || value === 'waiting_for_user') {
    return t('support.status.waitingForUser', 'Waiting for user')
  }
  if (value === 'in_review' || value === 'in_progress') {
    return t('support.status.inProgress', 'In progress')
  }
  if (value === 'resolved') return t('support.status.resolved', 'Resolved')
  if (value === 'closed') return t('support.status.closed', 'Closed')

  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  return new Date(value).toLocaleString()
}

export default function SupportMessagesPage() {
  const { t } = useI18n()
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMessages()
  }, [])

  async function loadMessages() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = '/login?redirectTo=/support/messages'
      return
    }

    const { data, error } = await supabase
      .from('support_messages')
      .select('id, subject, category, message, status, priority, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setMessages((data || []) as SupportMessage[])
    setLoading(false)
  }

  const openMessages = useMemo(() => {
    return messages.filter((message) => !['resolved', 'closed'].includes(String(message.status || 'open')))
  }, [messages])

  const unknownDate = t('support.messages.unknownDate', 'Unknown date')

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="support-messages-shell">
          <div className="support-messages-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>{t('support.messages.kicker', 'Support conversations')}</p>
              <h1 className="page-title">{t('support.messages.title', 'My support messages')}</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                {t('support.messages.subtitle', 'Track replies from Mirëbook support and continue conversations when more information is needed.')}
              </p>
            </div>

            <div className="support-messages-actions">
              <Link href="/support" className="btn btn-ghost">{t('support.messages.supportHub', 'Support hub')}</Link>
              <Link href="/my-bookings" className="btn btn-ghost">{t('nav.myBookings', 'My bookings')}</Link>
              <button type="button" className="btn btn-accent" onClick={loadMessages}>{t('common.refresh', 'Refresh')}</button>
            </div>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">{t('support.messages.loading', 'Loading your support conversations...')}</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="grid-3">
                <div className="card">
                  <p className="small muted">{t('support.messages.openConversations', 'Open conversations')}</p>
                  <h2>{openMessages.length}</h2>
                  <p className="small muted">{t('support.messages.openConversationsBody', 'Waiting, open or in review')}</p>
                </div>
                <div className="card">
                  <p className="small muted">{t('support.messages.totalConversations', 'Total conversations')}</p>
                  <h2>{messages.length}</h2>
                  <p className="small muted">{t('support.messages.totalConversationsBody', 'All support requests you have sent')}</p>
                </div>
                <div className="card support-help-card">
                  <p className="small muted">{t('common.needHelp', 'Need help?')}</p>
                  <h2>{t('support.messages.startFromSupport', 'Start from Support')}</h2>
                  <p className="small muted">{t('support.messages.startFromSupportBody', 'Choose customer, staff or business support to send a new message.')}</p>
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="card support-empty-card">
                  <h2>{t('support.messages.emptyTitle', 'No support conversations yet')}</h2>
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    {t('support.messages.emptyBody', 'When you send a support request, replies from Mirëbook support will appear here.')}
                  </p>
                  <Link href="/support" className="btn btn-accent" style={{ marginTop: '1rem' }}>
                    {t('support.messages.goToSupportHub', 'Go to support hub')}
                  </Link>
                </div>
              ) : (
                <div className="support-message-list">
                  {messages.map((message) => (
                    <Link key={message.id} href={`/support/messages/${message.id}`} className="card support-message-card">
                      <div>
                        <div className="support-message-title-row">
                          <strong>{message.subject || message.category || t('support.messages.requestFallback', 'Support request')}</strong>
                          <span className="support-pill">{statusLabel(message.status, t)}</span>
                        </div>
                        <p className="small muted" style={{ marginTop: '0.4rem' }}>
                          {message.message || t('support.messages.noPreview', 'No message preview available.')}
                        </p>
                        <p className="small muted" style={{ marginTop: '0.4rem' }}>
                          {t('support.messages.created', 'Created')} {formatDate(message.created_at, unknownDate)}
                          {message.updated_at && message.updated_at !== message.created_at
                            ? ` · ${t('support.messages.updated', 'Updated')} ${formatDate(message.updated_at, unknownDate)}`
                            : ''}
                        </p>
                      </div>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .support-messages-shell {
          max-width: 1040px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .support-messages-header,
        .support-message-card,
        .support-message-title-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .support-messages-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .support-message-list {
          display: grid;
          gap: 0.85rem;
        }

        .support-message-card {
          color: var(--text);
          transition: border-color 0.2s, transform 0.2s;
        }

        .support-message-card:hover {
          border-color: rgba(255,107,53,0.35);
          transform: translateY(-1px);
        }

        .support-pill {
          border-radius: 999px;
          padding: 0.15rem 0.55rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.75rem;
          white-space: nowrap;
        }

        .support-empty-card,
        .support-help-card {
          border-color: rgba(45,212,191,0.24);
          background: rgba(45,212,191,0.06);
        }

        @media (max-width: 640px) {
          .support-messages-header,
          .support-message-card {
            display: grid;
          }

          .support-messages-actions,
          .support-messages-actions :global(.btn),
          .support-messages-actions button,
          .support-messages-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}
