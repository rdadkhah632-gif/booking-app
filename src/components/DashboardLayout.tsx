import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export default function DashboardLayout({ children, title, subtitle }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [pendingCount, setPendingCount] = useState(0);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    async function loadPendingNotifications() {
      setCheckingAccess(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: linkedStaff } = await supabase
        .from("staff_members")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);

      if (linkedStaff && linkedStaff.length > 0) {
        router.replace("/staff");
        return;
      }

      const { data: businesses } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", session.user.id);

      const businessIds = (businesses || []).map((business) => business.id);

      if (businessIds.length === 0) {
        setPendingCount(0);
        router.replace("/explore");
        return;
      }

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
  }, [router.pathname]);

  const mainLinks = [
    { href: "/dashboard", label: t("dashboardLayout.nav.home", "Home") },
    ...(pendingCount > 0
      ? [
          {
            href: "/dashboard/notifications",
            label: `${t("account.needsAction", "Needs action")} (${pendingCount > 9 ? "9+" : pendingCount})`,
            urgent: true,
          },
        ]
      : []),
    {
      href: "/dashboard/bookings",
      label: t("support.business.bookings", "Bookings"),
    },
    {
      href: "/dashboard/services",
      label: t("dashboardServices.pageTitle", "Services"),
    },
    { href: "/dashboard/staff", label: t("dashboardStaff.pageTitle", "Staff") },
    {
      href: "/dashboard/analytics",
      label: t("dashboardHome.viewAnalytics", "Analytics"),
    },
  ];

  const lowerLinks = [
    {
      href: "/dashboard/availability",
      label: t("dashboardAvailability.pageTitle", "Availability"),
    },
    {
      href: "/dashboard/settings",
      label: t("dashboardSettings.pageTitle", "Business settings"),
    },
    { href: "/dashboard/billing", label: t("billing.pageTitle", "Billing") },
    {
      href: "/support/business",
      label: t("nav.businessSupport", "Business support"),
    },
    {
      href: "/account",
      label: t("dashboardLayout.nav.accountSettings", "My account"),
    },
  ];

  function isActiveLink(href: string) {
    return router.pathname === href || router.pathname.startsWith(`${href}/`);
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
          <Link href="/dashboard" className="logo">
            Mirë<span>book</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-main-links">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActiveLink(link.href) ? "active" : ""} ${"urgent" in link && link.urgent ? "urgent" : ""}`}
              >
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className="sidebar-lower-links">
            {lowerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActiveLink(link.href) ? "active" : ""}`}
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
        </nav>
      </aside>

      <section className="dashboard-main">
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
      </section>
      <style jsx>{`
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
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

        .sidebar-logout {
          width: 100%;
          border: 0;
          background: transparent;
          text-align: left;
          color: var(--text-muted);
          cursor: pointer;
        }

        .sidebar-link.urgent {
          border-color: rgba(255, 107, 53, 0.45);
          background: rgba(255, 107, 53, 0.1);
          color: var(--accent);
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
          .dashboard-page-header {
            display: grid;
          }
        }
      `}</style>
    </main>
  );
}
