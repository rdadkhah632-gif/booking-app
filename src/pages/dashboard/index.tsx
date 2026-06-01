import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardHomeHeader from "@/components/dashboard-home/DashboardHomeHeader";
import DashboardSummaryCards from "@/components/dashboard-home/DashboardSummaryCards";
import PriorityQueueCard from "@/components/dashboard-home/PriorityQueueCard";
import SchedulePreviewCard from "@/components/dashboard-home/SchedulePreviewCard";
import SetupGuidanceList from "@/components/dashboard-home/SetupGuidanceList";
import {
  AvailabilityRow,
  Booking,
  BookingRequest,
  Business,
  ScheduleDay,
  Service,
  SetupWarning,
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

  const nextBooking = useMemo(() => {
    return (
      bookings
        .filter(
          (booking) =>
            booking.status === "confirmed" && new Date(booking.start_at) >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        )[0] || null
    );
  }, [bookings, now]);

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

  const dashboardAnalytics = useMemo(() => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentBookings = bookings.filter(
      (booking) => new Date(booking.start_at) >= last30Days,
    );
    const recentCompleted = recentBookings.filter(
      (booking) => booking.status === "completed",
    );
    const recentConfirmed = recentBookings.filter(
      (booking) => booking.status === "confirmed",
    );
    const recentCancelled = recentBookings.filter(
      (booking) => booking.status === "cancelled",
    );

    const estimatedRevenue = recentCompleted.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0);
    }, 0);

    const estimatedUpcomingValue = recentConfirmed.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0);
    }, 0);

    const serviceCounts = recentBookings.reduce<
      Record<string, { name: string; count: number; value: number }>
    >((acc, booking) => {
      const serviceName =
        booking.services?.name ||
        t("dashboardHome.unknownService", "Unknown service");
      const serviceKey =
        booking.services?.id || booking.service_id || serviceName;

      if (!acc[serviceKey]) {
        acc[serviceKey] = {
          name: serviceName,
          count: 0,
          value: 0,
        };
      }

      acc[serviceKey].count += 1;
      acc[serviceKey].value += Number(booking.services?.price || 0);
      return acc;
    }, {});

    const topServices = Object.values(serviceCounts)
      .sort((a, b) => b.count - a.count || b.value - a.value)
      .slice(0, 3);

    const averageBookingValue =
      recentBookings.length > 0
        ? recentBookings.reduce(
            (total, booking) => total + Number(booking.services?.price || 0),
            0,
          ) / recentBookings.length
        : 0;

    return {
      recentBookings,
      recentCompleted,
      recentConfirmed,
      recentCancelled,
      estimatedRevenue,
      estimatedUpcomingValue,
      topServices,
      averageBookingValue,
    };
  }, [bookings]);

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
  const publishedCount = businesses.filter(
    (business) => business.published,
  ).length;
  const activeServices = services.filter((service) => service.active).length;
  const activeStaff = staffMembers.filter((staff) => staff.active).length;
  const openWorkingDays = availabilityRows.filter(
    (row) => row.is_closed !== true,
  ).length;

  const businessSetupReady =
    businesses.length > 0 &&
    activeServices > 0 &&
    activeStaff > 0 &&
    openWorkingDays > 0 &&
    publishedCount > 0;

  const setupWarnings = useMemo(() => {
    const warnings: SetupWarning[] = [];

    if (businesses.length === 0) {
      warnings.push({
        title: t(
          "dashboardHome.warnings.createProfile.title",
          "Create your business profile",
        ),
        body: t(
          "dashboardHome.warnings.createProfile.body",
          "You need a business profile before customers can book through Mirëbook.",
        ),
        href: "/dashboard/businesses",
        cta: t("dashboardHome.warnings.createProfile.cta", "Create profile"),
      });
      return warnings;
    }

    if (activeServices === 0) {
      warnings.push({
        title: t(
          "dashboardHome.warnings.services.title",
          "Add customer-facing services",
        ),
        body: t(
          "dashboardHome.warnings.services.body",
          "Customers need at least one active service before they can book.",
        ),
        href: "/dashboard/services",
        cta: t("dashboardHome.warnings.services.cta", "Add services"),
      });
    }

    if (activeStaff === 0) {
      warnings.push({
        title: t("dashboardHome.warnings.staff.title", "Add active staff"),
        body: t(
          "dashboardHome.warnings.staff.body",
          "Bookings need staff members assigned to services and working hours.",
        ),
        href: "/dashboard/staff",
        cta: t("dashboardHome.warnings.staff.cta", "Add staff"),
      });
    }

    if (openWorkingDays === 0) {
      warnings.push({
        title: t("dashboardHome.warnings.hours.title", "Set working hours"),
        body: t(
          "dashboardHome.warnings.hours.body",
          "At least one open business day is recommended before publishing.",
        ),
        href: "/dashboard/availability",
        cta: t("dashboardHome.warnings.hours.cta", "Set hours"),
      });
    }

    if (publishedCount === 0 && businesses.length > 0) {
      warnings.push({
        title: t("dashboardHome.warnings.publish.title", "Publish when ready"),
        body: t(
          "dashboardHome.warnings.publish.body",
          "Hidden businesses do not appear in the marketplace.",
        ),
        href: "/dashboard/businesses",
        cta: t("dashboardHome.warnings.publish.cta", "Review profile"),
      });
    }

    return warnings;
  }, [
    businesses.length,
    activeServices,
    activeStaff,
    openWorkingDays,
    publishedCount,
    t,
  ]);

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

  function bookingsLinkForView(
    view: string,
    status?: string,
    businessId?: string,
  ) {
    return `/dashboard/bookings?${new URLSearchParams({
      ...(businessId || primaryBusinessId
        ? { businessId: businessId || primaryBusinessId }
        : {}),
      view,
      ...(status ? { status } : {}),
    }).toString()}`;
  }

  function formatBookingTime(booking: Booking) {
    return new Date(booking.start_at).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      title={t("dashboardHome.title", "Business overview")}
      subtitle={t(
        "dashboardHome.subtitle",
        "A quick view of today’s appointments, customer actions and setup reminders.",
      )}
    >
      <DashboardHomeHeader loading={loading} onRefresh={loadDashboard} />

      {error && (
        <div
          className="card"
          style={{ borderColor: "rgba(255,77,109,0.35)", marginBottom: "1rem" }}
        >
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {businesses.length > 0 && (
        <div className="card dashboard-owner-command-card">
          <div>
            {/* kicker removed */}
            <h2 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
              {pendingActionCount > 0
                ? t(
                    "dashboardHome.ownerCommand.actionTitle",
                    "Customer actions need review",
                  )
                : todayBookings.length > 0
                  ? t(
                      "dashboardHome.ownerCommand.todayTitle",
                      "Today’s business schedule is active",
                    )
                  : t(
                      "dashboardHome.ownerCommand.readyTitle",
                      "Your business dashboard is ready",
                    )}
            </h2>
            <p className="small muted">
              {pendingActionCount > 0
                ? t(
                    "dashboardHome.ownerCommand.actionBody",
                    "Review pending bookings and customer requests before they affect the schedule.",
                  )
                : nextBooking
                  ? `${t("dashboardHome.ownerCommand.nextBooking", "Next confirmed booking")}: ${nextBooking.customer_name || t("common.customer", "Customer")} · ${formatBookingTime(nextBooking)}`
                  : t(
                      "dashboardHome.ownerCommand.noNextBooking",
                      "No confirmed upcoming bookings are waiting. Keep setup and availability up to date for new customers.",
                    )}
            </p>
          </div>

          <div className="dashboard-owner-command-actions">
            <Link
              href={bookingsLinkForView("needs-action", "pending")}
              className="btn btn-accent"
            >
              {pendingActionCount > 0
                ? t(
                    "dashboardHome.ownerCommand.reviewActions",
                    "Review actions",
                  )
                : t("dashboardHome.ownerCommand.viewBookings", "View bookings")}
            </Link>
            <Link href="/dashboard/businesses" className="btn btn-ghost">
              {businessSetupReady
                ? t("dashboardHome.ownerCommand.manageSetup", "Manage setup")
                : t("dashboardHome.ownerCommand.finishSetup", "Finish setup")}
            </Link>
            {/* Staff link removed */}
          </div>
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

      <DashboardSummaryCards
        todayCount={todayBookings.length}
        pendingActionCount={pendingActionCount}
        pendingBookingsCount={pendingBookings.length}
        pendingRescheduleCount={pendingRescheduleCount}
        analytics={dashboardAnalytics}
        bookingsLinkForView={bookingsLinkForView}
      />

      {businesses.length > 0 && (
        <div className="dashboard-readiness-strip">
          <div
            className={
              activeServices > 0
                ? "dashboard-readiness-item ready"
                : "dashboard-readiness-item"
            }
          >
            <strong>{activeServices}</strong>
            <span>
              {t("dashboardHome.readiness.services", "active services")}
            </span>
          </div>
          <div
            className={
              activeStaff > 0
                ? "dashboard-readiness-item ready"
                : "dashboard-readiness-item"
            }
          >
            <strong>{activeStaff}</strong>
            <span>{t("dashboardHome.readiness.staff", "active staff")}</span>
          </div>
          <div
            className={
              openWorkingDays > 0
                ? "dashboard-readiness-item ready"
                : "dashboard-readiness-item"
            }
          >
            <strong>{openWorkingDays}</strong>
            <span>
              {t("dashboardHome.readiness.workingDays", "open working days")}
            </span>
          </div>
          <div
            className={
              publishedCount > 0
                ? "dashboard-readiness-item ready"
                : "dashboard-readiness-item"
            }
          >
            <strong>{publishedCount}</strong>
            <span>
              {t("dashboardHome.readiness.published", "published profiles")}
            </span>
          </div>
        </div>
      )}

      <PriorityQueueCard
        pendingActionCount={pendingActionCount}
        bookingsLinkForView={bookingsLinkForView}
      />

      <SchedulePreviewCard
        scheduleDays={scheduleDays}
        bookingsLinkForDate={bookingsLinkForDate}
      />

      {/* owner/staff note block removed */}

      <SetupGuidanceList warnings={setupWarnings} />

      <style jsx>{`
        .dashboard-owner-command-card {
          display: flex;
          justify-content: space-between;
          gap: 0.9rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
          border-color: rgba(255, 107, 53, 0.24);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.08),
            rgba(11, 18, 32, 0)
          );
        }

        .dashboard-owner-command-card p {
          margin-top: 0;
        }

        .dashboard-owner-command-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }

        .dashboard-readiness-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
          margin: 0 0 1.25rem;
        }

        .dashboard-readiness-item {
          border: 1px solid rgba(255, 190, 11, 0.28);
          border-radius: 1rem;
          padding: 0.9rem;
          background: rgba(255, 190, 11, 0.06);
          display: grid;
          gap: 0.35rem;
        }

        .dashboard-readiness-item.ready {
          border-color: rgba(45, 212, 191, 0.28);
          background: rgba(45, 212, 191, 0.06);
        }

        .dashboard-readiness-item strong {
          font-size: 1.25rem;
        }

        .dashboard-readiness-item span {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        @media (max-width: 760px) {
          .dashboard-owner-command-card {
            display: grid;
          }

          .dashboard-owner-command-actions,
          .dashboard-owner-command-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .dashboard-readiness-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 480px) {
          .dashboard-readiness-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
