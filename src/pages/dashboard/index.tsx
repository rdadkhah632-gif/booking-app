import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AvailabilityRow,
  Booking,
  BookingRequest,
  Business,
  DepartureSummary,
  Service,
  SetupStep,
  StaffMember,
  StaffServiceAssignment,
} from "@/components/dashboard-home/dashboardHomeTypes";
import { useI18n } from "@/lib/useI18n";
import { formatLocalizedDate } from "@/lib/i18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import { dateKeyInTimeZone } from "@/lib/timezone";
import { getRoleLoginHref } from "@/lib/auth/getRoleLoginHref";

export default function DashboardHome() {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<StaffServiceAssignment[]>(
    [],
  );
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>(
    [],
  );
  const [scheduledDepartures, setScheduledDepartures] = useState<
    DepartureSummary[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace(getRoleLoginHref(router.asPath, "/dashboard"));
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
      .select("id, name, published, category, city, timezone")
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
      setStaffServices([]);
      setAvailabilityRows([]);
      setScheduledDepartures([]);
      setLoading(false);
      return;
    }

    const [
      { data: bookingData, error: bookingError },
      { data: requestData, error: requestError },
      { data: serviceData, error: serviceError },
      { data: staffData, error: staffError },
      { data: availabilityData, error: availabilityError },
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          `
          id,
          business_id,
          customer_name,
          start_at,
          duration_minutes,
          service_id,
          departure_id,
          status,
          created_at,
          businesses ( name ),
          services ( id, name, price ),
          staff_members ( name, role_title )
        `,
        )
        .in("business_id", businessIds)
        .order("start_at", { ascending: true }),
      supabase
        .from("booking_requests")
        .select("id, booking_id, business_id, status, created_at")
        .in("business_id", businessIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id, business_id, active, booking_type, owner_review_required")
        .in("business_id", businessIds),
      supabase
        .from("staff_members")
        .select("id, business_id, active")
        .in("business_id", businessIds),
      supabase
        .from("availability")
        .select("id, business_id, is_closed")
        .in("business_id", businessIds),
    ]);

    const initialLoadError =
      bookingError ||
      requestError ||
      serviceError ||
      staffError ||
      availabilityError;
    if (initialLoadError) {
      setError(initialLoadError.message);
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

    setRequests(requestData || []);
    setServices(serviceData || []);
    setStaffMembers(staffData || []);
    setAvailabilityRows(availabilityData || []);

    const activeStaffIds = (staffData || [])
      .filter((staff) => staff.active)
      .map((staff) => staff.id);

    const groupBusinessIds = Array.from(
      new Set(
        (serviceData || [])
          .filter((service) => service.booking_type === "group")
          .map((service) => service.business_id),
      ),
    );
    const [staffServiceResult, departureResponses] = await Promise.all([
      activeStaffIds.length > 0
        ? supabase
            .from("staff_services")
            .select("staff_member_id, service_id")
            .in("staff_member_id", activeStaffIds)
        : Promise.resolve({
            data: [] as StaffServiceAssignment[],
            error: null,
          }),
      Promise.all(
        groupBusinessIds.map(async (ownedBusinessId) => {
          try {
            const response = await fetch(
              `/api/dashboard/departures?businessId=${ownedBusinessId}`,
              {
                headers: { Authorization: `Bearer ${session.access_token}` },
              },
            );
            if (!response.ok) return [];
            const payload = (await response.json()) as {
              departures?: Array<{
                business_id: string;
                service_id: string;
                start_at: string;
                status: string;
              }>;
            };
            return (payload.departures || [])
              .filter(
                (departure) =>
                  departure.status === "scheduled" &&
                  new Date(departure.start_at) > new Date(),
              )
              .map((departure) => ({
                business_id: departure.business_id,
                service_id: departure.service_id,
              }));
          } catch {
            return [];
          }
        }),
      ),
    ]);
    if (staffServiceResult.error) {
      setError(staffServiceResult.error.message);
      setLoading(false);
      return;
    }

    setStaffServices(staffServiceResult.data || []);
    setScheduledDepartures(departureResponses.flat());
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
  const businessTimeZoneById = useMemo(
    () =>
      new Map(
        businesses.map((business) => [business.id, business.timezone || null]),
      ),
    [businesses],
  );

  function timeZoneForBooking(booking: Booking) {
    return (
      businessTimeZoneById.get(booking.business_id) ||
      businesses[0]?.timezone ||
      undefined
    );
  }

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const todayBookings = useMemo(() => {
    const today = new Date();

    return bookings.filter((booking) => {
      const timeZone = timeZoneForBooking(booking);
      return (
        booking.status === "confirmed" &&
        dateKeyInTimeZone(new Date(booking.start_at), timeZone) ===
          dateKeyInTimeZone(today, timeZone)
      );
    });
  }, [bookings, businessTimeZoneById, businesses]);

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
  const nextBooking = upcomingBookings[0] || null;
  const nextTodayBooking = todayBookings[0] || null;
  const primaryBusinessId = businesses[0]?.id;
  const primaryBusiness = businesses[0];
  const primaryServices = services.filter(
    (service) => service.business_id === primaryBusinessId,
  );
  const preparedServiceReviewCount = primaryServices.filter(
    (service) => service.owner_review_required,
  ).length;
  const activeServiceIds = new Set(
    primaryServices
      .filter((service) => service.active)
      .map((service) => service.id),
  );
  const activeAppointmentServiceIds = new Set(
    primaryServices
      .filter((service) => service.active && service.booking_type !== "group")
      .map((service) => service.id),
  );
  const activeGroupServiceIds = new Set(
    primaryServices
      .filter((service) => service.active && service.booking_type === "group")
      .map((service) => service.id),
  );
  const activeStaffIds = new Set(
    staffMembers
      .filter(
        (staff) => staff.business_id === primaryBusinessId && staff.active,
      )
      .map((staff) => staff.id),
  );
  const activeServices = activeServiceIds.size;
  const activeStaff = activeStaffIds.size;
  const activeAssignments = staffServices.filter(
    (assignment) =>
      activeStaffIds.has(assignment.staff_member_id) &&
      activeAppointmentServiceIds.has(assignment.service_id),
  ).length;
  const openWorkingDays = availabilityRows.filter(
    (row) => row.business_id === primaryBusinessId && row.is_closed !== true,
  ).length;
  const hasProfileBasics = Boolean(
    primaryBusiness?.name?.trim() &&
    primaryBusiness.category?.trim() &&
    primaryBusiness.city?.trim(),
  );
  const isPublished = Boolean(primaryBusiness?.published);
  const hasBookableAppointments =
    activeAppointmentServiceIds.size > 0 &&
    activeStaff > 0 &&
    activeAssignments > 0 &&
    openWorkingDays > 0;
  const hasScheduledDepartures = scheduledDepartures.some(
    (departure) =>
      departure.business_id === primaryBusinessId &&
      activeGroupServiceIds.has(departure.service_id),
  );
  const hasReadyBookingPath = hasBookableAppointments || hasScheduledDepartures;
  const publicPreviewHref = primaryBusinessId
    ? `/explore/${primaryBusinessId}`
    : undefined;
  const setupSteps = useMemo<SetupStep[]>(() => {
    const steps: SetupStep[] = [
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
        label:
          preparedServiceReviewCount > 0 && activeServices === 0
            ? t(
                "dashboardHome.setup.reviewServices",
                "Review prepared services",
              )
            : t("dashboardHome.setup.services", "First service"),
        href: "/dashboard/services",
        cta:
          preparedServiceReviewCount > 0 && activeServices === 0
            ? t("dashboardHome.setup.reviewServicesCta", "Review services")
            : t("dashboardHome.setup.servicesCta", "Add service"),
      },
    ];

    if (activeServices > 0 && !hasReadyBookingPath) {
      const hasAppointmentServices = activeAppointmentServiceIds.size > 0;
      const hasGroupServices = activeGroupServiceIds.size > 0;

      if (hasAppointmentServices && hasGroupServices) {
        steps.push({
          key: "availability",
          complete: false,
          label: t(
            "dashboardHome.setup.bookingAvailability",
            "Booking availability",
          ),
          href: "/dashboard/services",
          cta: t(
            "dashboardHome.setup.bookingAvailabilityCta",
            "Choose a booking setup",
          ),
        });
      } else if (hasAppointmentServices) {
        steps.push(
          {
            key: "team",
            complete: activeStaff > 0 && activeAssignments > 0,
            label: t("dashboardHome.setup.team", "Team"),
            href: "/dashboard/staff",
            cta:
              activeStaff > 0
                ? t("dashboardHome.setup.teamAssignCta", "Assign services")
                : t("dashboardHome.setup.teamCta", "Add staff"),
          },
          {
            key: "hours",
            complete: openWorkingDays > 0,
            label: t("dashboardHome.setup.hours", "Working hours"),
            href: "/dashboard/availability",
            cta: t("dashboardHome.setup.hoursCta", "Set hours"),
          },
        );
      }

      if (hasGroupServices && !hasAppointmentServices) {
        steps.push({
          key: "departures",
          complete: hasScheduledDepartures,
          label: t("dashboardHome.setup.departures", "First departure"),
          href: "/dashboard/departures",
          cta: t("dashboardHome.setup.departuresCta", "Add departure"),
        });
      }
    }

    steps.push({
      key: "publish",
      complete: isPublished,
      label: t("dashboardHome.setup.publish", "Customer profile"),
      href: "/dashboard/businesses",
      cta: t("dashboardHome.setup.publishCta", "Review profile"),
    });

    return steps;
  }, [
    businesses.length,
    hasProfileBasics,
    activeServices,
    preparedServiceReviewCount,
    hasReadyBookingPath,
    activeAppointmentServiceIds.size,
    activeGroupServiceIds.size,
    activeStaff,
    activeAssignments,
    openWorkingDays,
    hasScheduledDepartures,
    isPublished,
    t,
  ]);

  const nextSetupStep = setupSteps.find((step) => !step.complete) || null;
  const requiredSetupReady =
    hasProfileBasics && activeServices > 0 && hasReadyBookingPath;
  const readyToTakeBookings = requiredSetupReady && isPublished;
  const todayStatusLabel = readyToTakeBookings
    ? t("dashboardHome.status.ready", "Ready to take bookings")
    : requiredSetupReady
      ? t("dashboardHome.status.readyToPublish", "Ready to publish")
      : t("dashboardHome.status.setupNeeded", "Setup needed");
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
        href: "/dashboard/notifications",
        cta: t("dashboardHome.today.nextRequestsCta", "Open inbox"),
      }
    : todayBookings.length
      ? {
          title: nextTodayBooking?.departure_id
            ? t("dashboardHome.today.nextDeparture", "Open today's departure")
            : t("dashboardHome.today.nextCalendar", "Run today from Calendar"),
          body: nextTodayBooking?.departure_id
            ? t(
                "dashboardHome.today.nextDepartureBody",
                "Review the seats, guest list and meeting details for the next departure.",
              )
            : t(
                "dashboardHome.today.nextCalendarBody",
                "Confirmed appointments for today are ready.",
              ),
          href: nextTodayBooking?.departure_id
            ? `/dashboard/departures?${new URLSearchParams({
                businessId: nextTodayBooking.business_id,
                departureId: nextTodayBooking.departure_id,
              }).toString()}`
            : bookingsLinkForDate(
                dateKeyInTimeZone(new Date(), primaryBusiness?.timezone),
              ),
          cta: nextTodayBooking?.departure_id
            ? t("dashboardHome.today.nextDepartureCta", "Open departure")
            : t("dashboardHome.today.nextCalendarCta", "Open today"),
        }
      : nextSetupStep
        ? {
            title: nextSetupStep.label,
            body:
              nextSetupStep.key === "publish" && requiredSetupReady
                ? t(
                    "dashboardHome.today.nextPublishBody",
                    "Required booking setup is complete. Review your customer profile, then publish when it is ready.",
                  )
                : t(
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
        t("dashboardHome.subtitle", "Bookings and requests for today.")
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
          <header className="dashboard-today-heading">
            <h2>{t("dashboardHome.today.overviewTitle", "Your day")}</h2>
            <span
              className={
                readyToTakeBookings ? "today-status ready" : "today-status"
              }
            >
              {todayStatusLabel}
            </span>
          </header>

          <div className="dashboard-today-grid">
            <article className="today-next-card">
              <span className="today-section-label">
                {t("dashboardHome.today.nextAppointment", "Next booking")}
              </span>
              {nextBooking ? (
                <>
                  <div className="today-appointment-time">
                    {formatLocalizedDate(nextBooking.start_at, locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: timeZoneForBooking(nextBooking),
                    })}
                    <strong>
                      {formatLocalizedDate(nextBooking.start_at, locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: timeZoneForBooking(nextBooking),
                      })}
                    </strong>
                  </div>
                  <div className="today-appointment-copy">
                    <strong>{nextBooking.customer_name}</strong>
                    <span>
                      {nextBooking.services?.name ||
                        t("common.service", "Service")}
                      {nextBooking.staff_members?.name
                        ? ` · ${nextBooking.staff_members.name}`
                        : ""}
                    </span>
                  </div>
                  <Link
                    href={
                      nextBooking.departure_id
                        ? `/dashboard/departures?${new URLSearchParams({
                            businessId: nextBooking.business_id,
                            departureId: nextBooking.departure_id,
                          }).toString()}`
                        : bookingsLinkForDate(
                            dateKeyInTimeZone(
                              new Date(nextBooking.start_at),
                              timeZoneForBooking(nextBooking),
                            ),
                            nextBooking.business_id,
                          )
                    }
                    className="today-inline-link"
                  >
                    {nextBooking.departure_id
                      ? t("dashboardHome.today.openDeparture", "Open departure")
                      : t(
                          "dashboardHome.today.openCalendar",
                          "Open in Calendar",
                        )}
                  </Link>
                </>
              ) : (
                <div className="today-empty-copy">
                  <strong>
                    {t(
                      "dashboardHome.today.noUpcoming",
                      "No upcoming bookings",
                    )}
                  </strong>
                  <span>
                    {t(
                      "dashboardHome.today.noUpcomingBody",
                      "New confirmed bookings will appear here.",
                    )}
                  </span>
                </div>
              )}
            </article>

            <article
              className={
                pendingActionCount > 0
                  ? "today-focus-card urgent"
                  : "today-focus-card"
              }
            >
              <span className="today-section-label">
                {t("dashboardHome.today.nextLabel", "Next action")}
              </span>
              <strong>{primaryNextAction.title}</strong>
              <p>{primaryNextAction.body}</p>
              <div className="today-focus-footer">
                {pendingActionCount > 0 && (
                  <span className="today-action-count">
                    {pendingActionCount}
                  </span>
                )}
                <Link href={primaryNextAction.href} className="btn btn-accent">
                  {primaryNextAction.cta}
                </Link>
              </div>
            </article>
          </div>
        </section>
      )}

      <style jsx>{`
        .dashboard-today-panel {
          display: grid;
          gap: 0.9rem;
          margin-bottom: 1.25rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .dashboard-today-panel h2,
        .dashboard-today-panel p {
          margin: 0;
        }

        .dashboard-today-heading {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
        }

        .dashboard-today-heading h2 {
          font-size: 1.3rem;
        }

        .dashboard-today-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
          gap: 0.75rem;
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

        .today-next-card,
        .today-focus-card {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
          padding: 0.9rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
        }

        .today-focus-card.urgent {
          border-color: rgba(255, 107, 53, 0.35);
          background: rgba(255, 107, 53, 0.08);
        }

        .today-section-label {
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .today-appointment-time {
          display: flex;
          gap: 0.45rem;
          align-items: baseline;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 700;
        }

        .today-appointment-time strong {
          color: var(--text);
          font-size: 1.15rem;
        }

        .today-appointment-copy,
        .today-empty-copy {
          display: grid;
          gap: 0.12rem;
        }

        .today-appointment-copy span,
        .today-empty-copy span,
        .today-focus-card p {
          color: var(--text-muted);
          font-size: 0.84rem;
        }

        :global(.today-inline-link) {
          width: fit-content;
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 800;
        }

        .today-focus-footer {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          margin-top: auto;
        }

        .today-action-count {
          display: inline-flex;
          width: 2rem;
          height: 2rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: var(--accent);
          color: var(--bg);
          font-weight: 900;
        }

        @media (max-width: 820px) {
          .dashboard-today-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .dashboard-today-panel {
            padding: 0.75rem;
          }

          .dashboard-today-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .today-focus-footer :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
