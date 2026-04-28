import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Role = 'customer' | 'business' | null

export default function AuthNav() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setRole(null)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'business') {
        setRole('business')
      } else {
        setRole('customer')
      }

      setLoading(false)
    }

    loadUser()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setRole(null)
    router.push('/')
  }

  const logoHref =
    role === 'business'
      ? '/dashboard'
      : role === 'customer'
        ? '/explore'
        : '/'

  return (
    <nav className="nav-simple">
      <div className="nav-simple-inner">
        <Link href={logoHref} className="logo">
          Slot<span>ly</span>
        </Link>

        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {loading && (
            <span className="muted small">Checking account...</span>
          )}

          {!loading && !role && (
            <>
              <Link href="/explore" className="muted">
                Browse
              </Link>

              <Link href="/login" className="muted">
                Login
              </Link>

              <Link href="/register" className="btn btn-accent">
                Join
              </Link>
            </>
          )}

          {!loading && role === 'customer' && (
            <>
              <Link href="/explore" className="muted">
                Browse
              </Link>

              <Link href="/my-bookings" className="muted">
                My bookings
              </Link>

              <Link href="/account" className="muted">
                Account
              </Link>

              <button onClick={logout} className="btn btn-ghost">
                Log out
              </button>
            </>
          )}

          {!loading && role === 'business' && (
            <>
              <Link href="/dashboard" className="muted">
                Dashboard
              </Link>

              <Link href="/explore" className="muted">
                View marketplace
              </Link>

              <Link href="/account" className="muted">
                Account
              </Link>

              <button onClick={logout} className="btn btn-ghost">
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}