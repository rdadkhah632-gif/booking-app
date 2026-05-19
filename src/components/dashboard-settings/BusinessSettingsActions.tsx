import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardSettingsTypes'

type Props = {
  selectedBusiness: Business | null
  publicHref: string
  saving: boolean
  onSave: () => void
}

export default function BusinessSettingsActions({
  selectedBusiness,
  publicHref,
  saving,
  onSave
}: Props) {
  const { t } = useI18n()

  return (
    <div className="settings-final-actions">
      <Link href="/dashboard/businesses" className="btn btn-ghost">
        {t('dashboardSettings.backToSetup', 'Back to setup hub')}
      </Link>

      {selectedBusiness && (
        <Link href={publicHref} className="btn btn-ghost">
          {t('account.publicPage', 'Public page')}
        </Link>
      )}

      <Link href="/dashboard/notifications" className="btn btn-ghost">
        {t('account.needsAction', 'Needs action')}
      </Link>

      <button className="btn btn-accent" onClick={onSave} disabled={saving || !selectedBusiness}>
        {saving ? t('account.saving', 'Saving...') : t('dashboardSettings.saveMirebookSettings', 'Save Mirëbook settings')}
      </button>
    </div>
  )
}