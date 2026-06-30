import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Business, Service, TimeSlot } from "./publicBusinessTypes";

type Props = {
  business: Business;
  selectedService: Service | null;
  selectedSlot: TimeSlot | null;
  selectedStaffSummary: () => string;
  selectedDateLabel?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNotes: string;
  submitting: boolean;
  error: string | null;
  canSubmit: boolean;
  customerUserId: string | null;
  userRole: string | null;
  isOwnerPreview: boolean;
  loginHref: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerNotesChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formatServicePrice: (price: number) => string;
  bookingModeText: () => string;
  bookingModeDescription: () => string;
  reschedulePolicyText: () => string;
};

export default function PublicBusinessSummary({
  business,
  selectedService,
  selectedSlot,
  selectedStaffSummary,
  selectedDateLabel,
  customerName,
  customerEmail,
  customerPhone,
  customerNotes,
  submitting,
  error,
  canSubmit,
  customerUserId,
  userRole,
  isOwnerPreview,
  loginHref,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerPhoneChange,
  onCustomerNotesChange,
  onSubmit,
  formatServicePrice,
  bookingModeText,
  bookingModeDescription,
  reschedulePolicyText,
}: Props) {
  const { t } = useI18n();
  const blockedByRole = Boolean(
    customerUserId && userRole && userRole !== "customer",
  );
  const hasSelectedService = Boolean(selectedService);
  const hasAppointmentSelection = Boolean(selectedService && selectedSlot);

  return (
    <aside className="card booking-summary-panel">
      <div className="booking-summary-heading">
        <p className="small muted">
          {t("publicBusiness.summary.title", "Booking summary")}
        </p>
        <h2 style={{ fontFamily: "var(--font-display)" }}>
          {hasAppointmentSelection
            ? t("publicBusiness.summary.reviewTitle", "Review and book")
            : t("publicBusiness.summary.emptyTitle", "Your appointment")}
        </h2>
        {!hasAppointmentSelection && hasSelectedService && (
          <p className="small muted" style={{ marginTop: "0.35rem" }}>
            {t(
              "publicBusiness.summary.pickAppointmentBody",
              "Pick an appointment slot, then add your details to book.",
            )}
          </p>
        )}
      </div>

      {hasSelectedService && (
        <div className="public-business-summary-box booking-summary-details">
          <div className="booking-summary-detail-row">
            <span className="small muted">
              {t("common.service", "Service")}
            </span>
            <strong>{selectedService?.name}</strong>
            <span className="small muted">
              {selectedService?.duration_minutes}{" "}
              {t("common.minutes", "minutes")}
              {Number(selectedService?.price || 0) > 0
                ? ` · ${formatServicePrice(selectedService?.price || 0)}`
                : ""}
            </span>
          </div>

          {hasAppointmentSelection && (
            <div className="booking-summary-detail-row">
              <span className="small muted">{t("common.time", "Time")}</span>
              <strong>
                {selectedDateLabel ||
                  new Date(selectedSlot!.startAt).toLocaleString()}
              </strong>
            </div>
          )}

          {hasAppointmentSelection && (
            <div className="booking-summary-detail-row">
              <span className="small muted">{t("common.staff", "Staff")}</span>
              <strong>{selectedStaffSummary()}</strong>
            </div>
          )}

          {!hasAppointmentSelection && (
            <p className="small muted booking-summary-next-line">
              {t(
                "publicBusiness.summary.chooseTimeNext",
                "Now choose an available time.",
              )}
            </p>
          )}
        </div>
      )}

      {hasAppointmentSelection && (
        <div className="booking-summary-mode-row">
          <span className="small public-business-pill-accent">
            {bookingModeText()}
          </span>
          <p className="small muted">{bookingModeDescription()}</p>
        </div>
      )}

      {hasAppointmentSelection && !customerUserId && (
        <div
          className="public-business-summary-box"
          style={{
            borderColor: "rgba(255,107,53,0.28)",
            background: "rgba(255,107,53,0.06)",
          }}
        >
          <p className="small" style={{ color: "var(--accent)" }}>
            {t("publicBusiness.summary.loginRequired", "Login required")}
          </p>
          <h3 style={{ marginTop: "0.25rem" }}>
            {t("publicBusiness.summary.signIn", "Sign in to book")}
          </h3>
          <p className="small muted" style={{ marginTop: "0.35rem" }}>
            {t(
              "publicBusiness.summary.signInBody",
              "Create or use a customer account so your booking can be linked to your profile.",
            )}
          </p>
          <div className="booking-action-row compact">
            <Link href={loginHref} className="btn btn-accent">
              {t("nav.login", "Login")}
            </Link>
            <Link href="/register" className="btn btn-ghost">
              {t("publicBusiness.summary.createAccount", "Create account")}
            </Link>
          </div>
        </div>
      )}

      {hasAppointmentSelection && blockedByRole && (
        <div
          className="public-business-summary-box"
          style={{
            borderColor: "rgba(255,190,11,0.28)",
            background: "rgba(255,190,11,0.06)",
          }}
        >
          <p className="small" style={{ color: "var(--warning)" }}>
            {isOwnerPreview
              ? t("publicBusiness.summary.ownerPreview", "Your business page")
              : t(
                  "publicBusiness.summary.customerRequired",
                  "Customer account required",
                )}
          </p>
          <h3 style={{ marginTop: "0.25rem" }}>
            {isOwnerPreview
              ? t(
                  "publicBusiness.summary.ownerPreviewTitle",
                  "You're viewing your own business page",
                )
              : t(
                  "publicBusiness.summary.customerRequiredTitle",
                  "Use a customer account to book",
                )}
          </h3>
          <p className="small muted" style={{ marginTop: "0.35rem" }}>
            {isOwnerPreview
              ? t(
                  "publicBusiness.summary.ownerPreviewBody",
                  "To test the customer booking flow, use a customer account. Manage this business from your dashboard.",
                )
              : t(
                  "publicBusiness.summary.customerRequiredBody",
                  "Use a customer account to test or place a customer booking.",
                )}
          </p>
          <div className="booking-action-row compact">
            {isOwnerPreview ? (
              <Link href="/dashboard" className="btn btn-ghost">
                {t(
                  "publicBusiness.summary.manageBusiness",
                  "Manage this business",
                )}
              </Link>
            ) : (
              <>
                <Link href="/account" className="btn btn-ghost">
                  {t("nav.account", "Account")}
                </Link>
                <Link href="/support/customer" className="btn btn-ghost">
                  {t("nav.customerSupport", "Customer support")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {hasAppointmentSelection && customerUserId && !blockedByRole && (
        <form onSubmit={onSubmit} className="public-business-form">
          <p className="small muted">
            {t("publicBusiness.summary.customerDetails", "Your details")}
          </p>

          <label className="small muted">
            {t("common.name", "Name")}
            <input
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder={t(
                "publicBusiness.summary.namePlaceholder",
                "Your name",
              )}
              style={{ marginTop: "0.35rem" }}
            />
          </label>

          <label className="small muted">
            {t("common.email", "Email")}
            <input
              value={customerEmail}
              onChange={(e) => onCustomerEmailChange(e.target.value)}
              placeholder={t(
                "publicBusiness.summary.emailPlaceholder",
                "Your email",
              )}
              style={{ marginTop: "0.35rem" }}
            />
          </label>

          <label className="small muted">
            {t("common.phone", "Phone")}
            <input
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              placeholder={t(
                "publicBusiness.summary.phonePlaceholder",
                "Phone number",
              )}
              style={{ marginTop: "0.35rem" }}
            />
          </label>

          <label className="small muted">
            {t("common.notes", "Notes")}
            <textarea
              value={customerNotes}
              onChange={(e) => onCustomerNotesChange(e.target.value)}
              placeholder={t(
                "publicBusiness.summary.notesPlaceholder",
                "Anything the business should know?",
              )}
              rows={3}
              style={{ marginTop: "0.35rem" }}
            />
          </label>

          {error && (
            <div
              className="card"
              style={{
                borderColor: "rgba(255,77,109,0.35)",
                background: "rgba(255,77,109,0.05)",
                padding: "0.85rem",
              }}
            >
              <p className="small" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent"
            disabled={submitting || !canSubmit}
          >
            {submitting
              ? t("common.working", "Working...")
              : business.auto_accept_bookings === false
                ? t(
                    "publicBusiness.summary.sendRequest",
                    "Send booking request",
                  )
                : t(
                    "publicBusiness.summary.confirmAppointment",
                    "Confirm booking",
                  )}
          </button>
        </form>
      )}

      {hasAppointmentSelection && (
        <details className="booking-summary-policies">
          <summary className="small muted">
            {t("publicBusiness.summary.policies", "Booking policies")}
          </summary>
          <p className="small muted" style={{ marginTop: "0.6rem" }}>
            {reschedulePolicyText()}
          </p>
          {business.cancellation_policy && (
            <p className="small muted" style={{ marginTop: "0.45rem" }}>
              {business.cancellation_policy}
            </p>
          )}
        </details>
      )}

      <div className="booking-summary-meta-links">
        <span className="small muted">{business.name}</span>
        <Link href="/support/customer" className="small muted">
          {t("common.needHelp", "Need help?")}
        </Link>
      </div>
    </aside>
  );
}
