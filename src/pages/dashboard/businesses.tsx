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
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null } | null>(null)

  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null)
  const [publishingBusinessId, setPublishingBusinessId] = useState<string | null>(null)
  const [uploadingBusinessId, setUploadingBusinessId] = useState<string | null>(null)
  const [creatingOwnerStaffId, setCreatingOwnerStaffId] = useState<string | null>(null)
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

    setCurrentUser({
      id: session.user.id,
      email: session.user.email?.trim().toLowerCase() || null
    })

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (businessError) {
      setError(businessError.message)
      setPageLoading(false)
      return
    }

    const ownedBusinesses = businessData || []
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
      .select('id, business_id, user_id, email, active')
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


  function ownerStaffProfileForBusiness(businessId: string) {
    if (!currentUser) return null

    return staffMembers.find((staff: any) =>
      staff.business_id === businessId &&
      (staff.user_id === currentUser.id || (currentUser.email && staff.email?.toLowerCase() === currentUser.email))
    ) || null
  }

  async function addOwnerAsStaff(business: Business) {
    if (!currentUser) return

    const existingOwnerStaff = ownerStaffProfileForBusiness(business.id)

    if (existingOwnerStaff) {
      setSuccess(t('dashboardBusinesses.ownerStaff.alreadyLinked', 'You already have a staff profile for this business. Use the Staff page to manage your services and hours.'))
      return
    }

    setCreatingOwnerStaffId(business.id)
    setError(null)
    setSuccess(null)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', currentUser.id)
      .maybeSingle()

    const fallbackName = profile?.full_name?.trim() || business.name?.trim() || t('dashboardBusinesses.ownerStaff.defaultName', 'Business owner')

    const { error } = await supabase
      .from('staff_members')
      .insert({
        business_id: business.id,
        user_id: currentUser.id,
        name: fallbackName,
        role_title: t('dashboardBusinesses.ownerStaff.roleTitle', 'Owner'),
        email: currentUser.email,
        phone: profile?.phone || business.phone || null,
        invite_status: 'linked',
        permission_role: 'manager',
        active: true
      })

    setCreatingOwnerStaffId(null)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(t('dashboardBusinesses.ownerStaff.success', 'You have been added as bookable staff. Assign services and set your working hours from the Staff page.'))
    await loadBusinesses()
  }

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
    const profileMissingItems: string[] = []

    if (!profileComplete) profileMissingItems.push(t('dashboardBusinesses.missing.profile', 'profile details'))
    if (!hasBusinessImage) profileMissingItems.push(t('dashboardBusinesses.missing.image', 'business image'))
    if (!hasActiveServices) missingItems.push(t('dashboardBusinesses.missing.services', 'active services'))
    if (!hasActiveStaff) missingItems.push(t('dashboardBusinesses.missing.staff', 'active staff'))
    if (!hasStaffServiceAssignments) missingItems.push(t('dashboardBusinesses.missing.assignments', 'staff-service assignments'))
    if (!hasWorkingHours) missingItems.push(t('dashboardBusinesses.missing.hours', 'working hours'))

    const bookingReady = hasActiveServices && hasActiveStaff && hasStaffServiceAssignments && hasWorkingHours

    return {
      profileComplete,
      bookingReady,
      publicListingReady: business.published && bookingReady,
      hasActiveServices,
      hasActiveStaff,
      hasStaffServiceAssignments,
      hasWorkingHours,
      hasBusinessImage,
      activeServices,
      activeStaff,
      staffServiceAssignments,
      workingDays,
      missingItems,
      profileMissingItems
    }
  }

  const dashboardStats = useMemo(() => {
    const published = businesses.filter((business) => business.published).length
    const ready = businesses.filter((business) => getReadiness(business).bookingReady).length
    const incompletePublished = businesses.filter((business) => business.published && !getReadiness(business).bookingReady).length

    return {
      total: businesses.length,
      published,
      hidden: businesses.length - published,
      ready,
      incompletePublished
    }
  }, [businesses, services, staffMembers, staffServices, availabilityRows])

  const primaryBusiness = businesses[0] || null
  const primaryReadiness = primaryBusiness ? getReadiness(primaryBusiness) : null
  const ownerStaffProfile = primaryBusiness ? ownerStaffProfileForBusiness(primaryBusiness.id) : null

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

    if (!business.published && !readiness.bookingReady) {
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
          <div className="business-setup-hub-header">
            <div>
              <p className="small muted">{t('dashboardBusinesses.setupHub.kicker', 'Setup')}</p>
              <h3>{t('dashboardBusinesses.setupHub.title', 'Finish and manage your business setup')}</h3>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {t('dashboardBusinesses.setupHub.body', 'Keep your public profile, services, staff and availability ready so customers can book without confusion.')}
              </p>
            </div>

            {primaryBusiness && primaryReadiness && (
              <div className={primaryReadiness.publicListingReady ? 'business-live-pill' : 'business-draft-pill'}>
                <strong>
                  {primaryReadiness.publicListingReady
                    ? t('dashboardBusinesses.status.live', 'Live on Mirëbook')
                    : primaryReadiness.bookingReady
                      ? t('dashboardBusinesses.status.ready', 'Ready to publish')
                      : t('dashboardBusinesses.status.bookingSetup', 'Booking setup needed')}
                </strong>
                <span>
                  {primaryReadiness.publicListingReady
                    ? t('dashboardBusinesses.status.liveBody', 'Customers can find and book this business.')
                    : primaryBusiness.published
                      ? t('dashboardBusinesses.status.publishedNotBookableBody', 'This profile is published but hidden from Explore until booking setup is complete.')
                    : primaryReadiness.bookingReady
                      ? t('dashboardBusinesses.status.readyBody', 'Everything needed is complete. Publish when you are ready.')
                      : t('dashboardBusinesses.status.bookingSetupBody', 'Add the missing services, staff assignments or hours before customers can book.')}
                </span>
              </div>
            )}
          </div>

          {primaryBusiness && primaryReadiness && (
            <div className="business-readiness-strip">
              <div className={primaryReadiness.profileComplete ? 'business-readiness-item ready' : 'business-readiness-item'}>
                <strong>{primaryReadiness.profileComplete ? '✓' : '!'}</strong>
                <span>{t('dashboardBusinesses.readiness.profile', 'Profile')}</span>
              </div>
              <div className={primaryReadiness.hasBusinessImage ? 'business-readiness-item ready' : 'business-readiness-item'}>
                <strong>{primaryReadiness.hasBusinessImage ? '✓' : '!'}</strong>
                <span>{t('dashboardBusinesses.readiness.image', 'Image')}</span>
              </div>
              <div className={primaryReadiness.hasActiveServices ? 'business-readiness-item ready' : 'business-readiness-item'}>
                <strong>{primaryReadiness.activeServices}</strong>
                <span>{t('dashboardBusinesses.readiness.services', 'Services')}</span>
              </div>
              <div className={primaryReadiness.hasActiveStaff ? 'business-readiness-item ready' : 'business-readiness-item'}>
                <strong>{primaryReadiness.activeStaff}</strong>
                <span>{t('dashboardBusinesses.readiness.staff', 'Staff')}</span>
              </div>
              <div className={primaryReadiness.hasStaffServiceAssignments ? 'business-readiness-item ready' : 'business-readiness-item'}>
                <strong>{primaryReadiness.staffServiceAssignments}</strong>
                <span>{t('dashboardBusinesses.readiness.assignments', 'Assignments')}</span>
              </div>
              <div className={primaryReadiness.hasWorkingHours ? 'business-readiness-item ready' : 'business-readiness-item'}>
                <strong>{primaryReadiness.workingDays}</strong>
                <span>{t('dashboardBusinesses.readiness.hours', 'Working days')}</span>
              </div>
            </div>
          )}

          {primaryBusiness && primaryReadiness && (
            <div className="business-onboarding-checklist">
              {[
                {
                  number: 1,
                  ready: primaryReadiness.profileComplete,
                  href: '#business-profile',
                  title: t('dashboardBusinesses.onboarding.profile', 'Complete business profile'),
                  body: t(
                    'dashboardBusinesses.onboarding.profileBody',
                    'Profile details build customer trust. They improve presentation but do not replace booking readiness.'
                  )
                },
                {
                  number: 2,
                  ready: primaryReadiness.hasActiveServices,
                  href: '/dashboard/services',
                  title: t('dashboardBusinesses.onboarding.services', 'Add services'),
                  body: t(
                    'dashboardBusinesses.onboarding.servicesBody',
                    'Create at least one active service customers can select.'
                  )
                },
                {
                  number: 3,
                  ready: primaryReadiness.hasActiveStaff,
                  href: '/dashboard/staff',
                  title: t('dashboardBusinesses.onboarding.staff', 'Add staff'),
                  body: t(
                    'dashboardBusinesses.onboarding.staffBody',
                    'Add the people who deliver appointments, including yourself only when appropriate.'
                  )
                },
                {
                  number: 4,
                  ready: primaryReadiness.hasStaffServiceAssignments,
                  href: '/dashboard/staff',
                  title: t('dashboardBusinesses.onboarding.assignments', 'Assign services to staff'),
                  body: t(
                    'dashboardBusinesses.onboarding.assignmentsBody',
                    'Customers can book only when an active staff member is assigned to an active service.'
                  )
                },
                {
                  number: 5,
                  ready: primaryReadiness.hasWorkingHours,
                  href: '/dashboard/availability',
                  title: t('dashboardBusinesses.onboarding.hours', 'Set working hours'),
                  body: t(
                    'dashboardBusinesses.onboarding.hoursBody',
                    'Working hours create the availability customers use to choose a time.'
                  )
                },
                {
                  number: 6,
                  ready: primaryReadiness.bookingReady,
                  href: `/explore/${primaryBusiness.id}`,
                  title: t('dashboardBusinesses.onboarding.preview', 'Preview public page'),
                  body: t(
                    'dashboardBusinesses.onboarding.previewBody',
                    'Review the customer experience before making the profile visible.'
                  )
                },
                {
                  number: 7,
                  ready: Boolean(primaryBusiness.published),
                  href: '#business-profile',
                  title: t('dashboardBusinesses.onboarding.publish', 'Publish when ready'),
                  body: t(
                    'dashboardBusinesses.onboarding.publishBody',
                    'Publishing controls visibility. Billing remains informational and does not block setup or listing.'
                  )
                }
              ].map((item) => (
                <a
                  key={item.number}
                  href={item.href}
                  className={item.ready ? 'business-onboarding-step ready' : 'business-onboarding-step'}
                >
                  <span className="business-onboarding-number">
                    {item.ready ? '✓' : item.number}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </span>
                  <span className="business-onboarding-state">
                    {item.ready
                      ? t('dashboardBusinesses.onboarding.done', 'Done')
                      : t('dashboardBusinesses.onboarding.next', 'Next')}
                  </span>
                </a>
              ))}
            </div>
          )}

          <div className="business-owner-staff-row">
            <div>
              <strong>
                {ownerStaffProfile
                  ? t('dashboardBusinesses.ownerStaff.linkedTitle', 'You are bookable staff')
                  : t('dashboardBusinesses.ownerStaff.title', 'Do you take appointments?')}
              </strong>
              <p className="small muted">
                {ownerStaffProfile
                  ? t(
                      'dashboardBusinesses.onboarding.ownerStaffLinked',
                      'Business dashboard manages the company. My Work manages your personal schedule and availability.'
                    )
                  : t(
                      'dashboardBusinesses.ownerStaff.body',
                      'Add yourself as bookable staff only if customers can book appointments with you. If you only manage the business, leave yourself owner-only.'
                    )}
              </p>
            </div>
            {ownerStaffProfile ? (
              <a href="/staff" className="btn btn-ghost">
                {t('dashboardBusinesses.onboarding.openMyWork', 'Open My Work')}
              </a>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => addOwnerAsStaff(businesses[0])}
                disabled={creatingOwnerStaffId === businesses[0].id}
              >
                {creatingOwnerStaffId === businesses[0].id
                  ? t('dashboardBusinesses.ownerStaff.creating', 'Adding you as staff...')
                  : t('staff.ownerSetup.addSelf', 'Add myself as bookable staff')}
              </button>
            )}
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

        .business-setup-hub-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .business-live-pill,
        .business-draft-pill {
          display: grid;
          gap: 0.25rem;
          min-width: 12rem;
          border-radius: 1rem;
          padding: 0.85rem;
          border: 1px solid rgba(255,190,11,0.28);
          background: rgba(255,190,11,0.06);
        }

        .business-live-pill {
          border-color: rgba(45,212,191,0.28);
          background: rgba(45,212,191,0.06);
        }

        .business-live-pill span,
        .business-draft-pill span {
          color: var(--text-muted);
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .business-readiness-strip {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .business-readiness-item {
          border: 1px solid rgba(255,190,11,0.28);
          border-radius: 0.85rem;
          background: rgba(255,190,11,0.06);
          padding: 0.75rem;
          display: grid;
          gap: 0.2rem;
        }

        .business-readiness-item.ready {
          border-color: rgba(45,212,191,0.28);
          background: rgba(45,212,191,0.06);
        }

        .business-readiness-item span {
          color: var(--text-muted);
          font-size: 0.76rem;
        }

        .business-onboarding-checklist {
          display: grid;
          gap: 0.6rem;
        }

        .business-onboarding-step {
          display: grid;
          grid-template-columns: 2rem minmax(0, 1fr) auto;
          gap: 0.75rem;
          align-items: center;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .business-onboarding-step.ready {
          border-color: rgba(45,212,191,0.24);
          background: rgba(45,212,191,0.05);
        }

        .business-onboarding-number {
          width: 2rem;
          height: 2rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255,107,53,0.12);
          color: var(--accent);
          font-weight: 800;
        }

        .business-onboarding-step.ready .business-onboarding-number {
          background: rgba(45,212,191,0.12);
          color: var(--success);
        }

        .business-onboarding-step > span:nth-child(2) {
          display: grid;
          gap: 0.2rem;
        }

        .business-onboarding-step small {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .business-onboarding-state {
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .business-onboarding-step.ready .business-onboarding-state {
          color: var(--success);
        }

        .business-owner-staff-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border);
        }

        .business-owner-staff-row p {
          margin-top: 0.25rem;
          max-width: 680px;
        }

        @media (max-width: 700px) {
          .business-setup-hub-header,
          .business-owner-staff-row {
            display: grid;
          }

          .business-live-pill,
          .business-draft-pill,
          .business-owner-staff-row :global(.btn) {
            width: 100%;
          }

          .business-readiness-strip {
            grid-template-columns: 1fr;
          }

          .business-onboarding-step {
            grid-template-columns: 2rem minmax(0, 1fr);
          }

          .business-onboarding-state {
            grid-column: 2;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}
