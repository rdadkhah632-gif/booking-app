export default function WorkspaceSurfaceStyles() {
  return (
    <style jsx global>{`
      .dashboard-layout {
        --bg: #f6f7f8;
        --surface: #ffffff;
        --surface-2: #f1f3f5;
        --surface-3: #e8ebef;
        --border: #e0e3e7;
        --border-2: #c9ced5;
        --text: #17191c;
        --text-muted: #626a73;
        --text-faint: #8d949d;
        --accent: #e85d30;
        --accent-dim: rgba(232, 93, 48, 0.1);
        --success: #16846f;
        --success-dim: rgba(22, 132, 111, 0.1);
        --warning: #956600;
        --warning-dim: rgba(149, 102, 0, 0.1);
        --danger: #b4263d;
        --danger-dim: rgba(180, 38, 61, 0.08);
        --radius: 8px;
        --shadow-card: 0 5px 18px rgba(20, 24, 32, 0.05);
        color: var(--text);
        background: var(--bg);
      }

      .dashboard-layout .sidebar {
        border-right-color: var(--border);
        background: #fff;
        box-shadow: 4px 0 18px rgba(20, 24, 32, 0.03);
      }

      .dashboard-layout .sidebar-account-actions-menu {
        border-color: var(--border) !important;
        background: #fff !important;
        box-shadow: 0 14px 34px rgba(20, 24, 32, 0.14) !important;
      }

      .dashboard-layout .sidebar-account-actions-menu a,
      .dashboard-layout .sidebar-account-actions-menu button {
        min-height: 44px !important;
        color: var(--text) !important;
      }

      .dashboard-layout .dashboard-main {
        background: var(--bg);
      }

      .dashboard-layout .dashboard-page-header h1 {
        font-family: var(--font-body) !important;
        font-weight: 850;
        letter-spacing: 0;
      }

      .dashboard-layout .dashboard-main h2,
      .dashboard-layout .dashboard-main h3 {
        font-family: var(--font-body) !important;
        letter-spacing: 0;
      }

      .dashboard-layout .card {
        border-color: var(--border);
        background: var(--surface);
        box-shadow: var(--shadow-card);
      }

      .dashboard-layout input,
      .dashboard-layout select,
      .dashboard-layout textarea {
        border-color: var(--border);
        color: var(--text);
        background: #fff;
      }

      .dashboard-layout input:-webkit-autofill,
      .dashboard-layout input:-webkit-autofill:hover,
      .dashboard-layout input:-webkit-autofill:focus,
      .dashboard-layout textarea:-webkit-autofill,
      .dashboard-layout select:-webkit-autofill {
        -webkit-text-fill-color: var(--text);
        box-shadow: 0 0 0 1000px #fff inset;
      }

      .dashboard-layout .btn-ghost {
        border-color: var(--border);
        background: #fff;
      }

      .dashboard-layout .btn-ghost:hover {
        border-color: var(--border-2);
        background: var(--surface-2);
      }

      .dashboard-layout .badge,
      .dashboard-layout .pill {
        box-shadow: none;
      }

      .dashboard-layout .week-calendar,
      .dashboard-layout .staff-week-calendar {
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --text-faint: #64748b;
        color: var(--text);
      }

      @media (max-width: 900px) {
        .dashboard-layout .sidebar {
          border-right: 0;
          border-bottom: 1px solid var(--border);
          box-shadow: 0 4px 16px rgba(20, 24, 32, 0.04);
        }
      }
    `}</style>
  );
}
