import AuthNav from '@/components/AuthNav'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Notification = {
  id: string
  title: string | null
  message: string | null
  type: string | null
  action_url: string | null
  read_at: string | null
  created_at: string
}

export default function StaffNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = '/login'
      return
    }

    const { data: linkedStaff } = await supabase
      .from('staff_members')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    if (!linkedStaff) {
      window.location.href = '/my-bookings'
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, action_url, read_at, created_at')
      .eq('user_id', session.user.id)
      .in('audience', ['staff', 'general'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setNotifications(data || [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    await loadNotifications()
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((item) => !item.read_at).map((item) => item.id)

    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)

    await loadNotifications()
  }

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.read_at).length
  }, [notifications])

  return (
    <main>
      <AuthNav />

      <section className="page-shell">
        <div className="page-header-row" style={{ marginBottom: '1.5rem' }}>
          <div>
            <p className="small muted">Staff notifications</p>
            <h1 className="page-title">Updates</h1>
            <p className="page-sub" style={{ marginTop: '0.5rem' }}>
              Staff-only updates for your schedule, profile and assigned bookings.
            </p>
          </div>

          <div className="page-header-actions">
            <Link href="/staff" className="btn btn-ghost">
              My schedule
            </Link>

            <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="btn btn-accent">
              {unreadCount > 0 ? `Mark ${unreadCount} read` : 'All read'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="card">
            <p className="muted">Loading staff notifications...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="card">
            <h3>No staff notifications yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Booking updates, schedule changes and staff account messages will appear here.
            </p>
          </div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <div className="staff-notification-list">
            {notifications.map((item) => (
              <div key={item.id} className="card staff-notification-card">
                <div>
                  <div className="staff-notification-title-row">
                    <strong>{item.title || 'Staff update'}</strong>
                    {!item.read_at && <span className="badge badge-accent">New</span>}
                  </div>

                  <p className="muted" style={{ marginTop: '0.4rem' }}>
                    {item.message || 'You have a new staff update.'}
                  </p>

                  <p className="small muted" style={{ marginTop: '0.55rem' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="staff-notification-actions">
                  {item.action_url && item.action_url.startsWith('/staff') && (
                    <Link href={item.action_url} className="btn btn-ghost">
                      Open
                    </Link>
                  )}

                  {!item.read_at && (
                    <button type="button" onClick={() => markRead(item.id)} className="btn btn-ghost">
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .staff-notification-list {
          display: grid;
          gap: 1rem;
        }

        .staff-notification-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .staff-notification-title-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-notification-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 700px) {
          .staff-notification-card {
            display: grid;
          }

          .staff-notification-actions {
            justify-content: stretch;
          }

          .staff-notification-actions :global(.btn),
          .staff-notification-actions button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}