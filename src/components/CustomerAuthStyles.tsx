import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";

export default function CustomerAuthStyles() {
  return (
    <>
      <MarketplaceSurfaceStyles />
      <style jsx global>{`
        .customer-auth-surface {
          min-height: 100vh;
          min-height: 100dvh;
          background: #f7f8f9;
          color: var(--text);
        }

        .customer-auth-surface .auth-wrap {
          min-height: calc(100vh - 72px);
          min-height: calc(100dvh - 72px);
          padding: 3rem 24px 5rem;
          background: #f7f8f9;
          align-items: flex-start;
        }

        .customer-auth-surface .auth-wrap .auth-card,
        .customer-auth-surface .auth-wrap .login-shell {
          width: min(100%, 560px);
          margin: 0 auto;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 16px 42px rgba(20, 24, 32, 0.09);
        }

        .customer-auth-surface .auth-wrap .auth-card {
          padding: 2rem;
        }

        .customer-auth-surface .auth-wrap .login-shell {
          max-width: 520px;
          overflow: hidden;
        }

        .customer-auth-surface .auth-wrap .login-form-panel {
          padding: 2rem;
        }

        .customer-auth-surface .auth-card h1,
        .customer-auth-surface .login-form-panel h2 {
          font-family: var(--font-body) !important;
          font-size: clamp(1.8rem, 5vw, 2.35rem) !important;
          font-weight: 850;
          line-height: 1.08;
          letter-spacing: 0;
        }

        .customer-auth-surface .form-grid {
          gap: 0.9rem;
        }

        .customer-auth-surface input,
        .customer-auth-surface select {
          min-height: 50px;
          border-radius: 6px;
          border-color: var(--border-2);
          background: #fff;
        }

        .customer-auth-surface input:focus,
        .customer-auth-surface select:focus {
          border-color: var(--accent);
          outline: 3px solid rgba(237, 90, 42, 0.12);
          outline-offset: 0;
        }

        .customer-auth-surface .btn {
          min-height: 48px;
          border-radius: 6px;
        }

        .customer-auth-surface .login-bottom-actions,
        .customer-auth-surface .register-bottom-actions {
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .customer-auth-surface .register-profile-grid {
          gap: 0.8rem;
        }

        .customer-auth-surface .register-verification-card,
        .customer-auth-surface .login-verification-box {
          border-radius: 8px;
        }

        @media (max-width: 640px) {
          .customer-auth-surface,
          .customer-auth-surface .auth-wrap {
            background: #fff;
          }

          .customer-auth-surface .auth-wrap {
            min-height: calc(100dvh - 64px);
            padding: 1.5rem 14px 4rem;
          }

          .customer-auth-surface .auth-wrap .auth-card,
          .customer-auth-surface .auth-wrap .login-shell {
            width: 100%;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .customer-auth-surface .auth-wrap .auth-card,
          .customer-auth-surface .auth-wrap .login-form-panel {
            padding: 0;
          }
        }
      `}</style>
    </>
  );
}
