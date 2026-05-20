import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import { uploadMirebookImage } from '@/lib/imageUpload'
import BusinessSetupHero from '@/components/dashboard-businesses/BusinessSetupHero'
import BusinessSetupStats from '@/components/dashboard-businesses/BusinessSetupStats'
import CreateBusinessCard from '@/components/dashboard-businesses/CreateBusinessCard'
import BusinessProfileCard from '@/components/dashboard-businesses/BusinessProfileCard'
import {
  AvailabilityRow,
  Business,
  Readiness,
  Service,
  StaffMember,
  StaffService
} from '@/components/dashboard-businesses/dashboardBusinessesTypes'
import { useI18n } from '@/lib/useI18n'

export default function Businesses() {
  const router = useRouter()
  const { t } = useI18n()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([])

  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null)
  const [publishingBusinessId, setPublishingBusinessId] = useState<string | null>(null)
  const [uploadingBusinessId, setUploadingBusinessId] = useState<string | null>(null)
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
      setStaffServices([])
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

    const activeStaffIds = (staffData || []).filter((staff) => staff.active).map((staff) => staff.id)

    let staffServiceData: StaffService[] = []

    if (activeStaffIds.length > 0) {
      const { data: staffServiceRows, error: staffServiceError } = await supabase
        .from('staff_services')
        .select('id, staff_member_id, service_id')
        .in('staff_member_id', activeStaffIds)

      if (staffServiceError) {
        setError(staffServiceError.message)
        setPageLoading(false)
        return
      }

      staffServiceData = (staffServiceRows || []) as StaffService[]
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
    setStaffServices(staffServiceData)
    setAvailabilityRows(availabilityData || [])
    setPageLoading(false)
  }

  useEffect(() => {
    loadBusinesses()
  }, [])

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault()

    if (!newName.trim()) return

    if (businesses.length > 0) {
      setError(t('dashboardBusinesses.create.limitReached', 'Your account already has a business profile. To add another business or location, contact Mirëbook support.'))
      return
    }

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
    setSuccess(t('dashboardBusinesses.create.success', 'Business created. Complete the setup hub, then publish it to Mirëbook.'))
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

  async function uploadBusinessImage(business: Business, file: File | null) {
    if (!file) return

    setUploadingBusinessId(business.id)
    setError(null)
    setSuccess(null)

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: 'businesses',
        recordId: business.id
      })

      const { error: updateError } = await supabase
        .from('businesses')
        .update({ image_url: uploaded.publicUrl })
        .eq('id', business.id)

      if (updateError) throw updateError

      updateLocalBusiness(business.id, 'image_url', uploaded.publicUrl)
      setSuccess(`${business.name || t('common.business', 'Business')} ${t('dashboardBusinesses.image.uploaded', 'image uploaded.')}`)
      await loadBusinesses()
    } catch (err: any) {
      setError(err.message || t('dashboardBusinesses.image.uploadError', 'Could not upload business image.'))
    } finally {
      setUploadingBusinessId(null)
    }
  }

  async function removeBusinessImage(business: Business) {
    const confirmed = confirm(t('dashboardBusinesses.image.confirmRemove', 'Remove this business image from the public marketplace profile?'))
    if (!confirmed) return

    setUploadingBusinessId(business.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('businesses')
      .update({ image_url: null })
      .eq('id', business.id)

    setUploadingBusinessId(null)

    if (error) {
      setError(error.message)
      return
    }

    updateLocalBusiness(business.id, 'image_url', '')
    setSuccess(`${business.name || t('common.business', 'Business')} ${t('dashboardBusinesses.image.removed', 'image removed.')}`)
    await loadBusinesses()
}
  function getReadiness(business: Business): Readiness {
    const activeServices = services.filter((service) => service.business_id === business.id && service.active).length
    const activeStaff = staffMembers.filter((staff) => staff.business_id === business.id && staff.active).length
    const workingDays = availabilityRows.filter((row) => row.business_id === business.id && row.is_closed !== true).length

    const activeServiceIds = services
      .filter((service) => service.business_id === business.id && service.active)
      .map((service) => service.id)

    const activeStaffIds = staffMembers
      .filter((staff) => staff.business_id === business.id && staff.active)
      .map((staff) => staff.id)

    const staffServiceAssignments = staffServices.filter((assignment) =>
      activeStaffIds.includes(assignment.staff_member_id) && activeServiceIds.includes(assignment.service_id)
    ).length

    const profileComplete = Boolean(
      business.name?.trim() &&
      business.category?.trim() &&
      business.city?.trim() &&
      business.description?.trim() &&
      business.phone?.trim()
    )

    const hasActiveServices = activeServices > 0
    const hasActiveStaff = activeStaff > 0
    const hasStaffServiceAssignments = staffServiceAssignments > 0
    const hasWorkingHours = workingDays > 0
    const hasBusinessImage = Boolean(business.image_url?.trim())
    const missingItems: string[] = []

    if (!profileComplete) missingItems.push(t('dashboardBusinesses.missing.profile', 'profile details'))
    if (!hasBusinessImage) missingItems.push(t('dashboardBusinesses.missing.image', 'business image'))
    if (!hasActiveServices) missingItems.push(t('dashboardBusinesses.missing.services', 'active services'))
    if (!hasActiveStaff) missingItems.push(t('dashboardBusinesses.missing.staff', 'active staff'))
    if (!hasStaffServiceAssignments) missingItems.push(t('dashboardBusinesses.missing.assignments', 'staff-service assignments'))
    if (!hasWorkingHours) missingItems.push(t('dashboardBusinesses.missing.hours', 'working hours'))

    return {
      profileComplete,
      hasActiveServices,
      hasActiveStaff,
      hasStaffServiceAssignments,
           hasWorkingHours,
      hasBusinessImage,
      readyToPublish: profileComplete && hasBusinessImage && hasActiveServices && hasActiveStaff && hasStaffServiceAssignments && hasWorkingHours,
      activeServices,
      activeStaff,
      staffServiceAssignments,
      workingDays,
      missingItems
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
  }, [businesses, services, staffMembers, staffServices, availabilityRows])

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

    setSuccess(`${business.name || t('common.business', 'Business')} ${t('dashboardBusinesses.save.success', 'setup saved.')}`)
    setSavingBusinessId(null)
    await loadBusinesses()
  }

  async function togglePublished(business: Business) {
    setError(null)
    setSuccess(null)
    setPublishingBusinessId(business.id)

    const readiness = getReadiness(business)

    if (!business.published && !readiness.readyToPublish) {
      setError(`${t('dashboardBusinesses.publish.completeFirst', 'Complete')} ${readiness.missingItems.join(', ')} ${t('dashboardBusinesses.publish.beforePublishing', 'before publishing this business to Mirëbook.')}`)
      setPublishingBusinessId(null)
      return
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

    setSuccess(!business.published ? `${business.name} ${t('dashboardBusinesses.publish.visibleSuccess', 'is now visible on Mirëbook.')}` : `${business.name} ${t('dashboardBusinesses.publish.hiddenSuccess', 'is now hidden from customers.')}`)
    await loadBusinesses()
  }

  // readinessRow and setupCard functions deleted
  return (
    <DashboardLayout
      title={t('dashboardBusinesses.pageTitle', businesses.length > 0 ? 'Setup' : 'Create your business')}
      subtitle={t('dashboardBusinesses.pageSubtitle', businesses.length > 0 ? 'Manage the parts of your business customers rely on before they book.' : 'Create your first business profile, then add services, staff, availability and publish it to Mirëbook.')}
    >
      {businesses.length === 0 && <BusinessSetupHero />}

      {businesses.length === 0 && <BusinessSetupStats stats={dashboardStats} />}

      {businesses.length === 0 && (
        <CreateBusinessCard
          value={newName}
          loading={loading}
          existingBusinessCount={businesses.length}
          onChange={setNewName}
          onSubmit={createBusiness}
        />
      )}

      {businesses.length > 0 && (
        <div className="card business-setup-hub">
          <div>
            <p className="small muted">{t('dashboardBusinesses.setupHub.kicker', 'Setup')}</p>
            <h3>{t('dashboardBusinesses.setupHub.title', 'Finish and manage your business setup')}</h3>
            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t('dashboardBusinesses.setupHub.body', 'Keep your public profile, services, staff and availability ready so customers can book without confusion.')}
            </p>
          </div>

          <div className="business-setup-grid">
            <a href="#business-profile" className="business-setup-card">
              <strong>{t('dashboardBusinesses.setupHub.profile', 'Business profile')}</strong>
              <span>{t('dashboardBusinesses.setupHub.profileBody', 'Edit public details, image, category and publish status.')}</span>
            </a>

            <a href="/dashboard/services" className="business-setup-card">
              <strong>{t('support.business.services', 'Services')}</strong>
              <span>{t('dashboardBusinesses.setupHub.servicesBody', 'Create the services customers can book.')}</span>
            </a>

            <a href="/dashboard/staff" className="business-setup-card">
              <strong>{t('support.business.staff', 'Staff')}</strong>
              <span>{t('dashboardBusinesses.setupHub.staffBody', 'Add staff and assign services to them.')}</span>
            </a>

            <a href="/dashboard/availability" className="business-setup-card">
              <strong>{t('dashboardBusinesses.setupHub.availability', 'Availability')}</strong>
              <span>{t('dashboardBusinesses.setupHub.availabilityBody', 'Set the days and hours customers can book.')}</span>
            </a>

            <a href={`/explore/${businesses[0].id}`} className="business-setup-card">
              <strong>{t('dashboardBusinesses.profileTools.preview', 'Preview public page')}</strong>
              <span>{t('dashboardBusinesses.setupHub.previewBody', 'See what customers see before you share your page.')}</span>
            </a>
<a href="/support/business" className="business-setup-card">
  <strong>{t('dashboardBusinesses.create.requestAnother', 'Request another business')}</strong>
  <span>{t('dashboardBusinesses.setupHub.requestBody', 'Ask support to add another location or profile.')}</span>
</a>

         
          </div>
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

      {pageLoading && (
        <div className="card">
          <p className="muted">{t('dashboardBusinesses.loading', 'Loading your Mirëbook businesses...')}</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>{t('dashboardBusinesses.empty.title', 'No businesses yet')}</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {t('dashboardBusinesses.empty.body', 'Create your first business above. Then add services, staff, working hours and publish it to Mirëbook.')}
          </p>
        </div>
      )}

      <div id="business-profile" className="business-profile-list">
        {businesses.map((business) => (
          <BusinessProfileCard
            key={business.id}
            business={business}
            readiness={getReadiness(business)}
            savingBusinessId={savingBusinessId}
            publishingBusinessId={publishingBusinessId}
            uploadingBusinessId={uploadingBusinessId}
            updateLocalBusiness={updateLocalBusiness}
            onSave={saveBusiness}
            onTogglePublished={togglePublished}
            onUploadImage={uploadBusinessImage}
            onRemoveImage={removeBusinessImage}
          />
        ))}
      </div>
      <style jsx>{`
        .business-profile-list {
          display: grid;
          gap: 1.25rem;
        }

        .business-setup-hub {
          display: grid;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .business-setup-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .business-setup-card {
          display: grid;
          gap: 0.35rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .business-setup-card span {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .business-setup-support-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border);
        }

        .business-setup-support-row a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 700;
        }

        @media (max-width: 700px) {
          .business-setup-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}