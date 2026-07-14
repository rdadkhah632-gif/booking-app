import Link from "next/link";
import { useMemo } from "react";
import { useI18n } from "@/lib/useI18n";
import { formatLocalizedDate } from "@/lib/i18n";
import { formatCurrencyAmount } from "@/lib/currency";

export type CustomerHistoryBusiness = {
  id: string;
  name: string;
  currency?: string | null;
  timezone?: string | null;
};

export type CustomerHistoryBooking = {
  id: string;
  business_id: string;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
  services?: {
    name: string;
    price?: number | null;
  } | null;
  staff_members?: {
    name: string;
    role_title?: string | null;
  } | null;
};

type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
};

type Props = {
  customer: CustomerProfile;
  bookings: CustomerHistoryBooking[];
  businesses: CustomerHistoryBusiness[];
  selectedBusiness: CustomerHistoryBusiness | null;
  matchMode: "account" | "email";
};

export default function CustomerHistoryView({
  customer,
  bookings,
  businesses,
  selectedBusiness,
  matchMode,
}: Props) {
  const { locale, t } = useI18n();

  const stats = useMemo(() => {
    const now = new Date();

    const upcoming = bookings.filter(
      (booking) =>
        booking.status === "confirmed" && new Date(booking.start_at) >= now,
    );

    const pending = bookings.filter((booking) => booking.status === "pending");

    const completed = bookings.filter(
      (booking) => booking.status === "completed",
    );

    const history = bookings.filter(
      (booking) =>
        booking.status === "completed" ||
        booking.status === "cancelled" ||
        booking.status === "declined" ||
        (booking.status === "confirmed" && new Date(booking.start_at) < now),
    );

    const estimatedCompletedValue = completed.reduce((total, booking) => {
      return total + Number(booking.services?.price || 0);
    }, 0);

    const serviceMap = bookings.reduce<
      Record<string, { name: string; count: number }>
    >((acc, booking) => {
      const name =
        booking.services?.name ||
        t("dashboardCustomers.fallback.service", "Service not recorded");

      if (!acc[name]) {
        acc[name] = { name, count: 0 };
      }

      acc[name].count += 1;
      return acc;
    }, {});

    const favouriteService =
      Object.values(serviceMap).sort((a, b) => b.count - a.count)[0] || null;

    return {
      total: bookings.length,
      upcoming,
      pending,
      completed,
      history,
      estimatedCompletedValue,
      favouriteService,
    };
  }, [bookings, t]);

  function statusLabel(status: string) {
    if (status === "pending")
      return t("dashboardBookings.status.needsApproval", "Needs approval");
    if (status === "confirmed")
      return t("dashboardBookings.status.confirmed", "Confirmed");
    if (status === "completed")
      return t("dashboardBookings.status.completed", "Completed");
    if (status === "cancelled")
      return t("dashboardBookings.status.cancelled", "Cancelled");
    if (status === "declined")
      return t("dashboardBookings.status.declined", "Declined");
    return status;
  }

  function statusColor(status: string) {
    if (status === "pending") return "var(--accent)";
    if (status === "confirmed") return "var(--success)";
    if (status === "completed") return "var(--success)";
    if (status === "declined") return "var(--warning)";
    if (status === "cancelled") return "var(--warning)";
    return "var(--text-muted)";
  }

  function statusBackground(status: string) {
    if (status === "pending") return "rgba(255,107,53,0.12)";
    if (status === "confirmed") return "rgba(45,212,191,0.12)";
    if (status === "completed") return "rgba(45,212,191,0.12)";
    if (status === "declined") return "rgba(255,190,11,0.12)";
    if (status === "cancelled") return "rgba(255,190,11,0.12)";
    return "var(--surface-2)";
  }

  function bookingTime(booking: CustomerHistoryBooking) {
    const start = new Date(booking.start_at);
    const end = booking.end_at
      ? new Date(booking.end_at)
      : new Date(start.getTime() + booking.duration_minutes * 60000);
    const timeZone = businessForBooking(booking)?.timezone || undefined;

    return `${formatLocalizedDate(start, locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
    })} · ${formatLocalizedDate(start, locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })}-${formatLocalizedDate(end, locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })}`;
  }

  function businessForBooking(booking: CustomerHistoryBooking) {
    return (
      businesses.find((business) => business.id === booking.business_id) ||
      selectedBusiness
    );
  }

  function bookingPrice(booking: CustomerHistoryBooking) {
    return formatCurrencyAmount(
      Number(booking.services?.price || 0),
      businessForBooking(booking)?.currency,
      locale,
    );
  }

  function staffLabel(booking: CustomerHistoryBooking) {
    if (!booking.staff_members?.name) {
      return t("dashboardBookings.card.noStaff", "Staff not recorded");
    }

    return `${booking.staff_members.name}${
      booking.staff_members.role_title
        ? ` · ${booking.staff_members.role_title}`
        : ""
    }`;
  }

  function renderAppointmentRow(booking: CustomerHistoryBooking) {
    const isFutureConfirmed =
      booking.status === "confirmed" &&
      new Date(booking.start_at) >= new Date();

    return (
      <article key={booking.id} className="customer-appointment-row">
        <div className="appointment-status">
          <span
            className="status-pill"
            style={{
              background: statusBackground(booking.status),
              color: statusColor(booking.status),
            }}
          >
            {statusLabel(booking.status)}
          </span>
          <span className="small muted">{bookingTime(booking)}</span>
        </div>

        <div className="appointment-main">
          <strong>
            {booking.services?.name ||
              t("dashboardCustomers.fallback.service", "Service not recorded")}
          </strong>
          <p className="small muted">
            {staffLabel(booking)} · {booking.duration_minutes}{" "}
            {t("dashboardCustomers.labels.minutes", "min")} ·{" "}
            {bookingPrice(booking)}
          </p>
        </div>

        <div className="appointment-actions">
          {matchMode === "email" && booking.customer_user_id && (
            <Link
              href={`/dashboard/customers/${booking.customer_user_id}?businessId=${booking.business_id}`}
              className="btn btn-ghost"
            >
              {t("dashboardCustomers.actions.accountProfile", "Account")}
            </Link>
          )}

          {booking.status === "pending" && (
            <Link href="/dashboard/notifications" className="btn btn-ghost">
              {t("dashboardCustomers.actions.reviewRequest", "Review request")}
            </Link>
          )}

          {isFutureConfirmed && (
            <Link
              href={`/reschedule-booking?id=${booking.id}`}
              className="btn btn-ghost"
            >
              {t("dashboardBookings.actions.reschedule", "Reschedule")}
            </Link>
          )}
        </div>
      </article>
    );
  }

  function renderSection(
    title: string,
    bookingsForSection: CustomerHistoryBooking[],
  ) {
    if (bookingsForSection.length === 0) return null;

    return (
      <section className="customer-history-section">
        <div className="section-heading">
          <h2>{title}</h2>
          <span className="small muted">
            {bookingsForSection.length}{" "}
            {bookingsForSection.length === 1
              ? t("dashboardCustomers.labels.appointment", "appointment")
              : t("dashboardCustomers.labels.appointments", "appointments")}
          </span>
        </div>

        <div className="appointment-list">
          {bookingsForSection.map(renderAppointmentRow)}
        </div>
      </section>
    );
  }

  return (
    <div className="customer-history-view">
      <section className="customer-profile-card card">
        <div className="customer-profile-main">
          <div>
            <p className="small muted">
              {t("dashboardCustomers.profile.label", "Customer")}
            </p>
            <h2>{customer.name}</h2>
            <div className="customer-contact-line">
              <span>
                {customer.email ||
                  t("dashboardCustomers.fallback.noEmail", "No email")}
              </span>
              <span>
                {customer.phone ||
                  t("dashboardCustomers.fallback.noPhone", "No phone")}
              </span>
              {matchMode === "email" && (
                <span className="match-pill">
                  {t("dashboardCustomers.match.email", "Matched by email")}
                </span>
              )}
            </div>
          </div>

          <div className="customer-profile-actions">
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="btn btn-accent">
                {t("dashboardCustomers.actions.email", "Email")}
              </a>
            )}

            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="btn btn-ghost">
                {t("dashboardBookings.card.call", "Call")}
              </a>
            )}

            <Link
              href={
                selectedBusiness
                  ? `/dashboard/bookings?businessId=${selectedBusiness.id}`
                  : "/dashboard/bookings"
              }
              className="btn btn-ghost"
            >
              {t("dashboardBookings.businessPicker.cta", "Open calendar")}
            </Link>
          </div>
        </div>
      </section>

      <section className="customer-summary-strip card">
        <div>
          <strong>{stats.total}</strong>
          <span>{t("dashboardCustomers.summary.total", "Appointments")}</span>
        </div>
        <div>
          <strong>{stats.upcoming.length}</strong>
          <span>{t("dashboardCustomers.summary.upcoming", "Upcoming")}</span>
        </div>
        <div>
          <strong>
            {formatCurrencyAmount(
              stats.estimatedCompletedValue,
              selectedBusiness?.currency || businesses[0]?.currency,
              locale,
            )}
          </strong>
          <span>
            {t("dashboardCustomers.summary.completedValue", "Completed value")}
          </span>
        </div>
        <div>
          <strong>
            {stats.favouriteService?.name ||
              t("dashboardCustomers.summary.noFavourite", "No top service")}
          </strong>
          <span>
            {t("dashboardCustomers.summary.topService", "Top service")}
          </span>
        </div>
      </section>

      {matchMode === "email" && (
        <p className="small muted customer-match-note">
          {t(
            "dashboardCustomers.match.emailBody",
            "This history is matched by email. Future logged-in bookings can open the account profile directly.",
          )}
        </p>
      )}

      {renderSection(
        t("dashboardCustomers.sections.needsAction", "Needs action"),
        stats.pending,
      )}
      {renderSection(
        t("dashboardCustomers.sections.upcoming", "Upcoming"),
        stats.upcoming,
      )}
      {renderSection(
        t("dashboardCustomers.sections.history", "History"),
        stats.history,
      )}

      <style jsx>{`
        .customer-history-view {
          display: grid;
          gap: 1rem;
        }

        .customer-profile-card {
          border-color: rgba(255, 107, 53, 0.2);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.1),
            rgba(45, 212, 191, 0.05)
          );
        }

        .customer-profile-main {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .customer-profile-main h2 {
          margin: 0.2rem 0 0;
          font-family: var(--font-display);
        }

        .customer-contact-line {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          margin-top: 0.65rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .match-pill,
        .status-pill {
          border-radius: 999px;
          padding: 0.18rem 0.55rem;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .match-pill {
          background: rgba(255, 190, 11, 0.12);
          color: var(--warning);
        }

        .customer-profile-actions,
        .appointment-actions {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .customer-summary-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
          padding: 1rem;
        }

        .customer-summary-strip div {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
        }

        .customer-summary-strip strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-summary-strip span {
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .customer-match-note {
          margin: 0;
        }

        .customer-history-section {
          display: grid;
          gap: 0.75rem;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        .section-heading h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.1rem, 2vw, 1.35rem);
        }

        .appointment-list {
          display: grid;
          gap: 0.65rem;
        }

        .customer-appointment-row {
          display: grid;
          grid-template-columns: minmax(11rem, 0.8fr) minmax(14rem, 1.2fr) auto;
          gap: 1rem;
          align-items: center;
          padding: 0.9rem 1rem;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }

        .appointment-status,
        .appointment-main {
          display: grid;
          gap: 0.3rem;
          min-width: 0;
        }

        .appointment-main p {
          margin: 0;
        }

        @media (max-width: 860px) {
          .customer-profile-main,
          .customer-appointment-row {
            display: grid;
          }

          .customer-summary-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .customer-profile-actions,
          .appointment-actions {
            justify-content: stretch;
          }

          .customer-profile-actions :global(.btn),
          .customer-profile-actions a,
          .appointment-actions :global(.btn),
          .appointment-actions a {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 540px) {
          .customer-summary-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
