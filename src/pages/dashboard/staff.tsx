import { useEffect, useMemo, useState } from 'react'
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

type StaffAvailability = {
  id: string
  staff_member_id: string
  day_of_week: number
  is_closed: boolean
}

export default function StaffPage() {
  const router = useRouter()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)

  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([])

  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
        setStaffAvailability([])
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

        const { data: availabilityData, error: availabilityError } = await supabase
          .from('staff_availability')
          .select('id, staff_member_id, day_of_week, is_closed')
          .in('staff_member_id', staffIds)

        if (availabilityError) throw availabilityError

        setStaffAvailability(availabilityData || [])
      } else {
        setStaffServices([])
        setStaffAvailability([])
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

  const staffStats = useMemo(() => {
    const activeStaff = staff.filter((member) => member.active).length
    const inactiveStaff = staff.length - activeStaff
    const staffWithServices = staff.filter((member) => assignedServicesForStaff(member.id).length > 0).length
    const staffWithoutServices = staff.length - staffWithServices
    const staffWithHours = staff.filter((member) => openDaysForStaff(member.id) > 0).length
    const staffWithoutHours = staff.length - staffWithHours

    return {
      total: staff.length,
      activeStaff,
      inactiveStaff,
      staffWithServices,
      staffWithoutServices,
      staffWithHours,
      staffWithoutHours
    }
  }, [staff, staffServices, staffAvailability])

  async function addStaff(e: React.FormEvent) {
    e.preventDefault()

    if (!business) return

    if (!name.trim()) {
      setError('Staff name is required.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

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
    setSuccess('Staff member added. Assign services and set their working hours so customers can book with them.')

    await loadPage()
  }

  function updateLocalStaff(id: string, field: keyof StaffMember, value: string | boolean) {
    setStaff((prev) =>
      prev.map((member) =>
        member.id === id ? { ...member, [field]: value } : member
      )
    )
  }

  async function saveStaff(member: StaffMember) {
    if (!member.name.trim()) {
      setError('Staff name is required.')
      return
    }

    setSavingStaffId(member.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('staff_members')
      .update({
        name: member.name.trim(),
        role_title: member.role_title?.trim() || null,
        email: member.email?.trim() || null,
        phone: member.phone?.trim() || null,
        active: member.active
      })
      .eq('id', member.id)

    setSavingStaffId(null)

    if (error) {
      setError(error.message)
      return
    }

    setEditingStaffId(null)
    setSuccess(`${member.name} saved.`)
    await loadPage()
  }

  async function toggleStaffActive(member: StaffMember) {
    setActionLoadingKey(`staff-${member.id}`)
    setError(null)
    setSuccess(null)

    const assignedServices = assignedServicesForStaff(member.id)
    const openDays = openDaysForStaff(member.id)

    if (!member.active && (assignedServices.length === 0 || openDays === 0)) {
      const confirmed = confirm('This staff member is missing assigned services or working hours. Customers may not be able to book with them properly. Show them anyway?')
      if (!confirmed) {
        setActionLoadingKey(null)
        return
      }
    }

    const { error } = await supabase
      .from('staff_members')
      .update({ active: !member.active })
      .eq('id', member.id)

    setActionLoadingKey(null)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(!member.active ? `${member.name} is now active for booking.` : `${member.name} is hidden from booking.`)
    await loadPage()
  }

  function staffCanDoService(staffId: string, serviceId: string) {
    return staffServices.some(
      (link) => link.staff_member_id === staffId && link.service_id === serviceId
    )
  }

  function assignedServicesForStaff(staffId: string) {
    return services.filter((service) => staffCanDoService(staffId, service.id))
  }

  function openDaysForStaff(staffId: string) {
    return staffAvailability.filter((row) => row.staff_member_id === staffId && row.is_closed !== true).length
  }

  async function toggleStaffService(staffId: string, serviceId: string) {
    const exists = staffCanDoService(staffId, serviceId)

    setActionLoadingKey(`service-${staffId}-${serviceId}`)
    setError(null)
    setSuccess(null)

    if (exists) {
      const { error } = await supabase
        .from('staff_services')
        .delete()
        .eq('staff_member_id', staffId)
        .eq('service_id', serviceId)

      setActionLoadingKey(null)

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

      setActionLoadingKey(null)

      if (error) {
        setError(error.message)
        return
      }
    }

    setSuccess(exists ? 'Service removed from staff member.' : 'Service assigned to staff member.')
    await loadPage()
  }

  function readinessBadge(member: StaffMember) {
    const assignedServices = assignedServicesForStaff(member.id)
    const openDays = openDaysForStaff(member.id)
    const ready = member.active && assignedServices.length > 0 && openDays > 0

    return (
      <span
        className="small"
        style={{
          background: ready ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
          color: ready ? 'var(--success)' : 'var(--warning)',
          padding: '0.2rem 0.55rem',
          borderRadius: 999
        }}
      >
        {ready ? 'Bookable' : 'Setup needed'}
      </span>
    )
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

      {success && (
        <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--success)' }}>{success}</p>
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
          <div style={{ padding: '0.25rem 0 0.5rem' }}>
            <p className="small muted" style={{ marginBottom: '0.35rem' }}>
              Multiple businesses found
            </p>
            <h3 style={{ marginBottom: '0.35rem' }}>
              Choose a business to continue
            </h3>
            <p className="muted">
              Select one of the business cards below. The next page will show the staff for that specific business.
            </p>
          </div>

          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/staff?businessId=${b.id}`}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
            >
              <div>
                <strong>{b.name}</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Manage staff for this business.
                </p>
              </div>

              <span className="btn btn-accent">
                Manage staff
              </span>
            </Link>
          ))}
        </div>
      )}

      {!pageLoading && business && (
        <>
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <p className="small muted">Staff</p>
              <h3>{staffStats.total}</h3>
              <p className="muted small">Total staff members</p>
            </div>

            <div className="card">
              <p className="small muted">Active</p>
              <h3>{staffStats.activeStaff}</h3>
              <p className="muted small">Visible for booking</p>
            </div>

            <div className="card" style={{ borderColor: staffStats.staffWithoutServices > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
              <p className="small muted">No services</p>
              <h3>{staffStats.staffWithoutServices}</h3>
              <p className="muted small">Staff without assigned services</p>
            </div>

            <div className="card" style={{ borderColor: staffStats.staffWithoutHours > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
              <p className="small muted">No hours</p>
              <h3>{staffStats.staffWithoutHours}</h3>
              <p className="muted small">Staff without working hours</p>
            </div>
          </div>

          <form onSubmit={addStaff} className="card" style={{ display: 'grid', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <div>
              <p className="small muted">Create staff</p>
              <h3>Add staff member</h3>
              <p className="muted small" style={{ marginTop: '0.35rem' }}>
                Staff are assigned to services and have their own working hours. Customers only see bookable staff with matching services and availability.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
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
            </div>

            <button type="submit" disabled={saving} className="btn btn-accent">
              {saving ? 'Adding...' : 'Add staff'}
            </button>
          </form>

          {services.length === 0 && (
            <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(255,190,11,0.35)' }}>
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
                  Add your first staff member above. Then assign services and set their working hours.
                </p>
              </div>
            )}

            {staff.map((member) => {
              const assignedServices = assignedServicesForStaff(member.id)
              const openDays = openDaysForStaff(member.id)
              const isEditing = editingStaffId === member.id

              return (
                <div
                  key={member.id}
                  className="card"
                  style={{
                    display: 'grid',
                    gap: '1rem',
                    borderColor: !member.active
                      ? 'rgba(255,190,11,0.25)'
                      : assignedServices.length === 0 || openDays === 0
                        ? 'rgba(255,190,11,0.35)'
                        : 'var(--border)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <h3>{member.name}</h3>

                        <span
                          className="small"
                          style={{
                            background: member.active ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                            color: member.active ? 'var(--success)' : 'var(--warning)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 999
                          }}
                        >
                          {member.active ? 'Active' : 'Hidden'}
                        </span>

                        {readinessBadge(member)}
                      </div>

                      {!isEditing && (
                        <>
                          <p className="small muted" style={{ marginTop: '0.35rem' }}>
                            {member.role_title || 'Staff member'}
                          </p>
                          {member.email && <p className="small muted">Email: {member.email}</p>}
                          {member.phone && <p className="small muted">Phone: {member.phone}</p>}

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                            <span className="small muted">{assignedServices.length} service{assignedServices.length === 1 ? '' : 's'} assigned</span>
                            <span className="small muted">{openDays} open day{openDays === 1 ? '' : 's'} set</span>
                          </div>

                          {(assignedServices.length === 0 || openDays === 0) && (
                            <p className="small" style={{ color: 'var(--warning)', marginTop: '0.55rem' }}>
                              This staff member will not be properly bookable until they have services assigned and working hours set.
                            </p>
                          )}
                        </>
                      )}

                      {isEditing && (
                        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                          <input
                            placeholder="Staff name"
                            value={member.name || ''}
                            onChange={(e) => updateLocalStaff(member.id, 'name', e.target.value)}
                          />

                          <input
                            placeholder="Role/title"
                            value={member.role_title || ''}
                            onChange={(e) => updateLocalStaff(member.id, 'role_title', e.target.value)}
                          />

                          <input
                            type="email"
                            placeholder="Email optional"
                            value={member.email || ''}
                            onChange={(e) => updateLocalStaff(member.id, 'email', e.target.value)}
                          />

                          <input
                            placeholder="Phone optional"
                            value={member.phone || ''}
                            onChange={(e) => updateLocalStaff(member.id, 'phone', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveStaff(member)}
                            className="btn btn-accent"
                            disabled={savingStaffId === member.id}
                          >
                            {savingStaffId === member.id ? 'Saving...' : 'Save staff'}
                          </button>

                          <button
                            onClick={() => {
                              setEditingStaffId(null)
                              loadPage()
                            }}
                            className="btn btn-ghost"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingStaffId(member.id)} className="btn btn-ghost">
                            Edit
                          </button>

                          <Link href={`/dashboard/staff-availability?staffId=${member.id}`} className="btn btn-accent">
                            Staff hours
                          </Link>

                          <button
                            onClick={() => toggleStaffActive(member)}
                            className={member.active ? 'btn btn-ghost' : 'btn btn-accent'}
                            disabled={actionLoadingKey === `staff-${member.id}`}
                          >
                            {actionLoadingKey === `staff-${member.id}`
                              ? 'Updating...'
                              : member.active
                                ? 'Hide from booking'
                                : 'Show for booking'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                      <div>
                        <p className="small muted">Services this staff member can perform</p>
                        <p className="small muted" style={{ marginTop: '0.25rem' }}>
                          Active services are what customers can select on the booking page. Orange means assigned.
                        </p>
                      </div>

                      <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-ghost">
                        Manage services
                      </Link>
                    </div>

                    {services.length === 0 && (
                      <p className="small muted">No services to assign yet.</p>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {services.map((service) => {
                        const assigned = staffCanDoService(member.id, service.id)
                        const actionKey = `service-${member.id}-${service.id}`

                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleStaffService(member.id, service.id)}
                            className={assigned ? 'btn btn-accent' : 'btn btn-ghost'}
                            disabled={actionLoadingKey === actionKey}
                            title={assigned ? 'Click to remove this service from staff member' : 'Click to assign this service to staff member'}
                          >
                            {actionLoadingKey === actionKey ? 'Updating...' : assigned ? `✓ ${service.name}` : `+ ${service.name}`}
                            {!service.active ? ' (hidden)' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}