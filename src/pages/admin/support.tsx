import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'
import { requestTransactionalEmail } from '@/lib/email/client'

type SupportMessage = {
  id: string
  user_id?: string | null
  business_id?: string | null
  name?: string | null
  email?: string | null
  account_type?: string | null
  category?: string | null
  subject?: string | null
  message?: string | null
  status?: string | null
  priority?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type SupportReply = {
  id: string
  support_message_id: string
  sender_id?: string | null
  sender_role?: string | null
  message: string
  created_at?: string | null
}

type BusinessContext = {
  id: string
  name: string
}

function statusLabel(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string
) {
  if (!status || status === 'new' || status === 'pending') {
    return t('support.status.open', 'Open')
  }
  if (status === 'in_progress' || status === 'in_review') {
    return t('support.status.inProgress', 'In progress')
  }
  if (status === 'waiting' || status === 'waiting_for_user') {
    return t('support.status.waitingForUser', 'Waiting for user')
  }
  if (status === 'resolved' || status === 'closed') {
    return t('support.status.resolved', 'Resolved')
  }
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function priorityLabel(
  priority: string | null | undefined,
  t: (key: string, fallback?: string) => string
) {
  if (!priority || priority === 'normal') return t('support.priority.normal', 'Normal')
  if (priority === 'low') return t('support.priority.low', 'Low')
  if (priority === 'high') return t('support.priority.high', 'High')
  if (priority === 'urgent') return t('support.priority.urgent', 'Urgent')
  return priority.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function statusControlValue(status?: string | null) {
  if (!status || ['new', 'pending'].includes(status)) return 'open'
  if (status === 'in_progress') return 'in_review'
  if (status === 'waiting') return 'waiting_for_user'
  if (status === 'closed') return 'resolved'
  return status
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  return new Date(value).toLocaleString()
}

export default function AdminSupportPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [replies, setReplies] = useState<SupportReply[]>([])
  const [businessesById, setBusinessesById] = useState<Record<string, BusinessContext>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'progress' | 'resolved' | 'all'>('open')
  const [replyBody, setReplyBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [adminUserId, setAdminUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    loadSupport()
  }, [router.isReady])

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      await router.replace('/login?redirectTo=/admin/support')
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .eq('id', session.user.id)
      .single()

    if (profileError) throw profileError

    if (!profile?.is_admin) {
      await router.replace('/support')
      return null
    }

    return session.user
  }

  async function loadSupport() {
    setLoading(true)
    setError(null)

    try {
      const user = await checkAdmin()
      if (!user) {
        setLoading(false)
        return
      }
      setAdminUserId(user.id)

      const { data: messageData, error: messageError } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

      if (messageError) throw messageError

      const loadedMessages = (messageData || []) as SupportMessage[]
      setMessages(loadedMessages)

      const requestedTicketId =
        typeof router.query.ticketId === 'string' ? router.query.ticketId : null
      const requestedTicket = requestedTicketId
        ? loadedMessages.find((message) => message.id === requestedTicketId)
        : null

      if (requestedTicket) {
        setSelectedId(requestedTicket.id)
        setFilter('all')
      } else if (!selectedId && loadedMessages.length > 0) {
        setSelectedId(loadedMessages[0].id)
      }

      const ids = loadedMessages.map((message) => message.id)
      const businessIds = Array.from(
        new Set(
          loadedMessages
            .map((message) => message.business_id)
            .filter((businessId): businessId is string => Boolean(businessId))
        )
      )

      if (businessIds.length > 0) {
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('id, name')
          .in('id', businessIds)

        if (businessError) throw businessError

        setBusinessesById(
          ((businessData || []) as BusinessContext[]).reduce(
            (map: Record<string, BusinessContext>, business) => {
              map[business.id] = business
              return map
            },
            {}
          )
        )
      } else {
        setBusinessesById({})
      }

      if (ids.length > 0) {
        const { data: replyData, error: replyError } = await supabase
          .from('support_replies')
          .select('*')
          .in('support_message_id', ids)
          .order('created_at', { ascending: true })

        if (!replyError) {
          setReplies((replyData || []) as SupportReply[])
        }
      } else {
        setReplies([])
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || t('admin.support.error.load', 'Could not load support inbox.'))
      setLoading(false)
    }
  }

  const filteredMessages = useMemo(() => {
    if (filter === 'all') return messages

    return messages.filter((message) => {
      const status = message.status || 'open'
      if (filter === 'open') return status === 'open' || status === 'new' || status === 'pending'
      if (filter === 'progress') {
        return ['in_progress', 'in_review', 'waiting', 'waiting_for_user'].includes(status)
      }
      if (filter === 'resolved') return status === 'resolved' || status === 'closed'
      return true
    })
  }, [filter, messages])

  const selectedMessage = useMemo(() => {
    return (
      filteredMessages.find((message) => message.id === selectedId) ||
      filteredMessages[0] ||
      null
    )
  }, [selectedId, filteredMessages])

  const selectedReplies = useMemo(() => {
    if (!selectedMessage) return []
    return replies.filter((reply) => reply.support_message_id === selectedMessage.id)
  }, [replies, selectedMessage])

  const counts = useMemo(() => {
    return {
      open: messages.filter((message) => ['open', 'new', 'pending', undefined, null].includes(message.status as any)).length,
      progress: messages.filter((message) =>
        ['in_progress', 'in_review', 'waiting', 'waiting_for_user'].includes(
          String(message.status || '')
        )
      ).length,
      resolved: messages.filter((message) => ['resolved', 'closed'].includes(String(message.status || ''))).length,
      all: messages.length
    }
  }, [messages])


  async function notifyUser(message: SupportMessage, title: string, body: string, type = 'support_notice') {
    if (!message.user_id) return

    await supabase
      .from('notifications')
      .insert({
        user_id: message.user_id,
        business_id: message.business_id || null,
        title,
        body,
        type,
        action_url: `/support/messages/${message.id}`
      })
  }

  async function updateSelectedTicket(updates: Partial<SupportMessage>) {
    if (!selectedMessage) return
    await updateTicket(selectedMessage.id, updates, selectedMessage)
  }

  async function updateTicket(id: string, updates: Partial<SupportMessage>, ticket?: SupportMessage | null) {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await supabase
      .from('support_messages')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      setSaving(false)
      setError(updateError.message)
      return
    }

    if (ticket && updates.status === 'resolved') {
      await notifyUser(
        ticket,
        t('admin.support.notification.resolvedTitle', 'Support ticket resolved'),
        t(
          'admin.support.notification.resolvedBody',
          'Mirëbook support has marked your support conversation as resolved.'
        ),
        'support_resolved'
      )
    }

    setSaving(false)
    setSuccess(
      updates.status === 'resolved'
        ? t('admin.support.success.resolved', 'Support ticket marked as resolved.')
        : t('admin.support.success.updated', 'Support ticket updated.')
    )
    await loadSupport()
  }

  async function sendReply() {
    if (!selectedMessage || !replyBody.trim()) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const replyText = replyBody.trim()

    const { error: replyError } = await supabase
      .from('support_replies')
      .insert({
        support_message_id: selectedMessage.id,
        sender_id: adminUserId,
        sender_role: 'admin',
        message: replyText
      })

    if (replyError) {
      setSaving(false)
      setError(replyError.message)
      return
    }

    await supabase
      .from('support_messages')
      .update({ status: 'waiting_for_user' })
      .eq('id', selectedMessage.id)

    await notifyUser(
      selectedMessage,
      t('admin.support.notification.replyTitle', 'Mirëbook support replied'),
      replyText.length > 120 ? `${replyText.slice(0, 117)}...` : replyText,
      'support_reply'
    )
    void requestTransactionalEmail({
      event: 'support_replied',
      supportMessageId: selectedMessage.id
    })

    setReplyBody('')
    setSaving(false)
    setSuccess(t('admin.support.success.replySent', 'Reply sent.'))
    await loadSupport()
  }

  if (loading) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
          <div className="card">
            <p className="muted">
              {t('admin.support.loading', 'Loading support inbox...')}
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="admin-support-shell">
          <div className="admin-support-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>
                {t('admin.support.kicker', 'Mirëbook operator')}
              </p>
              <h1 className="page-title">
                {t('admin.support.title', 'Support inbox')}
              </h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                {t(
                  'admin.support.subtitle',
                  'Review customer, staff and business support messages, reply from the operator workspace and resolve completed conversations.'
                )}
              </p>
            </div>

            <div className="admin-support-actions">
              <Link href="/admin" className="btn btn-ghost">
                {t('admin.support.dashboard', 'Admin dashboard')}
              </Link>
              <Link href="/admin/users" className="btn btn-ghost">
                {t('nav.users', 'Users')}
              </Link>
              <button type="button" className="btn btn-accent" onClick={loadSupport}>
                {t('common.refresh', 'Refresh')}
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
            <button type="button" className={filter === 'open' ? 'card support-filter active' : 'card support-filter'} onClick={() => setFilter('open')}>
              <p className="small muted">{t('support.status.open', 'Open')}</p>
              <h2>{counts.open}</h2>
            </button>
            <button type="button" className={filter === 'progress' ? 'card support-filter active' : 'card support-filter'} onClick={() => setFilter('progress')}>
              <p className="small muted">
                {t('support.status.inProgress', 'In progress')}
              </p>
              <h2>{counts.progress}</h2>
            </button>
            <button type="button" className={filter === 'resolved' ? 'card support-filter active' : 'card support-filter'} onClick={() => setFilter('resolved')}>
              <p className="small muted">
                {t('support.status.resolved', 'Resolved')}
              </p>
              <h2>{counts.resolved}</h2>
            </button>
            <button type="button" className={filter === 'all' ? 'card support-filter active' : 'card support-filter'} onClick={() => setFilter('all')}>
              <p className="small muted">
                {t('admin.support.filters.all', 'All tickets')}
              </p>
              <h2>{counts.all}</h2>
            </button>
          </div>

          <div className="admin-support-grid">
            <div className="card support-list-card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">
                    {t('admin.support.inbox', 'Inbox')}
                  </p>
                  <h2>
                    {filter === 'all'
                      ? t('admin.support.filters.all', 'All tickets')
                      : `${statusLabel(filter, t)} ${t('admin.support.tickets', 'tickets')}`}
                  </h2>
                </div>
              </div>

              {filteredMessages.length === 0 ? (
                <div className="support-empty">
                  <h3>
                    {t('admin.support.empty.title', 'No support tickets found')}
                  </h3>
                  <p className="muted" style={{ marginTop: '0.4rem' }}>
                    {t(
                      'admin.support.empty.body',
                      'New customer, staff and business messages will appear here.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="support-ticket-list">
                  {filteredMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      className={selectedMessage?.id === message.id ? 'support-ticket-card selected' : 'support-ticket-card'}
                      onClick={() => setSelectedId(message.id)}
                    >
                      <div className="support-ticket-title-row">
                        <strong>
                          {message.subject ||
                            message.category ||
                            t('support.messages.requestFallback', 'Support request')}
                        </strong>
                        <span className="support-pill">
                          {statusLabel(message.status, t)}
                        </span>
                      </div>

                      <p className="small muted" style={{ marginTop: '0.3rem' }}>
                        {[message.account_type, message.name || message.email]
                          .filter(Boolean)
                          .join(' · ') ||
                          t('admin.support.unknownUser', 'Unknown user')}
                      </p>

                      <p className="small muted" style={{ marginTop: '0.3rem' }}>
                        {formatDate(
                          message.updated_at || message.created_at,
                          t('support.messages.unknownDate', 'Unknown date')
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card support-detail-card">
              {!selectedMessage ? (
                <div className="support-empty">
                  <h3>{t('admin.support.select.title', 'Select a ticket')}</h3>
                  <p className="muted" style={{ marginTop: '0.4rem' }}>
                    {t(
                      'admin.support.select.body',
                      'Choose a support request from the inbox to view details and reply.'
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="support-detail-header">
                    <div>
                      <p className="small muted">
                        {messageContext(selectedMessage, t)}
                      </p>
                      <h2>
                        {selectedMessage.subject ||
                          selectedMessage.category ||
                          t('support.messages.requestFallback', 'Support request')}
                      </h2>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        {selectedMessage.name ||
                          t('admin.support.unknownName', 'Unknown name')}{' '}
                        ·{' '}
                        {selectedMessage.email ||
                          t('admin.support.noEmail', 'No email')}{' '}
                        ·{' '}
                        {formatDate(
                          selectedMessage.created_at,
                          t('support.messages.unknownDate', 'Unknown date')
                        )}
                      </p>
                      <p className="small" style={{ color: 'var(--accent)', marginTop: '0.35rem' }}>
                        {t(
                          'admin.support.replyGuidance',
                          'User replies reopen this ticket. Operator replies notify the requester automatically.'
                        )}
                      </p>
                    </div>

                    <div className="support-ticket-controls">
                      <select
                        value={statusControlValue(selectedMessage.status)}
                        onChange={(e) => updateTicket(selectedMessage.id, { status: e.target.value }, selectedMessage)}
                        disabled={saving}
                      >
                        <option value="open">{t('support.status.open', 'Open')}</option>
                        <option value="in_review">
                          {t('support.status.inProgress', 'In progress')}
                        </option>
                        <option value="waiting_for_user">
                          {t('support.status.waitingForUser', 'Waiting for user')}
                        </option>
                        <option value="resolved">
                          {t('support.status.resolved', 'Resolved')}
                        </option>
                      </select>

                      <select
                        value={selectedMessage.priority || 'normal'}
                        onChange={(e) => updateTicket(selectedMessage.id, { priority: e.target.value }, selectedMessage)}
                        disabled={saving}
                      >
                        <option value="low">{t('support.priority.low', 'Low')}</option>
                        <option value="normal">
                          {t('support.priority.normal', 'Normal')}
                        </option>
                        <option value="high">
                          {t('support.priority.high', 'High')}
                        </option>
                        <option value="urgent">
                          {t('support.priority.urgent', 'Urgent')}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="support-meta-grid">
                    <div>
                      <p className="small muted">
                        {t('admin.support.accountType', 'Account type')}
                      </p>
                      <strong>
                        {selectedMessage.account_type ||
                          t('admin.support.unknown', 'Unknown')}
                      </strong>
                    </div>
                    <div>
                      <p className="small muted">
                        {t('support.thread.status', 'Status')}
                      </p>
                      <strong>{statusLabel(selectedMessage.status, t)}</strong>
                    </div>
                    <div>
                      <p className="small muted">
                        {t('support.thread.priority', 'Priority')}
                      </p>
                      <strong>{priorityLabel(selectedMessage.priority, t)}</strong>
                    </div>
                    <div>
                      <p className="small muted">
                        {t('admin.support.replyStatus', 'Reply status')}
                      </p>
                      <strong>
                        {selectedMessage.status === 'waiting_for_user'
                          ? t('support.status.waitingForUser', 'Waiting for user')
                          : selectedReplies.length > 0
                            ? t('admin.support.replied', 'Replied')
                            : t('admin.support.notReplied', 'Not replied')}
                      </strong>
                    </div>
                    <div>
                      <p className="small muted">
                        {t('support.messages.created', 'Created')}
                      </p>
                      <strong>
                        {formatDate(
                          selectedMessage.created_at,
                          t('support.messages.unknownDate', 'Unknown date')
                        )}
                      </strong>
                    </div>
                    <div>
                      <p className="small muted">
                        {t('admin.support.lastUpdated', 'Last updated')}
                      </p>
                      <strong>
                        {formatDate(
                          selectedMessage.updated_at || selectedMessage.created_at,
                          t('support.messages.unknownDate', 'Unknown date')
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="support-context-actions">
                    {selectedMessage.user_id && (
                      <Link
                        href={`/admin/users?userId=${selectedMessage.user_id}`}
                        className="btn btn-ghost"
                      >
                        {t('admin.support.openRequester', 'Open requester account')}
                      </Link>
                    )}
                    {selectedMessage.business_id && (
                      <Link
                        href={`/admin/businesses?businessId=${selectedMessage.business_id}`}
                        className="btn btn-ghost"
                      >
                        {businessesById[selectedMessage.business_id]?.name ||
                          t('admin.support.openBusiness', 'Open linked business')}
                      </Link>
                    )}
                  </div>

                  <div className="support-thread">
                    <div className="support-thread-message user">
                      <p className="small muted">
                        {t('admin.support.userMessage', 'Requester message')}
                      </p>
                      <p>
                        {selectedMessage.message ||
                          t(
                            'support.thread.noMessageBody',
                            'No message body provided.'
                          )}
                      </p>
                    </div>

                    {selectedReplies.map((reply) => (
                      <div key={reply.id} className={reply.sender_role === 'admin' ? 'support-thread-message admin' : 'support-thread-message user'}>
                        <p className="small muted">
                          {reply.sender_role === 'admin'
                            ? t('admin.support.operatorReply', 'Operator reply')
                            : t('admin.support.userReply', 'User reply')}{' '}
                          ·{' '}
                          {formatDate(
                            reply.created_at,
                            t('support.messages.unknownDate', 'Unknown date')
                          )}
                        </p>
                        <p>{reply.message}</p>
                      </div>
                    ))}
                  </div>

                  <div className="support-reply-box">
                    <p className="small muted">
                      {t('admin.support.replyAs', 'Reply as Mirëbook support')}
                    </p>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={5}
                      placeholder={t(
                        'admin.support.replyPlaceholder',
                        'Type your reply...'
                      )}
                    />
                    <div className="support-reply-actions">
                      <button type="button" className="btn btn-accent" onClick={sendReply} disabled={saving || !replyBody.trim()}>
                        {saving
                          ? t('support.thread.sending', 'Sending...')
                          : t('support.thread.sendReply', 'Send reply')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => updateSelectedTicket({ status: 'resolved' })} disabled={saving}>
                        {t('admin.support.markResolved', 'Mark resolved')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .admin-support-shell {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .admin-support-header,
        .admin-section-header,
        .support-detail-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .admin-support-actions,
        .support-reply-actions,
        .support-ticket-controls {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .support-filter {
          text-align: left;
          cursor: pointer;
          color: var(--text);
          border-color: var(--border);
        }

        .support-filter.active {
          border-color: rgba(255,107,53,0.45);
          background: rgba(255,107,53,0.08);
        }

        .admin-support-grid {
          display: grid;
          grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.35fr);
          gap: 1rem;
          align-items: start;
        }

        .support-ticket-list,
        .support-thread {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .support-ticket-card {
          width: 100%;
          text-align: left;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          padding: 0.95rem;
          cursor: pointer;
        }

        .support-ticket-card.selected {
          border-color: rgba(255,107,53,0.5);
          background: rgba(255,107,53,0.08);
        }

        .support-ticket-title-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
        }

        .support-pill {
          border-radius: 999px;
          padding: 0.15rem 0.5rem;
          font-size: 0.74rem;
          background: var(--surface);
          color: var(--text-muted);
          border: 1px solid var(--border);
        }

        .support-empty {
          padding: 1rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          margin-top: 1rem;
        }

        .support-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin: 1rem 0;
        }

        .support-meta-grid div {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
        }

        .support-context-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .support-thread-message {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
          background: var(--surface-2);
        }

        .support-thread-message.admin {
          border-color: rgba(45,212,191,0.28);
          background: rgba(45,212,191,0.06);
        }

        .support-thread-message.user {
          border-color: rgba(255,107,53,0.22);
        }

        .support-reply-box {
          margin-top: 1rem;
          display: grid;
          gap: 0.75rem;
          border-top: 1px solid var(--border);
          padding-top: 1rem;
        }

        .support-reply-box textarea,
        .support-ticket-controls select {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-2);
          color: var(--text);
          padding: 0.85rem;
        }

        @media (max-width: 920px) {
          .admin-support-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .admin-support-header,
          .support-detail-header {
            display: grid;
          }

          .admin-support-actions,
          .admin-support-actions :global(.btn),
          .admin-support-actions button,
          .support-reply-actions,
          .support-reply-actions button,
          .support-ticket-controls,
          .support-ticket-controls select,
          .support-context-actions,
          .support-context-actions :global(.btn),
          .support-context-actions a {
            width: 100%;
            justify-content: center;
          }

          .support-meta-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

function messageContext(
  message: SupportMessage,
  t: (key: string, fallback?: string) => string
) {
  return (
    [message.account_type, message.category].filter(Boolean).join(' · ') ||
    t('admin.support.ticketFallback', 'Support ticket')
  )
}
