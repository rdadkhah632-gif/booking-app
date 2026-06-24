import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import SchedulePreviewCard from "@/components/dashboard-home/SchedulePreviewCard";
import {
  AvailabilityRow,
  Booking,
  BookingRequest,
  Business,
  ScheduleDay,
  Service,
  SetupStep,
  StaffMember,
} from "@/components/dashboard-home/dashboardHomeTypes";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

export default function DashboardHome() {
  const router = useRouter();
  const { t } = useI18n();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() =>
    formatDateValue(new Date()),
  );

  function formatDateValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfDay(date: Date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function endOfDay(date: Date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const capabilities = await getAccountCapabilities(
      session.user.id,
      session.user.email,
    );

    if (!capabilities.canUseBusiness) {
      router.replace(capabilities.defaultRoute);
      return;
    }

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, published, category, city")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (businessError) {
      setError(businessError.message);
      setLoading(false);
      return;
    }

    const ownedBusinesses = businessData || [];
    setBusinesses(ownedBusinesses);

    const businessIds = ownedBusinesses.map((business) => business.id);

    if (businessIds.length === 0) {
      setBookings([]);
      setRequests([]);
      setServices([]);
      setStaffMembers([]);
      setAvailabilityRows([]);
      setLoading(false);
      return;
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        business_id,
        customer_name,
        start_at,
        duration_minutes,
        service_id,
        status,
        created_at,
        businesses ( name ),
        services ( id, name, price ),
        staff_members ( name, role_title )
      `,
      )
      .in("business_id", businessIds)
      .order("start_at", { ascending: true });

    if (bookingError) {
      setError(bookingError.message);
      setLoading(false);
      return;
    }

    const normalisedBookings = (bookingData || []).map((booking: any) => ({
      ...booking,
      businesses: Array.isArray(booking.businesses)
        ? booking.businesses[0] || null
        : booking.businesses,
      services: Array.isArray(booking.services)
        ? booking.services[0] || null
        : booking.services,
      staff_members: Array.isArray(booking.staff_members)
        ? booking.staff_members[0] || null
        : booking.staff_members,
    }));

    setBookings(normalisedBookings);

    const { data: requestData, error: requestError } = await supabase
      .from("booking_requests")
      .select("id, booking_id, business_id, status, created_at")
      .in("business_id", businessIds)
      .order("created_at", { ascending: false });

    if (requestError) {
      setError(requestError.message);
      setLoading(false);
      return;
    }

    setRequests(requestData || []);

    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .select("id, business_id, active")
      .in("business_id", businessIds);

    if (serviceError) {
      setError(serviceError.message);
      setLoading(false);
      return;
    }

    setServices(serviceData || []);

    const { data: staffData, error: staffError } = await supabase
      .from("staff_members")
      .select("id, business_id, active")
      .in("business_id", businessIds);

    if (staffError) {
      setError(staffError.message);
      setLoading(false);
      return;
    }

    setStaffMembers(staffData || []);

    const { data: availabilityData, error: availabilityError } = await supabase
      .from("availability")
      .select("id, business_id, is_closed")
      .in("business_id", businessIds);

    if (availabilityError) {
      setError(availabilityError.message);
      setLoading(false);
      return;
    }

    setAvailabilityRows(availabilityData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadDashboard();
      }
    }

    window.addEventListener("focus", loadDashboard);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", loadDashboard);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, []);

  const now = useMemo(() => new Date(), [bookings]);

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const todayBookings = useMemo(() => {
    const today = new Date();

    return bookings.filter((booking) => {
      const date = new Date(booking.start_at);
      return (
        booking.status === "confirmed" &&
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter(
        (booking) =>
          booking.status === "confirmed" && new Date(booking.start_at) >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
  }, [bookings, now]);

  const pendingRescheduleCount = useMemo(() => {
    const uniqueBookings = new Set(
      requests
        .filter((request) => request.status === "pending")
        .map((request) => request.booking_id),
    );

    return uniqueBookings.size;
  }, [requests]);

  const pendingActionCount = pendingBookings.length + pendingRescheduleCount;
  const primaryBusinessId = businesses[0]?.id;
  const primaryBusiness = businesses[0];
  const publishedCount = businesses.filter(
    (business) => business.published,
  ).length;
  const activeServices = services.filter((service) => service.active).length;
  const activeStaff = staffMembers.filter((staff) => staff.active).length;
  const openWorkingDays = availabilityRows.filter(
    (row) => row.is_closed !== true,
  ).length;
  const hasProfileBasics = Boolean(
    primaryBusiness?.name?.trim() &&
    (primaryBusiness.category?.trim() || primaryBusiness.city?.trim()),
  );
  const publicPreviewHref = primaryBusinessId
    ? `/explore/${primaryBusinessId}`
    : undefined;
  const readyToTakeBookings =
    hasProfileBasics &&
    activeServices > 0 &&
    activeStaff > 0 &&
    openWorkingDays > 0 &&
    publishedCount > 0;
  const todayStatusLabel = readyToTakeBookings
    ? t("dashboardHome.status.ready", "Ready to take bookings")
    : publishedCount > 0
      ? t("dashboardHome.status.hidden", "Hidden from Explore")
      : t("dashboardHome.status.setupNeeded", "Setup needed");

  const setupSteps = useMemo<SetupStep[]>(() => {
    return [
      {
        key: "profile",
        complete: businesses.length > 0 && hasProfileBasics,
        label: t("dashboardHome.setup.profile", "Business profile"),
        href: "/dashboard/businesses",
        cta: t("dashboardHome.setup.profileCta", "Add details"),
      },
      {
        key: "services",
        complete: activeServices > 0,
        label: t("dashboardHome.setup.services", "First service"),
        href: "/dashboard/services",
        cta: t("dashboardHome.setup.servicesCta", "Add service"),
      },
      {
        key: "team",
        complete: activeStaff > 0,
        label: t("dashboardHome.setup.team", "Team"),
        href: "/dashboard/staff",
        cta: t("dashboardHome.setup.teamCta", "Add staff"),
      },
      {
        key: "hours",
        complete: openWorkingDays > 0,
        label: t("dashboardHome.setup.hours", "Working hours"),
        href: "/dashboard/availability",
        cta: t("dashboardHome.setup.hoursCta", "Set hours"),
      },
      {
        key: "publish",
        complete: publishedCount > 0,
        label: t("dashboardHome.setup.publish", "Customer profile"),
        href: "/dashboard/businesses",
        cta: t("dashboardHome.setup.publishCta", "Review profile"),
      },
    ];
  }, [
    businesses.length,
    hasProfileBasics,
    activeServices,
    activeStaff,
    openWorkingDays,
    publishedCount,
    t,
  ]);

  const nextSetupStep = setupSteps.find((step) => !step.complete) || null;
  const primaryNextAction = pendingActionCount
    ? {
        title: t(
          "dashboardHome.today.nextRequests",
          "Review appointment requests",
        ),
        body: t(
          "dashboardHome.today.nextRequestsBody",
          "Customers are waiting for a decision.",
        ),
        href: "/dashboard/bookings?view=upcoming&status=pending",
        cta: t("dashboardHome.today.nextRequestsCta", "Open requests"),
      }
    : todayBookings.length
      ? {
          title: t(
            "dashboardHome.today.nextCalendar",
            "Run today from Calendar",
          ),
          body: t(
            "dashboardHome.today.nextCalendarBody",
            "Confirmed appointments for today are ready.",
          ),
          href: "/dashboard/bookings?view=today",
          cta: t("dashboardHome.today.nextCalendarCta", "Open today"),
        }
      : nextSetupStep
        ? {
            title: nextSetupStep.label,
            body: t(
              "dashboardHome.today.nextSetupBody",
              "Finish this setup step so customers can book with confidence.",
            ),
            href: nextSetupStep.href,
            cta: nextSetupStep.cta,
          }
        : {
            title: t("dashboardHome.today.nextReady", "Ready to take bookings"),
            body: t(
              "dashboardHome.today.nextReadyBody",
              "Your core setup is complete. Preview the customer profile or open Calendar.",
            ),
            href: publicPreviewHref || "/dashboard/bookings",
            cta: publicPreviewHref
              ? t("dashboardHome.setup.preview", "See what customers see")
              : t("dashboardLayout.nav.calendar", "Calendar"),
          };

  const scheduleDays = useMemo<ScheduleDay[]>(() => {
    const today = startOfDay(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index);
      const dateString = formatDateValue(date);

      const dayBookings = bookings
        .filter((booking) => {
          const bookingDate = new Date(booking.start_at);
          return (
            booking.status === "confirmed" &&
            bookingDate >= startOfDay(date) &&
            bookingDate <= endOfDay(date)
          );
        })
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        );

      return {
        date,
        dateString,
        label:
          index === 0
            ? t("dashboardHome.schedule.today", "Today")
            : index === 1
              ? t("dashboardHome.schedule.tomorrow", "Tomorrow")
              : date.toLocaleDateString(undefined, { weekday: "short" }),
        shortLabel: date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
        bookings: dayBookings,
      };
    });
  }, [bookings, t]);

  function bookingsLinkForDate(dateString: string, businessId?: string) {
    return `/dashboard/bookings?${new URLSearchParams({
      ...(businessId || primaryBusinessId
        ? { businessId: businessId || primaryBusinessId }
        : {}),
      date: dateString,
    }).toString()}`;
  }

  if (loading) {
    return (
      <DashboardLayout title={t("common.loading", "Loading...")}>
        <p className="muted">
          {t("dashboardHome.checkingAccount", "Checking your account...")}
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t("dashboardHome.title", "Today")}
      subtitle={
        primaryBusiness?.name ||
        t("dashboardHome.subtitle", "Appointments and requests for today.")
      }
    >
      {error && (
        <div
          className="card"
          style={{ borderColor: "rgba(255,77,109,0.35)", marginBottom: "1rem" }}
        >
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {businesses.length === 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3>
            {t("dashboardHome.empty.title", "Create your first business")}
          </h3>
          <p className="muted">
            {t(
              "dashboardHome.empty.body",
              "Add a business profile, then create services, staff and working hours before publishing it to Mirëbook customers.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "0.75rem" }}
          >
            {t("dashboardHome.empty.cta", "Create business profile")}
          </Link>
        </div>
      )}

      {businesses.length > 0 && (
        <section className="dashboard-today-panel">
          <div className="dashboard-today-main">
            <div className="dashboard-today-heading">
              <div>
                <h2>
                  {t("dashboardHome.today.title", "What needs attention today")}
                </h2>
              </div>
              <span
                className={
                  readyToTakeBookings ? "today-status ready" : "today-status"
                }
              >
                {todayStatusLabel}
              </span>
            </div>

            <div className="dashboard-today-stats">
              <Link
                href="/dashboard/bookings?view=upcoming&status=pending"
                className={
                  pendingActionCount > 0 ? "today-stat urgent" : "today-stat"
                }
              >
                <span className="today-stat-number">{pendingActionCount}</span>
                <span className="today-stat-label">
                  {t("dashboardHome.today.requests", "Needs attention")}
                </span>
              </Link>
              <Link
                href="/dashboard/bookings?view=today"
                className="today-stat"
              >
                <span className="today-stat-number">
                  {todayBookings.length}
                </span>
                <span className="today-stat-label">
                  {t("dashboardHome.today.confirmedToday", "Today")}
                </span>
              </Link>
              <Link
                href="/dashboard/bookings?view=upcoming"
                className="today-stat"
              >
                <span className="today-stat-number">
                  {upcomingBookings.length}
                </span>
                <span className="today-stat-label">
                  {t("dashboardHome.today.upcoming", "Upcoming")}
                </span>
              </Link>
            </div>
          </div>

          <div className="dashboard-next-action">
            <span className="small muted">
              {t("dashboardHome.today.nextLabel", "Next action")}
            </span>
            <strong>{primaryNextAction.title}</strong>
            <p className="small muted">{primaryNextAction.body}</p>
            <Link href={primaryNextAction.href} className="btn btn-accent">
              {primaryNextAction.cta}
            </Link>
          </div>
        </section>
      )}

      <SchedulePreviewCard
        scheduleDays={scheduleDays}
        bookingsLinkForDate={bookingsLinkForDate}
      />

      <style jsx>{`
        .dashboard-today-panel {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.72fr);
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .dashboard-today-main,
        .dashboard-next-action {
          display: grid;
          gap: 0.85rem;
          align-content: start;
        }

        .dashboard-today-panel h2,
        .dashboard-today-panel p {
          margin-top: 0;
        }

        .dashboard-today-heading {
          display: grid;
          gap: 0.5rem;
        }

        .today-status {
          width: fit-content;
          padding: 0.3rem 0.65rem;
          border-radius: 999px;
          background: rgba(255, 190, 11, 0.1);
          color: var(--warning);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .today-status.ready {
          background: rgba(45, 212, 191, 0.1);
          color: var(--success);
        }

        .dashboard-today-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
        }

        :global(.today-stat) {
          display: grid;
          grid-template-columns: 3rem minmax(0, 1fr);
          gap: 0.8rem;
          align-items: center;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        :global(.today-stat.urgent) {
          border-color: rgba(255, 107, 53, 0.35);
          background: rgba(255, 107, 53, 0.08);
        }

        :global(.today-stat-number) {
          display: block;
          min-width: 3rem;
          color: inherit;
          font-family: var(--font-display);
          font-size: 1.8rem;
          line-height: 1;
        }

        :global(.today-stat-label) {
          display: block;
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.84rem;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: normal;
        }

        .dashboard-next-action {
          padding-left: 1rem;
          border-left: 1px solid var(--border);
        }

        .dashboard-next-action :global(.btn) {
          width: fit-content;
        }

        @media (max-width: 820px) {
          .dashboard-today-panel {
            grid-template-columns: 1fr;
          }

          .dashboard-next-action {
            padding-left: 0;
            padding-top: 1rem;
            border-left: 0;
            border-top: 1px solid var(--border);
          }
        }

        @media (max-width: 560px) {
          .dashboard-today-stats {
            grid-template-columns: 1fr;
          }

          .dashboard-next-action :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
