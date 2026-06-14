import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import PublicNav from "./PublicNav";
import CustomerNav from "./CustomerNav";
import BusinessNav from "./BusinessNav";
import StaffNav from "./StaffNav";
import AdminNav from "./AdminNav";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import { getBusinessAppUrl } from "@/lib/appUrls";
import { Role } from "./navTypes";

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/admin");
}

function isBusinessRoute(pathname: string) {
  return pathname.startsWith("/dashboard");
}

function isStaffRoute(pathname: string) {
  return pathname.startsWith("/staff");
}

function supportRouteRole(
  pathname: string,
  capabilities: {
    ownsBusiness: boolean;
    hasStaffAccess: boolean;
  },
): Role {
  if (pathname.startsWith("/support/customer")) return "customer";

  if (pathname.startsWith("/support/business")) {
    return capabilities.ownsBusiness ? "business" : "customer";
  }

  if (pathname.startsWith("/support/staff")) {
    return capabilities.hasStaffAccess ? "staff" : "customer";
  }

  return null;
}

function navRoleForCapabilities(params: {
  activePath: string;
  isAdmin: boolean;
  ownsBusiness: boolean;
  hasStaffAccess: boolean;
}): Role {
  if (params.isAdmin && isAdminRoute(params.activePath)) return "admin";

  const explicitSupportRole = supportRouteRole(params.activePath, {
    ownsBusiness: params.ownsBusiness,
    hasStaffAccess: params.hasStaffAccess,
  });

  if (explicitSupportRole) return explicitSupportRole;

  if (params.hasStaffAccess && isStaffRoute(params.activePath)) return "staff";
  if (params.ownsBusiness && isBusinessRoute(params.activePath))
    return "business";

  if (params.isAdmin) return "admin";
  if (params.ownsBusiness) return "business";
  if (params.hasStaffAccess) return "staff";
  return "customer";
}

