import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

type StaffProfile = {
  id: string;
  business_id: string;
  name: string;
  businesses?: { name?: string | null } | { name?: string | null }[] | null;
};

type Booking = {
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
  services?: { name: string } | { name: string }[] | null;
};

function formatDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function serviceName(booking: Booking, fallback: string) {
  if (!booking.services) return fallback;
  return Array.isArray(booking.services)
    ? booking.services[0]?.name || fallback
    : booking.services.name || fallback;
}

function staffBusinessName(staff: StaffProfile | null, fallback: string) {
  if (!staff?.businesses) return fallback;
  return Array.isArray(staff.businesses)
    ? staff.businesses[0]?.name || fallback
    : staff.businesses.name || fallback;
}

function statusColor(status: string) {
  if (status === "pending") return "var(--accent)";
  if (status === "confirmed") return "var(--success)";
  if (status === "completed") return "var(--success)";
  if (status === "declined") return "var(--warning)";
  if (status === "cancelled") return "var(--warning)";
  return "var(--text-muted)";
}

export default function StaffCalendarPage() {
  const { locale, t } = useI18n();
  const dateLocale = locale === "sq" ? "sq-AL" : "en-GB";

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    formatDateInputValue(new Date()),
  );
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login?redirectTo=/staff/calendar";
      return;
    }
    const capabilities = await getAccountCapabilities(
      session.user.id,
      session.user.email,
    );

    if (!capabilities.canUseStaff || !capabilities.primaryStaffId) {
      setStaffProfile(null);
      setBookings([]);
      setError(t("staff.noProfile.kicker", "No staff profile linked"));
      setLoading(false);
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staff_members")
      .select(
        `
        id,
        business_id,
        name,
        businesses (
          name
        )
      `,
      )
      .eq("id", capabilities.primaryStaffId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (staffError || !staffData) {
      setError(
        staffError?.message ||
          t("staff.noProfile.kicker", "No staff profile linked"),
      );
      setLoading(false);
      return;
    }

    const normalisedStaff = staffData as unknown as StaffProfile;
    setStaffProfile(normalisedStaff);

    const from = startOfMonth(addDays(monthCursor, -7)).toISOString();
    const to = endOfMonth(addDays(monthCursor, 35)).toISOString();

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        business_id,
        customer_user_id,
        customer_name,
        customer_email,
        customer_phone,
        start_at,
        end_at,
        duration_minutes,
        status,
        services (
          name
        )
      `,
      )
      .eq("staff_member_id", normalisedStaff.id)
      .gte("start_at", from)
      .lte("start_at", to)
      .order("start_at", { ascending: true });

    if (bookingError) {
      setError(bookingError.message);
      setLoading(false);
      return;
    }

    setBookings((bookingData || []) as unknown as Booking[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!staffProfile) return;
    loadCalendar();
  }, [monthCursor]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const firstDayOffset = monthStart.getDay();
    const gridStart = addDays(monthStart, -firstDayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const dateString = formatDateInputValue(date);
      const dayBookings = bookings.filter((booking) => {
        return formatDateInputValue(new Date(booking.start_at)) === dateString;
      });

      return {
        date,
        dateString,
        isCurrentMonth: date.getMonth() === monthCursor.getMonth(),
        isToday: dateString === formatDateInputValue(new Date()),
        bookings: dayBookings,
      };
    });
  }, [bookings, monthCursor]);

  const selectedBookings = useMemo(() => {
    return bookings.filter((booking) => {
      return formatDateInputValue(new Date(booking.start_at)) === selectedDate;
    });
  }, [bookings, selectedDate]);

  const monthTitle = monthCursor.toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  });

  function statusLabel(status: string) {
    if (status === "pending")
      return t("staff.status.pending", "Awaiting business approval");
    if (status === "confirmed") return t("staff.status.confirmed", "Confirmed");
    if (status === "declined") return t("staff.status.declined", "Declined");
    if (status === "completed") return t("staff.status.completed", "Completed");
    if (status === "cancelled") return t("staff.status.cancelled", "Cancelled");
    return status;
  }

  async function markBookingComplete(booking: Booking) {
    const confirmed = confirm(
      t("staff.booking.confirmComplete", "Mark this appointment as completed?"),
    );
    if (!confirmed || !staffProfile) return;

    setActionLoadingId(booking.id);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id)
      .eq("staff_member_id", staffProfile.id);

    if (updateError) {
      setActionLoadingId(null);
      setError(updateError.message);
      return;
    }

    if (booking.customer_user_id) {
      await supabase.from("notifications").insert({
        user_id: booking.customer_user_id,
        business_id: booking.business_id,
        booking_id: booking.id,
        audience: "customer",
        type: "booking_completed",
        title: t("staff.notification.completedTitle", "Appointment completed"),
        message: `${t("staff.notification.completedStart", "Your appointment for")} ${serviceName(booking, t("staff.fallback.appointment", "your appointment"))} ${t("staff.notification.completedMiddle", "on")} ${new Date(booking.start_at).toLocaleString(dateLocale)} ${t("staff.notification.completedEnd", "has been marked as completed by staff.")}`,
        action_url: "/my-bookings",
      });
    }

    setSuccess(
      t("staff.booking.completedSuccess", "Appointment marked as completed."),
    );
    setActionLoadingId(null);
    await loadCalendar();
  }

  return (
    <DashboardLayout
      workspace="staff"
      title={t("staffCalendar.title", "Calendar")}
      subtitle={
        staffProfile
          ? staffBusinessName(
              staffProfile,
              t("staff.fallback.business", "Your business"),
            )
          : undefined
      }
    >
      <section className="staff-workspace-page">
        {loading && (
          <div className="card">
            <p className="muted">
              {t("staffCalendar.loading", "Loading staff calendar...")}
            </p>
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{ borderColor: "rgba(255,77,109,0.35)" }}
          >
            <p style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {success && (
          <div className="staff-calendar-success">
            <p>{success}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="card staff-calendar-toolbar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() - 1,
                      1,
                    ),
                  )
                }
              >
                {t("staffCalendar.previousMonth", "Previous")}
              </button>

              <div>
                <strong>{monthTitle}</strong>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() + 1,
                      1,
                    ),
                  )
                }
              >
                {t("staffCalendar.nextMonth", "Next")}
              </button>
            </div>

            <div className="staff-calendar-scroll">
              <div className="staff-calendar-grid">
                {[
                  t("calendar.weekdays.sun", "Sun"),
                  t("calendar.weekdays.mon", "Mon"),
                  t("calendar.weekdays.tue", "Tue"),
                  t("calendar.weekdays.wed", "Wed"),
                  t("calendar.weekdays.thu", "Thu"),
                  t("calendar.weekdays.fri", "Fri"),
                  t("calendar.weekdays.sat", "Sat"),
                ].map((day) => (
                  <div key={day} className="staff-calendar-day-name">
                    {day}
                  </div>
                ))}

                {calendarDays.map((day) => (
                  <button
                    key={day.dateString}
                    type="button"
                    className={[
                      "staff-calendar-day",
                      day.isCurrentMonth ? "" : "staff-calendar-muted",
                      day.isToday ? "staff-calendar-today" : "",
                      selectedDate === day.dateString
                        ? "staff-calendar-selected"
                        : "",
                    ].join(" ")}
                    onClick={() => setSelectedDate(day.dateString)}
                  >
                    <strong>{day.date.getDate()}</strong>
                    {day.bookings.length > 0 && (
                      <span>
                        {day.bookings.length}{" "}
                        {day.bookings.length === 1
                          ? t("staffCalendar.bookingSingle", "booking")
                          : t("staffCalendar.bookingPlural", "bookings")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="card staff-selected-day">
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                    dateLocale,
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </h2>
              </div>

              {selectedBookings.length === 0 ? (
                <div className="staff-calendar-empty">
                  <h3>
                    {t(
                      "staffCalendar.emptyTitle",
                      "No assigned bookings for this date",
                    )}
                  </h3>
                  <p className="muted">
                    {t(
                      "staffCalendar.emptyDay",
                      "Choose another day to review your schedule. New appointments will appear here once they are assigned to you.",
                    )}
                  </p>
                </div>
              ) : (
                <div className="staff-selected-bookings">
                  {selectedBookings.map((booking) => {
                    const start = new Date(booking.start_at);
                    const end = booking.end_at
                      ? new Date(booking.end_at)
                      : new Date(
                          start.getTime() + booking.duration_minutes * 60000,
                        );

                    return (
                      <div
                        key={booking.id}
                        className="card staff-calendar-booking"
                      >
                        <div className="staff-booking-time">
                          <strong>
                            {start.toLocaleTimeString(dateLocale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </strong>
                          <span>
                            {end.toLocaleTimeString(dateLocale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="staff-booking-main">
                          <div className="staff-booking-title-row">
                            <strong>
                              {booking.customer_name ||
                                t("common.customer", "Customer")}
                            </strong>
                            <span
                              className="small staff-booking-status"
                              style={{ color: statusColor(booking.status) }}
                            >
                              {statusLabel(booking.status)}
                            </span>
                          </div>
                          <p className="small muted">
                            {serviceName(
                              booking,
                              t("common.service", "Service"),
                            )}
                          </p>
                          {booking.status === "pending" && (
                            <p className="small muted">
                              {t(
                                "staff.booking.pendingHint",
                                "Awaiting business approval. No staff action is needed yet.",
                              )}
                            </p>
                          )}
                        </div>

                        <div className="staff-calendar-booking-actions">
                          {booking.customer_email && (
                            <a
                              href={`mailto:${booking.customer_email}`}
                              className="btn btn-ghost"
                            >
                              {t(
                                "staff.booking.emailCustomer",
                                "Email customer",
                              )}
                            </a>
                          )}
                          {!booking.customer_email &&
                            booking.customer_phone && (
                              <a
                                href={`tel:${booking.customer_phone}`}
                                className="btn btn-ghost"
                              >
                                {t(
                                  "staff.booking.callCustomer",
                                  "Call customer",
                                )}
                              </a>
                            )}
                          {booking.status === "confirmed" &&
                            start <= new Date() && (
                              <button
                                type="button"
                                className="btn btn-accent"
                                disabled={actionLoadingId === booking.id}
                                onClick={() => markBookingComplete(booking)}
                              >
                                {actionLoadingId === booking.id
                                  ? t("common.saving", "Saving...")
                                  : t(
                                      "staff.booking.markComplete",
                                      "Mark complete",
                                    )}
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .staff-workspace-page {
          width: 100%;
          min-width: 0;
        }

        .staff-calendar-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          border-color: rgba(255, 107, 53, 0.18);
          margin-bottom: 1rem;
        }

        .staff-calendar-success {
          margin-bottom: 1rem;
          padding: 0.85rem 1rem;
          border: 1px solid rgba(45, 212, 191, 0.28);
          border-radius: var(--radius);
          color: var(--success);
          background: rgba(45, 212, 191, 0.06);
        }

        .staff-calendar-success p {
          margin: 0;
        }

        .staff-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .staff-calendar-scroll {
          max-width: 100%;
          overflow-x: auto;
          overscroll-behavior-inline: contain;
          -webkit-overflow-scrolling: touch;
        }

        .staff-calendar-day-name {
          color: var(--text-muted);
          font-size: 0.8rem;
          text-align: center;
          padding: 0.35rem;
        }

        .staff-calendar-day {
          min-height: 5.75rem;
          border: 1px solid var(--border);
          border-radius: 1rem;
          background: var(--surface);
          color: var(--text);
          text-align: left;
          padding: 0.75rem;
          display: grid;
          align-content: start;
          gap: 0.35rem;
          cursor: pointer;
        }

        .staff-calendar-day span {
          color: var(--accent);
          font-size: 0.78rem;
        }

        .staff-calendar-muted {
          opacity: 0.45;
        }

        .staff-calendar-today {
          border-color: rgba(255, 107, 53, 0.45);
        }

        .staff-calendar-selected {
          background: rgba(255, 107, 53, 0.1);
          border-color: rgba(255, 107, 53, 0.65);
        }

        .staff-selected-day {
          display: grid;
          gap: 1rem;
        }

        .staff-selected-day p,
        .staff-calendar-booking p {
          margin-top: 0;
        }

        .staff-selected-bookings {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .staff-calendar-empty {
          display: grid;
          gap: 0.75rem;
          justify-items: start;
          padding-top: 0.5rem;
        }

        .staff-calendar-empty h3,
        .staff-calendar-empty p {
          margin: 0;
        }

        .staff-calendar-booking {
          display: grid;
          grid-template-columns: minmax(4.5rem, 0.18fr) minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: flex-start;
          background: var(--surface-2);
        }

        .staff-booking-time {
          display: grid;
          gap: 0.15rem;
          padding: 0.65rem;
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) - 4px);
          background: rgba(255, 107, 53, 0.08);
        }

        .staff-booking-time strong,
        .staff-booking-time span {
          line-height: 1.1;
        }

        .staff-booking-time span {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .staff-booking-main {
          min-width: 0;
          display: grid;
          gap: 0.35rem;
        }

        .staff-booking-title-row {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-booking-status {
          padding: 0.16rem 0.5rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
        }

        .staff-calendar-booking-actions {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 760px) {
          .staff-calendar-toolbar,
          .staff-calendar-booking {
            display: grid;
          }

          .staff-calendar-booking {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .staff-calendar-toolbar :global(.btn),
          .staff-calendar-booking-actions :global(.btn),
          .staff-calendar-booking-actions a {
            width: 100%;
            justify-content: center;
          }

          .staff-calendar-grid {
            gap: 0.35rem;
            min-width: 0;
            grid-template-columns: repeat(7, minmax(0, 1fr));
          }

          .staff-calendar-day {
            min-height: 3.95rem;
            padding: 0.45rem;
            border-radius: 0.75rem;
          }

          .staff-calendar-day strong {
            font-size: 0.85rem;
          }

          .staff-calendar-day span {
            width: 0.45rem;
            height: 0.45rem;
            border-radius: 999px;
            background: var(--accent);
            font-size: 0;
          }

          .staff-calendar-booking-actions,
          .staff-calendar-booking-actions :global(.btn),
          .staff-calendar-booking-actions a {
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
