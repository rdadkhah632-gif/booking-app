import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  image_url?: string | null
  published: boolean
  auto_accept_bookings?: boolean
  created_at?: string
}

type Service = {
  id: string
  business_id: string
  active: boolean
}

type StaffMember = {
  id: string
  business_id: string
  active: boolean
}

type AvailabilityRow = {
  id: string
  business_id: string
  is_closed?: boolean | null
}

type Readiness = {
  profileComplete: boolean
  hasActiveServices: boolean
  hasActiveStaff: boolean
  hasWorkingHours: boolean
  readyToPublish: boolean
  activeServices: number
  activeStaff: number
  workingDays: number
}

export default function Businesses() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([])

  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null)
  const [publishingBusinessId, setPublishingBusinessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadBusinesses() {
    setError(null)
    setPageLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }


    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setPageLoading(false)
      return
    }

    const ownedBusinesses = data || []
    setBusinesses(ownedBusinesses)

    const businessIds = ownedBusinesses.map((business) => business.id)

    if (businessIds.length === 0) {
      setServices([])
      setStaffMembers([])
      setAvailabilityRows([])
      setPageLoading(false)
      return
    }

    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    if (serviceError) {
      setError(serviceError.message)
      setPageLoading(false)
      return
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    if (staffError) {
      setError(staffError.message)
      setPageLoading(false)
      return
    }

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('id, business_id, is_closed')
      .in('business_id', businessIds)

    if (availabilityError) {
      setError(availabilityError.message)
      setPageLoading(false)
      return
    }

    setServices(serviceData || [])
    setStaffMembers(staffData || [])
    setAvailabilityRows(availabilityData || [])
    setPageLoading(false)
  }

  useEffect(() => {
    loadBusinesses()
  }, [])

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault()

    if (!newName.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { error } = await supabase
      .from('businesses')
      .insert({
        name: newName.trim(),
        user_id: session.user.id,
        published: false,
        auto_accept_bookings: true
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setNewName('')
    setSuccess('Business created. Complete the setup hub, then publish it to Mirëbook.')
    await loadBusinesses()
    setLoading(false)
  }

  function updateLocalBusiness(id: string, field: keyof Business, value: string | boolean) {
    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === id ? { ...business, [field]: value } : business
      )
    )
  }

  function getReadiness(business: Business): Readiness {
    const activeServices = services.filter((service) => service.business_id === business.id && service.active).length
    const activeStaff = staffMembers.filter((staff) => staff.business_id === business.id && staff.active).length
    const workingDays = availabilityRows.filter((row) => row.business_id === business.id && row.is_closed !== true).length

    const profileComplete = Boolean(
      business.name?.trim() &&
      business.category?.trim() &&
      business.city?.trim() &&
      business.description?.trim() &&
      business.phone?.trim()
    )

    const hasActiveServices = activeServices > 0
    const hasActiveStaff = activeStaff > 0
    const hasWorkingHours = workingDays > 0

    return {
      profileComplete,
      hasActiveServices,
      hasActiveStaff,
      hasWorkingHours,
      readyToPublish: profileComplete && hasActiveServices && hasActiveStaff && hasWorkingHours,
      activeServices,
      activeStaff,
      workingDays
    }
  }

  const dashboardStats = useMemo(() => {
    const published = businesses.filter((business) => business.published).length
    const ready = businesses.filter((business) => getReadiness(business).readyToPublish).length
    const incompletePublished = businesses.filter((business) => business.published && !getReadiness(business).readyToPublish).length

    return {
      total: businesses.length,
      published,
      hidden: businesses.length - published,
      ready,
      incompletePublished
    }
  }, [businesses, services, staffMembers, availabilityRows])

  async function saveBusiness(business: Business) {
    setSavingBusinessId(business.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('businesses')
      .update({
        name: business.name,
        description: business.description || null,
        category: business.category || null,
        city: business.city || null,
        country: business.country || null,
        address: business.address || null,
        phone: business.phone || null,
        image_url: business.image_url || null,
        auto_accept_bookings: business.auto_accept_bookings ?? true
      })
      .eq('id', business.id)

    if (error) {
      setError(error.message)
      setSavingBusinessId(null)
      return
    }

    setSuccess(`${business.name || 'Business'} setup saved.`)
    setSavingBusinessId(null)
    await loadBusinesses()
  }

  async function togglePublished(business: Business) {
    setError(null)
    setSuccess(null)
    setPublishingBusinessId(business.id)

    const readiness = getReadiness(business)

    if (!business.published && !readiness.readyToPublish) {
      const confirmed = confirm(
        'This business is missing setup details. You can publish it, but customers may not be able to book properly until profile details, services, staff and hours are complete. Publish anyway?'
      )

      if (!confirmed) {
        setPublishingBusinessId(null)
        return
      }
    }

    const { error } = await supabase
      .from('businesses')
      .update({ published: !business.published })
      .eq('id', business.id)

    setPublishingBusinessId(null)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(!business.published ? `${business.name} is now visible on Mirëbook.` : `${business.name} is now hidden from customers.`)
    await loadBusinesses()
  }

  function readinessRow(label: string, complete: boolean, helper: string) {
    return (
      <div className="business-readiness-row">
        <div>
          <strong>{label}</strong>
          <p className="small muted" style={{ marginTop: '0.2rem' }}>
            {helper}
          </p>
        </div>

        <span
          className="small"
          style={{
            background: complete ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
            color: complete ? 'var(--success)' : 'var(--warning)',
            padding: '0.2rem 0.55rem',
            borderRadius: 999,
            whiteSpace: 'nowrap'
          }}
        >
          {complete ? 'Ready' : 'Needs work'}
        </span>
      </div>
    )
  }

  function setupCard(
    title: string,
    value: string,
    helper: string,
    ready: boolean,
    href: string,
    cta: string
  ) {
    return (
      <Link
        href={href}
        className="card business-setup-link-card"
        style={{
          background: ready
            ? 'linear-gradient(135deg, rgba(45,212,191,0.10), rgba(31,28,44,0.75))'
            : 'linear-gradient(135deg, rgba(255,190,11,0.10), rgba(31,28,44,0.75))',
          borderColor: ready ? 'rgba(45,212,191,0.25)' : 'rgba(255,190,11,0.25)',
          display: 'grid',
          gap: '0.55rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div>
            <p className="small muted">{title}</p>
            <h3 style={{ marginTop: '0.2rem' }}>{value}</h3>
          </div>

          <span
            className="small"
            style={{
              background: ready ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
              color: ready ? 'var(--success)' : 'var(--warning)',
              padding: '0.2rem 0.55rem',
              borderRadius: 999,
              whiteSpace: 'nowrap'
            }}
          >
            {ready ? 'Ready' : 'Setup needed'}
          </span>
        </div>

        <p className="small muted">{helper}</p>

        <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {cta} →
        </span>
      </Link>
    )
  }
  return (
    <DashboardLayout
      title="Business setup hub"
      subtitle="Control your customer-facing profile, booking settings, services, staff and working hours from one place."
    >
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08))',
          borderColor: 'rgba(255,107,53,0.25)'
        }}
      >
        <div className="business-setup-hero-row">
          <div style={{ flex: 1, minWidth: 260 }}>
            <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook setup</p>
            <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
              Set up your business before customers book.
            </h2>
            <p className="muted" style={{ marginTop: '0.6rem' }}>
              Most businesses only need one shop profile. This hub keeps your profile, services, staff, hours and publishing controls together so Mirëbook stays easy to run from desktop now and mobile app later.
            </p>
          </div>

          <div className="business-setup-hero-actions">
            <Link href="/dashboard/services" className="btn btn-ghost">
              Manage services
            </Link>
            <Link href="/dashboard/staff" className="btn btn-ghost">
              Manage staff
            </Link>
            <Link href="/dashboard/availability" className="btn btn-ghost">
              Working hours
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <p className="small muted">Businesses</p>
          <h3>{dashboardStats.total}</h3>
          <p className="muted small">Total business profiles</p>
        </div>

        <div className="card" style={{ borderColor: dashboardStats.ready > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
          <p className="small muted">Ready profiles</p>
          <h3>{dashboardStats.ready}/{dashboardStats.total}</h3>
          <p className="muted small">Profiles with services, staff and hours</p>
        </div>

        <div className="card" style={{ borderColor: dashboardStats.incompletePublished > 0 ? 'rgba(255,190,11,0.28)' : 'var(--border)' }}>
          <p className="small muted">Live but incomplete</p>
          <h3>{dashboardStats.incompletePublished}</h3>
          <p className="muted small">Published profiles that still need setup attention</p>
        </div>

        <div className="card">
          <p className="small muted">Live</p>
          <h3>{dashboardStats.published}</h3>
          <p className="muted small">Visible to customers</p>
        </div>

        <div className="card">
          <p className="small muted">Hidden</p>
          <h3>{dashboardStats.hidden}</h3>
          <p className="muted small">Not visible in marketplace</p>
        </div>
      </div>

      <form onSubmit={createBusiness} className="card business-create-card">
        <div>
          <p className="small muted">Create profile</p>
          <h3>Add a new business</h3>
          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            Create the business first, then add profile details, services, staff, working hours and publish when it is ready for customers.
          </p>
        </div>

        <div className="business-create-row">
          <input
            placeholder="Business name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <button className="btn btn-accent" disabled={loading} type="submit">
            {loading ? 'Adding...' : 'Add business to Mirëbook'}
          </button>
        </div>
      </form>

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

      {pageLoading && (
        <div className="card">
          <p className="muted">Loading your Mirëbook businesses...</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>No businesses yet</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Create your first business above. Then add services, staff, working hours and publish it to Mirëbook.
          </p>
        </div>
      )}

      <div className="business-profile-list">
        {businesses.map((business) => {
          const readiness = getReadiness(business)

          return (
            <div
              key={business.id}
              className="card business-profile-card"
              style={{
                display: 'grid',
                gap: '1rem',
                borderColor: business.published
                  ? 'rgba(45,212,191,0.25)'
                  : readiness.readyToPublish
                    ? 'rgba(255,107,53,0.25)'
                    : 'var(--border)'
              }}
            >
              <div className="business-profile-card-top">
                <div
                  className="business-profile-image-preview"
                  style={{
                    height: 112,
                    borderRadius: 'var(--radius)',
                    background: business.image_url
                      ? `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.55)), url(${business.image_url})`
                      : 'linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.10))',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem'
                  }}
                >
                  {!business.image_url && '✨'}
                </div>

                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>
                    {business.name || 'Untitled business'}
                  </h3>

                  <p className="small muted">
                    {[business.category, business.city, business.country].filter(Boolean).join(' · ') || 'Add category and location before publishing'}
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                    <span
                      className="small"
                      style={{
                        background: business.published ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                        color: business.published ? 'var(--success)' : 'var(--warning)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 999
                      }}
                    >
                      {business.published ? 'Live on Mirëbook' : 'Hidden'}
                    </span>

                    <span
                      className="small"
                      style={{
                        background: business.auto_accept_bookings ?? true ? 'rgba(45,212,191,0.12)' : 'rgba(255,107,53,0.12)',
                        color: business.auto_accept_bookings ?? true ? 'var(--success)' : 'var(--accent)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 999
                      }}
                    >
                      {business.auto_accept_bookings ?? true ? 'Auto-accept' : 'Manual approval'}
                    </span>

                    <span
                      className="small"
                      style={{
                        background: readiness.readyToPublish ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                        color: readiness.readyToPublish ? 'var(--success)' : 'var(--warning)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 999
                      }}
                    >
                      {readiness.readyToPublish ? 'Ready to book' : 'Setup incomplete'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => togglePublished(business)}
                  className={business.published ? 'btn btn-ghost' : 'btn btn-accent'}
                  disabled={publishingBusinessId === business.id}
                >
                  {publishingBusinessId === business.id
                    ? 'Updating...'
                    : business.published
                      ? 'Hide from marketplace'
                      : readiness.readyToPublish ? 'Publish to Mirëbook' : 'Publish anyway'}
                </button>
              </div>

              <div className="grid-2 business-setup-card-grid">
                {setupCard(
                  'Services',
                  `${readiness.activeServices} active`,
                  'Create bookable services with prices, durations, descriptions and optional images.',
                  readiness.hasActiveServices,
                  `/dashboard/services?businessId=${business.id}`,
                  'Manage services'
                )}

                {setupCard(
                  'Staff',
                  `${readiness.activeStaff} active`,
                  'Add staff, assign services and control who customers can book with.',
                  readiness.hasActiveStaff,
                  `/dashboard/staff?businessId=${business.id}`,
                  'Manage staff'
                )}

                {setupCard(
                  'Working hours',
                  `${readiness.workingDays} open day${readiness.workingDays === 1 ? '' : 's'}`,
                  'Set general shop availability. Staff-specific hours control exact bookable slots.',
                  readiness.hasWorkingHours,
                  `/dashboard/availability?businessId=${business.id}`,
                  'Set hours'
                )}

                {setupCard(
                  'Marketplace preview',
                  business.published ? 'Live' : 'Hidden',
                  business.published
                    ? 'Preview how customers see this business on Mirëbook.'
                    : readiness.readyToPublish
                      ? 'Preview the public page before publishing.'
                      : 'Preview is available, but customers may not be able to book until setup is complete.',
                  business.published,
                  `/explore/${business.id}`,
                  'Open public page'
                )}
              </div>

              <div className="grid-2 business-detail-grid">
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <p className="small muted">Customer-facing profile</p>
                  <h3 style={{ marginTop: '0.25rem' }}>Profile details</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    These details appear on the public Mirëbook marketplace, booking page and later in the mobile app view.
                  </p>

                  <div className="business-profile-input-grid">
                    <input
                      placeholder="Business name"
                      value={business.name || ''}
                      onChange={(e) => updateLocalBusiness(business.id, 'name', e.target.value)}
                    />

                    <input
                      placeholder="Category e.g. Barber, Dentist, Salon"
                      value={business.category || ''}
                      onChange={(e) => updateLocalBusiness(business.id, 'category', e.target.value)}
                    />

                    <input
                      placeholder="City"
                      value={business.city || ''}
                      onChange={(e) => updateLocalBusiness(business.id, 'city', e.target.value)}
                    />

                    <input
                      placeholder="Country"
                      value={business.country || ''}
                      onChange={(e) => updateLocalBusiness(business.id, 'country', e.target.value)}
                    />

                    <input
                      placeholder="Address"
                      value={business.address || ''}
                      onChange={(e) => updateLocalBusiness(business.id, 'address', e.target.value)}
                    />

                    <input
                      placeholder="Phone"
                      value={business.phone || ''}
                      onChange={(e) => updateLocalBusiness(business.id, 'phone', e.target.value)}
                    />
                  </div>

                  <input
                    placeholder="Business image URL optional"
                    value={business.image_url || ''}
                    onChange={(e) => updateLocalBusiness(business.id, 'image_url', e.target.value)}
                    style={{ marginTop: '0.75rem' }}
                  />

                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Optional for now. Paste a public image URL to show a header image on your marketplace and booking pages.
                  </p>

                  <textarea
                    placeholder="Description shown to customers"
                    value={business.description || ''}
                    onChange={(e) => updateLocalBusiness(business.id, 'description', e.target.value)}
                    rows={4}
                    style={{ marginTop: '0.75rem' }}
                  />
                </div>

                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <p className="small muted">Readiness checklist</p>
                  <h3 style={{ marginTop: '0.25rem' }}>
                    {readiness.readyToPublish ? 'Ready for customers' : 'Complete setup before launch'}
                  </h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    This keeps the marketplace clean and stops customers seeing a business they cannot confidently book with.
                  </p>

                  <div style={{ marginTop: '0.8rem' }}>
                    {readinessRow(
                      'Profile details',
                      readiness.profileComplete,
                      'Name, category, city, phone and description are filled in.'
                    )}

                    {readinessRow(
                      'Active services',
                      readiness.hasActiveServices,
                      `${readiness.activeServices} active service${readiness.activeServices === 1 ? '' : 's'} found.`
                    )}

                    {readinessRow(
                      'Active staff',
                      readiness.hasActiveStaff,
                      `${readiness.activeStaff} active staff member${readiness.activeStaff === 1 ? '' : 's'} found.`
                    )}

                    {readinessRow(
                      'Working hours',
                      readiness.hasWorkingHours,
                      `${readiness.workingDays} open day${readiness.workingDays === 1 ? '' : 's'} configured.`
                    )}
                  </div>
                </div>
              </div>

              <div
                className="card"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <p className="small muted">Booking approval</p>
                    <h3 style={{ marginTop: '0.25rem' }}>
                      {business.auto_accept_bookings ?? true ? 'Auto-accept customer bookings' : 'Manually approve customer bookings'}
                    </h3>
                    <p className="small muted" style={{ marginTop: '0.35rem' }}>
                      Auto-accept confirms available customer bookings instantly. Manual approval sends new bookings to Needs action for review.
                    </p>
                  </div>

                  <label
                    className="btn btn-ghost"
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={business.auto_accept_bookings ?? true}
                      onChange={(e) => updateLocalBusiness(business.id, 'auto_accept_bookings', e.target.checked)}
                    />
                    Auto-accept new bookings
                  </label>
                </div>
              </div>

              <div className="business-profile-actions">
                <button
                  onClick={() => saveBusiness(business)}
                  className="btn btn-accent"
                  disabled={savingBusinessId === business.id}
                >
                  {savingBusinessId === business.id ? 'Saving...' : 'Save setup'}
                </button>

                <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-ghost">
                  Services
                </Link>

                <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
                  Staff
                </Link>

                <Link href={`/dashboard/availability?businessId=${business.id}`} className="btn btn-ghost">
                  Working hours
                </Link>

                <Link href={`/dashboard/bookings?businessId=${business.id}`} className="btn btn-ghost">
                  Bookings
                </Link>

                <Link href="/dashboard/notifications" className="btn btn-ghost">
                  Notifications
                </Link>

                <Link href={`/explore/${business.id}`} className="btn btn-ghost">
                  Preview public page
                </Link>
              </div>
            </div>
          )
        })}
      </div>
      <style jsx>{`
        .business-setup-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .business-setup-hero-actions,
        .business-profile-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .business-create-card {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .business-create-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.75rem;
        }

        .business-profile-list {
          display: grid;
          gap: 1.25rem;
        }

        .business-profile-card {
          display: grid;
          gap: 1rem;
        }

        .business-profile-card-top {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: start;
        }

        .business-profile-image-preview {
          height: 112px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
        }

        .business-setup-link-card {
          text-decoration: none;
          color: var(--text);
        }

        .business-setup-link-card:hover {
          transform: translateY(-1px);
          border-color: rgba(255,107,53,0.35);
        }

        .business-profile-input-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .business-readiness-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }

        @media (max-width: 860px) {
          .business-profile-card-top {
            grid-template-columns: 1fr;
          }

          .business-profile-image-preview {
            min-height: 160px;
            height: auto;
          }
        }

        @media (max-width: 640px) {
          .business-create-row {
            grid-template-columns: 1fr;
          }

          .business-setup-hero-actions,
          .business-profile-actions,
          .business-setup-hero-actions :global(.btn),
          .business-profile-actions :global(.btn),
          .business-setup-hero-actions a,
          .business-profile-actions a,
          .business-profile-actions button {
            width: 100%;
            justify-content: center;
          }

          .business-readiness-row {
            display: grid;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}