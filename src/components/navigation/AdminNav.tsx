import Link from "next/link";
import { NavProps, notificationLabel } from "./navTypes";

export default function AdminNav({
  notificationCount,
  onLogout,
  t = (key, fallback) => fallback || key,
}: NavProps) {
  const navItems = (
    <>
      <Link href="/admin" className="btn btn-accent">
        {t("nav.operator", "Operator")}
      </Link>

      <Link href="/admin/businesses" className="muted">
        {t("nav.businesses", "Businesses")}
      </Link>

      <Link href="/admin/users" className="muted">
        {t("nav.users", "Users")}
      </Link>

      <Link href="/admin/directory" className="muted">
        {t("nav.directory", "Directory")}
      </Link>

      <Link href="/admin/outreach" className="muted">
        {t("nav.outreach", "Outreach")}
      </Link>

      <Link href="/admin/directory-claims" className="muted">
        {t("nav.claims", "Claims")}
      </Link>

      <Link
        href="/admin/notifications"
        className={notificationCount > 0 ? "btn btn-accent" : "muted"}
      >
        {notificationLabel("admin", notificationCount, t)}
      </Link>

      <Link href="/admin/support" className="muted">
        {t("nav.support", "Support")}
      </Link>

      <Link href="/account" className="muted">
        {t("nav.account", "Account")}
      </Link>

      <button
        type="button"
        onClick={onLogout}
        className="btn btn-ghost"
        aria-label={t("auth.logout", "Log out")}
      >
        {t("auth.logout", "Log out")}
      </button>
    </>
  );

  return (
    <>
      <div className="admin-nav-desktop">{navItems}</div>

      <details className="admin-nav-mobile">
        <summary>{t("nav.operatorMenu", "Operator menu")}</summary>
        <div className="admin-nav-mobile-menu">{navItems}</div>
      </details>

      <style jsx>{`
        .admin-nav-desktop {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 1rem;
        }

        .admin-nav-mobile {
          display: none;
          position: relative;
        }

        @media (max-width: 540px) {
          .admin-nav-desktop {
            display: none;
          }

          .admin-nav-mobile {
            display: block;
          }

          .admin-nav-mobile summary {
            min-height: 2.25rem;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.48rem 0.72rem;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: var(--surface-2);
            color: var(--text);
            cursor: pointer;
            font-weight: 800;
            list-style: none;
            white-space: nowrap;
          }

          .admin-nav-mobile summary::-webkit-details-marker {
            display: none;
          }

          .admin-nav-mobile summary::after {
            content: "";
            width: 0.34rem;
            height: 0.34rem;
            border-right: 1.5px solid currentColor;
            border-bottom: 1.5px solid currentColor;
            transform: rotate(45deg) translateY(-1px);
            opacity: 0.75;
          }

          .admin-nav-mobile[open] summary::after {
            transform: rotate(225deg) translateY(-1px);
          }

          .admin-nav-mobile-menu {
            position: absolute;
            right: 0;
            top: calc(100% + 0.45rem);
            z-index: 60;
            width: min(14rem, calc(100vw - 1.5rem));
            display: grid;
            gap: 0.25rem;
            padding: 0.45rem;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: rgba(24, 23, 34, 0.98);
            box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.32);
          }

          .admin-nav-mobile:not([open]) .admin-nav-mobile-menu {
            display: none;
          }

          .admin-nav-mobile[open] .admin-nav-mobile-menu {
            display: grid;
          }

          .admin-nav-mobile-menu :global(a),
          .admin-nav-mobile-menu button {
            width: 100%;
            min-width: 0;
            justify-content: flex-start;
            white-space: normal;
          }
        }
      `}</style>
    </>
  );
}
