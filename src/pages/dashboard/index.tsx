import { useEffect, useState } from 'react'
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
      subtitle="Overview of your business activity"
    >
      <div className="grid-2">
        <div className="card">
          <h3>Manage business</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Update business details and publish your profile.
          </p>
        </div>

        <div className="card">
          <h3>Services</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Add and manage your services, pricing and duration.
          </p>
        </div>

        <div className="card">
          <h3>Working hours</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            Set availability for each day of the week.
          </p>
        </div>

        <div className="card">
          <h3>Bookings</h3>
          <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
            View and manage customer bookings.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}