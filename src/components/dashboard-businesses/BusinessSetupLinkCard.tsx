import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  title: string
  value: string
  helper: string
  ready: boolean
  href: string
  cta: string
}

export default function BusinessSetupLinkCard({
  title,
  value,
  helper,
  ready,
  href,
  cta
}: Props) {
  const { t } = useI18n()

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
          {ready
            ? t('dashboardBusinesses.ready', 'Ready')
            : t('dashboardBusinesses.setupNeeded', 'Setup needed')}
        </span>
      </div>

      <p className="small muted">{helper}</p>

      <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
        {cta} →
      </span>

      <style jsx>{`
        .business-setup-link-card {
          text-decoration: none;
          color: var(--text);
        }

        .business-setup-link-card:hover {
          transform: translateY(-1px);
          border-color: rgba(255,107,53,0.35);
        }
      `}</style>
    </Link>
  )
}