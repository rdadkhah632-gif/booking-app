export default function MarketplaceSurfaceStyles() {
  return (
    <style jsx global>{`
      .marketplace-surface {
        --bg: #ffffff;
        --surface: #ffffff;
        --surface-2: #f5f6f7;
        --surface-3: #eceef0;
        --border: #e2e4e7;
        --border-2: #cfd3d8;
        --accent: #ed5a2a;
        --accent-dim: rgba(237, 90, 42, 0.1);
        --text: #19191b;
        --text-muted: #62666d;
        --text-faint: #8a8f98;
        --success: #147d70;
        --success-dim: rgba(20, 125, 112, 0.1);
        --radius: 8px;
        --shadow-soft: 0 18px 44px rgba(20, 24, 32, 0.12);
        --shadow-card: 0 10px 28px rgba(20, 24, 32, 0.08);
        min-height: 100vh;
        min-height: 100dvh;
        background: #ffffff;
        color: var(--text);
        color-scheme: light;
      }

      .marketplace-surface .nav-simple {
        min-height: 72px;
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 1px 0 rgba(20, 24, 32, 0.02);
        backdrop-filter: blur(16px);
      }

      .marketplace-surface .nav-simple .logo {
        color: #19191b;
      }

      .marketplace-surface .nav-simple .muted,
      .marketplace-surface .nav-simple a:not(.btn),
      .marketplace-surface .nav-simple button:not(.btn) {
        color: #37393d;
      }

      .marketplace-surface .nav-simple .product-role-badge {
        color: #c9471c;
        background: rgba(237, 90, 42, 0.08);
        border-color: rgba(237, 90, 42, 0.2);
      }

      .marketplace-surface .language-switcher,
      .marketplace-surface .customer-nav-account-menu summary,
      .marketplace-surface .business-nav-mobile-account summary,
      .marketplace-surface .staff-nav-mobile-account summary,
      .marketplace-surface .admin-nav-mobile summary {
        border-color: var(--border);
        background: #ffffff;
        color: #303236;
      }

      .marketplace-surface .language-switcher button {
        color: #62666d;
      }

      .marketplace-surface .language-switcher button.active {
        background: var(--accent);
        color: #ffffff;
      }

      .marketplace-surface .customer-nav-account-menu-panel,
      .marketplace-surface .business-nav-mobile-menu,
      .marketplace-surface .staff-nav-mobile-menu,
      .marketplace-surface .admin-nav-mobile-menu {
        border-color: var(--border);
        background: #ffffff;
        box-shadow: 0 14px 34px rgba(20, 24, 32, 0.14);
      }

      .marketplace-surface .btn-accent {
        background: var(--accent);
        color: #ffffff;
      }

      .marketplace-surface .btn-ghost {
        border-color: var(--border);
        background: #ffffff;
        color: #303236;
      }

      .marketplace-surface input,
      .marketplace-surface select,
      .marketplace-surface textarea {
        border-radius: 6px;
        border-color: var(--border);
        background: #ffffff;
        color: var(--text);
      }

      .marketplace-surface select option {
        background: #ffffff;
        color: var(--text);
      }

      .marketplace-surface input::placeholder,
      .marketplace-surface textarea::placeholder {
        color: #8a8f98;
      }

      .marketplace-surface input:-webkit-autofill,
      .marketplace-surface input:-webkit-autofill:hover,
      .marketplace-surface input:-webkit-autofill:focus,
      .marketplace-surface textarea:-webkit-autofill,
      .marketplace-surface select:-webkit-autofill {
        -webkit-text-fill-color: var(--text);
        box-shadow: 0 0 0 1000px #ffffff inset;
        caret-color: var(--text);
      }

      .marketplace-surface .card {
        border-color: var(--border);
        background: #ffffff;
      }

      @media (max-width: 540px) {
        .marketplace-surface .nav-simple {
          min-height: 64px;
          padding: 9px 0;
        }

        .marketplace-surface .nav-simple-inner {
          row-gap: 0.45rem;
        }

        .marketplace-surface input,
        .marketplace-surface select,
        .marketplace-surface textarea {
          font-size: 1rem;
        }
      }
    `}</style>
  );
}
