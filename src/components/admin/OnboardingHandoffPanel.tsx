import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import OutreachDraftPanel from "@/components/admin/OutreachDraftPanel";
import { Locale, translate } from "@/lib/i18n";

type AssetStatus =
  | "not_requested"
  | "requested"
  | "partial"
  | "received"
  | "reviewed";

type OnboardingHandoffPanelProps = {
  caseId: string;
  placeName: string;
  directoryPlaceId?: string;
  businessId?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  socialUrl?: string;
  preferredLanguage: Locale;
  listingInterest: boolean;
  bookingInterest: boolean;
  businessAppInterest: boolean;
  assetsStatus: AssetStatus;
  profileMediaPermission: boolean;
  marketingMediaPermission: boolean;
  permissionEvidenceComplete: boolean;
  claimLink?: string;
  publicPlaceLink?: string;
  businessEntryLink: string;
  businessProfileLink?: string;
  uiLocale: Locale;
  t: (key: string, fallback?: string) => string;
};

type ReadinessTone = "ready" | "attention" | "later";

type ReadinessItem = {
  label: string;
  detail: string;
  tone: ReadinessTone;
};

function fillTemplate(
  template: string,
  values: Record<"placeName" | "businessUrl", string>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function buildProspectMessage(
  language: Locale,
  placeName: string,
  businessUrl: string,
) {
  return fillTemplate(
    translate(
      language,
      "admin.onboarding.handoff.prospectMessage",
      "Hello. We would like to add {placeName} to Mirëbook so people can discover it more easily. You can create a Mirëbook Business account to review the profile and, whenever you choose, add services and manage bookings. Mirëbook Business is also coming to the App Store. If you are happy to share photos, we can feature the business in Mirëbook promotion at no cost; profile and promotional use are always agreed separately. Start here: {businessUrl}",
    ),
    { placeName, businessUrl },
  );
}

function checklistText(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export default function OnboardingHandoffPanel({
  caseId,
  placeName,
  directoryPlaceId = "",
  businessId = "",
  ownerEmail = "",
  ownerPhone = "",
  socialUrl = "",
  preferredLanguage,
  listingInterest,
  bookingInterest,
  businessAppInterest,
  assetsStatus,
  profileMediaPermission,
  marketingMediaPermission,
  permissionEvidenceComplete,
  claimLink = "",
  publicPlaceLink = "",
  businessEntryLink,
  businessProfileLink = "",
  uiLocale,
  t,
}: OnboardingHandoffPanelProps) {
  const [draftLanguage, setDraftLanguage] =
    useState<Locale>(preferredLanguage);
  const [prospectMessage, setProspectMessage] = useState(() =>
    buildProspectMessage(preferredLanguage, placeName, businessEntryLink),
  );
  const [copied, setCopied] = useState<"" | "message" | "checklist">("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const checklistRef = useRef<HTMLTextAreaElement>(null);

  const hasContactRoute = Boolean(ownerEmail || ownerPhone || socialUrl);
  const hasOwnerRoute = Boolean(directoryPlaceId || businessId);
  const hasAnyMediaPermission =
    profileMediaPermission || marketingMediaPermission;
  const assetsReady = ["received", "reviewed"].includes(assetsStatus);

  const readinessItems = useMemo<ReadinessItem[]>(
    () => [
      {
        label: t(
          "admin.onboarding.handoff.contactTitle",
          "Owner contact route",
        ),
        detail: hasContactRoute
          ? t(
              "admin.onboarding.handoff.contactReady",
              "At least one direct contact route is recorded.",
            )
          : t(
              "admin.onboarding.handoff.contactMissing",
              "Add an owner email, phone number or social profile before contact.",
            ),
        tone: hasContactRoute ? "ready" : "attention",
      },
      {
        label: t(
          "admin.onboarding.handoff.ownerRouteTitle",
          "Owner handoff route",
        ),
        detail: directoryPlaceId
          ? t(
              "admin.onboarding.handoff.ownerRouteClaim",
              "A secure claim link is ready for the reviewed place.",
            )
          : businessId
            ? t(
                "admin.onboarding.handoff.ownerRouteBusiness",
                "This case is already attached to a Mirëbook business.",
              )
            : t(
                "admin.onboarding.handoff.ownerRouteRegister",
                "Use Business registration until a reviewed place or business is attached.",
              ),
        tone: hasOwnerRoute ? "ready" : "later",
      },
      {
        label: t(
          "admin.onboarding.handoff.assetsTitle",
          "Profile materials",
        ),
        detail: assetsReady
          ? t(
              "admin.onboarding.handoff.assetsReady",
              "Profile materials have been received or reviewed.",
            )
          : t(
              "admin.onboarding.handoff.assetsMissing",
              "The profile pack still needs material from the business.",
            ),
        tone: assetsReady ? "ready" : "attention",
      },
      {
        label: t(
          "admin.onboarding.handoff.permissionTitle",
          "Media permission",
        ),
        detail: hasAnyMediaPermission
          ? permissionEvidenceComplete
            ? t(
                "admin.onboarding.handoff.permissionReady",
                "The selected media uses have complete permission evidence.",
              )
            : t(
                "admin.onboarding.handoff.permissionIncomplete",
                "Complete the permission evidence before using any supplied media.",
              )
          : t(
              "admin.onboarding.handoff.permissionNone",
              "No profile or promotional media use is currently approved.",
            ),
        tone:
          hasAnyMediaPermission && permissionEvidenceComplete
            ? "ready"
            : hasAnyMediaPermission
              ? "attention"
              : "later",
      },
    ],
    [
      assetsReady,
      businessId,
      directoryPlaceId,
      hasAnyMediaPermission,
      hasContactRoute,
      hasOwnerRoute,
      permissionEvidenceComplete,
      t,
    ],
  );

  const requestItems = useMemo(() => {
    const items = [
      t(
        "admin.onboarding.handoff.request.contact",
        "Exact business address and best public contact details",
      ),
    ];
    if (listingInterest) {
      items.push(
        t(
          "admin.onboarding.handoff.request.profile",
          "A short business description and three to five clear photos",
        ),
      );
    }
    if (bookingInterest) {
      items.push(
        t(
          "admin.onboarding.handoff.request.services",
          "Services with prices and durations",
        ),
        t(
          "admin.onboarding.handoff.request.schedule",
          "Staff names, working hours and booking preference",
        ),
      );
    }
    if (businessAppInterest) {
      items.push(
        t(
          "admin.onboarding.handoff.request.ownerAccount",
          "The owner email that will manage the Mirëbook Business account",
        ),
      );
    }
    items.push(
      t(
        "admin.onboarding.handoff.request.permissions",
        "Separate confirmation for profile-photo and Mirëbook-promotion use",
      ),
    );
    return items;
  }, [businessAppInterest, bookingInterest, listingInterest, t]);

  const requestText = checklistText(requestItems);

  useEffect(() => {
    setDraftLanguage(preferredLanguage);
    setProspectMessage(
      buildProspectMessage(preferredLanguage, placeName, businessEntryLink),
    );
    setCopied("");
  }, [businessEntryLink, placeName, preferredLanguage]);

  async function copyValue(
    value: string,
    target: "message" | "checklist",
    fallbackRef: {
      current: HTMLTextAreaElement | null;
    },
  ) {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(value);
    } catch {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
    setCopied(target);
  }

  function changeDraftLanguage(language: Locale) {
    setDraftLanguage(language);
    setProspectMessage(
      buildProspectMessage(language, placeName, businessEntryLink),
    );
    setCopied("");
  }

  return (
    <section className="handoff-pack" aria-labelledby={`handoff-${caseId}`}>
      <header className="handoff-header">
        <div>
          <h3 id={`handoff-${caseId}`}>
            {t("admin.onboarding.handoff.title", "Owner handoff pack")}
          </h3>
          <p>
            {t(
              "admin.onboarding.handoff.body",
              "Prepare the next owner conversation without sending, registering or publishing anything automatically.",
            )}
          </p>
        </div>
        <span>
          <ShieldCheck aria-hidden="true" />
          {t("admin.onboarding.handoff.manual", "Manual only")}
        </span>
      </header>

      <div className="handoff-readiness">
        {readinessItems.map((item) => (
          <div key={item.label} data-tone={item.tone}>
            <span aria-hidden="true">
              {item.tone === "ready" ? <Check /> : <UserRound />}
            </span>
            <p>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </p>
          </div>
        ))}
      </div>

      <div className="handoff-links">
        {claimLink ? (
          <a className="btn btn-ghost" href={claimLink} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            {t("admin.onboarding.handoff.openClaim", "Open claim path")}
          </a>
        ) : (
          <a
            className="btn btn-ghost"
            href={businessEntryLink}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" />
            {t(
              "admin.onboarding.handoff.openRegistration",
              "Open Business registration",
            )}
          </a>
        )}
        {publicPlaceLink && (
          <a
            className="btn btn-ghost"
            href={publicPlaceLink}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" />
            {t("admin.onboarding.handoff.openListing", "Open public listing")}
          </a>
        )}
        {businessProfileLink && (
          <a className="btn btn-ghost" href={businessProfileLink}>
            <ExternalLink aria-hidden="true" />
            {t(
              "admin.onboarding.handoff.openBusiness",
              "Open linked business",
            )}
          </a>
        )}
      </div>

      <section className="request-pack">
        <header>
          <ListChecks aria-hidden="true" />
          <div>
            <h4>
              {t(
                "admin.onboarding.handoff.requestTitle",
                "What to request next",
              )}
            </h4>
            <p>
              {t(
                "admin.onboarding.handoff.requestBody",
                "This list follows the goals selected for the case.",
              )}
            </p>
          </div>
        </header>
        <div className="request-grid">
          <ul>
            {requestItems.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="request-copy">
            <textarea
              ref={checklistRef}
              readOnly
              rows={Math.max(4, requestItems.length)}
              value={requestText}
              aria-label={t(
                "admin.onboarding.handoff.requestCopyLabel",
                "Setup request checklist",
              )}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                copyValue(requestText, "checklist", checklistRef)
              }
            >
              {copied === "checklist" ? (
                <Check aria-hidden="true" />
              ) : (
                <Clipboard aria-hidden="true" />
              )}
              {copied === "checklist"
                ? t("admin.outreach.copied", "Copied")
                : t(
                    "admin.onboarding.handoff.copyChecklist",
                    "Copy checklist",
                  )}
            </button>
          </div>
        </div>
      </section>

      {directoryPlaceId && claimLink && publicPlaceLink ? (
        <OutreachDraftPanel
          key={`${caseId}:${directoryPlaceId}:${placeName}:${preferredLanguage}`}
          candidateId={caseId}
          placeName={placeName}
          email={ownerEmail}
          claimLink={claimLink}
          publicPlaceLink={publicPlaceLink}
          preferredChannel={socialUrl ? "social" : ownerEmail ? "email" : "other"}
          uiLocale={preferredLanguage}
          t={t}
        />
      ) : (
        <section className="prospect-draft">
          <header>
            <ImageIcon aria-hidden="true" />
            <div>
              <h4>
                {t(
                  "admin.onboarding.handoff.prospectTitle",
                  "Business introduction",
                )}
              </h4>
              <p>
                {t(
                  "admin.onboarding.handoff.prospectBody",
                  "Use this concise draft when there is no reviewed place to claim yet.",
                )}
              </p>
            </div>
          </header>
          <label>
            <span>
              {t("admin.outreach.template.languageLabel", "Draft language")}
            </span>
            <select
              value={draftLanguage}
              onChange={(event) =>
                changeDraftLanguage(event.target.value as Locale)
              }
            >
              <option value="sq">{t("language.albanian", "Albanian")}</option>
              <option value="en">{t("language.english", "English")}</option>
            </select>
          </label>
          <textarea
            ref={messageRef}
            rows={8}
            value={prospectMessage}
            onChange={(event) => {
              setProspectMessage(event.target.value);
              setCopied("");
            }}
          />
          <div>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() =>
                copyValue(prospectMessage, "message", messageRef)
              }
            >
              {copied === "message" ? (
                <Check aria-hidden="true" />
              ) : (
                <Clipboard aria-hidden="true" />
              )}
              {copied === "message"
                ? t("admin.outreach.copied", "Copied")
                : t("admin.outreach.template.copyMessage", "Copy message")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => changeDraftLanguage(draftLanguage)}
            >
              {t("admin.outreach.template.reset", "Reset draft")}
            </button>
          </div>
        </section>
      )}

      <style jsx>{`
        .handoff-pack {
          border-top: 1px solid var(--border);
          display: grid;
        }

        .handoff-header {
          padding: 1rem;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .handoff-header > div,
        .request-pack header > div,
        .prospect-draft header > div {
          min-width: 0;
          display: grid;
          gap: 0.25rem;
        }

        .handoff-header h3,
        .request-pack h4,
        .prospect-draft h4 {
          font-size: 1rem;
        }

        .handoff-header p,
        .request-pack p,
        .prospect-draft p {
          color: var(--muted);
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .handoff-header > span {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--success);
          font-size: 0.75rem;
          font-weight: 800;
        }

        .handoff-header svg,
        .handoff-links :global(svg),
        .request-pack svg,
        .prospect-draft svg {
          width: 1rem;
          height: 1rem;
        }

        .handoff-readiness {
          padding: 0 1rem 1rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
        }

        .handoff-readiness > div {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.6rem;
          align-items: start;
          padding: 0.7rem;
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) * 0.65);
          background: var(--surface-2);
        }

        .handoff-readiness > div > span {
          width: 1.8rem;
          height: 1.8rem;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: var(--muted);
          background: var(--surface);
        }

        .handoff-readiness > div[data-tone="ready"] > span {
          color: var(--success);
          background: var(--success-dim);
        }

        .handoff-readiness > div[data-tone="attention"] > span {
          color: var(--warning);
          background: var(--warning-dim);
        }

        .handoff-readiness p {
          min-width: 0;
          display: grid;
          gap: 0.2rem;
        }

        .handoff-readiness strong {
          font-size: 0.85rem;
        }

        .handoff-readiness small {
          color: var(--muted);
          font-size: 0.76rem;
          line-height: 1.4;
        }

        .handoff-links {
          padding: 0 1rem 1rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .request-pack,
        .prospect-draft {
          padding: 1rem;
          border-top: 1px solid var(--border);
          display: grid;
          gap: 0.8rem;
        }

        .request-pack header,
        .prospect-draft header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.6rem;
          align-items: start;
        }

        .request-pack header > svg,
        .prospect-draft header > svg {
          color: var(--accent);
          margin-top: 0.05rem;
        }

        .request-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(15rem, 0.8fr);
          gap: 1rem;
          align-items: start;
        }

        .request-grid ul {
          list-style: none;
          display: grid;
          gap: 0.55rem;
          margin: 0;
          padding: 0;
        }

        .request-grid li {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.5rem;
          align-items: start;
          color: var(--text);
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .request-grid li svg {
          color: var(--success);
          margin-top: 0.1rem;
        }

        .request-copy {
          display: grid;
          gap: 0.5rem;
        }

        .request-copy textarea,
        .prospect-draft textarea,
        .prospect-draft select {
          width: 100%;
          min-width: 0;
        }

        .request-copy textarea {
          min-height: 7.5rem;
          color: var(--muted);
          font-size: 0.76rem;
          line-height: 1.45;
          resize: vertical;
        }

        .request-copy :global(.btn) {
          justify-self: start;
        }

        .prospect-draft > label {
          display: grid;
          gap: 0.35rem;
          max-width: 15rem;
        }

        .prospect-draft > label > span {
          color: var(--muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .prospect-draft textarea {
          min-height: 10rem;
          resize: vertical;
          line-height: 1.45;
        }

        .prospect-draft > div:last-child {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        @media (max-width: 760px) {
          .handoff-readiness,
          .request-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 430px) {
          .handoff-header {
            display: grid;
          }

          .handoff-header,
          .request-pack,
          .prospect-draft {
            padding: 0.78rem;
          }

          .handoff-readiness,
          .handoff-links {
            padding-right: 0.78rem;
            padding-left: 0.78rem;
          }

          .handoff-links :global(.btn),
          .request-copy :global(.btn),
          .prospect-draft :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
