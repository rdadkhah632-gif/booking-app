type Props = {
  label: string
  tone: 'success' | 'warning' | 'accent' | 'muted'
}

export default function ServiceStatusBadge({ label, tone }: Props) {
  const styles = {
    success: { background: 'rgba(45,212,191,0.12)', color: 'var(--success)' },
    warning: { background: 'rgba(255,190,11,0.12)', color: 'var(--warning)' },
    accent: { background: 'rgba(255,107,53,0.12)', color: 'var(--accent)' },
    muted: { background: 'var(--surface-2)', color: 'var(--text-muted)' }
  }

  return (
    <span
      className="small"
      style={{
        ...styles[tone],
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </span>
  )
}