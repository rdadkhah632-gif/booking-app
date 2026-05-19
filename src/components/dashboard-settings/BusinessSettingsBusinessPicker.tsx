import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardSettingsTypes'

type Props = {
  businesses: Business[]
  selectedBusinessId: string
  onSelectBusiness: (businessId: string) => void
}

export default function BusinessSettingsBusinessPicker({
  businesses,
  selectedBusinessId,
  onSelectBusiness
}: Props) {
  const { t } = useI18n()

  if (businesses.length <= 1) return null

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="settings-picker-header">
        <div>
          <p className="small muted">
            {t('dashboardSettings.businessPicker.kicker', 'Manage another business')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.businessPicker.title', 'Choose business settings')}
          </h2>

          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.businessPicker.body', 'Each business has its own booking rules, region settings and customer policy wording.')}
          </p>
        </div>

        <Link href="/dashboard/businesses" className="btn btn-ghost">
          {t('dashboardSettings.manageBusinesses', 'Manage businesses')}
        </Link>
      </div>

      <div className="settings-business-list">
        {businesses.map((business) => (
          <button
            key={business.id}
            type="button"
            className={
              business.id === selectedBusinessId
                ? 'settings-business-card settings-business-card-active'
                : 'settings-business-card'
            }
            onClick={() => onSelectBusiness(business.id)}
          >
            <strong>{business.name}</strong>
            <span>
              {business.published
                ? t('support.business.status.published', 'published')
                : t('support.business.status.draft', 'draft')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}