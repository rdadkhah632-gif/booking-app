import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";

export default function CustomerPortalStyles() {
  return (
    <>
      <MarketplaceSurfaceStyles />
      <style jsx global>{`
        .customer-portal-surface {
          min-height: 100vh;
          min-height: 100dvh;
          background: #fff;
          color: var(--text);
        }

        .customer-portal-surface .customer-page-container {
          width: min(100%, 1080px);
          margin: 0 auto;
          padding: 2rem 24px 5.5rem;
        }

        .customer-portal-surface .page-title {
          margin: 0;
          font-family: var(--font-body);
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 850;
          line-height: 1.02;
          letter-spacing: 0;
        }

        .customer-portal-surface .page-sub {
          max-width: 54rem;
          color: var(--text-muted);
          font-size: 1rem;
          line-height: 1.6;
        }

        .customer-portal-surface h2,
        .customer-portal-surface h3 {
          font-family: var(--font-body);
          letter-spacing: 0;
        }

        .customer-portal-surface .card {
          border-color: var(--border);
          border-radius: 8px;
          background: #fff;
          box-shadow: none;
        }

        .customer-portal-surface .btn {
          min-height: 44px;
          border-radius: 6px;
        }

        .customer-portal-surface .btn-danger {
          border-color: rgba(180, 38, 61, 0.22);
          background: rgba(180, 38, 61, 0.06);
          color: #a5233b;
        }

        .customer-portal-surface .my-bookings-summary-grid {
          padding: 0;
          border: 0;
          background: transparent;
        }

        .customer-portal-surface .my-bookings-summary-item {
          min-height: 64px;
          border: 1px solid var(--border) !important;
          border-radius: 8px;
          background: #fff !important;
          box-shadow: 0 5px 16px rgba(20, 24, 32, 0.05);
        }

        .customer-portal-surface .my-bookings-section-list {
          gap: 2.25rem;
        }

        .customer-portal-surface .my-bookings-section > div:first-child h2,
        .customer-portal-surface .customer-notification-section h2 {
          font-family: var(--font-body) !important;
          font-size: 1.45rem;
        }

        .customer-portal-surface .my-booking-card {
          padding: 1.1rem;
          box-shadow: 0 8px 24px rgba(20, 24, 32, 0.06);
        }

        .customer-portal-surface .my-booking-card-head h3 {
          font-family: var(--font-body);
        }

        .customer-portal-surface .my-booking-appointment-strip,
        .customer-portal-surface .my-booking-requested-time-box {
          border-radius: 8px;
          background: var(--surface-2);
        }

        .customer-portal-surface .my-booking-pending-change-card {
          border-radius: 8px;
          background: rgba(237, 90, 42, 0.06);
        }

        .customer-portal-surface .customer-notification-section {
          gap: 0.65rem;
        }

        .customer-portal-surface .customer-notification-card {
          padding: 1rem;
        }

        .customer-portal-surface .customer-notification-status,
        .customer-portal-surface .my-booking-status-pill,
        .customer-portal-surface .my-booking-pill-accent {
          border-radius: 999px;
          font-weight: 750;
        }

        .customer-portal-surface .account-page-shell {
          max-width: 920px;
          gap: 0.8rem;
        }

        .customer-portal-surface .account-card-heading h2,
        .customer-portal-surface .account-card-heading h3 {
          font-family: var(--font-body) !important;
          letter-spacing: 0;
        }

        .customer-portal-surface .account-identity-card,
        .customer-portal-surface .account-form-card,
        .customer-portal-surface .account-security-card,
        .customer-portal-surface .account-region-card,
        .customer-portal-surface .account-details-panel {
          border-radius: 8px;
          background: #fff;
        }

        .customer-portal-surface .account-preference-groups,
        .customer-portal-surface .account-region-grid span {
          border-radius: 8px;
          background: var(--surface-2);
        }

        .customer-portal-surface .support-shell {
          max-width: 940px;
          gap: 1.25rem;
        }

        .customer-portal-surface .support-hero {
          padding: 0 0 1.4rem;
          border: 0;
          border-bottom: 1px solid var(--border);
          border-radius: 0;
          background: transparent;
        }

        .customer-portal-surface .support-grid {
          gap: 1.5rem;
        }

        .customer-portal-surface .support-form-card,
        .customer-portal-surface .support-side-card {
          padding: 1.1rem;
        }

        .customer-portal-surface .support-link-row {
          min-height: 64px;
          border-radius: 8px;
          background: #fff;
        }

        .customer-portal-surface .support-messages-shell,
        .customer-portal-surface .support-thread-shell {
          gap: 1.25rem;
        }

        .customer-portal-surface .support-messages-header,
        .customer-portal-surface .support-thread-header {
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }

        .customer-portal-surface .support-messages-header .page-title,
        .customer-portal-surface .support-thread-header .page-title {
          font-family: var(--font-body);
        }

        .customer-portal-surface .support-message-card,
        .customer-portal-surface .support-status-strip > div,
        .customer-portal-surface .support-message,
        .customer-portal-surface .support-reply-card {
          border-radius: 8px;
        }

        .customer-portal-surface .support-reply-card textarea {
          border-radius: 6px;
          background: #fff;
        }

        .customer-portal-surface .booking-confirmation-shell {
          max-width: 800px;
          gap: 1.25rem;
        }

        .customer-portal-surface .booking-confirmation-hero {
          padding: 2.3rem 1rem;
          border: 0;
          background: transparent;
        }

        .customer-portal-surface .booking-confirmation-hero h1 {
          font-family: var(--font-body) !important;
          font-size: clamp(2rem, 6vw, 3rem) !important;
          letter-spacing: 0;
        }

        .customer-portal-surface .booking-confirmation-details-header h2,
        .customer-portal-surface .reschedule-form-card > h2 {
          font-family: var(--font-body) !important;
        }

        .customer-portal-surface .reschedule-form-card {
          border-radius: 8px;
        }

        .customer-portal-surface .reschedule-calendar-card {
          border-radius: 8px;
          background: var(--surface-2) !important;
        }

        @media (max-width: 640px) {
          .customer-portal-surface .customer-page-container {
            padding: 1.25rem 14px 5.5rem;
          }

          .customer-portal-surface .page-title {
            font-size: clamp(1.85rem, 9vw, 2.35rem);
          }

          .customer-portal-surface .my-booking-card,
          .customer-portal-surface .customer-notification-card,
          .customer-portal-surface .support-form-card,
          .customer-portal-surface .support-side-card {
            padding: 0.9rem;
          }
        }
      `}</style>
    </>
  );
}
