import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import {
  Business,
  Readiness,
  UpdateBusinessField
} from './dashboardBusinessesTypes'
import BusinessImageUpload from './BusinessImageUpload'
import BusinessReadinessRow from './BusinessReadinessRow'
import BusinessSetupLinkCard from './BusinessSetupLinkCard'

type Props = {
  business: Business
  readiness: Readiness
  savingBusinessId: string | null
  publishingBusinessId: string | null
  uploadingBusinessId: string | null
  updateLocalBusiness: UpdateBusinessField
  onSave: (business: Business) => void
  onTogglePublished: (business: Business) => void
  onUploadImage: (business: Business, file: File | null) => void
  onRemoveImage: (business: Business) => void
}

export default function BusinessProfileCard({
  business,
  readiness,
  savingBusinessId,
  publishingBusinessId,
  uploadingBusinessId,
  updateLocalBusiness,
  onSave,
  onTogglePublished,
  onUploadImage,
  onRemoveImage
}: Props) {
  const { t } = useI18n()
  const isSaving = savingBusinessId === business.id
  const isPublishing = publishingBusinessId === business.id

  return (
    <div
      className="card business-profile-card"
      style={{
        display: 'grid',
        gap: '1rem',
        borderColor: readiness.publicListingReady
          ? 'rgba(45,212,191,0.25)'
          : readiness.bookingReady
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
            {business.name || t('dashboardBusinesses.untitledBusiness', 'Untitled business')}
          </h3>

          <p className="small muted">
            {[business.category, business.city, business.country].filter(Boolean).join(' · ') ||
              t('dashboardBusinesses.addCategoryLocation', 'Add category and location before publishing')}
          </p>

          <div className="business-status-pills">
            <span
              className="small"
              style={{
                background: business.published ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                color: business.published ? 'var(--success)' : 'var(--warning)',
                padding: '0.2rem 0.55rem',
                borderRadius: 999
              }}
            >
              {business.published
                ? t('dashboardBusinesses.liveOnMirebook', 'Live on Mirëbook')
                : t('dashboardBusinesses.hidden', 'Hidden')}
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
              {business.auto_accept_bookings ?? true
                ? t('dashboardBusinesses.autoAccept', 'Auto-accept')
                : t('dashboardSettings.approval.manualTitle', 'Manual approval')}
            </span>

            <span
              className="small"
              style={{
                background: readiness.bookingReady ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                color: readiness.bookingReady ? 'var(--success)' : 'var(--warning)',
                padding: '0.2rem 0.55rem',
                borderRadius: 999
              }}
            >
              {readiness.bookingReady
                ? t('dashboardBusinesses.readyToBook', 'Booking ready')
                : t('dashboardBusinesses.setupIncomplete', 'Booking setup needed')}
            </span>

            <span className="small" style={{ background: readiness.profileComplete ? 'rgba(45,212,191,0.12)' : 'var(--surface-2)', color: readiness.profileComplete ? 'var(--success)' : 'var(--text-muted)', padding: '0.2rem 0.55rem', borderRadius: 999 }}>
              {readiness.profileComplete
                ? t('dashboardBusinesses.profileComplete', 'Profile complete')
                : t('dashboardBusinesses.profileNeedsPolish', 'Profile needs details')}
            </span>
          </div>
        </div>

        <button
          onClick={() => onTogglePublished(business)}
          className={business.published ? 'btn btn-ghost' : 'btn btn-accent'}
          disabled={isPublishing}
        >
          {isPublishing
            ? t('common.updating', 'Updating...')
            : business.published
              ? t('dashboardBusinesses.hideMarketplace', 'Hide from marketplace')
              : readiness.bookingReady
                ? t('dashboardBusinesses.publish', 'Publish to Mirëbook')
                : t('dashboardBusinesses.finishSetup', 'Finish setup first')}
        </button>
      </div>

      <div className="business-readiness-overview">
        <div className={readiness.profileComplete ? 'business-readiness-panel ready' : 'business-readiness-panel'}>
          <p className="small muted">
            {t('dashboardBusinesses.overview.profileTitle', 'Profile completeness')}
          </p>
          <strong>
            {readiness.profileComplete
              ? t('dashboardBusinesses.overview.complete', 'Complete')
              : t('dashboardBusinesses.overview.needsDetails', 'Needs details')}
          </strong>
          <p className="small muted">
            {t('dashboardBusinesses.overview.profileBody', 'Presentation details for customers. An image is recommended, not required for booking readiness.')}
          </p>
        </div>

        <div className={readiness.bookingReady ? 'business-readiness-panel ready' : 'business-readiness-panel'}>
          <p className="small muted">
            {t('dashboardBusinesses.overview.bookingTitle', 'Booking readiness')}
          </p>
          <strong>
            {readiness.bookingReady
              ? t('dashboardBusinesses.overview.ready', 'Ready')
              : t('dashboardBusinesses.overview.actionNeeded', 'Action needed')}
          </strong>
          <p className="small muted">
            {t('dashboardBusinesses.overview.bookingBody', 'Requires an active service, active staff assignment and available working hours.')}
          </p>
        </div>

        <div className={readiness.publicListingReady ? 'business-readiness-panel ready' : 'business-readiness-panel'}>
          <p className="small muted">
            {t('dashboardBusinesses.overview.publicTitle', 'Public listing')}
          </p>
          <strong>
            {readiness.publicListingReady
              ? t('dashboardBusinesses.overview.listed', 'Listed and bookable')
              : business.published
                ? t('dashboardBusinesses.overview.hiddenUntilReady', 'Published, awaiting booking setup')
                : t('dashboardBusinesses.overview.hidden', 'Hidden')}
          </strong>
          <p className="small muted">
            {t('dashboardBusinesses.overview.publicBody', 'Explore only shows published businesses that pass the booking-readiness checks.')}
          </p>
        </div>
      </div>

      <div className="grid-2 business-setup-card-grid">
        <BusinessSetupLinkCard
          title={t('support.business.services', 'Services')}
          value={`${readiness.activeServices} ${t('dashboardBusinesses.active', 'active')}`}
          helper={t('dashboardBusinesses.servicesHelper', 'Create bookable services with prices, durations, descriptions and optional images.')}
          ready={readiness.hasActiveServices}
          href={`/dashboard/services?businessId=${business.id}`}
          cta={t('dashboardBusinesses.manageServices', 'Manage services')}
        />

        <BusinessSetupLinkCard
          title={t('support.business.staff', 'Staff')}
          value={`${readiness.activeStaff} ${t('dashboardBusinesses.active', 'active')}`}
          helper={t('dashboardBusinesses.staffHelper', 'Add staff, link emails and assign active services so customers can book the right people.')}
          ready={readiness.hasActiveStaff && readiness.hasStaffServiceAssignments}
          href={`/dashboard/staff?businessId=${business.id}`}
          cta={t('dashboardBusinesses.manageStaff', 'Manage staff')}
        />

        <BusinessSetupLinkCard
          title={t('nav.settings', 'Settings')}
          value={business.auto_accept_bookings ?? true ? t('dashboardBusinesses.autoAccept', 'Auto-accept') : t('dashboardSettings.approval.manualTitle', 'Manual approval')}
          helper={t('dashboardBusinesses.settingsHelper', 'Control approval mode, booking intervals, notice periods, buffers and customer policies.')}
          ready
          href={`/dashboard/settings?businessId=${business.id}`}
          cta={t('dashboardBusinesses.openSettings', 'Open settings')}
        />

        <BusinessSetupLinkCard
          title={t('home.trust.billing', 'Billing')}
          value={t('dashboardBusinesses.subscription', 'Subscription')}
          helper={t('dashboardBusinesses.billingHelper', 'Prepare trial, plan and subscription details for this business account.')}
          ready
          href={`/dashboard/billing?businessId=${business.id}`}
          cta={t('dashboardBusinesses.openBilling', 'Open billing')}
        />

        <BusinessSetupLinkCard
          title={t('dashboardBusinesses.workingHours', 'Working hours')}
          value={`${readiness.workingDays} ${t('dashboardBusinesses.openDay', 'open day')}${readiness.workingDays === 1 ? '' : 's'}`}
          helper={t('dashboardBusinesses.hoursHelper', 'Set general shop availability. Staff-specific hours control exact bookable slots.')}
          ready={readiness.hasWorkingHours}
          href={`/dashboard/availability?businessId=${business.id}`}
          cta={t('dashboardBusinesses.setHours', 'Set hours')}
        />

        <BusinessSetupLinkCard
          title={t('dashboardBusinesses.marketplacePreview', 'Marketplace preview')}
          value={business.published ? t('dashboardBusinesses.live', 'Live') : t('dashboardBusinesses.hidden', 'Hidden')}
          helper={
            business.published
              ? t('dashboardBusinesses.previewLiveHelper', 'Preview how customers see this business on Mirëbook.')
              : readiness.bookingReady
                ? t('dashboardBusinesses.previewReadyHelper', 'Preview the public page before publishing.')
                : t('dashboardBusinesses.previewIncompleteHelper', 'Preview is available, but customers may not be able to book until setup is complete.')
          }
          ready={readiness.publicListingReady}
          href={`/explore/${business.id}`}
          cta={t('dashboardBusinesses.openPublicPage', 'Open public page')}
        />
      </div>

      <div className="grid-2 business-detail-grid">
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <p className="small muted">{t('dashboardBusinesses.profile.kicker', 'Customer-facing profile')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {t('dashboardBusinesses.profile.title', 'Profile details')}
          </h3>

          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardBusinesses.profile.body',
              'These details appear on the public Mirëbook marketplace, booking page and later in the mobile app view.'
            )}
          </p>

          <div className="business-profile-input-grid">
            <input
              placeholder={t('dashboardBusinesses.create.placeholder', 'Business name')}
              value={business.name || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'name', e.target.value)}
            />

            <input
              placeholder={t('dashboardBusinesses.profile.categoryPlaceholder', 'Category e.g. Barber, Dentist, Salon')}
              value={business.category || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'category', e.target.value)}
            />

            <input
              placeholder={t('dashboardBusinesses.profile.cityPlaceholder', 'City')}
              value={business.city || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'city', e.target.value)}
            />

            <input
              placeholder={t('dashboardBusinesses.profile.countryPlaceholder', 'Country')}
              value={business.country || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'country', e.target.value)}
            />

            <input
              placeholder={t('dashboardBusinesses.profile.addressPlaceholder', 'Address')}
              value={business.address || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'address', e.target.value)}
            />

            <input
              placeholder={t('common.phone', 'Phone')}
              value={business.phone || ''}
              onChange={(e) => updateLocalBusiness(business.id, 'phone', e.target.value)}
            />
          </div>

          <BusinessImageUpload
            business={business}
            uploadingBusinessId={uploadingBusinessId}
            onUpload={onUploadImage}
            onRemove={onRemoveImage}
          />

          <textarea
            placeholder={t('dashboardBusinesses.profile.descriptionPlaceholder', 'Description shown to customers')}
            value={business.description || ''}
            onChange={(e) => updateLocalBusiness(business.id, 'description', e.target.value)}
            rows={4}
            style={{ marginTop: '0.75rem' }}
          />
        </div>

        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <p className="small muted">{t('dashboardBusinesses.readiness.kicker', 'Readiness checklist')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {readiness.bookingReady
              ? t('dashboardBusinesses.readiness.readyTitle', 'Booking readiness complete')
              : t('dashboardBusinesses.readiness.notReadyTitle', 'Booking setup needs attention')}
          </h3>

          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardBusinesses.readiness.body',
              'Booking readiness controls whether customers can actually book. Profile details and images improve presentation but do not create appointment availability.'
            )}
          </p>

          <div style={{ marginTop: '0.8rem' }}>
            <BusinessReadinessRow
              label={t('dashboardBusinesses.readiness.profile', 'Profile details')}
              complete={readiness.profileComplete}
              helper={t('dashboardBusinesses.readiness.profileBody', 'Name, category, city, phone and description are filled in.')}
              incompleteLabel={t('dashboardBusinesses.readiness.addDetails', 'Add details')}
            />

            <BusinessReadinessRow
              label={t('dashboardBusinesses.readiness.image', 'Business image')}
              complete={readiness.hasBusinessImage}
              helper={readiness.hasBusinessImage
                ? t('dashboardBusinesses.readiness.imageReady', 'A marketplace image is uploaded.')
                : t('dashboardBusinesses.readiness.imageMissing', 'Recommended for a stronger marketplace profile; not required for booking readiness.')}
              incompleteLabel={t('dashboardBusinesses.readiness.recommended', 'Recommended')}
            />

            <BusinessReadinessRow
              label={t('dashboardBusinesses.readiness.services', 'Active services')}
              complete={readiness.hasActiveServices}
              helper={`${readiness.activeServices} ${t('dashboardBusinesses.readiness.activeServiceFound', 'active service')}${readiness.activeServices === 1 ? '' : 's'} ${t('dashboardBusinesses.readiness.found', 'found')}.`}
            />

            <BusinessReadinessRow
              label={t('dashboardBusinesses.readiness.staff', 'Active staff')}
              complete={readiness.hasActiveStaff}
              helper={`${readiness.activeStaff} ${t('dashboardBusinesses.readiness.activeStaffFound', 'active staff member')}${readiness.activeStaff === 1 ? '' : 's'} ${t('dashboardBusinesses.readiness.found', 'found')}.`}
            />

            <BusinessReadinessRow
              label={t('dashboardBusinesses.readiness.assignment', 'Staff-service assignment')}
              complete={readiness.hasStaffServiceAssignments}
              helper={`${readiness.staffServiceAssignments} ${t('dashboardBusinesses.readiness.assignmentFound', 'active staff-service assignment')}${readiness.staffServiceAssignments === 1 ? '' : 's'} ${t('dashboardBusinesses.readiness.found', 'found')}.`}
            />

            <BusinessReadinessRow
              label={t('dashboardBusinesses.readiness.hours', 'Working hours')}
              complete={readiness.hasWorkingHours}
              helper={`${readiness.workingDays} ${t('dashboardBusinesses.openDay', 'open day')}${readiness.workingDays === 1 ? '' : 's'} ${t('dashboardBusinesses.readiness.configured', 'configured')}.`}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', padding: '1rem' }}>
        <div className="booking-approval-row">
          <div style={{ flex: 1, minWidth: 240 }}>
            <p className="small muted">{t('dashboardSettings.approval.kicker', 'Booking approval')}</p>

            <h3 style={{ marginTop: '0.25rem' }}>
              {business.auto_accept_bookings ?? true
                ? t('dashboardBusinesses.autoAcceptBookings', 'Auto-accept customer bookings')
                : t('dashboardBusinesses.manualApproveBookings', 'Manually approve customer bookings')}
            </h3>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t(
                'dashboardBusinesses.bookingApprovalBody',
                'Auto-accept confirms available customer bookings instantly. Manual approval sends new bookings to Needs action for review.'
              )}
            </p>
          </div>

          <label className="btn btn-ghost booking-approval-toggle">
            <input
              type="checkbox"
              checked={business.auto_accept_bookings ?? true}
              onChange={(e) => updateLocalBusiness(business.id, 'auto_accept_bookings', e.target.checked)}
            />
            {t('dashboardBusinesses.autoAcceptNewBookings', 'Auto-accept new bookings')}
          </label>
        </div>
      </div>

      <div className="business-profile-actions">
        <button
          onClick={() => onSave(business)}
          className="btn btn-accent"
          disabled={isSaving}
        >
          {isSaving ? t('account.saving', 'Saving...') : t('dashboardBusinesses.saveSetup', 'Save setup')}
        </button>

        <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-ghost">
          {t('support.business.services', 'Services')}
        </Link>

        <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
          {t('support.business.staff', 'Staff')}
        </Link>

        <Link href={`/dashboard/availability?businessId=${business.id}`} className="btn btn-ghost">
          {t('dashboardBusinesses.workingHours', 'Working hours')}
        </Link>

        <Link href={`/dashboard/bookings?businessId=${business.id}`} className="btn btn-ghost">
          {t('support.business.bookings', 'Bookings')}
        </Link>

        <Link href="/dashboard/notifications" className="btn btn-ghost">
          {t('account.needsAction', 'Needs action')}
        </Link>

        <Link href={`/dashboard/settings?businessId=${business.id}`} className="btn btn-ghost">
          {t('nav.settings', 'Settings')}
        </Link>

        <Link href={`/dashboard/billing?businessId=${business.id}`} className="btn btn-ghost">
          {t('home.trust.billing', 'Billing')}
        </Link>

        <Link href="/support/business" className="btn btn-ghost">
          {t('nav.support', 'Support')}
        </Link>

        <Link href={`/explore/${business.id}`} className="btn btn-ghost">
          {t('account.publicPage', 'Public page')}
        </Link>
      </div>

      <style jsx>{`
        .business-profile-card-top {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr) minmax(170px, auto);
          gap: 1rem;
          align-items: start;
        }

        .business-status-pills,
        .business-profile-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.7rem;
        }

        .business-readiness-overview {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .business-readiness-panel {
          display: grid;
          gap: 0.35rem;
          padding: 0.9rem;
          border: 1px solid rgba(255,190,11,0.28);
          border-radius: var(--radius);
          background: rgba(255,190,11,0.06);
        }

        .business-readiness-panel.ready {
          border-color: rgba(45,212,191,0.28);
          background: rgba(45,212,191,0.06);
        }

        .business-readiness-panel p {
          margin-top: 0;
        }

        .business-profile-input-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .booking-approval-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .booking-approval-toggle {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        @media (max-width: 860px) {
          .business-profile-card-top {
            grid-template-columns: 1fr;
          }

          .business-profile-image-preview {
            min-height: 160px;
            height: auto;
          }

          .business-readiness-overview {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .business-profile-actions,
          .business-profile-actions :global(.btn),
          .business-profile-actions a,
          .business-profile-actions button,
          .booking-approval-toggle {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
