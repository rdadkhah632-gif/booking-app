import { useRef, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Locale, translate } from "@/lib/i18n";

type TemplateChannel =
  | "email"
  | "phone"
  | "social"
  | "website"
  | "in_person"
  | "other";

type TemplateDraft = {
  subject: string;
  message: string;
};

type CopyTarget = "" | "subject" | "message" | "claim";

type OutreachDraftPanelProps = {
  candidateId: string;
  placeName: string;
  email?: string | null;
  claimLink: string;
  publicPlaceLink: string;
  preferredChannel: TemplateChannel;
  uiLocale: Locale;
  t: (key: string, fallback?: string) => string;
};

const TEMPLATE_CHANNELS: TemplateChannel[] = [
  "email",
  "social",
  "website",
  "phone",
  "in_person",
  "other",
];

function fillTemplate(
  template: string,
  values: Record<"placeName" | "claimUrl" | "publicUrl", string>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function buildDraft(
  language: Locale,
  channel: TemplateChannel,
  values: Record<"placeName" | "claimUrl" | "publicUrl", string>,
  includeEarlyPartnerOffer: boolean,
): TemplateDraft {
  const subject = fillTemplate(
    translate(
      language,
      "admin.outreach.template.email.subject",
      "Claim and manage {placeName} on Mirëbook",
    ),
    values,
  );

  const messageKeys: Record<TemplateChannel, [string, string]> = {
    email: [
      "admin.outreach.template.email.message",
      "Hello,\n\nWe have added a public-information listing for {placeName} to Mirëbook, an Albania-focused discovery and booking platform.\n\nIf you own or manage this business, you can claim the listing, review its details and choose whether to publish bookable services. Claiming is optional and does not publish anything automatically.\n\nClaim and review the listing:\n{claimUrl}\n\nView the current public information:\n{publicUrl}\n\nMirëbook",
    ],
    social: [
      "admin.outreach.template.social.message",
      "Hello. We have added a public-information listing for {placeName} to Mirëbook, an Albania-focused discovery and booking platform. If you own or manage it, you can securely claim and review the listing here: {claimUrl}. Claiming is optional and does not publish booking services automatically. Current public listing: {publicUrl}",
    ],
    website: [
      "admin.outreach.template.website.message",
      "Hello. I am contacting you from Mirëbook about the public-information listing for {placeName}. If you own or manage the business, you can securely claim and review it here: {claimUrl}. Claiming is optional and nothing becomes bookable automatically. Current listing: {publicUrl}",
    ],
    phone: [
      "admin.outreach.template.phone.message",
      "Hello, I am calling from Mirëbook. We maintain a public-information listing for {placeName}. I would like to confirm whether you manage the business and explain how you can claim and review the listing. Claiming is optional, and nothing becomes bookable until the owner chooses to publish it. I can send the secure claim link: {claimUrl}. The current public listing is: {publicUrl}",
    ],
    in_person: [
      "admin.outreach.template.inPerson.message",
      "Hello, I am from Mirëbook. We maintain a public-information listing for {placeName}. If you manage the business, I can show you the listing and provide a secure link to claim and review it. Claiming is optional, and no booking services are published automatically. Claim link: {claimUrl}. Current public listing: {publicUrl}",
    ],
    other: [
      "admin.outreach.template.other.message",
      "Hello. Mirëbook has a public-information listing for {placeName}. An authorised owner or manager can securely claim and review it here: {claimUrl}. Claiming is optional and does not automatically publish bookable services. Public listing: {publicUrl}",
    ],
  };

  const message = fillTemplate(
    translate(language, messageKeys[channel][0], messageKeys[channel][1]),
    values,
  );
  const offerMessage = translate(
    language,
    "admin.outreach.template.offer.message",
    "Mirëbook Business is currently open to a small group of early partners. During this period there is no customer booking commission, and we can help set up services and availability. Participation is optional.",
  );

  return {
    subject: channel === "email" ? subject : "",
    message: includeEarlyPartnerOffer
      ? `${message}\n\n${offerMessage}`
      : message,
  };
}

function channelTranslationKey(channel: TemplateChannel) {
  const keys: Record<TemplateChannel, string> = {
    email: "admin.outreach.channel.email",
    phone: "admin.outreach.channel.phone",
    social: "admin.outreach.channel.social",
    website: "admin.outreach.channel.website",
    in_person: "admin.outreach.channel.inPerson",
    other: "admin.outreach.channel.other",
  };
  return keys[channel];
}

export default function OutreachDraftPanel({
  candidateId,
  placeName,
  email,
  claimLink,
  publicPlaceLink,
  preferredChannel,
  uiLocale,
  t,
}: OutreachDraftPanelProps) {
  const values = { placeName, claimUrl: claimLink, publicUrl: publicPlaceLink };
  const [language, setLanguage] = useState<Locale>(uiLocale);
  const [channel, setChannel] =
    useState<TemplateChannel>(preferredChannel);
  const [includeEarlyPartnerOffer, setIncludeEarlyPartnerOffer] =
    useState(false);
  const [draft, setDraft] = useState<TemplateDraft>(() =>
    buildDraft(uiLocale, preferredChannel, values, false),
  );
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget>("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const claimRef = useRef<HTMLInputElement>(null);

  function applyTemplate(
    nextLanguage: Locale,
    nextChannel: TemplateChannel,
    nextIncludeOffer = includeEarlyPartnerOffer,
  ) {
    setLanguage(nextLanguage);
    setChannel(nextChannel);
    setDraft(
      buildDraft(nextLanguage, nextChannel, values, nextIncludeOffer),
    );
    setCopiedTarget("");
  }

  async function copyValue(
    value: string,
    target: Exclude<CopyTarget, "">,
    fallbackRef: {
      current: HTMLInputElement | HTMLTextAreaElement | null;
    },
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

  const isConversationScript = ["phone", "in_person"].includes(channel);
  const emailHref = email
    ? `mailto:${email.replace(/\s/g, "")}?subject=${encodeURIComponent(
        draft.subject,
      )}&body=${encodeURIComponent(draft.message)}`
    : "";

  return (
    <section className="outreach-draft-section" aria-labelledby={`draft-${candidateId}`}>
      <header className="outreach-draft-header">
        <div>
          <h3 id={`draft-${candidateId}`}>
            {t("admin.outreach.template.title", "Prepare outreach")}
          </h3>
          <p>
            {t(
              "admin.outreach.template.body",
              "Choose a language and contact format, then edit before copying.",
            )}
          </p>
        </div>
        <span className="outreach-manual-badge">
          <ShieldCheck size={16} aria-hidden="true" />
          {t("admin.outreach.template.manualOnly", "Manual send only")}
        </span>
      </header>

      <div className="outreach-template-controls">
        <label>
          <span>
            {t("admin.outreach.template.languageLabel", "Draft language")}
          </span>
          <select
            value={language}
            onChange={(event) =>
              applyTemplate(event.target.value as Locale, channel)
            }
          >
            <option value="sq">{t("language.albanian", "Albanian")}</option>
            <option value="en">{t("language.english", "English")}</option>
          </select>
        </label>
        <label>
          <span>
            {t("admin.outreach.template.formatLabel", "Contact format")}
          </span>
          <select
            value={channel}
            onChange={(event) =>
              applyTemplate(language, event.target.value as TemplateChannel)
            }
          >
            {TEMPLATE_CHANNELS.map((value) => (
              <option key={value} value={value}>
                {t(channelTranslationKey(value), value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="outreach-offer-toggle">
        <input
          type="checkbox"
          checked={includeEarlyPartnerOffer}
          onChange={(event) => {
            const nextIncludeOffer = event.target.checked;
            setIncludeEarlyPartnerOffer(nextIncludeOffer);
            applyTemplate(language, channel, nextIncludeOffer);
          }}
        />
        <span>
          <strong>
            {t(
              "admin.outreach.template.includeOffer",
              "Include early-partner invitation",
            )}
          </strong>
          <small>
            {t(
              "admin.outreach.template.includeOfferBody",
              "Adds the current no-customer-booking-commission and setup-support message. Use only when offering the launch pilot.",
            )}
          </small>
        </span>
      </label>

      {channel === "email" && (
        <label className="outreach-template-field">
          <span>{t("admin.outreach.template.subjectLabel", "Subject")}</span>
          <div className="outreach-field-copy">
            <input
              ref={subjectRef}
              type="text"
              value={draft.subject}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  subject: event.target.value,
                }));
                setCopiedTarget("");
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => copyValue(draft.subject, "subject", subjectRef)}
            >
              {copiedTarget === "subject" ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Clipboard size={16} aria-hidden="true" />
              )}
              {copiedTarget === "subject"
                ? t("admin.outreach.copied", "Copied")
                : t("admin.outreach.template.copySubject", "Copy subject")}
            </button>
          </div>
        </label>
      )}

      <label className="outreach-template-field">
        <span>
          {isConversationScript
            ? t("admin.outreach.template.scriptLabel", "Conversation guide")
            : t("admin.outreach.template.messageLabel", "Message")}
        </span>
        <textarea
          ref={messageRef}
          rows={8}
          value={draft.message}
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              message: event.target.value,
            }));
            setCopiedTarget("");
          }}
        />
      </label>

      <div className="outreach-template-actions">
        {channel === "email" && emailHref && (
          <a className="btn btn-ghost" href={emailHref}>
            <Mail size={16} aria-hidden="true" />
            {t("admin.outreach.template.openEmail", "Open email draft")}
          </a>
        )}
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => copyValue(draft.message, "message", messageRef)}
        >
          {copiedTarget === "message" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Clipboard size={16} aria-hidden="true" />
          )}
          {copiedTarget === "message"
            ? t("admin.outreach.copied", "Copied")
            : t("admin.outreach.template.copyMessage", "Copy message")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => applyTemplate(language, channel)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t("admin.outreach.template.reset", "Reset draft")}
        </button>
      </div>

      <div className="outreach-claim-tools">
        <label>
          <span>{t("admin.outreach.claimLinkLabel", "Owner claim link")}</span>
          <input ref={claimRef} type="text" readOnly value={claimLink} />
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => copyValue(claimLink, "claim", claimRef)}
        >
          {copiedTarget === "claim" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Clipboard size={16} aria-hidden="true" />
          )}
          {copiedTarget === "claim"
            ? t("admin.outreach.copied", "Copied")
            : t("admin.outreach.copy", "Copy")}
        </button>
        <a
          href={claimLink}
          className="btn btn-ghost"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} aria-hidden="true" />
          {t("admin.outreach.openClaim", "Open")}
        </a>
      </div>

      <style jsx>{`
        .outreach-draft-section {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          display: grid;
          gap: 0.85rem;
        }

        .outreach-draft-header,
        .outreach-template-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .outreach-draft-header {
          align-items: flex-start;
        }

        .outreach-draft-header > div {
          min-width: 0;
          display: grid;
          gap: 0.25rem;
        }

        .outreach-draft-header h3 {
          font-size: 1rem;
        }

        .outreach-draft-header p {
          color: var(--muted);
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .outreach-manual-badge {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.55rem;
          border-radius: 999px;
          background: var(--success-dim);
          color: var(--success);
          font-size: 0.74rem;
          font-weight: 800;
        }

        .outreach-template-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .outreach-template-controls label,
        .outreach-template-field,
        .outreach-claim-tools label {
          min-width: 0;
          display: grid;
          gap: 0.35rem;
        }

        .outreach-template-controls label > span,
        .outreach-template-field > span,
        .outreach-claim-tools label > span {
          color: var(--muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .outreach-template-controls select,
        .outreach-template-field input,
        .outreach-template-field textarea,
        .outreach-claim-tools input {
          width: 100%;
          min-width: 0;
        }

        .outreach-offer-toggle {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.65rem;
          align-items: start;
          padding: 0.7rem;
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) * 0.75);
          background: var(--surface-2);
          cursor: pointer;
        }

        .outreach-offer-toggle input {
          width: 1rem;
          height: 1rem;
          min-height: 1rem;
          margin-top: 0.12rem;
          padding: 0;
          border-radius: 0.2rem;
          accent-color: var(--accent);
        }

        .outreach-offer-toggle span {
          display: grid;
          gap: 0.18rem;
        }

        .outreach-offer-toggle small {
          color: var(--muted);
          font-size: 0.76rem;
          line-height: 1.4;
        }

        .outreach-template-field textarea {
          min-height: 9.5rem;
          resize: vertical;
          line-height: 1.45;
        }

        .outreach-field-copy,
        .outreach-claim-tools {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.5rem;
          align-items: end;
        }

        .outreach-claim-tools {
          grid-template-columns: minmax(0, 1fr) auto auto;
          padding-top: 0.8rem;
          border-top: 1px solid var(--border);
        }

        .outreach-field-copy :global(.btn),
        .outreach-template-actions :global(.btn),
        .outreach-claim-tools :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }

        .outreach-template-actions {
          justify-content: flex-start;
        }

        @media (max-width: 560px) {
          .outreach-template-controls,
          .outreach-field-copy,
          .outreach-claim-tools {
            grid-template-columns: minmax(0, 1fr);
          }

          .outreach-template-actions {
            display: grid;
          }

          .outreach-template-actions :global(.btn),
          .outreach-field-copy :global(.btn),
          .outreach-claim-tools :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
