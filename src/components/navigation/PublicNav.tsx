import Link from 'next/link'
import LanguageToggle from './LanguageToggle'

export default function PublicNav() {
  return (
    <>
      <Link href="/explore" className="muted">
        Explore
      </Link>

      <Link href="/support" className="muted nav-wide-only">
        Support
      </Link>

      <LanguageToggle />

      <Link href="/login" className="muted">
        Login
      </Link>

      <Link href="/register" className="btn btn-accent">
        Create account
      </Link>
    </>
  )
}