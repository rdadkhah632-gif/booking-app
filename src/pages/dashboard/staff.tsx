import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import { uploadMirebookImage } from '@/lib/imageUpload'
import StaffBusinessPicker from '@/components/dashboard-staff/StaffBusinessPicker'
import StaffSetupHero from '@/components/dashboard-staff/StaffSetupHero'
import StaffStats from '@/components/dashboard-staff/StaffStats'
import CreateStaffCard from '@/components/dashboard-staff/CreateStaffCard'
import StaffProfileCard from '@/components/dashboard-staff/StaffProfileCard'
import {
  AvailabilityRow,
  Business,
  Service,
  StaffMember,
  StaffService
} from '@/components/dashboard-staff/dashboardStaffTypes'
import { useI18n } from '@/lib/useI18n'

export default function StaffPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)

  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [staffAvailability, setStaffAvailability] = useState<AvailabilityRow[]>([])

  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [permissionRole, setPermissionRole] = useState<'staff' | 'manager' | 'reception'>('staff')
  const [formExpanded, setFormExpanded] = useState(false)

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null)
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null)
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
        throw new Error(t('dashboardStaff.error.noAccess', 'You do not have access to this business.'))
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
        .select('role, is_admin')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'business') {
        router.replace(profile?.is_admin ? '/admin' : '/explore')
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
        .select('id, business_id, name, active, duration_minutes, price')
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
      setError(err.message || t('dashboardStaff.error.load', 'Could not load staff.'))
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, businessId])
function assignedServicesForStaff(staffId: string) {
    return services.filter((service) => staffCanDoService(staffId, service.id))
  }
    const staffStats = useMemo(() => {
    const activeStaff = staff.filter((member) => member.active).length
    const inactiveStaff = staff.length - activeStaff
    const staffWithServices = staff.filter((member) => assignedServicesForStaff(member.id).length > 0).length
    const staffWithoutServices = staff.length - staffWithServices

    return {
      total: staff.length,
      active: activeStaff,
      inactive: inactiveStaff,
      linkedAccounts: staff.filter((member) => !!member.user_id).length,
      withEmail: staff.filter((member) => !!member.email).length,
      assignedToServices: staffWithServices,
      unassignedToServices: staffWithoutServices,
      activeServices: services.filter((service) => service.active).length
    }
  }, [staff, staffServices, services])

  async function addStaff(e: React.FormEvent) {
    e.preventDefault()

    if (!business) return

    if (!name.trim()) {
      setError(t('dashboardStaff.error.nameRequired', 'Staff name is required.'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    let finalImageUrl = imageUrl.trim() || null

    if (imageFile) {
      const uploadedUrl = await uploadCreateImage()
      if (!uploadedUrl) {
        setSaving(false)
        return
      }
      finalImageUrl = uploadedUrl
    }

    const { error } = await supabase
      .from('staff_members')
      .insert({
        business_id: business.id,
        name: name.trim(),
        role_title: roleTitle.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        image_url: finalImageUrl,
        invite_status: email.trim() ? 'not_invited' : 'not_invited',
        permission_role: permissionRole,
        active: true
      })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    resetForm()
    setFormExpanded(false)
    setSuccess(t('dashboardStaff.create.success', 'Staff member added. Assign services and working hours so Mirëbook can show real bookable times for them.'))

    await loadPage()
  }
  function resetForm() {
    setName('')
    setRoleTitle('')
    setEmail('')
    setPhone('')
    setImageUrl('')
    setImageFile(null)
    setImagePreviewUrl('')
    setPermissionRole('staff')
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
        folder: 'staff',
        recordId: business?.id || 'new-staff'
      })

      setImageUrl(uploaded.publicUrl)
      setImageFile(null)
      setImagePreviewUrl(uploaded.publicUrl)
      setSuccess('Staff image uploaded.')
      return uploaded.publicUrl
    } catch (err: any) {
      setError(err.message || 'Could not upload image.')
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  async function uploadStaffImage(member: StaffMember, file: File | null) {
    if (!file) return

    setUploadingStaffId(member.id)
    setError(null)
    setSuccess(null)

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: 'staff',
        recordId: member.id
      })

      const { error: updateError } = await supabase
        .from('staff_members')
        .update({ image_url: uploaded.publicUrl })
        .eq('id', member.id)

      if (updateError) throw updateError

      updateLocalStaff(member.id, 'image_url', uploaded.publicUrl)
      setSuccess(`${member.name} image uploaded.`)
      await loadPage()
    } catch (err: any) {
      setError(err.message || 'Could not upload staff image.')
    } finally {
      setUploadingStaffId(null)
    }
  }
  async function removeStaffImage(member: StaffMember) {
    const confirmed = confirm('Remove this optional staff photo?')
    if (!confirmed) return

    setUploadingStaffId(member.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('staff_members')
      .update({ image_url: null })
      .eq('id', member.id)

    setUploadingStaffId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalStaff(member.id, 'image_url', '')
    setSuccess(`${member.name} photo removed.`)
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
      setError(t('dashboardStaff.error.nameRequired', 'Staff name is required.'))
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
        image_url: member.image_url?.trim() || null,
        permission_role: member.permission_role || 'staff',
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

  async function markStaffInvited(member: StaffMember) {
    if (!member.email) {
      setError('Add an email before marking this staff member as invited.')
      return
    }

    setActionLoadingKey(`invite-${member.id}`)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('staff_members')
      .update({ invite_status: 'invited' })
      .eq('id', member.id)

    setActionLoadingKey(null)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(`${member.name} marked as invited. Ask them to register or log in with ${member.email}; Mirëbook will link the staff account when the email matches.`)
    await loadPage()
  }

  async function toggleStaffActive(member: StaffMember) {
    setActionLoadingKey(`staff-${member.id}`)
    setError(null)
    setSuccess(null)

    const assignedServices = assignedServicesForStaff(member.id)
    const openDays = openDaysForStaff(member.id)

    if (!member.active && (assignedServices.length === 0 || openDays === 0)) {
      const confirmed = confirm('This staff member is missing assigned services or working hours. They may still not appear as bookable until both are complete. Show them anyway?')
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

 

  function openDaysForStaff(staffId: string) {
    return staffAvailability.filter((row) => row.staff_member_id === staffId && row.is_closed !== true).length
  }

  function inviteStatusLabel(member: StaffMember) {
    if (member.user_id) return 'Linked account'
    if (member.invite_status === 'invited') return 'Invite sent'
    if (member.email) return 'Ready to invite'
    return 'No email added'
  }

  function inviteStatusTone(member: StaffMember) {
    if (member.user_id) return 'success'
    if (member.invite_status === 'invited') return 'accent'
    if (member.email) return 'warning'
    return 'muted'
  }

  function staffInitials(member: StaffMember) {
    return member.name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'MB'
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
        {ready ? 'Bookable on Mirëbook' : 'Setup needed'}
      </span>
    )
  }
  
  return (
    <DashboardLayout
      title="Staff setup"
      subtitle={business ? `Manage staff, service assignments and booking readiness for ${business.name}` : 'Choose which business staff to manage.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading Mirëbook staff setup...</p>
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
              Select one of the business cards below. Mirëbook will show the staff setup for that specific business.
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
         <StaffSetupHero business={business} />

<StaffStats stats={staffStats} />

<CreateStaffCard
  loading={saving}
  formExpanded={formExpanded}
  name={name}
  roleTitle={roleTitle}
  email={email}
  phone={phone}
  setFormExpanded={setFormExpanded}
  setName={setName}
  setRoleTitle={setRoleTitle}
  setEmail={setEmail}
  setPhone={setPhone}
  resetForm={resetForm}
  addStaff={addStaff}
/>

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

          <div className="staff-card-list">
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
                  className="card staff-member-card"
                  style={{
                    borderColor: !member.active
                      ? 'rgba(255,190,11,0.25)'
                      : assignedServices.length === 0 || openDays === 0
                        ? 'rgba(255,190,11,0.35)'
                        : 'var(--border)'
                  }}
                >
                  <div className="staff-member-card-header">
                    <div className="staff-member-main">
                      <div className="staff-avatar-wrap">
                        {member.image_url ? (
                          <img src={member.image_url} alt={member.name} />
                        ) : (
                          <span>{staffInitials(member)}</span>
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
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

                        <span
                          className="small"
                          style={{
                            background: inviteStatusTone(member) === 'success'
                              ? 'rgba(45,212,191,0.12)'
                              : inviteStatusTone(member) === 'accent'
                                ? 'rgba(255,107,53,0.12)'
                                : inviteStatusTone(member) === 'warning'
                                  ? 'rgba(255,190,11,0.12)'
                                  : 'var(--surface-2)',
                            color: inviteStatusTone(member) === 'success'
                              ? 'var(--success)'
                              : inviteStatusTone(member) === 'accent'
                                ? 'var(--accent)'
                                : inviteStatusTone(member) === 'warning'
                                  ? 'var(--warning)'
                                  : 'var(--text-muted)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 999
                          }}
                        >
                          {inviteStatusLabel(member)}
                        </span>
                        </div>

                        {!isEditing && (
                          <>
                            <p className="small muted" style={{ marginTop: '0.35rem' }}>
                              {member.role_title || 'Staff member'}
                            </p>
                            {member.email && <p className="small muted">Email: {member.email}</p>}
                            {member.phone && <p className="small muted">Phone: {member.phone}</p>}
                            <p className="small muted">Permission: {member.permission_role || 'staff'}</p>
                            <p className="small muted">Account: {inviteStatusLabel(member)}</p>
                            {!member.email && (
                              <p className="small" style={{ color: 'var(--warning)', marginTop: '0.35rem' }}>
                                Add an email if this person should log in to the staff portal.
                              </p>
                            )}

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

                            <div className="image-upload-box">
                              <div>
                                <p className="small muted">Staff photo</p>
                                <strong>{member.image_url ? 'Replace uploaded image' : 'Upload image'}</strong>
                                <p className="small muted" style={{ marginTop: '0.25rem' }}>
                                  Optional. JPG, PNG, WEBP or GIF up to 5MB. Staff photos help the public page look better but are not required for booking.
                                </p>
                              </div>

                              {member.image_url && (
                                <div
                                  className="image-preview"
                                  style={{ backgroundImage: `url(${member.image_url})` }}
                                />
                              )}

                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={(e) => uploadStaffImage(member, e.target.files?.[0] || null)}
                                disabled={uploadingStaffId === member.id}
                              />

                              <div className="image-upload-actions">
                                {uploadingStaffId === member.id && <p className="small muted">Uploading image...</p>}
                                {member.image_url && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => removeStaffImage(member)}
disabled={uploadingStaffId === member.id}
                                  >
                                    Remove image
                                  </button>
                                )}
                              </div>
                            </div>

                            <select
                              value={member.permission_role || 'staff'}
                              onChange={(e) => updateLocalStaff(member.id, 'permission_role', e.target.value)}
                            >
                              <option value="staff">Staff</option>
                              <option value="reception">Reception</option>
                              <option value="manager">Manager</option>
                            </select>
                          </div>
                        )}
                      </div>
                      </div>

                    <div className="staff-card-actions">
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

                          <button
                            onClick={() => markStaffInvited(member)}
                            className="btn btn-ghost"
                            disabled={actionLoadingKey === `invite-${member.id}` || !!member.user_id || !member.email}
                          >
                            {actionLoadingKey === `invite-${member.id}`
                              ? 'Updating...'
                              : member.user_id
                                ? 'Account linked'
                                : member.invite_status === 'invited'
                                  ? 'Invited'
                                  : 'Mark invited'}
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
                          Assign every active service this staff member can perform. Orange means assigned; hidden services do not show to customers.
                        </p>

                        {assignedServices.length === 0 && services.length > 0 && (
                          <p className="small" style={{ color: 'var(--warning)', marginTop: '0.7rem' }}>
                            No services assigned yet. This staff member will not appear in public booking slots until at least one active service is assigned.
                          </p>
                        )}
                      </div>

                      <div className="staff-service-actions">
                        <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-ghost">
                          Manage services
                        </Link>

                        <Link href="/support/business" className="btn btn-ghost">
                          Support
                        </Link>
                      </div>
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
      <style jsx>{`
        .staff-summary-card {
          min-height: 122px;
        }
        .staff-readiness-panel {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
          border-color: rgba(255,107,53,0.22);
          background: rgba(255,107,53,0.05);
        }

        .staff-readiness-actions,
        .staff-service-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .staff-form-card {
          display: grid;
          gap: 0.85rem;
          margin-bottom: 1.5rem;
        }

        .staff-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
        .staff-card-list {
          display: grid;
          gap: 1rem;
        }

        .staff-member-card {
          display: grid;
          gap: 1rem;
        }

        .staff-member-card-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .staff-member-main {
          flex: 1;
          min-width: 260px;
          display: flex;
          gap: 0.9rem;
          align-items: flex-start;
        }

        .staff-avatar-wrap {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          overflow: hidden;
          background: var(--accent-dim);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          font-weight: 800;
          flex: 0 0 auto;
        }

        .staff-avatar-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .staff-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 720px) {
                    .staff-readiness-panel,
          .staff-member-card-header,
          .staff-member-main {
            display: grid;
          }

          .staff-card-actions {
            justify-content: stretch;
          }

          .staff-readiness-actions,
          .image-upload-actions,
          .staff-readiness-actions :global(.btn),
          .staff-readiness-actions a,
          .image-upload-actions :global(.btn),
          .image-upload-actions button,
          .staff-card-actions :global(.btn),
          .staff-card-actions button,
          .staff-card-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}