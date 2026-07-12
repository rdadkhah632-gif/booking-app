import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { requestTransactionalEmail } from "@/lib/email/client";
import { requestSupportAdminNotification } from "@/lib/support/adminNotifications";

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
};

type StaffProfile = {
  id: string;
  business_id?: string | null;
  name?: string | null;
  email?: string | null;
  role_title?: string | null;
  permission_role?: string | null;
  active?: boolean | null;
  business_name?: string | null;
};

const STAFF_SUBJECT_KEYS = [
  "support.staff.subject.access",
  "support.staff.subject.availability",
  "support.staff.subject.schedule",
  "support.staff.subject.wrongBusiness",
  "support.staff.subject.email",
  "support.staff.subject.notifications",
  "support.staff.subject.other",
];

export default function StaffSupportPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(STAFF_SUBJECT_KEYS[0]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  useEffect(() => {
    loadContext();
  }, []);

  async function loadContext() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login?redirectTo=/support/staff");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      setError(
        t(
          "support.staff.contextError",
          "We could not load your staff account for support. Please refresh and try again.",
        ),
      );
      setLoading(false);
      return;
    }

    if (profileData) {
      setProfile(profileData);
      setName(profileData.full_name || "");
      setEmail(profileData.email || "");
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staff_members")
      .select(
        "id, business_id, name, email, role_title, permission_role, active",
      )
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (staffError) {
      setError(
        t(
          "support.staff.contextError",
          "We could not load your staff account for support. Please refresh and try again.",
        ),
      );
      setLoading(false);
      return;
    }

    let resolvedStaff = staffData as StaffProfile | null;

    if (resolvedStaff?.business_id) {
      const { data: businessData } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("id", resolvedStaff.business_id)
        .maybeSingle();

      resolvedStaff = {
        ...resolvedStaff,
        business_name: businessData?.name || null,
      };
    }

    setStaffProfile(resolvedStaff);
    setLoading(false);
  }

  async function submitSupportMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!profile) {
      setError(
        t(
          "support.staff.loginRequired",
          "You need to be logged in as staff to contact staff support.",
        ),
      );
      return;
    }

    if (!message.trim()) {
      setError(
        t(
          "support.validation.messageRequired",
          "Write a message before sending.",
        ),
      );
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    setCreatedTicketId(null);

    const ticketSubject = staffSubjectLabel(subject).trim();
    const ticketMessage = message.trim();
    const ticketPriority =
      subject === "support.staff.subject.access" ||
      subject === "support.staff.subject.wrongBusiness"
        ? "high"
        : "normal";

    const { data: insertedTicket, error: insertError } = await supabase
      .from("support_messages")
      .insert({
        user_id: profile.id,
        business_id: staffProfile?.business_id || null,
        account_type: "staff",
        name: name.trim() || staffProfile?.name || profile.full_name || null,
        email: email.trim() || staffProfile?.email || profile.email || null,
        category: "staff_support",
        subject: ticketSubject,
        message: ticketMessage,
        status: "open",
        priority: ticketPriority,
      })
      .select("id")
      .single();

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const ticketId = insertedTicket?.id || null;
    setCreatedTicketId(ticketId);

    if (ticketId) {
      void requestSupportAdminNotification({
        supportMessageId: ticketId,
        event: "support_created",
        summary: `${ticketSubject} · ${staffProfile?.business_name || staffProfile?.name || name.trim() || profile.email || "Staff member"}`,
      });
      void requestTransactionalEmail({
        event: "support_created",
        supportMessageId: ticketId,
      });
    }

    setSuccess(
      t("support.staff.success", "Your support message has been sent."),
    );
    setMessage("");
    setSubject(STAFF_SUBJECT_KEYS[0]);
  }

  function staffSubjectLabel(key: string) {
    const fallback: Record<string, string> = {
      "support.staff.subject.access": "Account access or login issue",
      "support.staff.subject.availability": "Availability or working hours",
      "support.staff.subject.schedule": "Schedule or booking question",
      "support.staff.subject.wrongBusiness": "Wrong business or staff profile",
      "support.staff.subject.email": "Email or profile details",
      "support.staff.subject.notifications": "Notifications issue",
      "support.staff.subject.other": "Other staff support request",
    };

    return t(key, fallback[key] || "Staff support request");
  }

  return (
    <main>
      <AuthNav />

      <section
        className="container"
        style={{ paddingTop: 24, paddingBottom: 56 }}
      >
        <div className="support-shell">
          <div className="card support-hero">
            <h1 className="page-title">
              {t("support.staff.heroTitle", "Get help with your staff account")}
            </h1>
            <p className="page-sub" style={{ marginTop: "0.6rem" }}>
              {t(
                "support.staff.heroBody",
                "Contact support about staff access, availability, bookings, notifications or your linked business profile.",
              )}
            </p>
            <div className="support-hero-actions">
              <Link href="/staff" className="btn btn-accent">
                {t("staff.schedule.title", "My schedule")}
              </Link>
              <Link href="/staff/calendar" className="btn btn-ghost">
                {t("staffCalendar.title", "Calendar view")}
              </Link>
              <Link href="/staff/availability" className="btn btn-ghost">
                {t("staff.actions.updateAvailability", "Update availability")}
              </Link>
              <Link href="/support/messages" className="btn btn-ghost">
                {t("support.staff.myMessages", "My support messages")}
              </Link>
            </div>
          </div>

          {loading && (
            <div className="card">
              <p className="muted">
                {t("support.staff.loading", "Loading staff support...")}
              </p>
            </div>
          )}

          {error && (
            <div
              className="card"
              style={{ borderColor: "rgba(255,77,109,0.35)" }}
            >
              <p style={{ color: "var(--danger)" }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="card support-success-card">
              <p style={{ color: "var(--success)" }}>{success}</p>
              <p className="small muted" style={{ marginTop: "0.4rem" }}>
                {t(
                  "support.staff.successBody",
                  "Your message is now saved as a staff support conversation. Mirëbook support will reply there.",
                )}
              </p>
              <div className="support-success-actions">
                {createdTicketId && (
                  <Link
                    href={`/support/messages/${createdTicketId}`}
                    className="btn btn-accent"
                  >
                    {t("support.staff.viewConversation", "View conversation")}
                  </Link>
                )}
                <Link href="/support/messages" className="btn btn-ghost">
                  {t("support.staff.allConversations", "All support messages")}
                </Link>
              </div>
            </div>
          )}

          {!loading && profile && (
            <div className="support-grid">
              <form
                onSubmit={submitSupportMessage}
                className="card support-form-card"
              >
                <div>
                  <h2>
                    {t("support.staff.formTitle", "Send a message to support")}
                  </h2>
                </div>

                <div className="support-form-grid">
                  <div>
                    <label className="small muted">{t("common.name")}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t(
                        "support.staff.namePlaceholder",
                        "Your name",
                      )}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>

                  <div>
                    <label className="small muted">{t("common.email")}</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t(
                        "support.staff.emailPlaceholder",
                        "Your email",
                      )}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("support.staff.subjectLabel", "Subject")}
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      style={{ marginTop: "0.4rem" }}
                    >
                      {STAFF_SUBJECT_KEYS.map((item) => (
                        <option key={item} value={item}>
                          {staffSubjectLabel(item)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="full-span">
                    <label className="small muted">
                      {t("support.staff.messageLabel", "Message")}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t(
                        "support.staff.messagePlaceholder",
                        "Tell us what you need help with...",
                      )}
                      rows={5}
                      style={{ marginTop: "0.4rem" }}
                    />
                  </div>
                </div>

                {staffProfile && (
                  <details className="staff-context-box support-secondary-context">
                    <summary>
                      {t("support.staff.linkedProfile", "Linked staff profile")}
                    </summary>
                    <strong>
                      {staffProfile.name ||
                        name ||
                        t("support.staff.memberFallback", "Staff member")}
                    </strong>
                    <p className="small muted" style={{ marginTop: "0.35rem" }}>
                      {staffProfile.role_title ||
                        staffProfile.permission_role ||
                        t("support.staff.roleFallback", "Staff role")}{" "}
                      ·{" "}
                      {staffProfile.business_name ||
                        t(
                          "support.staff.businessFallback",
                          "Business not shown",
                        )}{" "}
                      ·{" "}
                      {staffProfile.active
                        ? t("support.staff.status.active", "Active")
                        : t("support.staff.status.hidden", "Hidden")}
                    </p>
                    <p className="small muted" style={{ marginTop: "0.35rem" }}>
                      {t(
                        "support.staff.profileHelpText",
                        "If services, bookings or availability look wrong, ask the business owner to check your staff setup and assigned services.",
                      )}
                    </p>
                  </details>
                )}

                {!staffProfile && (
                  <details
                    className="staff-context-box warning support-secondary-context"
                    open
                  >
                    <summary>
                      {t("support.staff.noProfile", "No linked staff profile")}
                    </summary>
                    <strong>
                      {t(
                        "support.staff.noProfileTitle",
                        "Your account is not linked to a staff profile yet",
                      )}
                    </strong>
                    <p className="small muted" style={{ marginTop: "0.35rem" }}>
                      {t(
                        "support.staff.noProfileBody",
                        "Ask the business owner to add your exact email address to their staff list, then log in again.",
                      )}
                    </p>
                    <ol className="support-step-list">
                      <li>
                        {t(
                          "support.staff.noProfileStep1",
                          "Check you registered with the same email the business added.",
                        )}
                      </li>
                      <li>
                        {t(
                          "support.staff.noProfileStep2",
                          "Ask the business owner to open Staff setup and confirm your email is listed.",
                        )}
                      </li>
                      <li>
                        {t(
                          "support.staff.noProfileStep3",
                          "Log out and log back in after the owner updates your staff profile.",
                        )}
                      </li>
                    </ol>
                  </details>
                )}

                <div className="support-submit-note">
                  <p className="small muted">
                    {staffProfile
                      ? t(
                          "support.staff.beforeSending.linked",
                          "Include the affected booking, date, service or availability day so support can trace the issue faster.",
                        )
                      : t(
                          "support.staff.beforeSending.unlinked",
                          "Include the business name and the email address the owner added to their staff list.",
                        )}
                  </p>
                </div>
                <button
                  type="submit"
                  className="btn btn-accent"
                  disabled={sending}
                >
                  {sending
                    ? t("support.staff.sending", "Sending...")
                    : t("support.staff.sendButton", "Send support message")}
                </button>
              </form>

              <div className="card support-side-card">
                <h2>{t("support.staff.quickActions", "Staff actions")}</h2>

                <div className="support-link-list">
                  <Link href="/staff" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("support.staff.schedule", "Schedule")}</strong>
                      <small>
                        {t(
                          "support.staff.scheduleBody",
                          "View your upcoming staff bookings.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/staff/calendar" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>
                        {t("staffCalendar.title", "Calendar view")}
                      </strong>
                      <small>
                        {t(
                          "support.staff.calendarBody",
                          "Look ahead across your assigned bookings by month.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/staff/availability" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>
                        {t("support.staff.availability", "Availability")}
                      </strong>
                      <small>
                        {t(
                          "support.staff.availabilityBody",
                          "Update your working days and hours.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link
                    href="/staff/notifications"
                    className="support-link-row"
                  >
                    <span className="support-link-copy">
                      <strong>
                        {t("staffNotifications.title", "Updates")}
                      </strong>
                      <small>
                        {t(
                          "support.staff.notificationsBody",
                          "Check staff booking, schedule and profile updates.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/support/messages" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>
                        {t("support.staff.myMessages", "My support messages")}
                      </strong>
                      <small>
                        {t(
                          "support.staff.myMessagesBody",
                          "Read support replies and continue staff support conversations.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/account" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("nav.account")}</strong>
                      <small>
                        {t(
                          "support.staff.accountBody",
                          "Update your personal account details.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link href="/support/business" className="support-link-row">
                    <span className="support-link-copy">
                      <strong>{t("nav.businessSupport")}</strong>
                      <small>
                        {t(
                          "support.staff.businessSupportBody",
                          "Contact the business support route if you manage the business account.",
                        )}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <details className="support-troubleshooting-card">
                  <summary>
                    {t(
                      "support.staff.troubleshooting.kicker",
                      "Quick troubleshooting",
                    )}
                  </summary>
                  <h3>
                    {t(
                      "support.staff.troubleshooting.title",
                      "Common staff setup checks",
                    )}
                  </h3>
                  <div className="support-check-list">
                    <div>
                      <strong>
                        {t(
                          "support.staff.troubleshooting.accessTitle",
                          "Cannot access staff workspace",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.staff.troubleshooting.accessBody",
                          "The business owner must add the same email address you use to log in.",
                        )}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {t(
                          "support.staff.troubleshooting.servicesTitle",
                          "No services shown",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.staff.troubleshooting.servicesBody",
                          "The owner must assign services to your staff profile before customers can book you.",
                        )}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {t(
                          "support.staff.troubleshooting.availabilityTitle",
                          "No bookable times",
                        )}
                      </strong>
                      <p className="small muted">
                        {t(
                          "support.staff.troubleshooting.availabilityBody",
                          "Check that your availability is open and that the business itself also has working hours.",
                        )}
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .support-shell {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 0.75rem;
        }

        .support-hero {
          padding: 0.95rem 1rem;
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.12),
            rgba(45, 212, 191, 0.08)
          );
          border-color: rgba(255, 107, 53, 0.25);
        }

        .support-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .support-success-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .support-success-card {
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.06);
        }

        .support-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          gap: 0.85rem;
          align-items: start;
        }

        .support-form-card,
        .support-side-card {
          display: grid;
          gap: 0.78rem;
        }

        .support-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.72rem 0.85rem;
        }

        .full-span {
          grid-column: 1 / -1;
        }

        .staff-context-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.72rem 0.78rem;
        }

        .staff-context-box summary {
          cursor: pointer;
          font-weight: 800;
          list-style: none;
        }

        .staff-context-box summary::-webkit-details-marker {
          display: none;
        }

        .staff-context-box summary::after {
          content: " +";
          color: var(--accent);
        }

        .staff-context-box[open] summary::after {
          content: " -";
        }

        .support-secondary-context {
          font-size: 0.9rem;
        }

        .staff-context-box.warning {
          border-color: rgba(255, 190, 11, 0.28);
          background: rgba(255, 190, 11, 0.06);
        }

        .support-step-list {
          margin: 0.75rem 0 0;
          padding-left: 1.1rem;
          color: var(--text-muted);
          font-size: 0.86rem;
          line-height: 1.55;
        }

        .support-submit-note {
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: var(--radius);
          padding: 0.65rem 0.75rem;
          background: rgba(45, 212, 191, 0.06);
        }

        .support-link-list {
          display: grid;
          gap: 0.55rem;
        }

        .support-link-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.72rem 0.78rem;
        }

        .support-link-copy {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 0.28rem;
          min-width: 0;
          text-align: left;
        }

        .support-link-copy strong {
          display: block;
          line-height: 1.2;
        }

        .support-link-copy small {
          display: block;
          color: var(--text-muted);
          line-height: 1.35;
        }

        .support-troubleshooting-card {
          border-top: 1px solid var(--border);
          padding-top: 0.75rem;
          display: grid;
          gap: 0.6rem;
        }

        .support-troubleshooting-card summary {
          cursor: pointer;
          color: var(--text);
          font-weight: 800;
          list-style: none;
        }

        .support-troubleshooting-card summary::-webkit-details-marker {
          display: none;
        }

        .support-troubleshooting-card summary::after {
          content: " +";
          color: var(--accent);
        }

        .support-troubleshooting-card[open] summary::after {
          content: " -";
        }

        .support-check-list {
          display: grid;
          gap: 0.55rem;
        }

        .support-check-list div {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.68rem;
        }

        @media (max-width: 860px) {
          .support-grid,
          .support-form-grid {
            grid-template-columns: 1fr;
          }

          .support-hero-actions,
          .support-hero-actions :global(.btn),
          .support-success-actions,
          .support-success-actions :global(.btn),
          .support-form-card button {
            width: 100%;
            justify-content: center;
          }

          .support-link-row {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}
