import Link from 'next/link'

type Props = {
  issues: string[]
}

export default function PublicBusinessSetupWarning({ issues }: Props) {
  if (issues.length === 0) return null

  return (
    <div className="card" style={{ borderColor: 'rgba(255,190,11,0.3)', background: 'rgba(255,190,11,0.06)', marginTop: '1rem' }}>
      <p className="small" style={{ color: 'var(--warning)' }}>Limited booking setup</p>
      <h3 style={{ marginTop: '0.25rem' }}>Some booking information is not ready yet</h3>

      <ul style={{ marginTop: '0.75rem', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>

      <div className="booking-action-row compact">
        <Link href="/support/customer" className="btn btn-ghost">
          Customer support
        </Link>

        <Link href="/explore" className="btn btn-ghost">
          Back to marketplace
        </Link>
      </div>
    </div>
  )
}