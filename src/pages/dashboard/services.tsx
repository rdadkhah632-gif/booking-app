import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import { uploadMirebookImage } from '@/lib/imageUpload'

type Business = {
  id: string
  name: string
  published?: boolean | null
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState(0)
  const [formExpanded, setFormExpanded] = useState(true)

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null)
  const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id, name, published')
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
    const bookable = services.filter((service) =>
      service.active && staffServices.some((link) => link.service_id === service.id)
    ).length

    const withImages = services.filter((service) => Boolean(service.image_url?.trim())).length
    const totalValue = services.reduce((total, service) => total + Number(service.price || 0), 0)

    return {
      total: services.length,
      active,
      inactive,
      assigned,
      unassigned,
      averagePrice,
      averageDuration,
      bookable,
      withImages,
      totalValue
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
    setImageFile(null)
    setImagePreviewUrl('')
    setDuration(30)
    setPrice(0)
  }

  function handleCreateImageChange(file: File | null) {
    setError(null)
    setImageFile(file)

    if (!file) {
      setImagePreviewUrl('')
      return
    }

    setImagePreviewUrl(URL.createObjectURL(file))
  }

  async function uploadCreateImage() {
    if (!imageFile) {
      setError('Choose an image file first.')
      return null
    }

    setUploadingImage(true)
    setError(null)

    try {
      const uploaded = await uploadMirebookImage({
        file: imageFile,
        folder: 'services',
        recordId: business?.id || 'new-service'
      })

      setImageUrl(uploaded.publicUrl)
      setImageFile(null)
      setImagePreviewUrl(uploaded.publicUrl)
      setSuccess('Service image uploaded.')
      return uploaded.publicUrl
    } catch (err: any) {
      setError(err.message || 'Could not upload image.')
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  async function uploadServiceImage(service: Service, file: File | null) {
    if (!file) return

    setUploadingServiceId(service.id)
    setError(null)
    setSuccess(null)

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: 'services',
        recordId: service.id
      })

      const { error: updateError } = await supabase
        .from('services')
        .update({ image_url: uploaded.publicUrl })
        .eq('id', service.id)

      if (updateError) throw updateError

      updateLocalService(service.id, 'image_url', uploaded.publicUrl)
      setSuccess(`${service.name} image uploaded.`)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Could not upload service image.')
    } finally {
      setUploadingServiceId(null)
    }
  }

  async function removeServiceImage(service: Service) {
    const confirmed = confirm('Remove this service image from the public booking page?')
    if (!confirmed) return

    setUploadingServiceId(service.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('services')
      .update({ image_url: null })
      .eq('id', service.id)

    setUploadingServiceId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalService(service.id, 'image_url', '')
    setSuccess(`${service.name} image removed.`)
    await loadData()
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

    let finalImageUrl = imageUrl.trim() || null

    if (imageFile) {
      const uploadedUrl = await uploadCreateImage()
      if (!uploadedUrl) {
        setLoading(false)
        return
      }
      finalImageUrl = uploadedUrl
    }

    const { error } = await supabase
      .from('services')
      .insert({
        business_id: business.id,
        name: name.trim(),
        description: description.trim() || null,
        image_url: finalImageUrl,
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
  function serviceReadinessText(service: Service) {
    const assignedStaff = assignedStaffForService(service.id)

    if (!service.active && assignedStaff.length === 0) {
      return 'Hidden and needs staff assignment before customers can book.'
    }

    if (!service.active) {
      return 'Hidden from customers. Show it when you are ready to take bookings.'
    }

    if (assignedStaff.length === 0) {
      return 'Visible but not bookable yet because no staff are assigned.'
    }

    return 'Ready for customers to book through Mirëbook.'
  }

  function serviceLaunchWarning(service: Service) {
    const warnings: string[] = []
    const assignedStaff = assignedStaffForService(service.id)

    if (!service.active) warnings.push('hidden')
    if (assignedStaff.length === 0) warnings.push('no staff assigned')
    if (!service.description?.trim()) warnings.push('no description')
    if (!service.image_url?.trim()) warnings.push('no image')

    return warnings
  }

  function durationOptions() {
    return [15, 30, 45, 60, 75, 90, 120]
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
      subtitle={business ? `Create Mirëbook services, pricing and bookability rules for ${business.name}.` : 'Choose which business services to manage.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading Mirëbook services...</p>
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
            Create a business profile first, then add Mirëbook services customers can book.
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
              Pick the business you want to configure. Mirëbook services are managed per business because prices, staff and availability can differ.
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
                <p className="small muted" style={{ marginTop: '0.25rem' }}>
                  {b.published ? 'Published' : 'Hidden / draft'}
                </p>
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
            <div className="services-hero-row">
              <div style={{ flex: 1, minWidth: 260 }}>
                <p className="small" style={{ color: 'var(--accent)' }}>Setup sub-page</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Services customers can book on Mirëbook.
                </h2>
                <p className="muted" style={{ marginTop: '0.55rem' }}>
                  Add services with prices, durations, descriptions and optional images. Mirëbook only treats a service as properly bookable when it is visible and active staff are assigned to it.
                </p>
              </div>

              <div className="services-hero-actions">
                <Link href="/dashboard/businesses" className="btn btn-ghost">
                  Back to setup hub
                </Link>
                <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
                  Assign staff
                </Link>
                <Link href={`/explore/${business.id}`} className="btn btn-ghost">
                  Preview public page
                </Link>
<Link href="/support/business" className="btn btn-ghost">
  Business support
</Link>
              </div>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
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

            <div className="card" style={{ borderColor: serviceStats.bookable > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
              <p className="small muted">Bookable</p>
              <h3>{serviceStats.bookable}</h3>
              <p className="muted small">Visible services with assigned staff</p>
            </div>
<div className="card" style={{ borderColor: serviceStats.withImages > 0 ? 'rgba(45,212,191,0.25)' : 'var(--border)' }}>
  <p className="small muted">With images</p>
  <h3>{serviceStats.withImages}</h3>
  <p className="muted small">Services with uploaded public images</p>
</div>

            <div className="card" style={{ borderColor: serviceStats.unassigned > 0 ? 'rgba(255,190,11,0.35)' : 'var(--border)' }}>
              <p className="small muted">Unassigned</p>
              <h3>{serviceStats.unassigned}</h3>
              <p className="muted small">Services without assigned staff</p>
            </div>

            <div className="card">
              <p className="small muted">Average service</p>
              <h3>£{serviceStats.averagePrice.toFixed(2)}</h3>
              <p className="muted small">Avg. {Math.round(serviceStats.averageDuration)} minutes · £{serviceStats.totalValue.toFixed(2)} total list value</p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="services-form-header" style={{ marginBottom: formExpanded ? '1rem' : 0 }}>
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
                <div className="services-create-grid">
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
                        <select
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          style={{ marginTop: '0.35rem' }}
                        >
                          {durationOptions().map((minutes) => (
                            <option key={minutes} value={minutes}>{minutes} minutes</option>
                          ))}
                        </select>
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

                   <div className="image-upload-box">
  <div>
    <p className="small muted">Service image</p>
    <strong>Upload from your device</strong>
    <p className="small muted" style={{ marginTop: '0.25rem' }}>
      JPG, PNG, WEBP or GIF up to 5MB.
    </p>
  </div>

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    onChange={(e) => handleCreateImageChange(e.target.files?.[0] || null)}
  />

  {(imagePreviewUrl || imageUrl) && (
    <div
      className="image-preview"
      style={{ backgroundImage: `url(${imagePreviewUrl || imageUrl})` }}
    />
  )}

  <div className="image-upload-actions">
    <button type="button" className="btn btn-ghost" onClick={uploadCreateImage} disabled={uploadingImage || !imageFile}>
      {uploadingImage ? 'Uploading...' : imageUrl ? 'Replace image' : 'Upload image'}
    </button>

    {(imageUrl || imagePreviewUrl) && (
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setImageUrl('')
          setImageFile(null)
          setImagePreviewUrl('')
        }}
      >
        Remove image
      </button>
    )}
  </div>
</div>

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
                        background: (imagePreviewUrl || imageUrl)
  ? `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${imagePreviewUrl || imageUrl})`
                          : 'linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.10))',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem'
                      }}
                    >
                      {!(imagePreviewUrl || imageUrl) && '✨'}
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

          <div className="services-list-grid">
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
              const launchWarnings = serviceLaunchWarning(service)

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
                  <div className={service.image_url ? 'service-card-grid service-card-grid-with-image' : 'service-card-grid'}>
                    {service.image_url && (
                      <div
                        style={{
                          minHeight: 180,
                          backgroundImage: `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${service.image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                    )}

                    <div className="service-card-content">
                      <div className="service-card-top-row">
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
                                  {serviceReadinessText(service)}
                                </p>
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

                              <div className="service-edit-grid">
                                <input
                                  type="number"
                                  placeholder="Duration"
                                  value={service.duration_minutes}
                                  onChange={(e) => updateLocalService(service.id, 'duration_minutes', Number(e.target.value))}
                                  min={5}
                                />
                                <select
                                  value={service.duration_minutes}
                                  onChange={(e) => updateLocalService(service.id, 'duration_minutes', Number(e.target.value))}
                                >
                                  {durationOptions().map((minutes) => (
                                    <option key={minutes} value={minutes}>{minutes} minutes</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  placeholder="Price"
                                  value={service.price}
                                  onChange={(e) => updateLocalService(service.id, 'price', Number(e.target.value))}
                                  min={0}
                                  step="0.01"
                                />
                              </div>

                             <div className="image-upload-box">
  <div>
    <p className="small muted">Service image</p>
    <strong>{service.image_url ? 'Replace uploaded image' : 'Upload image'}</strong>
    <p className="small muted" style={{ marginTop: '0.25rem' }}>
      JPG, PNG, WEBP or GIF up to 5MB.
    </p>
  </div>

  {service.image_url && (
    <div
      className="image-preview"
      style={{ backgroundImage: `url(${service.image_url})` }}
    />
  )}

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    onChange={(e) => uploadServiceImage(service, e.target.files?.[0] || null)}
    disabled={uploadingServiceId === service.id}
  />

  <div className="image-upload-actions">
    {uploadingServiceId === service.id && <p className="small muted">Uploading image...</p>}
    {service.image_url && (
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => removeServiceImage(service)}
      >
        Remove image
      </button>
    )}
  </div>
</div>

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

                        <div className="service-card-actions">
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
{service.image_url
  ? statusBadge('Image added', 'muted')
  : statusBadge('No image', 'muted')}
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
      <style jsx>{`
        .services-hero-row,
        .services-form-header,
        .service-card-top-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .services-hero-actions,
        .service-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .services-create-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
          gap: 1rem;
          align-items: start;
        }

        .services-list-grid {
          display: grid;
          gap: 1rem;
        }

        .service-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }

        .service-card-grid-with-image {
          grid-template-columns: 180px minmax(0, 1fr);
        }

        .service-card-grid-with-image > div:first-child {
          border-right: 1px solid var(--border);
        }

        .service-card-content {
          padding: 1rem;
        }

        .service-edit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }
.image-upload-box {
  display: grid;
  gap: 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
}

.image-preview {
  min-height: 150px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background-size: cover;
  background-position: center;
  background-color: var(--surface);
}

.image-upload-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

        @media (max-width: 860px) {
          .services-create-grid,
          .service-card-grid-with-image {
            grid-template-columns: 1fr;
          }

          .service-card-grid-with-image > div:first-child {
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }
        }

        @media (max-width: 640px) {
                  .services-hero-actions,
          .service-card-actions,
          .image-upload-actions {
            width: 100%;
            justify-content: stretch;
          }

          .services-hero-actions :global(.btn),
          .services-hero-actions a,
          .services-hero-actions button,
          .service-card-actions :global(.btn),
          .service-card-actions a,
          .service-card-actions button,
          .image-upload-actions :global(.btn),
          .image-upload-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}