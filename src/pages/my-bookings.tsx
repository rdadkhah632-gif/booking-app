import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import MyBookingsHeader from "@/components/my-bookings/MyBookingsHeader";
import MyBookingsStats from "@/components/my-bookings/MyBookingsStats";
import MyBookingsEmptyState from "@/components/my-bookings/MyBookingsEmptyState";
import MyBookingsSection from "@/components/my-bookings/MyBookingsSection";
import MyBookingCard from "@/components/my-bookings/MyBookingCard";
import {
  Booking,
  BookingRequest,
} from "@/components/my-bookings/myBookingsTypes";
import { publicStaffName } from "@/components/public-business/publicStaffDisplay";
import { useI18n } from "@/lib/useI18n";
import { formatLocalizedDate } from "@/lib/i18n";
import { requestTransactionalEmail } from "@/lib/email/client";

export default function MyBookings() {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pendingSectionRef = useRef<HTMLElement | null>(null);
  const upcomingSectionRef = useRef<HTMLElement | null>(null);
  const changeRequestsSectionRef = useRef<HTMLElement | null>(null);
  const historySectionRef = useRef<HTMLElement | null>(null);

  async function loadBookings(options?: {
    keepSuccess?: boolean;
    silent?: boolean;
  }) {
    if (!options?.silent) setLoading(true);
    setError(null);
    if (!options?.keepSuccess) setSuccess(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login?redirectTo=/my-bookings");
      return;
    }

    const response = await fetch("/api/customer/bookings", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      router.replace("/login?redirectTo=/my-bookings");
      return;
    }

    if (!response.ok) {
      setError(t("myBookings.error.load", "Could not load your bookings."));
      setLoading(false);
      return;
    }

    setBookings((payload.bookings || []) as Booking[]);
    setRequests((payload.requests || []) as BookingRequest[]);
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      loadBookings({ silent: true, keepSuccess: true });
    }

    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadBookings({ silent: true, keepSuccess: true });
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;

    async function subscribeToBookingUpdates() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session?.user?.id) return;

      function queueRefresh() {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          loadBookings({ silent: true, keepSuccess: true });
        }, 350);
      }

      const channel = supabase
        .channel(`customer-bookings-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `customer_user_id=eq.${session.user.id}`,
          },
          queueRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "booking_requests",
            filter: `customer_user_id=eq.${session.user.id}`,
          },
          queueRefresh,
        )
        .subscribe();

      return channel;
    }

    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    subscribeToBookingUpdates().then((channel) => {
      if (channel) channelRef = channel;
    });

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, []);

  async function createBusinessNotification(
    booking: Booking,
    type: string,
    title: string,
    message: string,
  ) {
    if (!booking.business_id) return;

    await supabase.from("notifications").insert({
      business_id: booking.business_id,
      booking_id: booking.id,
      audience: "business",
      type,
      title,
      message,
      action_url: "/dashboard/notifications",
    });
  }

  async function cancelBooking(booking: Booking) {
    const confirmed = confirm(
      t("myBookings.confirm.cancel", "Cancel this booking?"),
    );
    if (!confirmed) return;

    setActionLoadingId(booking.id);
    setError(null);
    setSuccess(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setActionLoadingId(null);
      router.replace("/login?redirectTo=/my-bookings");
      return;
    }

    const { data: cancelledBooking, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("customer_user_id", session.user.id)
      .in("status", ["pending", "confirmed"])
      .select("id")
      .maybeSingle();

    setActionLoadingId(null);

    if (error || !cancelledBooking) {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("[my-bookings] Cancellation guard rejected update", {
          code: error.code,
        });
      }
      setError(
        t(
          "myBookings.error.cancellationStatusChanged",
          "This booking can no longer be cancelled because its status has changed.",
        ),
      );
      await loadBookings({ silent: true });
      return;
    }

    setBookings((current) =>
      current.map((item) =>
        item.id === booking.id ? { ...item, status: "cancelled" } : item,
      ),
    );

    await createBusinessNotification(
      booking,
      "booking_cancelled",
      t("myBookings.notification.cancelledTitle", "Customer cancelled booking"),
      `${booking.customer_name || t("publicBusiness.customerFallback", "A customer")} ${t("myBookings.notification.cancelledWord", "cancelled their booking for")} ${serviceName(booking)} ${t("publicBusiness.notification.forWord", "for")} ${formatLocalizedDate(booking.start_at, locale, { dateStyle: "medium", timeStyle: "short", timeZone: businessTimeZone(booking) || undefined })}.`,
    );
    void requestTransactionalEmail({
      event: "booking_customer_cancelled",
      bookingId: booking.id,
    });

    setSuccess(
      booking.status === "pending"
        ? t(
            "myBookings.success.pendingCancelled",
            "Booking request cancelled. It is no longer waiting for business approval.",
          )
        : t(
            "myBookings.success.cancelled",
            "Booking cancelled. The business has been notified and this booking is now locked as cancelled.",
          ),
    );
    await loadBookings({ keepSuccess: true, silent: true });
  }

  function statusLabel(status: string) {
    if (status === "pending")
      return t("myBookings.status.requestSent", "Request sent");
    if (status === "confirmed")
      return t("myBookings.status.confirmed", "Confirmed");
    if (status === "declined")
      return t("myBookings.status.declined", "Declined");
    if (status === "completed")
      return t("myBookings.status.completed", "Completed");
    if (status === "cancelled")
      return t("myBookings.status.cancelled", "Cancelled");
    return status;
  }

  function statusColor(status: string) {
    if (status === "pending") return "var(--accent)";
    if (status === "confirmed") return "var(--success)";
    if (status === "declined") return "var(--warning)";
    if (status === "completed") return "var(--accent)";
    if (status === "cancelled") return "var(--warning)";
    return "var(--text-muted)";
  }

  function statusBackground(status: string) {
    if (status === "pending") return "rgba(255,107,53,0.12)";
    if (status === "confirmed") return "rgba(45,212,191,0.12)";
    if (status === "declined") return "rgba(255,190,11,0.12)";
    if (status === "completed") return "rgba(255,107,53,0.12)";
    if (status === "cancelled") return "rgba(255,190,11,0.12)";
    return "var(--surface-2)";
  }

  function cardTone(
    status: string,
    hasPendingRequest: boolean,
    mode: "pending" | "confirmed" | "history",
  ) {
    if (status === "pending") {
      return {
        border: "rgba(255,107,53,0.45)",
        background:
          "linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))",
      };
    }

    if (hasPendingRequest && status === "confirmed") {
      return {
        border: "rgba(255,107,53,0.45)",
        background:
          "linear-gradient(135deg, rgba(255,107,53,0.10), rgba(31,28,44,0.85))",
      };
    }

    if (status === "completed") {
      return {
        border: "rgba(45,212,191,0.22)",
        background:
          "linear-gradient(135deg, rgba(45,212,191,0.08), rgba(31,28,44,0.72))",
      };
    }

    if (status === "declined") {
      return {
        border: "rgba(255,190,11,0.22)",
        background:
          "linear-gradient(135deg, rgba(255,190,11,0.07), rgba(31,28,44,0.66))",
      };
    }

    if (status === "cancelled") {
      return {
        border: "rgba(255,190,11,0.22)",
        background:
          "linear-gradient(135deg, rgba(255,190,11,0.07), rgba(31,28,44,0.66))",
      };
    }

    if (mode === "history") {
      return {
        border: "rgba(255,255,255,0.08)",
        background: "rgba(31,28,44,0.62)",
      };
    }

    return {
      border: "var(--border)",
      background: "var(--surface)",
    };
  }

  function firstRelation<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  function businessName(booking: Booking) {
    return (
      firstRelation(booking.businesses)?.name ||
      t("dashboardNotifications.labels.businessFallback", "Business")
    );
  }

  function businessCurrency(booking: Booking) {
    return firstRelation(booking.businesses)?.currency || "GBP";
  }

  function businessTimeZone(booking: Booking) {
    return firstRelation(booking.businesses)?.timezone || null;
  }

  function serviceName(booking: Booking) {
    return (
      firstRelation(booking.services)?.name ||
      t("myBookings.fallback.serviceNotRecorded", "Service not recorded")
    );
  }

  function servicePrice(booking: Booking) {
    return Number(firstRelation(booking.services)?.price || 0);
  }

  function staffName(booking: Booking) {
    const staff = firstRelation(booking.staff_members);
    const fallback = t("myBookings.fallback.staffMember", "Assigned staff");
    if (!staff)
      return t("dashboardBookings.card.noStaff", "Staff not recorded");
    const displayName = publicStaffName(staff, fallback);
    const roleTitle =
      displayName === fallback ? null : staff.role_title?.trim() || null;
    return `${displayName}${roleTitle ? ` — ${roleTitle}` : ""}`;
  }

  function requestedStaffName(request: BookingRequest) {
    const staff = firstRelation(request.requested_staff);
    const fallback = t("myBookings.fallback.staffMember", "Assigned staff");
    if (!staff)
      return t("dashboardBookings.card.noStaff", "Staff not recorded");
    const displayName = publicStaffName(staff, fallback);
    const roleTitle =
      displayName === fallback ? null : staff.role_title?.trim() || null;
    return `${displayName}${roleTitle ? ` — ${roleTitle}` : ""}`;
  }

  function lifecycleCopy(booking: Booking, pendingRequest?: BookingRequest) {
    if (booking.status === "pending") {
      return t(
        "myBookings.lifecycle.waitingBody",
        "Waiting for the business to confirm.",
      );
    }

    if (pendingRequest && booking.status === "confirmed") {
      return t(
        "myBookings.lifecycle.pendingChangeBody",
        "Your original appointment is still confirmed. The new requested time will only replace it if the business accepts your request.",
      );
    }

    if (booking.status === "confirmed") {
      return t(
        "myBookings.lifecycle.confirmedBody",
        "Your booking is confirmed.",
      );
    }

    if (booking.status === "completed") {
      return t(
        "myBookings.lifecycle.completedBody",
        "This booking is complete.",
      );
    }

    if (booking.status === "cancelled") {
      return t(
        "myBookings.lifecycle.cancelledBody",
        "This booking has been cancelled.",
      );
    }

    if (booking.status === "declined") {
      return t(
        "myBookings.lifecycle.declinedBody",
        "The business declined this request.",
      );
    }

    return t(
      "myBookings.lifecycle.defaultBody",
      "Booking details are shown below.",
    );
  }

  const pendingRequestByBookingId = useMemo(() => {
    const map: Record<string, BookingRequest> = {};

    requests
      .filter((request) => request.status === "pending")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .forEach((request) => {
        if (!map[request.booking_id]) {
          map[request.booking_id] = request;
        }
      });

    return map;
  }, [requests]);

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === "confirmed" &&
        new Date(booking.start_at) >= new Date(),
    );
  }, [bookings]);

  const historyBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === "cancelled" ||
        booking.status === "declined" ||
        booking.status === "completed" ||
        (booking.status === "confirmed" &&
          new Date(booking.start_at) < new Date()),
    );
  }, [bookings]);

  const pendingRescheduleCount = Object.keys(pendingRequestByBookingId).length;
  const hasBookingActivity = bookings.length > 0 || pendingRescheduleCount > 0;

  function scrollToSection(
    section: "pending" | "upcoming" | "changes" | "history",
  ) {
    const sectionMap = {
      pending: pendingSectionRef,
      upcoming: upcomingSectionRef,
      changes: changeRequestsSectionRef,
      history: historySectionRef,
    };

    const target = sectionMap[section].current;
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function statCardStyle(isActive: boolean) {
    return {
      width: "100%",
      textAlign: "left" as const,
      cursor: isActive ? "pointer" : "default",
      borderColor: isActive ? "rgba(255,107,53,0.35)" : "var(--border)",
      background: isActive
        ? "linear-gradient(135deg, rgba(255,107,53,0.10), rgba(31,28,44,0.72))"
        : "var(--surface)",
      color: "var(--text)",
    };
  }

  function renderBookingCard(
    booking: Booking,
    mode: "pending" | "confirmed" | "history",
  ) {
    return (
      <MyBookingCard
        key={booking.id}
        booking={booking}
        mode={mode}
        pendingRequest={pendingRequestByBookingId[booking.id]}
        isWorking={actionLoadingId === booking.id}
        onCancel={cancelBooking}
        businessName={businessName}
        businessCurrency={businessCurrency}
        businessTimeZone={businessTimeZone}
        serviceName={serviceName}
        servicePrice={servicePrice}
        staffName={staffName}
        requestedStaffName={requestedStaffName}
        lifecycleCopy={lifecycleCopy}
        statusLabel={statusLabel}
        statusColor={statusColor}
        statusBackground={statusBackground}
        cardTone={cardTone}
      />
    );
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "36px 24px 70px" }}>
        <MyBookingsHeader
          loading={loading}
          showExploreAction={!loading && bookings.length > 0}
          bookingRequested={router.query.bookingRequested}
          requestSent={router.query.requestSent}
          success={success}
          showRefreshAction={!loading && hasBookingActivity}
          onClearSuccess={() => setSuccess(null)}
          onRefresh={() => loadBookings({ keepSuccess: true })}
        />

        {hasBookingActivity && (
          <MyBookingsStats
            pendingCount={pendingBookings.length}
            upcomingCount={confirmedUpcomingBookings.length}
            changeCount={pendingRescheduleCount}
            historyCount={historyBookings.length}
            onJump={scrollToSection}
            statCardStyle={statCardStyle}
          />
        )}

        {error && (
          <div
            className="card"
            style={{
              borderColor: "rgba(255,77,109,0.35)",
              marginBottom: "1rem",
            }}
          >
            <p style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">
              {t("myBookings.loading", "Loading your Mirëbook bookings...")}
            </p>
          </div>
        )}

        {!loading && bookings.length === 0 && <MyBookingsEmptyState />}

        {!loading && bookings.length > 0 && (
          <div className="my-bookings-section-list">
            {pendingBookings.length > 0 && (
              <MyBookingsSection
                sectionRef={pendingSectionRef}
                id="waiting-approval"
                title={t("myBookings.sections.requestsTitle", "Requests")}
              >
                {pendingBookings.map((booking) =>
                  renderBookingCard(booking, "pending"),
                )}
              </MyBookingsSection>
            )}

            {pendingRescheduleCount > 0 && (
              <MyBookingsSection
                sectionRef={changeRequestsSectionRef}
                id="change-requests"
                title={t(
                  "myBookings.sections.changeRequestsTitle",
                  "Change requests",
                )}
              >
                {confirmedUpcomingBookings
                  .filter((booking) => pendingRequestByBookingId[booking.id])
                  .map((booking) => renderBookingCard(booking, "confirmed"))}
              </MyBookingsSection>
            )}

            {confirmedUpcomingBookings.length > 0 && (
              <MyBookingsSection
                sectionRef={upcomingSectionRef}
                id="upcoming-bookings"
                title={t("myBookings.sections.upcomingTitle", "Upcoming")}
                action={
                  pendingRescheduleCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => scrollToSection("changes")}
                      className="btn btn-ghost"
                      style={{ marginTop: "0.75rem" }}
                    >
                      {t(
                        "myBookings.actions.viewPendingChanges",
                        "View pending change requests",
                      )}
                    </button>
                  ) : null
                }
              >
                {confirmedUpcomingBookings
                  .filter((booking) => !pendingRequestByBookingId[booking.id])
                  .map((booking) => renderBookingCard(booking, "confirmed"))}
              </MyBookingsSection>
            )}

            {historyBookings.length > 0 && (
              <MyBookingsSection
                sectionRef={historySectionRef}
                id="booking-history"
                title={t("myBookings.sections.historyTitle", "History")}
              >
                {historyBookings.map((booking) =>
                  renderBookingCard(booking, "history"),
                )}
              </MyBookingsSection>
            )}
          </div>
        )}
      </section>
      <style jsx>{`
        .my-bookings-header-actions,
        .my-booking-empty-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .my-booking-success-banner {
          margin-top: 1rem;
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.06);
        }

        .my-booking-route-banner {
          margin-top: 1rem;
          border-color: rgba(255, 107, 53, 0.45);
          background: var(--accent-dim);
        }

        .my-booking-banner-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .my-bookings-section-list {
          display: grid;
          gap: 1.5rem;
        }

        .my-bookings-section {
          display: grid;
          gap: 1rem;
          scroll-margin-top: 96px;
        }

        .my-booking-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .my-booking-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: flex-end;
        }

        .my-booking-pending-change-card {
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.14),
            rgba(255, 107, 53, 0.05)
          );
          margin-top: 1rem;
          border-color: rgba(255, 107, 53, 0.45);
        }

        .my-booking-pill-accent {
          background: rgba(255, 107, 53, 0.14);
          color: var(--accent);
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
        }

        .my-booking-requested-time-box {
          margin-top: 0.75rem;
          padding: 0.85rem;
          border-radius: var(--radius);
          background: rgba(11, 18, 32, 0.28);
          border: 1px solid rgba(255, 107, 53, 0.28);
        }

        .my-booking-locked-card {
          background: var(--surface-2);
          padding: 0.85rem;
          max-width: 240px;
        }

        @media (max-width: 640px) {
          .my-bookings-header-actions :global(.btn),
          .my-bookings-header-actions button,
          .my-bookings-header-actions a,
          .my-booking-empty-actions :global(.btn),
          .my-booking-empty-actions a,
          .my-booking-banner-row :global(.btn),
          .my-booking-banner-row button,
          .my-booking-card-actions :global(.btn),
          .my-booking-card-actions button,
          .my-booking-card-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
