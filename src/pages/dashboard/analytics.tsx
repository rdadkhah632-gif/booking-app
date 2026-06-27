import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

type Timeframe = "7d" | "30d" | "90d" | "all";

type Business = {
  id: string;
  name: string;
  published: boolean;
};

type Booking = {
  id: string;
  business_id: string;
  customer_name: string;
  start_at: string;
  duration_minutes: number;
  status: string;
  service_id?: string | null;
  businesses?: {
    name: string;
  } | null;
  services?: {
    id?: string;
    name: string;
    price?: number | null;
  } | null;
  staff_members?: {
    name: string;
    role_title?: string | null;
  } | null;
};

type ServiceSummary = {
  key: string;
  name: string;
  count: number;
  completed: number;
  confirmed: number;
  cancelled: number;
  estimatedValue: number;
};

type DailySummary = {
  label: string;
  dateKey: string;
  count: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  value: number;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
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
      .select("id, name, published")
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
        status,
        service_id,
        businesses ( name ),
        services ( id, name, price ),
        staff_members ( name, role_title )
      `,
      )
      .in("business_id", businessIds)
      .order("start_at", { ascending: false });

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
    setLoading(false);
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  function timeframeStartDate(currentTimeframe: Timeframe) {
    if (currentTimeframe === "all") return null;

    const date = new Date();

    if (currentTimeframe === "7d") date.setDate(date.getDate() - 7);
    if (currentTimeframe === "30d") date.setDate(date.getDate() - 30);
    if (currentTimeframe === "90d") date.setDate(date.getDate() - 90);

    return date;
  }

  const filteredBookings = useMemo(() => {
    const startDate = timeframeStartDate(timeframe);

    return bookings.filter((booking) => {
      const matchesBusiness =
        selectedBusinessId === "all"
          ? true
          : booking.business_id === selectedBusinessId;

      const matchesTimeframe = startDate
        ? new Date(booking.start_at) >= startDate
        : true;

      return matchesBusiness && matchesTimeframe;
    });
  }, [bookings, timeframe, selectedBusinessId]);

  const analytics = useMemo(() => {
    const completed = filteredBookings.filter(
      (booking) => booking.status === "completed",
    );
    const confirmed = filteredBookings.filter(
      (booking) => booking.status === "confirmed",
    );
    const pending = filteredBookings.filter(
      (booking) => booking.status === "pending",
    );
    const cancelled = filteredBookings.filter(
      (booking) => booking.status === "cancelled",
    );

    const estimatedCompletedValue = completed.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0);
    }, 0);

    const estimatedConfirmedValue = confirmed.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0);
    }, 0);

    const estimatedAllValue = filteredBookings.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0);
    }, 0);

    const averageBookingValue =
      filteredBookings.length > 0
        ? estimatedAllValue / filteredBookings.length
        : 0;

    const completionRate =
      filteredBookings.length > 0
        ? Math.round((completed.length / filteredBookings.length) * 100)
        : 0;

    const cancellationRate =
      filteredBookings.length > 0
        ? Math.round((cancelled.length / filteredBookings.length) * 100)
        : 0;

    const approvalLoad = pending.length;

    const serviceMap = filteredBookings.reduce<Record<string, ServiceSummary>>(
      (acc, booking) => {
        const serviceName =
          booking.services?.name ||
          t("dashboardAnalytics.fallback.unknownService", "Unknown service");
        const serviceKey =
          booking.services?.id || booking.service_id || serviceName;
        const price = Number(booking.services?.price || 0);

        if (!acc[serviceKey]) {
          acc[serviceKey] = {
            key: serviceKey,
            name: serviceName,
            count: 0,
            completed: 0,
            confirmed: 0,
            cancelled: 0,
            estimatedValue: 0,
          };
        }

        acc[serviceKey].count += 1;

        if (booking.status === "completed") acc[serviceKey].completed += 1;
        if (booking.status === "confirmed") acc[serviceKey].confirmed += 1;
        if (booking.status === "cancelled") acc[serviceKey].cancelled += 1;

        acc[serviceKey].estimatedValue += price;

        return acc;
      },
      {},
    );

    const topServices = Object.values(serviceMap).sort(
      (a, b) => b.count - a.count || b.estimatedValue - a.estimatedValue,
    );

    const businessMap = filteredBookings.reduce<
      Record<string, { name: string; count: number; value: number }>
    >((acc, booking) => {
      const businessName =
        booking.businesses?.name ||
        t("dashboardNotifications.labels.businessFallback", "Business");
      const businessKey = booking.business_id;
      const price = Number(booking.services?.price || 0);

      if (!acc[businessKey]) {
        acc[businessKey] = {
          name: businessName,
          count: 0,
          value: 0,
        };
      }

      acc[businessKey].count += 1;
      acc[businessKey].value += price;

      return acc;
    }, {});

    const businessBreakdown = Object.values(businessMap).sort(
      (a, b) => b.count - a.count || b.value - a.value,
    );

    const dailyMap = filteredBookings.reduce<Record<string, DailySummary>>(
      (acc, booking) => {
        const date = new Date(booking.start_at);
        const dateKey = date.toISOString().slice(0, 10);
        const label = date.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        });
        const price = Number(booking.services?.price || 0);

        if (!acc[dateKey]) {
          acc[dateKey] = {
            label,
            dateKey,
            count: 0,
            completed: 0,
            confirmed: 0,
            pending: 0,
            cancelled: 0,
            value: 0,
          };
        }

        acc[dateKey].count += 1;
        acc[dateKey].value += price;

        if (booking.status === "completed") acc[dateKey].completed += 1;
        if (booking.status === "confirmed") acc[dateKey].confirmed += 1;
        if (booking.status === "pending") acc[dateKey].pending += 1;
        if (booking.status === "cancelled") acc[dateKey].cancelled += 1;

        return acc;
      },
      {},
    );

    const dailyActivity = Object.values(dailyMap).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    );

    const busiestDay =
      [...dailyActivity].sort((a, b) => b.count - a.count)[0] || null;
    const mostValuableDay =
      [...dailyActivity].sort((a, b) => b.value - a.value)[0] || null;

    const recentActivity = [...filteredBookings]
      .sort(
        (a, b) =>
          new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
      )
      .slice(0, 8);

    return {
      completed,
      confirmed,
      pending,
      cancelled,
      estimatedCompletedValue,
      estimatedConfirmedValue,
      estimatedAllValue,
      averageBookingValue,
      completionRate,
      cancellationRate,
      approvalLoad,
      topServices,
      businessBreakdown,
      dailyActivity,
      busiestDay,
      mostValuableDay,
      recentActivity,
    };
  }, [filteredBookings]);

  function timeframeLabel() {
    if (timeframe === "7d")
      return t("dashboardAnalytics.timeframe.last7", "Last 7 days");
    if (timeframe === "30d")
      return t("dashboardAnalytics.timeframe.last30", "Last 30 days");
    if (timeframe === "90d")
      return t("dashboardAnalytics.timeframe.last90", "Last 90 days");
    return t("dashboardAnalytics.timeframe.allTime", "All time");
  }

  function statusColor(status: string) {
    if (status === "confirmed") return "var(--success)";
    if (status === "completed") return "var(--success)";
    if (status === "pending") return "var(--accent)";
    if (status === "cancelled") return "var(--warning)";
    return "var(--text-muted)";
  }

  function maxDailyCount() {
    const max = Math.max(...analytics.dailyActivity.map((day) => day.count), 0);
    return max || 1;
  }

  function maxServiceCount() {
    const max = Math.max(
      ...analytics.topServices.map((service) => service.count),
      0,
    );
    return max || 1;
  }

  if (loading) {
    return (
      <DashboardLayout title={t("dashboardAnalytics.pageTitle", "Analytics")}>
        <div className="card">
          <p className="muted">
            {t("dashboardAnalytics.loading", "Loading analytics...")}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t("dashboardAnalytics.pageTitle", "Analytics")}
      subtitle={t(
        "dashboardAnalytics.pageSubtitle",
        "Understand booking activity, estimated value and service demand.",
      )}
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
        <div className="card">
          <h3>
            {t(
              "dashboardAnalytics.empty.noBusinessTitle",
              "No business data yet",
            )}
          </h3>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "dashboardAnalytics.empty.noBusinessBody",
              "Create a business profile and receive bookings before analytics can be generated.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "1rem" }}
          >
            {t(
              "dashboardAnalytics.empty.createBusinessProfile",
              "Create business profile",
            )}
          </Link>
        </div>
      )}

      {businesses.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p className="small muted">
                  {t("dashboardAnalytics.controls.kicker", "Filters")}
                </p>
                <h3 style={{ marginTop: "0.25rem" }}>
                  {t("dashboardAnalytics.controls.title", "Analytics controls")}
                </h3>
                <p className="small muted" style={{ marginTop: "0.35rem" }}>
                  {t(
                    "dashboardAnalytics.controls.body",
                    "Revenue here is estimated from listed service prices. It is not payment-confirmed revenue yet.",
                  )}
                </p>
              </div>

              <button onClick={loadAnalytics} className="btn btn-ghost">
                {t("dashboardAnalytics.controls.refresh", "Refresh analytics")}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              <label className="small muted">
                {t("dashboardAnalytics.controls.timeframe", "Timeframe")}
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                  style={{ marginTop: "0.35rem", width: "100%" }}
                >
                  <option value="7d">
                    {t("dashboardAnalytics.timeframe.last7", "Last 7 days")}
                  </option>
                  <option value="30d">
                    {t("dashboardAnalytics.timeframe.last30", "Last 30 days")}
                  </option>
                  <option value="90d">
                    {t("dashboardAnalytics.timeframe.last90", "Last 90 days")}
                  </option>
                  <option value="all">
                    {t("dashboardAnalytics.timeframe.allTime", "All time")}
                  </option>
                </select>
              </label>

              <label className="small muted">
                {t("dashboardNotifications.labels.business", "Business")}
                <select
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  style={{ marginTop: "0.35rem", width: "100%" }}
                >
                  <option value="all">
                    {t(
                      "dashboardAnalytics.controls.allBusinesses",
                      "All businesses",
                    )}
                  </option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                      {business.published
                        ? ""
                        : ` (${t("support.business.status.draft", "hidden")})`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <p className="small muted">{timeframeLabel()}</p>
              <h3>{filteredBookings.length}</h3>
              <p className="muted small">
                {t(
                  "dashboardAnalytics.metrics.totalBookingActivity",
                  "Total booking activity",
                )}
              </p>
            </div>

            <div
              className="card"
              style={{ borderColor: "rgba(45,212,191,0.25)" }}
            >
              <p className="small muted">
                {t(
                  "dashboardAnalytics.metrics.completedValue",
                  "Estimated completed value",
                )}
              </p>
              <h3>£{analytics.estimatedCompletedValue.toFixed(2)}</h3>
              <p className="muted small">
                {t(
                  "dashboardAnalytics.metrics.completedValueBody",
                  "Completed appointments only",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t(
                  "dashboardAnalytics.metrics.averageValue",
                  "Average booking value",
                )}
              </p>
              <h3>£{analytics.averageBookingValue.toFixed(2)}</h3>
              <p className="muted small">
                {t(
                  "dashboardAnalytics.metrics.averageValueBody",
                  "Average listed service price",
                )}
              </p>
            </div>

            <div
              className="card"
              style={{
                borderColor:
                  analytics.approvalLoad > 0
                    ? "rgba(255,107,53,0.35)"
                    : "var(--border)",
              }}
            >
              <p className="small muted">
                {t("dashboardAnalytics.metrics.approvalLoad", "Approval load")}
              </p>
              <h3>{analytics.approvalLoad}</h3>
              <p className="muted small">
                {t(
                  "dashboardBookings.summary.pendingRequests",
                  "Pending booking requests",
                )}
              </p>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <p className="small muted">
                {t(
                  "dashboardAnalytics.metrics.confirmedValue",
                  "Confirmed upcoming value",
                )}
              </p>
              <h3>£{analytics.estimatedConfirmedValue.toFixed(2)}</h3>
              <p className="muted small">
                {t(
                  "dashboardAnalytics.metrics.confirmedValueBody",
                  "Estimated value of confirmed appointments",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t(
                  "dashboardAnalytics.metrics.completionRate",
                  "Completion rate",
                )}
              </p>
              <h3>{analytics.completionRate}%</h3>
              <p className="muted small">
                {t(
                  "dashboardAnalytics.metrics.completionRateBody",
                  "Completed / all bookings in this filter",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t(
                  "dashboardAnalytics.metrics.cancellationRate",
                  "Cancellation rate",
                )}
              </p>
              <h3>{analytics.cancellationRate}%</h3>
              <p className="muted small">
                {t(
                  "dashboardAnalytics.metrics.cancellationRateBody",
                  "Cancelled / all bookings in this filter",
                )}
              </p>
            </div>

            <div className="card">
              <p className="small muted">
                {t("dashboardAnalytics.metrics.busiestDay", "Busiest day")}
              </p>
              <h3>
                {analytics.busiestDay?.label ||
                  t("dashboardAnalytics.empty.noData", "No data")}
              </h3>
              <p className="muted small">
                {analytics.busiestDay
                  ? `${analytics.busiestDay.count} ${t("support.business.bookings", "booking")}${analytics.busiestDay.count === 1 ? "" : "s"}`
                  : t(
                      "dashboardAnalytics.empty.noBookingsInFilter",
                      "No bookings in this filter",
                    )}
              </p>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <p className="small muted">
                    {t("dashboardAnalytics.status.kicker", "Booking status")}
                  </p>
                  <h3>
                    {t("dashboardAnalytics.status.title", "Status breakdown")}
                  </h3>
                </div>
                <Link href="/dashboard/bookings" className="btn btn-ghost">
                  {t("dashboardBookings.businessPicker.cta", "Open calendar")}
                </Link>
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {[
                  {
                    label: t("dashboardBookings.status.completed", "Completed"),
                    value: analytics.completed.length,
                    color: "var(--success)",
                  },
                  {
                    label: t("dashboardBookings.status.confirmed", "Confirmed"),
                    value: analytics.confirmed.length,
                    color: "var(--success)",
                  },
                  {
                    label: t(
                      "dashboardBookings.status.pendingApproval",
                      "Pending approval",
                    ),
                    value: analytics.pending.length,
                    color: "var(--accent)",
                  },
                  {
                    label: t("dashboardBookings.status.cancelled", "Cancelled"),
                    value: analytics.cancelled.length,
                    color: "var(--warning)",
                  },
                ].map((row) => {
                  const width =
                    filteredBookings.length > 0
                      ? Math.max(
                          8,
                          Math.round(
                            (row.value / filteredBookings.length) * 100,
                          ),
                        )
                      : 0;

                  return (
                    <div key={row.label}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                        }}
                      >
                        <p className="small muted">{row.label}</p>
                        <strong>{row.value}</strong>
                      </div>
                      <div
                        style={{
                          height: 10,
                          borderRadius: 999,
                          background: "var(--surface-2)",
                          overflow: "hidden",
                          border: "1px solid var(--border)",
                          marginTop: "0.3rem",
                        }}
                      >
                        <div
                          style={{
                            width: `${width}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: row.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <p className="small muted">
                {t("dashboardAnalytics.daily.kicker", "Daily activity")}
              </p>
              <h3 style={{ marginBottom: "1rem" }}>
                {t("dashboardAnalytics.daily.title", "Bookings over time")}
              </h3>

              {analytics.dailyActivity.length === 0 && (
                <p className="muted">
                  {t(
                    "dashboardAnalytics.empty.noActivityTimeframe",
                    "No booking activity in this timeframe.",
                  )}
                </p>
              )}

              {analytics.dailyActivity.length > 0 && (
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {analytics.dailyActivity.slice(-10).map((day) => {
                    const width = Math.max(
                      8,
                      Math.round((day.count / maxDailyCount()) * 100),
                    );

                    return (
                      <div key={day.dateKey}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "1rem",
                          }}
                        >
                          <p className="small muted">{day.label}</p>
                          <strong>{day.count}</strong>
                        </div>
                        <div
                          style={{
                            height: 12,
                            borderRadius: 999,
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            overflow: "hidden",
                            marginTop: "0.3rem",
                          }}
                        >
                          <div
                            style={{
                              width: `${width}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <p className="small muted">
                    {t("support.business.services", "Services")}
                  </p>
                  <h3>
                    {t(
                      "dashboardAnalytics.services.title",
                      "Most booked services",
                    )}
                  </h3>
                </div>
                <Link href="/dashboard/services" className="btn btn-ghost">
                  {t("dashboardAnalytics.services.manage", "Manage services")}
                </Link>
              </div>

              {analytics.topServices.length === 0 && (
                <p className="muted">
                  {t(
                    "dashboardAnalytics.empty.noServiceData",
                    "No service data in this filter yet.",
                  )}
                </p>
              )}

              {analytics.topServices.length > 0 && (
                <div style={{ display: "grid", gap: "0.85rem" }}>
                  {analytics.topServices.slice(0, 8).map((service, index) => {
                    const width = Math.max(
                      8,
                      Math.round((service.count / maxServiceCount()) * 100),
                    );

                    return (
                      <div
                        key={service.key}
                        className="card"
                        style={{
                          background: "var(--surface-2)",
                          padding: "0.9rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "1rem",
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <p className="small muted">#{index + 1}</p>
                            <strong>{service.name}</strong>
                            <p
                              className="small muted"
                              style={{ marginTop: "0.25rem" }}
                            >
                              {service.completed}{" "}
                              {t(
                                "dashboardBookings.status.completed",
                                "completed",
                              )}{" "}
                              · {service.confirmed}{" "}
                              {t(
                                "dashboardBookings.status.confirmed",
                                "confirmed",
                              )}{" "}
                              · {service.cancelled}{" "}
                              {t(
                                "dashboardBookings.status.cancelled",
                                "cancelled",
                              )}
                            </p>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <strong>{service.count}</strong>
                            <p className="small muted">
                              {t("support.business.bookings", "bookings")}
                            </p>
                            <p className="small muted">
                              £{service.estimatedValue.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div
                          style={{
                            height: 10,
                            borderRadius: 999,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            overflow: "hidden",
                            marginTop: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              width: `${width}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <p className="small muted">
                {t("dashboardBusinesses.stats.businesses", "Businesses")}
              </p>
              <h3 style={{ marginBottom: "1rem" }}>
                {t("dashboardAnalytics.businesses.title", "Business breakdown")}
              </h3>

              {analytics.businessBreakdown.length === 0 && (
                <p className="muted">
                  {t(
                    "dashboardAnalytics.empty.noBusinessBookingData",
                    "No business booking data in this filter yet.",
                  )}
                </p>
              )}

              {analytics.businessBreakdown.length > 0 && (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {analytics.businessBreakdown.map((business) => (
                    <div
                      key={business.name}
                      className="card"
                      style={{
                        background: "var(--surface-2)",
                        padding: "0.9rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <strong>{business.name}</strong>
                          <p className="small muted">
                            {business.count}{" "}
                            {t("support.business.bookings", "booking")}
                            {business.count === 1 ? "" : "s"}
                          </p>
                        </div>

                        <strong>£{business.value.toFixed(2)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: "1rem",
              }}
            >
              <div>
                <p className="small muted">
                  {t("dashboardAnalytics.recent.kicker", "Recent activity")}
                </p>
                <h3>
                  {t(
                    "dashboardAnalytics.recent.title",
                    "Latest bookings in this filter",
                  )}
                </h3>
              </div>

              <Link href="/dashboard/bookings" className="btn btn-accent">
                {t("dashboardLayout.nav.calendar", "Calendar")}
              </Link>
            </div>

            {analytics.recentActivity.length === 0 && (
              <p className="muted">
                {t(
                  "dashboardAnalytics.empty.noActivityFilter",
                  "No booking activity found for this filter.",
                )}
              </p>
            )}

            {analytics.recentActivity.length > 0 && (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {analytics.recentActivity.map((booking) => (
                  <div
                    key={booking.id}
                    className="card"
                    style={{
                      background: "var(--surface-2)",
                      padding: "0.9rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>{booking.customer_name}</strong>
                        <p
                          className="small muted"
                          style={{ marginTop: "0.25rem" }}
                        >
                          {booking.businesses?.name ||
                            t(
                              "dashboardNotifications.labels.businessFallback",
                              "Business",
                            )}{" "}
                          ·{" "}
                          {booking.services?.name ||
                            t(
                              "dashboardNotifications.labels.serviceFallback",
                              "Service",
                            )}
                        </p>
                        <p className="small muted">
                          {new Date(booking.start_at).toLocaleString()}
                        </p>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          className="small"
                          style={{
                            color: statusColor(booking.status),
                            background: "rgba(255,255,255,0.04)",
                            padding: "0.2rem 0.55rem",
                            borderRadius: 999,
                            textTransform: "capitalize",
                          }}
                        >
                          {booking.status}
                        </span>
                        <p
                          className="small muted"
                          style={{ marginTop: "0.45rem" }}
                        >
                          £{Number(booking.services?.price || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
