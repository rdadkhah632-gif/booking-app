import Link from "next/link";
import { useRouter } from "next/router";
import { Bell, CalendarDays, Map, Search, UserRound } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type Props = {
  notificationCount: number;
};

export default function MobileCustomerDock({ notificationCount }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const isMap = router.pathname === "/explore" && router.query.view === "map";

  const items: Array<{
    href: string;
    label: string;
    icon: typeof Search;
    active: boolean;
    count?: number;
  }> = [
    {
      href: "/explore",
      label: t("nav.mobile.explore", "Explore"),
      icon: Search,
      active:
        router.pathname.startsWith("/places/") ||
        (router.pathname.startsWith("/explore") && !isMap),
    },
    {
      href: "/explore?view=map",
      label: t("nav.mobile.map", "Map"),
      icon: Map,
      active: isMap,
    },
    {
      href: "/my-bookings",
      label: t("nav.mobile.bookings", "Bookings"),
      icon: CalendarDays,
      active:
        router.pathname === "/my-bookings" ||
        router.pathname === "/booking-confirmation" ||
        router.pathname === "/reschedule-booking",
    },
    {
      href: "/notifications",
      label: t("nav.mobile.updates", "Updates"),
      icon: Bell,
      active: router.pathname === "/notifications",
      count: notificationCount,
    },
    {
      href: "/account",
      label: t("nav.mobile.account", "Account"),
      icon: UserRound,
      active:
        router.pathname === "/account" ||
        router.pathname === "/login" ||
        router.pathname === "/register" ||
        router.pathname === "/forgot-password" ||
        router.pathname === "/reset-password" ||
        router.pathname.startsWith("/support/customer") ||
        router.pathname.startsWith("/support/messages"),
    },
  ];

  return (
    <>
      <nav
        className="mobile-customer-dock"
        aria-label={t("nav.mobile.label", "Customer navigation")}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? "is-active" : ""}
              aria-current={item.active ? "page" : undefined}
              aria-label={
                item.count
                  ? `${item.label} (${Math.min(item.count, 9)})`
                  : item.label
              }
            >
              <span className="mobile-dock-icon">
                <Icon size={21} strokeWidth={item.active ? 2.4 : 1.9} />
                {Boolean(item.count) && (
                  <span className="mobile-dock-badge" aria-hidden="true">
                    {Math.min(item.count || 0, 9)}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx global>{`
        .mobile-customer-dock {
          display: none;
        }

        @media (max-width: 700px) and (min-height: 501px) {
          body {
            --mobile-customer-dock-space: calc(
              66px + env(safe-area-inset-bottom)
            );
            padding-bottom: var(--mobile-customer-dock-space);
          }

          .mobile-customer-dock {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 70;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            min-height: calc(66px + env(safe-area-inset-bottom));
            padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
            border-top: 1px solid rgba(17, 24, 39, 0.12);
            background: rgba(255, 255, 255, 0.97);
            box-shadow: 0 -8px 28px rgba(17, 24, 39, 0.08);
            backdrop-filter: blur(18px);
          }

          .mobile-customer-dock a {
            display: flex;
            min-width: 0;
            min-height: 54px;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 2px;
            border-radius: 7px;
            color: #6b7078;
            font-size: 0.68rem;
            font-weight: 700;
            line-height: 1;
            text-decoration: none;
            -webkit-tap-highlight-color: transparent;
          }

          .mobile-customer-dock a.is-active {
            color: #19191b;
          }

          .mobile-customer-dock a.is-active::after {
            position: absolute;
            bottom: calc(3px + env(safe-area-inset-bottom));
            width: 20px;
            height: 2px;
            border-radius: 999px;
            background: #ed5a2a;
            content: "";
          }

          .mobile-dock-icon {
            position: relative;
            display: inline-flex;
          }

          .mobile-dock-badge {
            position: absolute;
            top: -6px;
            right: -8px;
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
