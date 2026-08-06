import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { getCustomerAppUrl } from "@/lib/appUrls";
import { Locale, translate } from "@/lib/i18n";
import { useI18n } from "@/lib/useI18n";

type CopyTarget = "" | "request" | "permission";

type DirectoryPhotoRequestKitProps = {
  placeId: string;
  placeName: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  isPilot: boolean;
};

function fillTemplate(
  template: string,
  values: Record<"name" | "url", string>,
) {
  return template.replace(
    /\{(name|url)\}/g,
    (_, key: "name" | "url") => values[key] || "",
  );
}

function safeWebsite(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function phoneHref(value?: string | null) {
  const compact = value?.replace(/[^+\d]/g, "") || "";
  return compact ? `tel:${compact}` : "";
}

function safeEmail(value?: string | null) {
  const candidate = value?.trim() || "";
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate)
    ? candidate
    : "";
}

export default function DirectoryPhotoRequestKit({
  placeId,
  placeName,
  phone,
  email,
  website,
  isPilot,
}: DirectoryPhotoRequestKitProps) {
  const { locale, t } = useI18n();
  const [language, setLanguage] = useState<Locale>(locale);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget>("");
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const permissionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLanguage(locale);
    setCopiedTarget("");
  }, [locale, placeId]);

  const publicPlaceUrl = useMemo(() => {
    const configuredUrl = getCustomerAppUrl(`/places/${placeId}`);
    return configuredUrl.startsWith("http")
      ? configuredUrl
      : `https://mirebook.com${configuredUrl}`;
  }, [placeId]);

  const request = useMemo(
    () =>
      fillTemplate(
        translate(
          language,
          "admin.directory.acquisition.requestTemplate",
          "Hello {name}, Mirëbook is building a reviewed guide to places and services across Albania. Your public listing currently appears here: {url}. We would like to replace its category illustration with real photos supplied by you. Please send 2–4 landscape photos of your premises, team or service that you own or have permission to share, ideally 1600×900 or larger. Please also reply with the permission statement below. This does not create or claim a business account and does not make the listing bookable. You can request removal of the photos at any time. Thank you, Mirëbook.",
        ),
        { name: placeName, url: publicPlaceUrl },
      ),
    [language, placeName, publicPlaceUrl],
  );

  const permission = useMemo(
    () =>
      fillTemplate(
        translate(
          language,
          "admin.directory.acquisition.permissionTemplate",
          "I confirm that I own these images or have authority to grant permission. I give Mirëbook non-exclusive, royalty-free permission to display and crop them on Mirëbook websites, apps, social media and launch marketing for {name}. I can request their removal. I understand this does not create a business account or make the place bookable.",
        ),
        { name: placeName, url: publicPlaceUrl },
      ),
    [language, placeName, publicPlaceUrl],
  );

  const validWebsite = safeWebsite(website);
  const validPhoneHref = phoneHref(phone);
  const validEmail = safeEmail(email);

  async function copyValue(
    value: string,
    target: Exclude<CopyTarget, "">,
    fallbackRef: { current: HTMLTextAreaElement | null },
  ) {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(value);
    } catch {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
    setCopiedTarget(target);
  }

  return (
    <section
      className="directory-photo-request"
      aria-labelledby={`directory-photo-request-${placeId}`}
    >
      <header className="directory-photo-request-header">
        <div>
          <p className="small muted">
            {t("admin.directory.acquisition.kicker", "Rights-safe sourcing")}
          </p>
          <h3 id={`directory-photo-request-${placeId}`}>
            {t("admin.directory.acquisition.title", "Photo request kit")}
          </h3>
          <p>
            {t(
              "admin.directory.acquisition.body",
              "Prepare a bilingual request for real owner-supplied imagery. Fallback artwork stays public until the photo and permission evidence are reviewed.",
            )}
          </p>
        </div>
        <div className="directory-photo-request-badges">
          {isPilot && (
            <span className="directory-photo-pilot-badge">
              {t("admin.directory.acquisition.pilot", "Priority photo pilot")}
            </span>
          )}
          <span className="directory-photo-manual-badge">
            <ShieldCheck size={15} aria-hidden="true" />
            {t("admin.directory.acquisition.manual", "Manual contact only")}
          </span>
        </div>
      </header>

      <div
        className="directory-photo-specs"
        aria-label={t(
          "admin.directory.acquisition.specsLabel",
          "Requested photo specification",
        )}
      >
        <span>
          {t("admin.directory.acquisition.spec.count", "2–4 landscape photos")}
        </span>
        <span>
          {t("admin.directory.acquisition.spec.size", "1600×900 minimum")}
        </span>
        <span>
          {t("admin.directory.acquisition.spec.format", "JPG, PNG or WEBP")}
        </span>
        <span>
          {t(
            "admin.directory.acquisition.spec.subject",
            "Real premises, team or service",
          )}
        </span>
      </div>

      <div className="directory-photo-contact-row">
        <strong>
          {t("admin.directory.acquisition.contact", "Available contact routes")}
        </strong>
        <div>
          {validEmail && (
            <a
              href={`mailto:${validEmail}`}
              className="directory-photo-contact"
            >
              <Mail size={15} aria-hidden="true" />
              {validEmail}
            </a>
          )}
          {validPhoneHref && phone && (
            <a href={validPhoneHref} className="directory-photo-contact">
              <Phone size={15} aria-hidden="true" />
              {phone}
            </a>
          )}
          {validWebsite && (
            <a
              href={validWebsite}
              target="_blank"
              rel="noreferrer"
              className="directory-photo-contact"
            >
              <Globe2 size={15} aria-hidden="true" />
              {t("admin.directory.acquisition.website", "Website")}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
          {!validEmail && !validPhoneHref && !validWebsite && (
            <span className="muted">
              {t(
                "admin.directory.acquisition.noContact",
                "No direct contact route is recorded.",
              )}
            </span>
          )}
        </div>
      </div>

      <div
        className="directory-photo-language"
        role="group"
        aria-label={t(
          "admin.directory.acquisition.language",
          "Request language",
        )}
      >
        <button
          type="button"
          className={language === "en" ? "is-active" : ""}
          aria-pressed={language === "en"}
          onClick={() => {
            setLanguage("en");
            setCopiedTarget("");
          }}
        >
          EN
        </button>
        <button
          type="button"
          className={language === "sq" ? "is-active" : ""}
          aria-pressed={language === "sq"}
          onClick={() => {
            setLanguage("sq");
            setCopiedTarget("");
          }}
        >
          SQ
        </button>
      </div>

      <div className="directory-photo-copy-grid">
        <label>
          <span>
            {t("admin.directory.acquisition.request", "Photo request")}
          </span>
          <textarea ref={requestRef} rows={8} readOnly value={request} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void copyValue(request, "request", requestRef)}
          >
            {copiedTarget === "request" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copiedTarget === "request"
              ? t("admin.directory.acquisition.copied", "Copied")
              : t("admin.directory.acquisition.copyRequest", "Copy request")}
          </button>
        </label>

        <label>
          <span>
            {t(
              "admin.directory.acquisition.permission",
              "Permission statement",
            )}
          </span>
          <textarea ref={permissionRef} rows={8} readOnly value={permission} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              void copyValue(permission, "permission", permissionRef)
            }
          >
            {copiedTarget === "permission" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copiedTarget === "permission"
              ? t("admin.directory.acquisition.copied", "Copied")
              : t(
                  "admin.directory.acquisition.copyPermission",
                  "Copy permission",
                )}
          </button>
        </label>
      </div>

      <p className="directory-photo-safety">
        {t(
          "admin.directory.acquisition.safety",
          "Preparing or copying this kit records nothing and sends nothing. Contact happens outside Mirëbook; upload only after the supplier and permission evidence have been checked.",
        )}
      </p>

      <style jsx>{`
        .directory-photo-request {
          display: grid;
          gap: 0.9rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .directory-photo-request-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .directory-photo-request-header h3,
        .directory-photo-request-header p {
          margin: 0;
        }

        .directory-photo-request-header > div:first-child {
          display: grid;
          gap: 0.3rem;
          max-width: 720px;
        }

        .directory-photo-request-badges,
        .directory-photo-contact-row > div,
        .directory-photo-specs {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .directory-photo-pilot-badge,
        .directory-photo-manual-badge,
        .directory-photo-specs span,
        .directory-photo-contact {
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.55rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .directory-photo-pilot-badge {
          border-color: rgba(15, 143, 131, 0.38);
          background: rgba(15, 143, 131, 0.1);
          color: var(--success);
        }

        .directory-photo-manual-badge {
          color: var(--text-muted);
        }

        .directory-photo-specs {
          align-items: stretch;
        }

        .directory-photo-specs span {
          background: var(--surface-2);
          color: var(--text-muted);
          font-weight: 650;
        }

        .directory-photo-contact-row {
          display: grid;
          gap: 0.45rem;
        }

        .directory-photo-contact-row strong {
          font-size: 0.8rem;
        }

        .directory-photo-contact {
          min-height: 44px;
          color: var(--text);
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .directory-photo-contact:hover,
        .directory-photo-contact:focus-visible {
          border-color: var(--border-2);
          background: var(--surface-2);
        }

        .directory-photo-language {
          width: fit-content;
          display: grid;
          grid-template-columns: repeat(2, minmax(52px, 1fr));
          padding: 3px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface-2);
        }

        .directory-photo-language button {
          min-width: 52px;
          min-height: 44px;
          padding: 0.4rem 0.7rem;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: var(--text-muted);
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }

        .directory-photo-language button.is-active {
          background: var(--surface);
          color: var(--text);
          box-shadow: 0 0 0 1px var(--border-2);
        }

        .directory-photo-copy-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .directory-photo-copy-grid label {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 0.45rem;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .directory-photo-copy-grid textarea {
          width: 100%;
          min-height: 188px;
          resize: vertical;
          color: var(--text);
          line-height: 1.5;
        }

        .directory-photo-copy-grid :global(.btn) {
          width: fit-content;
          min-height: 44px;
        }

        .directory-photo-safety {
          margin: 0;
          padding-left: 0.75rem;
          border-left: 3px solid rgba(15, 143, 131, 0.5);
          color: var(--text-muted);
          font-size: 0.78rem;
          line-height: 1.5;
        }

        @media (max-width: 720px) {
          .directory-photo-request-header,
          .directory-photo-copy-grid {
            grid-template-columns: 1fr;
          }

          .directory-photo-request-header {
            display: grid;
          }

          .directory-photo-request-badges {
            justify-content: flex-start;
          }

          .directory-photo-copy-grid :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
