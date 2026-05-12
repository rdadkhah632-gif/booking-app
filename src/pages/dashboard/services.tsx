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
  business_id: string
  name: string
  description?: string | null
  duration_minutes: number
  price: number
  image_url?: string | null
  active: boolean
}

type StaffService = {
  staff_member_id: string
  service_id: string
}

type StaffMember = {
  id: string
  business_id: string
  name: string
  role_title?: string | null
  active: boolean
}

export default function Services() {
  const router = useRouter()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState(0)
  const [formExpanded, setFormExpanded] = useState(true)

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
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

  async function loadData() {
    setError(null)
    setPageLoading(true)

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
        setServices([])
        setStaffMembers([])
        setStaffServices([])
        setPageLoading(false)
        return
      }

      setBusiness(selectedBusiness)

      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', selectedBusiness.id)
        .order('created_at', { ascending: false })

      if (serviceError) throw serviceError

      setServices(serviceData || [])

      const { data: staffData, error: staffError } = await supabase
        .from('staff_members')
        .select('id, business_id, name, role_title, active')
        .eq('business_id', selectedBusiness.id)
        .order('created_at', { ascending: false })

      if (staffError) throw staffError

      setStaffMembers(staffData || [])

      const staffIds = (staffData || []).map((staff) => staff.id)

      if (staffIds.length > 0) {
        const { data: staffServiceData, error: staffServiceError } = await supabase
          .from('staff_services')
          .select('staff_member_id, service_id')
          .in('staff_member_id', staffIds)

        if (staffServiceError) throw staffServiceError

        setStaffServices(staffServiceData || [])
      } else {
        setStaffServices([])
      }

      setPageLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load services.')
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadData()
  }, [router.isReady, businessId])

  const serviceStats = useMemo(() => {
    const active = services.filter((service) => service.active).length
    const inactive = services.length - active
    const assigned = services.filter((service) => staffServices.some((link) => link.service_id === service.id)).length
    const unassigned = services.length - assigned
    const averagePrice = services.length > 0
      ? services.reduce((total, service) => total + Number(service.price || 0), 0) / services.length
      : 0
    const averageDuration = services.length > 0
      ? services.reduce((total, service) => total + Number(service.duration_minutes || 0), 0) / services.length
      : 0

    return {
      total: services.length,
      active,
      inactive,
      assigned,
      unassigned,
      averagePrice,
      averageDuration
    }
  }, [services, staffServices])

  function assignedStaffForService(serviceId: string) {
    return staffMembers.filter((staff) =>
      staffServices.some((link) => link.service_id === serviceId && link.staff_member_id === staff.id)
    )
  }

  function resetForm() {
    setName('')
    setDescription('')
    setImageUrl('')
    setDuration(30)
    setPrice(0)
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault()

    if (!business) {
      setError('Choose a business first.')
      return
    }

    if (!name.trim()) {
      setError('Service name is required.')
      return
    }

    if (duration < 5) {
      setError('Service duration must be at least 5 minutes.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('services')
      .insert({
        business_id: business.id,
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        duration_minutes: duration,
        price,
        active: true
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    resetForm()
    setFormExpanded(false)
    setSuccess('Service added. Assign staff to this service so customers can book it on Mirëbook.')

    await loadData()
    setLoading(false)
  }

  function updateLocalService(id: string, field: keyof Service, value: string | number | boolean) {
    setServices((prev) =>
      prev.map((service) =>
        service.id === id ? { ...service, [field]: value } : service
      )
    )
  }

  async function saveService(service: Service) {
    if (!service.name.trim()) {
      setError('Service name is required.')
      return
    }

    if (Number(service.duration_minutes) < 5) {
      setError('Service duration must be at least 5 minutes.')
      return
    }

    setSavingServiceId(service.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('services')
      .update({
        name: service.name.trim(),
        description: service.description?.trim() || null,
        image_url: service.image_url?.trim() || null,
        duration_minutes: Number(service.duration_minutes),
        price: Number(service.price),
        active: service.active
      })
      .eq('id', service.id)

    setSavingServiceId(null)

    if (error) {
      setError(error.message)
      return
    }

    setEditingServiceId(null)
    setSuccess(`${service.name} saved.`)
    await loadData()
  }

  async function toggleService(service: Service) {
    setError(null)
    setSuccess(null)

    const assignedStaff = assignedStaffForService(service.id)

    if (!service.active && assignedStaff.length === 0) {
      const confirmed = confirm('This service has no staff assigned yet. Customers will not be able to book it properly until staff are assigned. Show it anyway?')
      if (!confirmed) return
    }

    const { error } = await supabase
      .from('services')
      .update({ active: !service.active })
      .eq('id', service.id)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(!service.active ? `${service.name} is now visible to customers.` : `${service.name} is now hidden from customers.`)
    await loadData()
  }

  function serviceBookable(service: Service) {
    return service.active && assignedStaffForService(service.id).length > 0
  }

  function statusBadge(label: string, tone: 'success' | 'warning' | 'accent' | 'muted') {
    const styles = {
      success: { background: 'rgba(45,212,191,0.12)', color: 'var(--success)' },
      warning: { background: 'rgba(255,190,11,0.12)', color: 'var(--warning)' },
      accent: { background: 'rgba(255,107,53,0.12)', color: 'var(--accent)' },
      muted: { background: 'var(--surface-2)', color: 'var(--text-muted)' }
    }

    return (
      <span
        className="small"
        style={{
          ...styles[tone],
          padding: '0.2rem 0.55rem',
          borderRadius: 999,
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <DashboardLayout
      title="Services setup"
      subtitle={business ? `Create and manage customer-facing services for ${business.name}.` : 'Choose which business services to manage.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading services...</p>
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
            Create a business profile first, then add services.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Create business
          </Link>
        </div>
      )}

      {!pageLoading && !business && businesses.length > 1 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08))' }}>
            <p className="small muted">Multiple businesses found</p>
            <h3 style={{ marginTop: '0.25rem' }}>Choose a business to continue</h3>
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              Pick the business you want to configure. Services are managed per business because prices, staff and availability can differ.
            </p>
          </div>

          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/services?businessId=${b.id}`}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
            >
              <div>
                <strong>{b.name}</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Manage services for this business.
                </p>
              </div>

              <span className="btn btn-accent">
                Manage services
              </span>
            </Link>
          ))}
        </div>
      )}

      {!pageLoading && business && (
        <>
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.07))',
              borderColor: 'rgba(255,107,53,0.22)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <p className="small" style={{ color: 'var(--accent)' }}>Setup sub-page</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Services customers can book on Mirëbook.
                </h2>
                <p className="muted" style={{ marginTop: '0.55rem' }}>
                  Add services with prices, durations, descriptions and optional images. A service becomes properly bookable once active staff are assigned to it.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/dashboard/businesses" className="btn btn-ghost">
                  Back to setup hub
                </Link>
                <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
                  Assign staff
                </Link>
                <Link href={`/explore/${business.id}`} className="btn btn-ghost">
                  Preview public page
                </Link>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <p className="small muted">Services</p>
              <h3>{serviceStats.total}</h3>
              <p className="muted small">Total services</p>
            </div>

            <div className="card" style={{ borderColor: serviceStats.active > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
              <p className="small muted">Visible</p>
              <h3>{serviceStats.active}</h3>
              <p className="muted small">Active customer-facing services</p>
            </div>

            <div className="card" style={{ borderColor: serviceStats.unassigned > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
              <p className="small muted">Unassigned</p>
              <h3>{serviceStats.unassigned}</h3>
              <p className="muted small">Services without assigned staff</p>
            </div>

            <div className="card">
              <p className="small muted">Average service</p>
              <h3>£{serviceStats.averagePrice.toFixed(2)}</h3>
              <p className="muted small">Avg. {Math.round(serviceStats.averageDuration)} minutes</p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: formExpanded ? '1rem' : 0 }}>
              <div>
                <p className="small muted">Create service</p>
                <h3 style={{ marginTop: '0.25rem' }}>Add a new service</h3>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Keep service names simple. Customers should understand what they are booking without needing to ask.
                </p>
              </div>

              <button type="button" onClick={() => setFormExpanded((prev) => !prev)} className="btn btn-ghost">
                {formExpanded ? 'Collapse form' : 'Add service'}
              </button>
            </div>

            {formExpanded && (
              <form onSubmit={addService} style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)', gap: '1rem', alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <input
                      placeholder="Service name e.g. Haircut, Dental Checkup"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                      <label className="small muted">
                        Duration
                        <input
                          type="number"
                          placeholder="Duration in minutes"
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          min={5}
                          required
                          style={{ marginTop: '0.35rem' }}
                        />
                      </label>

                      <label className="small muted">
                        Price
                        <input
                          type="number"
                          placeholder="Price"
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          min={0}
                          step="0.01"
                          required
                          style={{ marginTop: '0.35rem' }}
                        />
                      </label>
                    </div>

                    <input
                      placeholder="Service image URL optional"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />

                    <textarea
                      placeholder="Short description shown to customers optional"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="card" style={{ background: 'var(--surface-2)' }}>
                    <p className="small muted">Customer preview</p>
                    <div
                      style={{
                        minHeight: 130,
                        borderRadius: 'var(--radius)',
                        margin: '0.75rem 0',
                        border: '1px solid var(--border)',
                        background: imageUrl
                          ? `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${imageUrl})`
                          : 'linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.10))',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem'
                      }}
                    >
                      {!imageUrl && '✨'}
                    </div>

                    <h3>{name || 'Service name'}</h3>
                    <p className="small muted" style={{ marginTop: '0.35rem' }}>
                      {duration || 0} minutes · £{Number(price || 0).toFixed(2)}
                    </p>
                    <p className="small muted" style={{ marginTop: '0.45rem' }}>
                      {description || 'Add a short description to help customers understand this service.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="submit" disabled={loading} className="btn btn-accent">
                    {loading ? 'Adding...' : 'Add service'}
                  </button>

                  <button type="button" onClick={resetForm} className="btn btn-ghost">
                    Clear form
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {services.length === 0 && (
              <div className="card">
                <h3>No services yet</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Add your first service above. Then assign staff to it from the Staff page so customers can book it.
                </p>
              </div>
            )}

            {services.map((service) => {
              const assignedStaff = assignedStaffForService(service.id)
              const isEditing = editingServiceId === service.id
              const isBookable = serviceBookable(service)

              return (
                <div
                  key={service.id}
                  className="card"
                  style={{
                    borderColor: !service.active
                      ? 'rgba(255,190,11,0.25)'
                      : assignedStaff.length === 0
                        ? 'rgba(255,190,11,0.35)'
                        : 'rgba(45,212,191,0.16)',
                    overflow: 'hidden',
                    padding: 0
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: service.image_url ? '180px minmax(0, 1fr)' : '1fr', gap: 0 }}>
                    {service.image_url && (
                      <div
                        style={{
                          minHeight: 180,
                          backgroundImage: `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${service.image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRight: '1px solid var(--border)'
                        }}
                      />
                    )}

                    <div style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                            <strong>{service.name || 'Untitled service'}</strong>
                            {statusBadge(service.active ? 'Visible' : 'Hidden', service.active ? 'success' : 'warning')}
                            {statusBadge(isBookable ? 'Bookable' : 'Not bookable yet', isBookable ? 'success' : 'warning')}
                            {assignedStaff.length > 0
                              ? statusBadge(`${assignedStaff.length} staff assigned`, 'success')
                              : statusBadge('No staff assigned', 'warning')}
                          </div>

                          {!isEditing && (
                            <>
                              <p className="small muted">
                                {service.duration_minutes} minutes · £{Number(service.price).toFixed(2)}
                              </p>

                              {service.description ? (
                                <p className="small muted" style={{ marginTop: '0.45rem' }}>
                                  {service.description}
                                </p>
                              ) : (
                                <p className="small muted" style={{ marginTop: '0.45rem' }}>
                                  No description added yet.
                                </p>
                              )}

                              <div className="card" style={{ background: 'var(--surface-2)', padding: '0.85rem', marginTop: '0.85rem' }}>
                                <p className="small muted">Bookability</p>
                                <strong>{isBookable ? 'Customers can book this service' : 'Complete setup before customers can book this service'}</strong>
                                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                                  Staff: {assignedStaff.length > 0
                                    ? assignedStaff.map((staff) => `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`).join(', ')
                                    : 'Assign active staff to make this service bookable.'}
                                </p>
                              </div>
                            </>
                          )}

                          {isEditing && (
                            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                              <input
                                placeholder="Service name"
                                value={service.name || ''}
                                onChange={(e) => updateLocalService(service.id, 'name', e.target.value)}
                              />

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                                <input
                                  type="number"
                                  placeholder="Duration"
                                  value={service.duration_minutes}
                                  onChange={(e) => updateLocalService(service.id, 'duration_minutes', Number(e.target.value))}
                                  min={5}
                                />

                                <input
                                  type="number"
                                  placeholder="Price"
                                  value={service.price}
                                  onChange={(e) => updateLocalService(service.id, 'price', Number(e.target.value))}
                                  min={0}
                                  step="0.01"
                                />
                              </div>

                              <input
                                placeholder="Service image URL optional"
                                value={service.image_url || ''}
                                onChange={(e) => updateLocalService(service.id, 'image_url', e.target.value)}
                              />

                              <textarea
                                placeholder="Service description optional"
                                value={service.description || ''}
                                onChange={(e) => updateLocalService(service.id, 'description', e.target.value)}
                                rows={3}
                              />

                              <label className="card" style={{ background: 'var(--surface-2)', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={service.active}
                                    onChange={(e) => updateLocalService(service.id, 'active', e.target.checked)}
                                  />
                                  <div>
                                    <strong>Visible to customers</strong>
                                    <p className="small muted">Hidden services stay saved but will not be offered for booking.</p>
                                  </div>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveService(service)}
                                className="btn btn-accent"
                                disabled={savingServiceId === service.id}
                              >
                                {savingServiceId === service.id ? 'Saving...' : 'Save service'}
                              </button>

                              <button
                                onClick={() => {
                                  setEditingServiceId(null)
                                  loadData()
                                }}
                                className="btn btn-ghost"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setEditingServiceId(service.id)} className="btn btn-ghost">
                                Edit
                              </button>

                              <button onClick={() => toggleService(service)} className={service.active ? 'btn btn-ghost' : 'btn btn-accent'}>
                                {service.active ? 'Hide service' : 'Show service'}
                              </button>

                              <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
                                Assign staff
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
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