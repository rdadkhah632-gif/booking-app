import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import LanguageToggle from "./LanguageToggle";
import { NavProps } from "./navTypes";

export default function BusinessNav({ onLogout }: NavProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="business-nav-desktop-actions">
        <LanguageToggle />

        <Link href="/account" className="muted">
          {t("nav.account")}
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="btn btn-ghost"
          aria-label={t("nav.logout")}
        >
          {t("nav.logout")}
        </button>
      </div>

      <details className="business-nav-mobile-account">
        <summary>{t("nav.account")}</summary>
        <div className="business-nav-mobile-menu">
          <LanguageToggle />
          <Link href="/account" className="muted">
            {t("nav.account")}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-ghost"
            aria-label={t("nav.logout")}
          >
            {t("nav.logout")}
          </button>
        </div>
      </details>

      <style jsx>{`
        .business-nav-desktop-actions {
          display: contents;
        }

        .business-nav-mobile-account {
          display: none;
          position: relative;
        }

        @media (max-width: 540px) {
          .business-nav-desktop-actions {
            display: none;
          }

          .business-nav-mobile-account {
            display: block;
          }

          .business-nav-mobile-account summary {
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

          .business-nav-mobile-account summary::-webkit-details-marker {
            display: none;
          }

          .business-nav-mobile-account summary::after {
            content: "";
            width: 0.34rem;
            height: 0.34rem;
            border-right: 1.5px solid currentColor;
            border-bottom: 1.5px solid currentColor;
            transform: rotate(45deg) translateY(-1px);
            opacity: 0.75;
          }

          .business-nav-mobile-account[open] summary::after {
            transform: rotate(225deg) translateY(-1px);
          }

          .business-nav-mobile-menu {
            position: absolute;
            right: 0;
            top: calc(100% + 0.45rem);
            z-index: 60;
            width: min(13rem, calc(100vw - 1.5rem));
            display: grid;
            gap: 0.25rem;
            padding: 0.45rem;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: rgba(24, 23, 34, 0.98);
            box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.32);
          }

          .business-nav-mobile-account:not([open]) .business-nav-mobile-menu {
            display: none;
          }

          .business-nav-mobile-account[open] .business-nav-mobile-menu {
            display: grid;
          }

          .business-nav-mobile-menu :global(.language-switcher),
          .business-nav-mobile-menu :global(a),
          .business-nav-mobile-menu button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