export default function AuthNav() {
  const router = useRouter();
  const { t } = useI18n();
  const isPublicBusinessEntry = router.pathname === "/business";

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setRole(null);
        setNotificationCount(0);
        setPrimaryBusinessId(null);
        setLoading(false);
        return;
      }

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      if (cancelled) return;

      const nextRole = navRoleForCapabilities({
        activePath: router.pathname,
        isAdmin: capabilities.isAdmin,
        ownsBusiness: capabilities.ownsBusiness,
        hasStaffAccess: capabilities.hasStaffAccess,
      });

      setPrimaryBusinessId(capabilities.primaryBusinessId);
      setRole(nextRole);

      await loadNotificationCounts({
        userId: session.user.id,
        activePath: router.pathname,
        navRole: nextRole,
        adminUser: capabilities.isAdmin,
        ownsBusiness: capabilities.ownsBusiness,
        hasStaffProfile: capabilities.hasStaffAccess,
        staffId: capabilities.primaryStaffId,
        businessIds: capabilities.ownedBusinesses.map(
          (business) => business.id,
        ),
      });

      if (!cancelled) setLoading(false);
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

  async function loadNotificationCounts(params: {
    userId: string;
    activePath: string;
    navRole: Role;
    adminUser: boolean;
    ownsBusiness: boolean;
    hasStaffProfile: boolean;
    staffId: string | null;
    businessIds: string[];
  }) {
    if (params.adminUser && isAdminRoute(params.activePath)) {
      const { count: unreadAdminCount } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("audience", "admin")
        .is("read_at", null);

      setNotificationCount(unreadAdminCount || 0);
      return;
    }

    if (
      params.navRole === "staff" &&
      params.hasStaffProfile &&
      params.staffId
    ) {
      const { count: unreadStaffNotifications } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", params.userId)
        .in("audience", ["staff", "general"])
        .is("read_at", null);

      const { count: staffPendingBookings } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("staff_member_id", params.staffId)
        .eq("status", "pending");

      setNotificationCount(
        (unreadStaffNotifications || 0) + (staffPendingBookings || 0),
      );
      return;
    }

    if (params.navRole === "business" && params.businessIds.length > 0) {
      const { count: pendingBookingsCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("business_id", params.businessIds)
        .eq("status", "pending");

      const { data: pendingRequests } = await supabase
        .from("booking_requests")
        .select("booking_id")
        .in("business_id", params.businessIds)
        .eq("status", "pending");

      const { count: unreadBusinessNotifications } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", params.userId)
        .eq("audience", "business")
        .is("read_at", null);

      const uniquePendingReschedules = new Set(
        (pendingRequests || []).map((request) => request.booking_id),
      ).size;
      setNotificationCount(
        (pendingBookingsCount || 0) +
          uniquePendingReschedules +
          (unreadBusinessNotifications || 0),
      );
      return;
    }

    const { count: pendingBookingsCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_user_id", params.userId)
      .eq("status", "pending");

    const { data: pendingRequests } = await supabase
      .from("booking_requests")
      .select("booking_id")
      .eq("customer_user_id", params.userId)
      .eq("status", "pending");

    const { count: unreadCustomerNotifications } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .in("audience", ["general", "customer"])
      .is("read_at", null);

    const uniquePendingReschedules = new Set(
      (pendingRequests || []).map((request) => request.booking_id),
    ).size;
    setNotificationCount(
      (pendingBookingsCount || 0) +
        uniquePendingReschedules +
        (unreadCustomerNotifications || 0),
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    setRole(null);
    setNotificationCount(0);
    setPrimaryBusinessId(null);
    router.replace("/");
  }

  const logoHref = useMemo(() => {
    if (role === "admin") return "/admin";
    if (role === "business") return "/dashboard";
    if (role === "staff") return "/staff";
    if (role === "customer") return "/explore";
    if (isPublicBusinessEntry) return getBusinessAppUrl();
    return "/";
  }, [isPublicBusinessEntry, role]);

  const roleBadge = useMemo(() => {
    if (role === "admin") return t("nav.role.operator", "Operator");
    if (role === "business" || role === "staff" || isPublicBusinessEntry)
      return t("product.business.suffix", "Business");
    return null;
  }, [isPublicBusinessEntry, role, t]);

  return (
    <nav
      className={[
        "nav-simple",
        role === "admin" ? "nav-operator" : "",
        !role && isPublicBusinessEntry ? "nav-public-business" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="nav-simple-inner">
        <Link href={logoHref} className="logo">
          Mirë<span>book</span>
          {roleBadge && <em className="product-role-badge">{roleBadge}</em>}
        </Link>

        <div className="auth-nav-links">
          {loading && (
            <span className="muted small">
              {t("nav.checkingAccount", "Checking account...")}
            </span>
          )}

          {!loading && !role && <PublicNav />}

          {!loading && role === "admin" && (
            <AdminNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
              t={t}
            />
          )}

          {!loading && role === "customer" && (
            <CustomerNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
              t={t}
            />
          )}

          {!loading && role === "business" && (
            <BusinessNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
              t={t}
            />
          )}

          {!loading && role === "staff" && (
            <StaffNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
              t={t}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-nav-links {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: nowrap;
          justify-content: flex-end;
          min-width: 0;
        }

        .auth-nav-links :global(a),
        .auth-nav-links button {
          flex-shrink: 0;
        }

        .logo {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }

        .product-role-badge {
          font-style: normal;
          font-size: 0.7rem;
          line-height: 1;
          padding: 0.22rem 0.45rem;
          border-radius: 999px;
          color: var(--accent);
          background: var(--accent-dim);
          border: 1px solid rgba(255, 107, 53, 0.24);
        }

        .nav-operator {
          border-bottom-color: rgba(255, 107, 53, 0.24);
          background: linear-gradient(
            180deg,
            rgba(255, 107, 53, 0.07),
            rgba(11, 18, 32, 0)
          );
        }

        :global(.nav-simple) {
          position: sticky;
          top: 0;
          z-index: 40;
          backdrop-filter: blur(14px);
        }

        :global(.language-pill) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.2rem;
          height: 2rem;
          padding: 0 0.6rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 700;
        }

        @media (max-width: 860px) {
          .auth-nav-links {
            width: 100%;
            justify-content: flex-start;
            gap: 0.5rem;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 0.15rem 0 0.3rem;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .auth-nav-links::-webkit-scrollbar {
            display: none;
          }

          :global(.nav-wide-only) {
            display: none;
          }

          .product-role-badge {
            font-size: 0.66rem;
            padding: 0.18rem 0.4rem;
          }
        }

        @media (max-width: 540px) {
          :global(.nav-mobile-optional),
          :global(.public-register-link) {
            display: none;
          }

          :global(.nav-public-business .public-explore-link),
          :global(.nav-public-business .public-business-link) {
            display: none;
          }

          .auth-nav-links :global(a),
          .auth-nav-links button {
            width: auto;
            max-width: none;
            justify-content: center;
            white-space: nowrap;
          }

          .logo {
            font-size: 1rem;
          }

          .product-role-badge {
            max-width: 5.5rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          :global(.language-toggle),
          :global(.account-mode-pill) {
            width: auto;
            flex: 0 0 auto;
          }
        }

        @media (max-width: 360px) {
          .auth-nav-links {
            gap: 0.3rem;
          }

          .auth-nav-links :global(a),
          .auth-nav-links button {
            font-size: 0.8rem;
          }

          .auth-nav-links :global(.btn) {
            padding-inline: 0.55rem;
          }

          .auth-nav-links :global(.language-switcher) {
            gap: 0.15rem;
            padding-inline: 0.2rem;
          }

          .auth-nav-links :global(.language-switcher button) {
            padding-inline: 0.3rem;
          }
        }
      `}</style>
    </nav>
  );
}
