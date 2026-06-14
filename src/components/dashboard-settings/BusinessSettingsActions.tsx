import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardSettingsTypes'

type Props = {
  selectedBusiness: Business | null
  saving: boolean
  onSave: () => void
}

export default function BusinessSettingsActions({
  selectedBusiness,
  saving,
  onSave
}: Props) {
  const { t } = useI18n()

  return (
    <div className="settings-final-actions">
      <button className="btn btn-accent" onClick={onSave} disabled={saving || !selectedBusiness}>
        {saving ? t('account.saving', 'Saving...') : t('dashboardSettings.saveMirebookSettings', 'Save Mirëbook settings')}
      </button>

      <style jsx>{`
        .settings-final-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border);
        }

        @media (max-width: 640px) {
          .settings-final-actions,
          .settings-final-actions :global(.btn) {
            width: 100%;
          }

          .settings-final-actions :global(.btn) {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
