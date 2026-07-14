import { useI18n } from "@/lib/useI18n";

export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t("language.selector", "Language")}
    >
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        onClick={() => setLocale("en")}
        aria-label={`${t("language.selector", "Language")}: ${t("language.english", "English")}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>

      <span aria-hidden="true">/</span>

      <button
        type="button"
        className={locale === "sq" ? "active" : ""}
        onClick={() => setLocale("sq")}
        aria-label={`${t("language.selector", "Language")}: ${t("language.albanian", "Albanian")}`}
        aria-pressed={locale === "sq"}
      >
        SQ
      </button>

      <style jsx>{`
        .language-switcher {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.22rem 0.35rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
          flex-shrink: 0;
        }

        .language-switcher button {
          border: 0;
          background: transparent;
          color: var(--text-muted);
          font-weight: 800;
          font-size: 0.78rem;
          padding: 0.25rem 0.42rem;
          border-radius: 999px;
          cursor: pointer;
        }

        .language-switcher button.active {
          background: var(--accent);
          color: var(--bg);
        }

        .language-switcher span {
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        @media (max-width: 520px) {
          .language-switcher {
            gap: 0.18rem;
            padding: 0.18rem 0.25rem;
          }

          .language-switcher button {
            padding: 0.22rem 0.34rem;
            font-size: 0.72rem;
          }
        }
      `}</style>
    </div>
  );
}
