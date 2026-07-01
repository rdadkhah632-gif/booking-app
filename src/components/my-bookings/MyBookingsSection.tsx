import { ReactNode, RefObject } from 'react'

type Props = {
  sectionRef: RefObject<HTMLElement | null>
  id: string
  kicker?: string
  title: string
  body?: string
  children: ReactNode
  action?: ReactNode
}

export default function MyBookingsSection({
  sectionRef,
  id,
  kicker,
  title,
  children,
  action
}: Props) {
  return (
    <section ref={sectionRef} id={id} className="my-bookings-section">
      <div>
        {kicker && <p className="small muted">{kicker}</p>}
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
        {action}
      </div>

      {children}
    </section>
  )
}
