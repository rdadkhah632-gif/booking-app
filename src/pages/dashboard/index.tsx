import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

export default function DashboardHome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'business') {
        router.replace('/explore')
        return
      }

      setLoading(false)
    }

    checkUser()
  }, [])

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <p className="muted">Checking your account...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Start from your Business Profile, then manage services, working hours and bookings for the selected business."
    >
      <div className="grid-2">
        <Link href="/dashboard/businesses" className="card">
          <h3>Manage business</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Choose a business, publish it, and access its management tools.
          </p>
          <span className="btn btn-accent">Open business profile</span>
        </Link>

        <Link href="/dashboard/businesses" className="card">
          <h3>Services</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Go to Business Profile first, then choose which business services to edit.
          </p>
          <span className="btn btn-ghost">Choose business</span>
        </Link>

        <Link href="/dashboard/businesses" className="card">
          <h3>Working hours</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Select a business and set its weekly opening hours.
          </p>
          <span className="btn btn-ghost">Choose business</span>
        </Link>

        <Link href="/dashboard/businesses" className="card">
          <h3>Bookings</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Select a business and view customer appointments.
          </p>
          <span className="btn btn-ghost">Choose business</span>
        </Link>
      </div>
    </DashboardLayout>
  )
}