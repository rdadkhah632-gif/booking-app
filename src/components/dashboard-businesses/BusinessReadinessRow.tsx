import { useI18n } from '@/lib/useI18n'

type Props = {
  label: string
  complete: boolean
  helper: string
  incompleteLabel?: string
}

export default function BusinessReadinessRow({
  label,
  complete,
  helper,
  incompleteLabel
}: Props) {
  const { t } = useI18n()

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
        {complete
          ? t('dashboardBusinesses.ready', 'Ready')
          : incompleteLabel || t('dashboardBusinesses.needsWork', 'Needs work')}
      </span>

      <style jsx>{`
        .business-readiness-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }

        @media (max-width: 640px) {
          .business-readiness-row {
            display: grid;
          }
        }
      `}</style>
    </div>
  )
}
