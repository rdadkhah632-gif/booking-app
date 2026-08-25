import Link from "next/link";
import { useRouter } from "next/router";
import {
  Bell,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type Workspace = "business" | "staff";

type Props = {
  workspace: Workspace;
  badgeCount?: number;
  badgeTarget?: "calendar" | "inbox";
};

export default function MobileWorkspaceDock({
  workspace,
  badgeCount = 0,
  badgeTarget = "inbox",
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const setupRoutes = [
    "/dashboard/businesses",
    "/dashboard/services",
    "/dashboard/staff",
    "/dashboard/availability",
    "/dashboard/settings",
    "/dashboard/analytics",
  ];
  const isBusiness = workspace === "business";
  const items = isBusiness
    ? [
        {
          key: "today",
          href: "/dashboard",
          label: t("dashboardLayout.nav.today", "Today"),
          icon: LayoutDashboard,
          active: router.pathname === "/dashboard",
        },
        {
          key: "calendar",
          href: "/dashboard/bookings",
          label: t("dashboardLayout.nav.calendar", "Calendar"),
          icon: CalendarDays,
          active: router.pathname === "/dashboard/bookings",
        },
        {
          key: "setup",
          href: "/dashboard/businesses",
          label: t("dashboardLayout.nav.setup", "Setup"),
          icon: Settings2,
          active: setupRoutes.some(
            (path) =>
              router.pathname === path || router.pathname.startsWith(`${path}/`),
          ),
        },
        {
          key: "inbox",
          href: "/dashboard/notifications",
          label: t("dashboardLayout.nav.inbox", "Inbox"),
          icon: Bell,
          active: router.pathname === "/dashboard/notifications",
        },
      ]
    : [
        {
          key: "today",
          href: "/staff",
          label: t("dashboardLayout.staffNav.today", "Today"),
          icon: LayoutDashboard,
          active: router.pathname === "/staff",
        },
        {
          key: "calendar",
          href: "/staff/calendar",
          label: t("dashboardLayout.staffNav.calendar", "Calendar"),
          icon: CalendarDays,
          active: router.pathname === "/staff/calendar",
        },
        {
          key: "availability",
          href: "/staff/availability",
          label: t("dashboardLayout.staffNav.availability", "Working hours"),
          icon: Clock3,
          active: router.pathname === "/staff/availability",
        },
        {
          key: "inbox",
          href: "/staff/notifications",
          label: t("dashboardLayout.staffNav.inbox", "Inbox"),
          icon: Bell,
          active: router.pathname === "/staff/notifications",
        },
      ];

  return (
    <>
      <nav
        className="mobile-workspace-dock"
        aria-label={
          isBusiness
            ? t("product.business.suffix", "Business")
            : t("staff.workspace.kicker", "Staff workspace")
        }
      >
        {items.map((item) => {
          const Icon = item.icon;
          const showBadge =
            badgeCount > 0 &&
            ((badgeTarget === "calendar" && item.key === "calendar") ||
              (badgeTarget === "inbox" && item.key === "inbox"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? "is-active" : ""}
              aria-current={item.active ? "page" : undefined}
              aria-label={
                showBadge
                  ? `${item.label} (${Math.min(badgeCount, 9)})`
                  : item.label
              }
            >
              <span className="mobile-workspace-dock-icon">
                <Icon size={21} strokeWidth={item.active ? 2.4 : 1.9} />
                {showBadge && (
                  <span className="mobile-workspace-dock-badge" aria-hidden="true">
                    {Math.min(badgeCount, 9)}
                  </span>
                )}
              </span>
              <span className="mobile-workspace-dock-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx global>{`
        .mobile-workspace-dock {
          display: none;
        }

        @media (max-width: 700px) and (min-height: 501px) {
          body {
            --mobile-workspace-dock-space: calc(
              66px + env(safe-area-inset-bottom)
            );
            padding-bottom: var(--mobile-workspace-dock-space);
          }

          .dashboard-layout {
            min-height: calc(100dvh - var(--mobile-workspace-dock-space));
          }

          .mobile-workspace-dock {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 70;
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            min-height: calc(66px + env(safe-area-inset-bottom));
            padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
            border-top: 1px solid rgba(17, 24, 39, 0.12);
            background: rgba(255, 255, 255, 0.97);
            box-shadow: 0 -8px 28px rgba(17, 24, 39, 0.1);
            backdrop-filter: blur(18px);
          }

          .mobile-workspace-dock a {
            position: relative;
            display: flex;
            min-width: 0;
            min-height: 54px;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 2px;
            padding: 2px 4px;
            border-radius: 7px;
            color: #6b7078;
            font-size: 0.68rem;
            font-weight: 700;
            line-height: 1.05;
            text-align: center;
            text-decoration: none;
            -webkit-tap-highlight-color: transparent;
          }

          .mobile-workspace-dock a.is-active {
            color: #19191b;
          }

          .mobile-workspace-dock a.is-active::after {
            position: absolute;
            bottom: calc(2px + env(safe-area-inset-bottom));
            width: 22px;
            height: 2px;
            border-radius: 999px;
            background: #ed5a2a;
            content: "";
          }

          .mobile-workspace-dock-icon {
            position: relative;
            display: inline-flex;
            flex: 0 0 auto;
          }

          .mobile-workspace-dock-label {
            display: block;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-workspace-dock-badge {
            position: absolute;
            top: -6px;
            right: -9px;
            display: grid;
            min-width: 16px;
            height: 16px;
            place-items: center;
            padding: 0 4px;
            border: 2px solid #ffffff;
            border-radius: 999px;
            background: #ed5a2a;
            color: #ffffff;
            font-size: 0.58rem;
            font-weight: 800;
          }
        }
      `}</style>
    </>
  );
}
