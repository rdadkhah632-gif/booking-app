import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  workspace?: "business" | "staff";
};

export default function DashboardLayout({
  children,
  title,
  subtitle,
  workspace = "business",
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [pendingCount, setPendingCount] = useState(0);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasBusinessWorkspace, setHasBusinessWorkspace] = useState(false);

  useEffect(() => {
    async function loadPendingNotifications() {
      setCheckingAccess(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(
          workspace === "staff"
            ? `/login?redirectTo=${encodeURIComponent(router.asPath)}`
            : "/login",
        );
        return;
      }

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      setHasBusinessWorkspace(capabilities.canUseBusiness);

      if (workspace === "staff") {
        if (!capabilities.canUseStaff && !capabilities.canUseBusiness) {
          setPendingCount(0);
          router.replace(capabilities.defaultRoute);
          return;
        }

        if (!capabilities.canUseBusiness) {
          setPendingCount(0);
          setCheckingAccess(false);
          return;
        }
      } else if (!capabilities.canUseBusiness) {
        setPendingCount(0);
        router.replace(capabilities.defaultRoute);
        return;
      }

      const businessIds = capabilities.ownedBusinesses.map(
        (business) => business.id,
      );

      const { count: pendingBookingsCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("business_id", businessIds)
        .eq("status", "pending");

      const { data: pendingRequests } = await supabase
        .from("booking_requests")
        .select("booking_id")
        .in("business_id", businessIds)
        .eq("status", "pending");

      const uniquePendingBookings = new Set(
        (pendingRequests || []).map((request) => request.booking_id),
      );

      setPendingCount((pendingBookingsCount || 0) + uniquePendingBookings.size);
      setCheckingAccess(false);
    }

    loadPendingNotifications();
  }, [router.pathname, workspace]);

  const businessMainLinks = [
    { href: "/dashboard", label: t("dashboardLayout.nav.home", "Home") },
    {
      href: "/dashboard/bookings",
      label:
        pendingCount > 0
          ? `${t("support.business.bookings", "Bookings")} (${pendingCount > 9 ? "9+" : pendingCount})`
          : t("support.business.bookings", "Bookings"),
      urgent: pendingCount > 0,
    },
    {
      href: "/dashboard/services",
      label: t("dashboardServices.pageTitle", "Services"),
    },
    {
      href: "/dashboard/staff",
      label: t("dashboardLayout.nav.team", "Team"),
    },
    {
      href: "/dashboard/settings",
      label: t("dashboardLayout.nav.more", "More"),
    },
  ];

  const staffMainLinks = [
    {
      href: "/staff",
      label: t("dashboardLayout.staffNav.home", "Home"),
    },
    {
      href: "/staff/calendar",
      label: t("dashboardLayout.staffNav.calendar", "Calendar"),
    },
    {
      href: "/staff/availability",
      label: t("dashboardLayout.staffNav.availability", "Availability"),
    },
    {
      href: "/staff/notifications",
      label: t("dashboardLayout.staffNav.notifications", "Notifications"),
    },
  ];

  const staffSecondaryLinks = [
    ...(hasBusinessWorkspace
      ? [
          {
            href: "/dashboard",
            label: t(
              "dashboardLayout.staffNav.manageBusiness",
              "Manage business",
            ),
          },
        ]
      : []),
    {
      href: "/support/staff",
      label: t("nav.staffSupport", "Staff support"),
    },
    {
      href: "/account",
      label: t("dashboardLayout.nav.accountSettings", "My account"),
    },
  ];

  const mainLinks = workspace === "staff" ? staffMainLinks : businessMainLinks;
  const secondaryLinks = workspace === "staff" ? staffSecondaryLinks : [];

  const moreRoutes = [
    "/dashboard/settings",
    "/dashboard/businesses",
    "/dashboard/availability",
    "/dashboard/notifications",
    "/dashboard/analytics",
    "/dashboard/billing",
    "/support/business",
    "/account",
    "/staff",
  ];

  function isActiveLink(href: string) {
    if (workspace !== "staff" && href === "/dashboard/settings") {
      return moreRoutes.some(
        (route) =>
          router.pathname === route || router.pathname.startsWith(`${route}/`),
      );
    }

    return (
      router.pathname === href ||
      (href !== "/staff" && router.pathname.startsWith(`${href}/`))
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (checkingAccess) {
    return (
      <main className="dashboard-layout">
        <section className="dashboard-main">
          <div className="card">
            <p className="muted">{t("common.loading", "Loading...")}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link
            href={workspace === "staff" ? "/staff" : "/dashboard"}
            className="logo"
          >
            Mirë<span>book</span>
            <em>{t("product.business.suffix", "Business")}</em>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-main-links">
            {workspace === "staff" && (
              <p className="sidebar-section-label">
                {t("staff.workspace.kicker", "Staff workspace")}
              </p>
            )}
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActiveLink(link.href) ? "active" : ""} ${"urgent" in link && link.urgent ? "urgent" : ""}`.trim()}
              >
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {secondaryLinks.length > 0 && (
            <div className="sidebar-lower-links">
              {secondaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sidebar-link ${isActiveLink(link.href) ? "active" : ""}`.trim()}
                >
                  <span>{link.label}</span>
                </Link>
              ))}

              <button
                type="button"
                onClick={logout}
                className="sidebar-link sidebar-logout"
              >
                {t("auth.logout", "Log out")}
              </button>
            </div>
          )}

        </nav>
      </aside>

      <section className="dashboard-main">
        <div className="dashboard-content">
          <div className="dashboard-page-header">
            <div>
              {title && (
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "2rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  {title}
                </h1>
              )}

              {subtitle && <p className="muted">{subtitle}</p>}
            </div>
          </div>

          {children}
        </div>
      </section>
      <style jsx>{`
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
        }

        .sidebar-logo :global(.logo) {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }

        .sidebar-logo em {
          font-style: normal;
          font-size: 0.7rem;
          line-height: 1;
          padding: 0.22rem 0.45rem;
          border-radius: 999px;
          color: var(--accent);
          background: var(--accent-dim);
          border: 1px solid rgba(255, 107, 53, 0.24);
        }

        .sidebar-main-links,
        .sidebar-lower-links {
          display: grid;
          gap: 0.3rem;
        }

        .sidebar-lower-links {
          margin-top: 0.25rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .sidebar-section-label {
          margin: 0 0 0.25rem;
          padding: 0 0.85rem;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .sidebar-link {
          position: relative;
          min-height: 2.55rem;
          border-left: 3px solid transparent;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease;
        }

        .sidebar-link::after {
          content: "";
          position: absolute;
          left: 0.85rem;
          right: 0.85rem;
          bottom: 0.35rem;
          height: 2px;
          border-radius: 999px;
          background: transparent;
        }

        .sidebar-link.active {
          border-left-color: var(--accent);
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
          font-weight: 800;
        }

        .sidebar-link.active::after {
          background: var(--accent);
        }

        .sidebar-link:hover {
          transform: translateX(1px);
        }

        .sidebar-logout {
          width: 100%;
          border: 0;
          background: transparent;
          text-align: left;
          color: var(--text-muted);
          cursor: pointer;
        }

        .sidebar-link.urgent {
          border-left-color: rgba(255, 107, 53, 0.65);
          border-color: rgba(255, 107, 53, 0.45);
          background: rgba(255, 107, 53, 0.1);
          color: var(--accent);
        }

        .sidebar-link.urgent.active {
          border-left-color: var(--accent);
          background: rgba(255, 107, 53, 0.16);
        }

        .dashboard-content {
          width: min(100%, 1320px);
          margin: 0 auto;
        }

        .dashboard-page-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        @media (max-width: 720px) {
          .sidebar-nav {
            flex-direction: row;
            gap: 0.5rem;
            overflow-x: auto;
          }

          .sidebar-main-links,
          .sidebar-lower-links {
            display: contents;
          }

          .sidebar-section-label {
            display: none;
          }

          .dashboard-page-header {
            display: grid;
          }
        }

        @media (max-width: 900px) {
          .sidebar {
            position: sticky;
            top: 0;
            z-index: 35;
            overflow: hidden;
          }

          .sidebar-logo {
            margin-bottom: 0.65rem;
          }

          .sidebar-nav {
            display: flex;
            flex-direction: row;
            gap: 0.45rem;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 0.25rem;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }

          .sidebar-nav::-webkit-scrollbar {
            display: none;
          }

          .sidebar-main-links,
          .sidebar-lower-links {
            display: contents;
          }

          .sidebar-section-label {
            display: none;
          }

          .sidebar-link,
          .sidebar-logout {
            width: auto;
            min-height: 2.6rem;
            flex: 0 0 auto;
            white-space: nowrap;
            border-left: 0;
            border-bottom: 3px solid transparent;
          }

          .sidebar-link.active,
          .sidebar-link.urgent {
            border-left: 0;
            border-bottom-color: var(--accent);
          }

          .sidebar-link::after {
            display: none;
          }

          .sidebar-link:hover {
            transform: none;
          }
        }
      `}</style>
    </main>
  );
}
