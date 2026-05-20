import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import LanguageToggle from './LanguageToggle'
import { NavProps } from './navTypes'

export default function BusinessNav({ onLogout }: NavProps) {
  const { t } = useI18n()

  return (
    <>
      <LanguageToggle />

      <Link href="/account" className="muted">
        {t('nav.account')}
      </Link>

      <button onClick={onLogout} className="btn btn-ghost">
        {t('nav.logout')}
      </button>
    </>
  )
}