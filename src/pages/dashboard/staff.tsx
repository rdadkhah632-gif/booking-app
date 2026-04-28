import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
}

type Service = {
  id: string
  name: string
  active: boolean
}

type StaffMember = {
  id: string
  business_id: string
  name: string
  role_title?: string | null
  email?: string | null
  phone?: string | null
  active: boolean
}

type StaffService = {
  staff_member_id: string
  service_id: string
}

export default function StaffPage() {
  const router = useRouter()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)

  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])

  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', sessionUserId)
      .order('created_at', { ascending: false })

    if (businessesError) throw businessesError

    const owned = ownedBusinesses || []
    setBusinesses(owned)

    if (owned.length === 0) return null

    if (businessId && !Array.isArray(businessId)) {
      const selected = owned.find((b) => b.id === businessId)

      if (!selected) {
        throw new Error('You do not have access to this business.')
      }

      return selected
    }

    if (owned.length === 1) return owned[0]

    return null
  }

  async function loadPage() {
    setPageLoading(true)
    setError(null)

    try {
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

      const selectedBusiness = await getBusinessContext(session.user.id)

      if (!selectedBusiness) {
        setBusiness(null)
        setStaff([])
        setServices([])
        setStaffServices([])
        setPageLoading(false)
        return
      }

      setBusiness(selectedBusiness)

      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, name, active')
        .eq('business_id', selectedBusiness.id)
        .order('created_at', { ascending: false })

      if (serviceError) throw serviceError

      setServices(serviceData || [])

      const { data: staffData, error: staffError } = await supabase
        .from('staff_members')
        .select('*')
        .eq('business_id', selectedBusiness.id)
        .order('created_at', { ascending: false })

      if (staffError) throw staffError

      setStaff(staffData || [])

      const staffIds = (staffData || []).map((s) => s.id)

      if (staffIds.length > 0) {
        const { data: linkData, error: linkError } = await supabase
          .from('staff_services')
          .select('staff_member_id, service_id')
          .in('staff_member_id', staffIds)

        if (linkError) throw linkError

        setStaffServices(linkData || [])
      } else {
        setStaffServices([])
      }

      setPageLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load staff.')
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, businessId])

  async function addStaff(e: React.FormEvent) {
    e.preventDefault()

    if (!business) return

    if (!name.trim()) {
      setError('Staff name is required.')
      return
    }

    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('staff_members')
      .insert({
        business_id: business.id,
        name: name.trim(),
        role_title: roleTitle.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        active: true
      })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setRoleTitle('')
    setEmail('')
    setPhone('')

    await loadPage()
  }

  async function toggleStaffActive(member: StaffMember) {
    const { error } = await supabase
      .from('staff_members')
      .update({ active: !member.active })
      .eq('id', member.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadPage()
  }

  function staffCanDoService(staffId: string, serviceId: string) {
    return staffServices.some(
      (link) => link.staff_member_id === staffId && link.service_id === serviceId
    )
  }

  async function toggleStaffService(staffId: string, serviceId: string) {
    const exists = staffCanDoService(staffId, serviceId)

    if (exists) {
      const { error } = await supabase
        .from('staff_services')
        .delete()
        .eq('staff_member_id', staffId)
        .eq('service_id', serviceId)

      if (error) {
        setError(error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('staff_services')
        .insert({
          staff_member_id: staffId,
          service_id: serviceId
        })

      if (error) {
        setError(error.message)
        return
      }
    }

    await loadPage()
  }

  return (
    <DashboardLayout
      title="Staff"
      subtitle={business ? `Manage staff for ${business.name}` : 'Choose which business staff to manage.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading staff...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>No business found</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Create a business profile first, then add staff.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Create business
          </Link>
        </div>
      )}

      {!pageLoading && !business && businesses.length > 1 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="card">
            <h3>Choose a business</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Select which business you want to manage staff for.
            </p>
          </div>

          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/staff?businessId=${b.id}`}
              className="card"
            >
              <strong>{b.name}</strong>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                Manage staff for this business.
              </p>
            </Link>
          ))}
        </div>
      )}

      {!pageLoading && business && (
        <>
          <form onSubmit={addStaff} className="card" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <h3>Add staff member</h3>

            <input
              placeholder="Staff name e.g. Ali, Sara, Reza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              placeholder="Role/title e.g. Senior barber"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />

            <input
              type="email"
              placeholder="Email optional"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              placeholder="Phone optional"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <button type="submit" disabled={saving} className="btn btn-accent">
              {saving ? 'Adding...' : 'Add staff'}
            </button>
          </form>

          {services.length === 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3>No services yet</h3>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Add services first, then assign staff to those services.
              </p>
              <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-accent" style={{ marginTop: '1rem' }}>
                Add services
              </Link>
            </div>
          )}

          <div style={{ display: 'grid', gap: '1rem' }}>
            {staff.length === 0 && (
              <div className="card">
                <h3>No staff yet</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Add your first staff member above. Later, staff will be able to have their own login and availability.
                </p>
              </div>
            )}

            {staff.map((member) => (
              <div key={member.id} className="card" style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3>{member.name}</h3>
                    <p className="small muted">{member.role_title || 'Staff member'}</p>
                    {member.email && <p className="small muted">{member.email}</p>}
                    {member.phone && <p className="small muted">{member.phone}</p>}
                    <p
                      className="small"
                      style={{ color: member.active ? 'var(--success)' : 'var(--warning)', marginTop: '0.35rem' }}
                    >
                      {member.active ? 'Active' : 'Hidden'}
                    </p>
                  </div>

                  <button onClick={() => toggleStaffActive(member)} className="btn btn-ghost">
                    {member.active ? 'Hide staff' : 'Show staff'}
                  </button>
                </div>

                <div>
                  <p className="small muted" style={{ marginBottom: '0.5rem' }}>
                    Services this staff member can perform
                  </p>

                  {services.length === 0 && (
                    <p className="small muted">No services to assign yet.</p>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleStaffService(member.id, service.id)}
                        className={staffCanDoService(member.id, service.id) ? 'btn btn-accent' : 'btn btn-ghost'}
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}