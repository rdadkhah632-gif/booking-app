import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import MobileDayCalendar from "@/components/calendar/MobileDayCalendar";

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

function dateQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDateInputValue(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) && formatDateInputValue(parsed) === value
  );
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const daysSinceMonday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - daysSinceMonday);
  return copy;
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeInputForMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
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

const CALENDAR_HOUR_HEIGHT = 72;
const CALENDAR_MIN_BLOCK_HEIGHT = 52;
const DEFAULT_CALENDAR_START_HOUR = 8;
const DEFAULT_CALENDAR_END_HOUR = 18;

export default function StaffCalendarPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const dateLocale = locale === "sq" ? "sq-AL" : "en-GB";

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    formatDateInputValue(new Date()),
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calendarReady, setCalendarReady] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    const queryDate = dateQueryValue(router.query.date);
    if (isDateInputValue(queryDate) && queryDate !== selectedDate) {
      setSelectedDate(queryDate);
    }

    setCalendarReady(true);
  }, [router.isReady, router.query.date, selectedDate]);

  useEffect(() => {
    if (!calendarReady) return;
    loadCalendar();
  }, [calendarReady, selectedDate]);

  async function loadCalendar() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const redirectTo = encodeURIComponent(
        `/staff/calendar?date=${selectedDate}`,
      );
      window.location.href = `/login?redirectTo=${redirectTo}`;
      return;
    }
    const capabilities = await getAccountCapabilities(
      session.user.id,
      session.user.email,
    );

    if (!capabilities.canUseStaff || !capabilities.primaryStaffId) {
      setStaffProfile(null);
      setBookings([]);
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
      if (staffError) {
        setError(staffError.message);
      } else {
        setStaffProfile(null);
        setBookings([]);
      }
      setLoading(false);
      return;
    }

    const normalisedStaff = staffData as unknown as StaffProfile;
    setStaffProfile(normalisedStaff);

    const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
    const weekStart = startOfWeek(selectedDateObject);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const from = weekStart.toISOString();
    const to = weekEnd.toISOString();

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

  const selectedDateObject = useMemo(
    () => new Date(`${selectedDate}T12:00:00`),
    [selectedDate],
  );
  const weekStartDate = useMemo(
    () => startOfWeek(selectedDateObject),
    [selectedDateObject],
  );
  const weekEndDate = useMemo(
    () => endOfDay(addDays(weekStartDate, 6)),
    [weekStartDate],
  );
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate],
  );
  const weekBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        const bookingDate = new Date(booking.start_at);
        return bookingDate >= weekStartDate && bookingDate <= weekEndDate;
      })
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
  }, [bookings, weekStartDate, weekEndDate]);
  const weekGroups = useMemo(() => {
    return weekDays.map((date) => {
      const dateString = formatDateInputValue(date);
      const dayBookings = weekBookings.filter(
        (booking) =>
          formatDateInputValue(new Date(booking.start_at)) === dateString,
      );

      return {
        date,
        dateString,
        shortLabel: date.toLocaleDateString(dateLocale, {
          weekday: "short",
          day: "numeric",
        }),
        bookings: dayBookings,
      };
    });
  }, [dateLocale, weekBookings, weekDays]);
  const selectedBooking = useMemo(
    () =>
      weekBookings.find((booking) => booking.id === selectedBookingId) || null,
    [selectedBookingId, weekBookings],
  );
  const weekLabel = `${weekStartDate.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
  })} - ${weekEndDate.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
  })}`;

  useEffect(() => {
    if (
      selectedBookingId &&
      !bookings.some((booking) => booking.id === selectedBookingId)
    ) {
      setSelectedBookingId(null);
    }
  }, [bookings, selectedBookingId]);

  function statusLabel(status: string) {
    if (status === "pending")
      return t("staff.status.pending", "Awaiting business approval");
    if (status === "confirmed") return t("staff.status.confirmed", "Confirmed");
    if (status === "declined") return t("staff.status.declined", "Declined");
    if (status === "completed") return t("staff.status.completed", "Completed");
    if (status === "cancelled") return t("staff.status.cancelled", "Cancelled");
    return status;
  }

  function bookingTime(booking: Booking) {
    const start = new Date(booking.start_at);
    const end = booking.end_at
      ? new Date(booking.end_at)
      : new Date(start.getTime() + booking.duration_minutes * 60000);

    return {
      start,
      end,
      label: `${start.toLocaleTimeString(dateLocale, {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${end.toLocaleTimeString(dateLocale, {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    };
  }

  function scheduleWindowFor(dayBookings: Booking[]) {
    if (dayBookings.length === 0) {
      return {
        startHour: DEFAULT_CALENDAR_START_HOUR,
        endHour: DEFAULT_CALENDAR_END_HOUR,
      };
    }

    const startMinutes = dayBookings.map((booking) =>
      minutesSinceMidnight(bookingTime(booking).start),
    );
    const endMinutes = dayBookings.map((booking) =>
      minutesSinceMidnight(bookingTime(booking).end),
    );
    const earliest = Math.min(...startMinutes);
    const latest = Math.max(...endMinutes);
    const startHour = Math.max(
      0,
      Math.min(DEFAULT_CALENDAR_START_HOUR, Math.floor(earliest / 60)),
    );
    const endHour = Math.min(
      24,
      Math.max(DEFAULT_CALENDAR_END_HOUR, Math.ceil(latest / 60)),
    );

    return { startHour, endHour: Math.max(endHour, startHour + 1) };
  }

  function changeCalendarDate(value: string) {
    if (!isDateInputValue(value)) return;

    setSelectedDate(value);
    setSelectedBookingId(null);

    if (router.isReady && dateQueryValue(router.query.date) !== value) {
      void router.replace(
        {
          pathname: "/staff/calendar",
          query: { date: value },
        },
        undefined,
        { shallow: true },
      );
    }
  }

  function moveWeek(direction: -1 | 1) {
    changeCalendarDate(
      formatDateInputValue(addDays(selectedDateObject, direction * 7)),
    );
  }

  function goToToday() {
    changeCalendarDate(formatDateInputValue(new Date()));
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

  function renderCalendarBlock(booking: Booking, startHour: number) {
    const time = bookingTime(booking);
    const startMinutes = minutesSinceMidnight(time.start);
    const endMinutes = minutesSinceMidnight(time.end);
    const durationMinutes = Math.max(
      15,
      endMinutes - startMinutes || booking.duration_minutes,
    );
    const blockTop =
      ((startMinutes - startHour * 60) / 60) * CALENDAR_HOUR_HEIGHT;
    const blockHeight = Math.max(
      CALENDAR_MIN_BLOCK_HEIGHT,
      (durationMinutes / 60) * CALENDAR_HOUR_HEIGHT,
    );
    const isCompactBlock = blockHeight < 58;
    const selected = selectedBookingId === booking.id;

    return (
      <button
        key={booking.id}
        type="button"
        className={`staff-schedule-block ${booking.status} ${
          isCompactBlock ? "compact" : ""
        } ${selected ? "selected" : ""}`}
        style={{
          top: `${Math.max(0, blockTop)}px`,
          height: `${blockHeight}px`,
        }}
        onClick={() => {
          changeCalendarDate(formatDateInputValue(time.start));
          setSelectedBookingId(booking.id);
        }}
        aria-label={`${time.label} ${
          booking.customer_name || t("common.customer", "Customer")
        }`}
      >
        <span>{time.label}</span>
        <strong>
          {booking.customer_name || t("common.customer", "Customer")}
        </strong>
        {!isCompactBlock && booking.status === "pending" && (
          <em>{statusLabel(booking.status)}</em>
        )}
      </button>
    );
  }

  function renderWeekCalendar() {
    const { startHour, endHour } = scheduleWindowFor(weekBookings);
    const hours = Array.from(
      { length: endHour - startHour + 1 },
      (_, index) => startHour + index,
    );
    const scheduleHeight = (endHour - startHour) * CALENDAR_HOUR_HEIGHT;
    const now = new Date();
    const todayKey = formatDateInputValue(now);
    const currentMinutes = minutesSinceMidnight(now);
    const showCurrentTime =
      currentMinutes >= startHour * 60 && currentMinutes <= endHour * 60;
    const selectedGroup =
      weekGroups.find((group) => group.dateString === selectedDate) ||
      weekGroups[0];
    const mobileWindow = scheduleWindowFor(selectedGroup?.bookings || []);
    const mobileAppointments = (selectedGroup?.bookings || []).map(
      (booking) => {
        const time = bookingTime(booking);

        return {
          id: booking.id,
          startMinutes: minutesSinceMidnight(time.start),
          endMinutes: minutesSinceMidnight(time.end),
          timeLabel: time.label,
          title: booking.customer_name || t("common.customer", "Customer"),
          subtitle: serviceName(booking, t("common.service", "Service")),
          status: booking.status,
          statusLabel: statusLabel(booking.status),
        };
      },
    );

    return (
      <section className="staff-week-calendar">
        {selectedGroup && (
          <MobileDayCalendar
            ariaLabel={t("staffCalendar.mobileAgenda.label", "Day calendar")}
            days={weekGroups.map((group) => ({
              key: group.dateString,
              weekday: group.date.toLocaleDateString(dateLocale, {
                weekday: "short",
              }),
              date: String(group.date.getDate()),
              count: group.bookings.length,
              isToday: group.dateString === todayKey,
            }))}
            selectedDayKey={selectedGroup.dateString}
            selectedDayLabel={selectedGroup.date.toLocaleDateString(
              dateLocale,
              {
                weekday: "long",
                day: "numeric",
                month: "long",
              },
            )}
            appointments={mobileAppointments}
            selectedAppointmentId={selectedBookingId}
            startHour={mobileWindow.startHour}
            endHour={mobileWindow.endHour}
            currentTimeMinutes={
              selectedGroup.dateString === todayKey ? currentMinutes : null
            }
            emptyLabel={t(
              "staffCalendar.emptyDayShort",
              "No assigned appointments",
            )}
            onSelectDay={changeCalendarDate}
            onSelectAppointment={setSelectedBookingId}
          />
        )}

        <div className="staff-week-scroll">
          <div className="staff-week-grid">
            <div className="staff-week-corner" />
            {weekGroups.map((group) => (
              <button
                key={group.dateString}
                type="button"
                className={
                  group.dateString === selectedDate
                    ? "staff-week-day-header active"
                    : "staff-week-day-header"
                }
                onClick={() => changeCalendarDate(group.dateString)}
              >
                <span>{group.shortLabel}</span>
                {group.bookings.length > 0 && (
                  <small>
                    {group.bookings.length}{" "}
                    {group.bookings.length === 1
                      ? t("dashboardBookings.appointmentCount", "appointment")
                      : t("dashboardBookings.appointments", "appointments")}
                  </small>
                )}
              </button>
            ))}

            <div
              className="staff-week-time-rail"
              style={{ height: `${scheduleHeight}px` }}
              aria-hidden="true"
            >
              {hours.map((hour) => (
                <span
                  key={hour}
                  style={{
                    top: `${(hour - startHour) * CALENDAR_HOUR_HEIGHT}px`,
                  }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {weekGroups.map((group) => (
              <div
                key={group.dateString}
                className="staff-week-lane"
                style={{ height: `${scheduleHeight}px` }}
              >
                {hours.slice(0, -1).map((hour) => (
                  <span
                    key={hour}
                    className="staff-hour-line"
                    style={{
                      top: `${(hour - startHour) * CALENDAR_HOUR_HEIGHT}px`,
                    }}
                  />
                ))}

                {showCurrentTime && group.dateString === todayKey && (
                  <span
                    className="staff-current-time-line"
                    style={{
                      top: `${
                        ((currentMinutes - startHour * 60) / 60) *
                        CALENDAR_HOUR_HEIGHT
                      }px`,
                    }}
                    aria-hidden="true"
                  >
                    <span>{timeInputForMinutes(currentMinutes)}</span>
                  </span>
                )}

                {group.bookings.length === 0 ? (
                  <span className="staff-week-empty" aria-hidden="true" />
                ) : (
                  group.bookings.map((booking) =>
                    renderCalendarBlock(booking, startHour),
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderSelectedBooking() {
    if (!selectedBooking) return null;

    const time = bookingTime(selectedBooking);
    const start = time.start;
    const isConfirmedAppointment = selectedBooking.status === "confirmed";

    return (
      <section className="staff-selected-appointment">
        <div className="staff-selected-heading">
          <div>
            <p className="small muted">
              {t("dashboardBookings.details.kicker", "Selected appointment")}
            </p>
            <h2>
              {selectedBooking.customer_name ||
                t("common.customer", "Customer")}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSelectedBookingId(null)}
          >
            {t("common.close", "Close")}
          </button>
        </div>

        <div className="staff-selected-card">
          <div className="staff-booking-time">
            <strong>{time.label}</strong>
            <span>
              {selectedBooking.duration_minutes}{" "}
              {t("common.minutes", "minutes")}
            </span>
          </div>

          <div className="staff-booking-main">
            <div className="staff-booking-title-row">
              <strong>
                {serviceName(selectedBooking, t("common.service", "Service"))}
              </strong>
              <span
                className="small staff-booking-status"
                style={{ color: statusColor(selectedBooking.status) }}
              >
                {statusLabel(selectedBooking.status)}
              </span>
            </div>
            {selectedBooking.status === "pending" && (
              <p className="small muted">
                {t(
                  "staff.booking.pendingHint",
                  "Awaiting business approval. No staff action is needed yet.",
                )}
              </p>
            )}
          </div>

          {isConfirmedAppointment ? (
            <div className="staff-calendar-booking-actions">
              {selectedBooking.customer_email && (
                <a
                  href={`mailto:${selectedBooking.customer_email}`}
                  className="btn btn-ghost"
                >
                  {t("staff.booking.emailCustomer", "Email customer")}
                </a>
              )}
              {!selectedBooking.customer_email &&
                selectedBooking.customer_phone && (
                  <a
                    href={`tel:${selectedBooking.customer_phone}`}
                    className="btn btn-ghost"
                  >
                    {t("staff.booking.callCustomer", "Call customer")}
                  </a>
                )}
              {start <= new Date() && (
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={actionLoadingId === selectedBooking.id}
                  onClick={() => markBookingComplete(selectedBooking)}
                >
                  {actionLoadingId === selectedBooking.id
                    ? t("common.saving", "Saving...")
                    : t("staff.booking.markComplete", "Mark complete")}
                </button>
              )}
            </div>
          ) : (
            <p className="staff-selected-no-action small muted">
              {t("staff.booking.noStaffAction", "No staff action needed.")}
            </p>
          )}
        </div>
      </section>
    );
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

        {!loading && !error && !staffProfile && (
          <div className="card staff-no-profile-card">
            <h2>
              {t(
                "staffCalendar.noProfile.title",
                "Calendar is not available yet",
              )}
            </h2>
            <p className="muted">
              {t(
                "staffCalendar.noProfile.body",
                "Ask the business to add your email to Team. Once linked, assigned appointments will appear here.",
              )}
            </p>
            <Link href="/staff" className="btn btn-accent">
              {t("staff.actions.backToToday", "Back to Today")}
            </Link>
          </div>
        )}

        {success && (
          <div className="staff-calendar-success">
            <p>{success}</p>
          </div>
        )}

        {!loading && !error && staffProfile && (
          <>
            <section className="staff-calendar-toolbar">
              <div
                className="staff-week-stepper"
                aria-label={t(
                  "dashboardBookings.week.controls",
                  "Week controls",
                )}
              >
                <button
                  type="button"
                  className="staff-step-button"
                  onClick={() => moveWeek(-1)}
                  aria-label={t("dashboardBookings.week.previous", "Previous")}
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  type="button"
                  className="staff-today-button"
                  onClick={goToToday}
                  title={t(
                    "dashboardBookings.week.returnToToday",
                    "Return to today",
                  )}
                  aria-label={t(
                    "dashboardBookings.week.returnToToday",
                    "Return to today",
                  )}
                >
                  {t("dashboardHome.summary.today", "Today")}
                </button>
                <button
                  type="button"
                  className="staff-step-button"
                  onClick={() => moveWeek(1)}
                  aria-label={t("dashboardBookings.week.next", "Next")}
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>

              <strong className="staff-week-label">{weekLabel}</strong>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) => changeCalendarDate(event.target.value)}
                aria-label={t(
                  "dashboardBookings.filters.jumpDate",
                  "Jump to date",
                )}
              />
            </section>

            {renderWeekCalendar()}

            {renderSelectedBooking()}
          </>
        )}
      </section>

      <style jsx>{`
        .staff-workspace-page {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 1rem;
          height: calc(100dvh - 9.75rem);
          min-height: 34rem;
          width: 100%;
          min-width: 0;
        }

        .staff-no-profile-card {
          display: grid;
          gap: 0.75rem;
          justify-items: start;
          max-width: 42rem;
        }

        .staff-no-profile-card h2,
        .staff-no-profile-card p {
          margin: 0;
        }

        .staff-calendar-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 0.65rem;
          align-items: center;
          padding: 0.75rem 0.85rem;
          border: 1px solid rgba(255, 107, 53, 0.18);
          border-radius: var(--radius);
          background: var(--surface);
          margin-bottom: 0;
          min-width: 0;
        }

        .staff-week-stepper {
          display: inline-flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
        }

        .staff-step-button,
        .staff-today-button {
          min-height: 2.55rem;
          border: 0;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-weight: 900;
        }

        .staff-step-button {
          width: 2.75rem;
          padding: 0;
          font-size: 1.25rem;
        }

        .staff-today-button {
          min-width: 5.2rem;
          padding: 0 0.85rem;
          border-right: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }

        .staff-calendar-toolbar input {
          width: auto;
          min-height: 2.55rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: 8px;
          color-scheme: dark;
          padding: 0.55rem 0.7rem;
        }

        .staff-week-label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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

        .staff-week-calendar {
          display: grid;
          gap: 0.85rem;
          grid-template-rows: minmax(0, 1fr);
          height: 100%;
          min-width: 0;
          max-width: 100%;
          padding: 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: calc(var(--radius) + 2px);
          background:
            radial-gradient(
              circle at 18% 0%,
              rgba(255, 107, 53, 0.12),
              transparent 32%
            ),
            linear-gradient(
              180deg,
              rgba(15, 23, 42, 0.98),
              rgba(2, 6, 23, 0.96)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 24px 70px rgba(0, 0, 0, 0.24);
          overflow: hidden;
        }

        :global(.staff-week-calendar) {
          display: grid;
          gap: 0.85rem;
          grid-template-rows: minmax(0, 1fr);
          height: 100%;
          min-width: 0;
          max-width: 100%;
          padding: 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: calc(var(--radius) + 2px);
          background:
            radial-gradient(
              circle at 18% 0%,
              rgba(255, 107, 53, 0.12),
              transparent 32%
            ),
            linear-gradient(
              180deg,
              rgba(15, 23, 42, 0.98),
              rgba(2, 6, 23, 0.96)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 24px 70px rgba(0, 0, 0, 0.24);
          overflow: hidden;
        }

        .staff-week-scroll {
          position: relative;
          width: 100%;
          min-height: 0;
          max-width: 100%;
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: calc(var(--radius) + 2px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(2, 6, 23, 0.5);
          background-size: 100% 72px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            inset 0 0 0 1px rgba(2, 6, 23, 0.3);
          scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
        }

        :global(.staff-week-scroll) {
          position: relative;
          width: 100%;
          min-height: 0;
          max-width: 100%;
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: calc(var(--radius) + 2px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(2, 6, 23, 0.5);
          background-size: 100% 72px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            inset 0 0 0 1px rgba(2, 6, 23, 0.3);
          scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
        }

        .staff-mobile-week-agenda {
          display: none;
        }

        :global(.staff-mobile-week-agenda) {
          display: none;
        }

        .staff-week-summary {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 0.1rem 0.1rem 0;
        }

        :global(.staff-week-summary) {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 0.1rem 0.1rem 0;
        }

        .staff-week-summary div {
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
          flex-wrap: wrap;
        }

        :global(.staff-week-summary div) {
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
          flex-wrap: wrap;
        }

        .staff-week-summary span {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        :global(.staff-week-summary span) {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .staff-week-pending {
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 800;
        }

        :global(.staff-week-pending) {
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 800;
        }

        .staff-week-grid {
          display: grid;
          grid-template-columns: 4.4rem repeat(7, minmax(7.1rem, 1fr));
          min-width: 100%;
          overflow: visible;
          background: rgba(2, 6, 23, 0.22);
        }

        :global(.staff-week-grid) {
          display: grid;
          grid-template-columns: 4.4rem repeat(7, minmax(7.1rem, 1fr));
          min-width: 100%;
          overflow: visible;
          background: rgba(2, 6, 23, 0.22);
        }

        .staff-week-corner {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 8;
          min-height: 3.6rem;
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.96);
        }

        :global(.staff-week-corner) {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 8;
          min-height: 3.6rem;
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.96);
        }

        .staff-week-day-header {
          position: sticky;
          top: 0;
          z-index: 7;
          min-height: 3.6rem;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          display: grid;
          gap: 0.12rem;
          align-content: center;
          justify-items: center;
          min-width: 0;
          padding: 0.4rem 0.25rem;
          border: 0;
          border-right: 1px solid rgba(148, 163, 184, 0.14);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 0;
          background: rgba(15, 23, 42, 0.62);
          color: var(--text);
          font: inherit;
          text-align: center;
          cursor: pointer;
          transition:
            background 0.16s ease,
            color 0.16s ease;
        }

        :global(.staff-week-day-header) {
          position: sticky;
          top: 0;
          z-index: 7;
          min-height: 3.6rem;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          display: grid;
          gap: 0.12rem;
          align-content: center;
          justify-items: center;
          min-width: 0;
          padding: 0.4rem 0.25rem;
          border: 0;
          border-right: 1px solid rgba(148, 163, 184, 0.14);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 0;
          background: rgba(15, 23, 42, 0.62);
          color: var(--text);
          font: inherit;
          text-align: center;
          cursor: pointer;
          transition:
            background 0.16s ease,
            color 0.16s ease;
        }

        .staff-week-day-header.active {
          background:
            linear-gradient(
              180deg,
              rgba(255, 107, 53, 0.26),
              rgba(255, 107, 53, 0.1)
            ),
            rgba(15, 23, 42, 0.9);
          color: #fff7ed;
          box-shadow: inset 0 -2px 0 rgba(255, 107, 53, 0.75);
        }

        :global(.staff-week-day-header.active) {
          background:
            linear-gradient(
              180deg,
              rgba(255, 107, 53, 0.26),
              rgba(255, 107, 53, 0.1)
            ),
            rgba(15, 23, 42, 0.9);
          color: #fff7ed;
          box-shadow: inset 0 -2px 0 rgba(255, 107, 53, 0.75);
        }

        .staff-week-day-header span,
        .staff-week-day-header small {
          overflow: hidden;
          max-width: 100%;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.staff-week-day-header span),
        :global(.staff-week-day-header small) {
          overflow: hidden;
          max-width: 100%;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .staff-week-day-header span {
          font-weight: 900;
        }

        :global(.staff-week-day-header span) {
          font-weight: 900;
        }

        .staff-week-day-header small {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 800;
        }

        :global(.staff-week-day-header small) {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 800;
        }

        .staff-week-time-rail,
        .staff-week-lane {
          position: relative;
          min-width: 0;
        }

        :global(.staff-week-time-rail),
        :global(.staff-week-lane) {
          position: relative;
          min-width: 0;
        }

        .staff-week-time-rail {
          position: sticky;
          left: 0;
          z-index: 5;
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.92);
          box-shadow: 10px 0 28px rgba(0, 0, 0, 0.18);
        }

        :global(.staff-week-time-rail) {
          position: sticky;
          left: 0;
          z-index: 5;
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.92);
          box-shadow: 10px 0 28px rgba(0, 0, 0, 0.18);
        }

        .staff-week-time-rail span {
          position: absolute;
          right: 0.45rem;
          transform: translateY(-0.55rem);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          white-space: nowrap;
        }

        :global(.staff-week-time-rail span) {
          position: absolute;
          right: 0.45rem;
          transform: translateY(-0.55rem);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .staff-week-lane {
          border-right: 1px solid rgba(148, 163, 184, 0.12);
          overflow: hidden;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0.005)
            ),
            rgba(15, 23, 42, 0.12);
        }

        :global(.staff-week-lane) {
          border-right: 1px solid rgba(148, 163, 184, 0.12);
          overflow: hidden;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0.005)
            ),
            rgba(15, 23, 42, 0.12);
        }

        .staff-week-lane:last-child,
        .staff-week-day-header:last-of-type {
          border-right: 0;
        }

        :global(.staff-week-lane:last-child),
        :global(.staff-week-day-header:last-of-type) {
          border-right: 0;
        }

        .staff-hour-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(148, 163, 184, 0.1);
        }

        :global(.staff-hour-line) {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(148, 163, 184, 0.1);
        }

        .staff-current-time-line,
        :global(.staff-current-time-line) {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 4;
          height: 2px;
          background: var(--accent);
          box-shadow:
            0 0 0 1px rgba(255, 107, 53, 0.18),
            0 0 22px rgba(255, 107, 53, 0.34);
          pointer-events: none;
        }

        .staff-current-time-line::before,
        :global(.staff-current-time-line)::before {
          content: "";
          position: absolute;
          top: 50%;
          left: -0.32rem;
          width: 0.58rem;
          height: 0.58rem;
          border-radius: 999px;
          background: var(--accent);
          transform: translateY(-50%);
          box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.14);
        }

        .staff-current-time-line span,
        :global(.staff-current-time-line span) {
          position: absolute;
          top: 50%;
          right: 0.35rem;
          transform: translateY(-50%);
          padding: 0.12rem 0.36rem;
          border-radius: 999px;
          background: rgba(255, 107, 53, 0.18);
          color: #fff7ed;
          font-size: 0.68rem;
          font-weight: 900;
        }

        .staff-week-empty {
          position: absolute;
          inset: 0.45rem;
          border: 1px dashed rgba(148, 163, 184, 0.12);
          border-radius: calc(var(--radius) - 4px);
          background: rgba(15, 23, 42, 0.12);
          pointer-events: none;
        }

        :global(.staff-week-empty) {
          position: absolute;
          inset: 0.45rem;
          border: 1px dashed rgba(148, 163, 184, 0.12);
          border-radius: calc(var(--radius) - 4px);
          background: rgba(15, 23, 42, 0.12);
          pointer-events: none;
        }

        .staff-schedule-block {
          position: absolute;
          left: 0.5rem;
          right: 0.5rem;
          display: grid;
          align-content: start;
          gap: 0.16rem;
          overflow: hidden;
          padding: 0.58rem 0.65rem;
          border: 1px solid rgba(45, 212, 191, 0.32);
          border-left: 4px solid rgba(45, 212, 191, 0.92);
          border-radius: 0.82rem;
          background:
            linear-gradient(
              135deg,
              rgba(45, 212, 191, 0.18),
              rgba(45, 212, 191, 0.07)
            ),
            rgba(15, 23, 42, 0.96);
          color: var(--text);
          font: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow:
            0 18px 34px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        :global(.staff-schedule-block) {
          position: absolute;
          left: 0.5rem;
          right: 0.5rem;
          display: grid;
          align-content: start;
          gap: 0.16rem;
          overflow: hidden;
          padding: 0.58rem 0.65rem;
          border: 1px solid rgba(45, 212, 191, 0.32);
          border-left: 4px solid rgba(45, 212, 191, 0.92);
          border-radius: 0.82rem;
          background:
            linear-gradient(
              135deg,
              rgba(45, 212, 191, 0.18),
              rgba(45, 212, 191, 0.07)
            ),
            rgba(15, 23, 42, 0.96);
          color: var(--text);
          font: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow:
            0 18px 34px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        .staff-schedule-block:hover,
        .staff-schedule-block:focus-visible,
        :global(.staff-schedule-block:hover),
        :global(.staff-schedule-block:focus-visible) {
          border-color: rgba(45, 212, 191, 0.5);
          box-shadow:
            0 20px 42px rgba(0, 0, 0, 0.28),
            0 0 0 1px rgba(45, 212, 191, 0.16);
          transform: translateY(-1px);
        }

        .staff-schedule-block.selected {
          outline: 2px solid rgba(255, 107, 53, 0.72);
          outline-offset: 1px;
        }

        :global(.staff-schedule-block.selected) {
          outline: 2px solid rgba(255, 107, 53, 0.72);
          outline-offset: 1px;
        }

        .staff-schedule-block.pending {
          border-color: rgba(255, 107, 53, 0.34);
          border-left-color: var(--accent);
          background:
            linear-gradient(
              135deg,
              rgba(255, 107, 53, 0.16),
              rgba(255, 107, 53, 0.06)
            ),
            rgba(15, 23, 42, 0.94);
        }

        :global(.staff-schedule-block.pending) {
          border-color: rgba(255, 107, 53, 0.34);
          border-left-color: var(--accent);
          background:
            linear-gradient(
              135deg,
              rgba(255, 107, 53, 0.16),
              rgba(255, 107, 53, 0.06)
            ),
            rgba(15, 23, 42, 0.94);
        }

        .staff-schedule-block.cancelled,
        .staff-schedule-block.declined {
          border-left-color: var(--warning);
          opacity: 0.76;
        }

        :global(.staff-schedule-block.cancelled),
        :global(.staff-schedule-block.declined) {
          border-left-color: var(--warning);
          opacity: 0.76;
        }

        .staff-schedule-block.completed {
          opacity: 0.82;
        }

        :global(.staff-schedule-block.completed) {
          opacity: 0.82;
        }

        .staff-schedule-block span,
        .staff-schedule-block small {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.74rem;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.staff-schedule-block span),
        :global(.staff-schedule-block small) {
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.74rem;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .staff-schedule-block strong {
          overflow: hidden;
          font-size: 0.88rem;
          line-height: 1.12;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(.staff-schedule-block strong) {
          overflow: hidden;
          font-size: 0.88rem;
          line-height: 1.12;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .staff-schedule-block em {
          width: fit-content;
          margin-top: 0.18rem;
          border-radius: 999px;
          padding: 0.18rem 0.5rem;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 800;
        }

        :global(.staff-schedule-block em) {
          width: fit-content;
          margin-top: 0.18rem;
          border-radius: 999px;
          padding: 0.18rem 0.5rem;
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 800;
        }

        .staff-schedule-block.pending em {
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
        }

        :global(.staff-schedule-block.pending em) {
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
        }

        .staff-schedule-block.confirmed em,
        .staff-schedule-block.completed em {
          display: none;
        }

        :global(.staff-schedule-block.confirmed em),
        :global(.staff-schedule-block.completed em) {
          display: none;
        }

        .staff-schedule-block.compact,
        :global(.staff-schedule-block.compact) {
          align-content: center;
          gap: 0.06rem;
          padding: 0.24rem 0.45rem;
          border-radius: 0.62rem;
        }

        .staff-schedule-block.compact span,
        :global(.staff-schedule-block.compact span) {
          font-size: 0.62rem;
          line-height: 1.05;
        }

        .staff-schedule-block.compact strong,
        :global(.staff-schedule-block.compact strong) {
          font-size: 0.74rem;
          line-height: 1.08;
        }

        .staff-calendar-empty {
          display: grid;
          gap: 0.35rem;
          margin-top: 0.85rem;
          padding: 1rem;
          border: 1px dashed rgba(148, 163, 184, 0.22);
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.02);
        }

        .staff-calendar-empty h3,
        .staff-calendar-empty p,
        .staff-selected-heading h2,
        .staff-selected-heading p,
        .staff-booking-main p {
          margin: 0;
        }

        .staff-selected-appointment {
          position: fixed;
          top: 6.25rem;
          right: 1.25rem;
          z-index: 40;
          width: min(24rem, calc(100vw - 2rem));
          max-height: calc(100vh - 7.5rem);
          overflow-y: auto;
          display: grid;
          gap: 0.75rem;
          padding: 0.95rem;
          border: 1px solid rgba(255, 107, 53, 0.22);
          border-radius: var(--radius);
          background: rgba(255, 107, 53, 0.05);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
        }

        .staff-selected-heading,
        .staff-selected-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-selected-card {
          align-items: flex-start;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 107, 53, 0.18);
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

        .staff-selected-no-action {
          margin: 0;
          align-self: center;
          padding: 0.55rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) - 4px);
          background: rgba(255, 255, 255, 0.03);
        }

        @media (max-width: 760px) {
          .staff-workspace-page {
            height: calc(100dvh - 11rem);
            min-height: 32rem;
          }

          .staff-calendar-toolbar,
          .staff-selected-heading,
          .staff-selected-card {
            display: grid;
            align-items: stretch;
          }

          .staff-calendar-toolbar {
            grid-template-columns: minmax(0, 1fr) 2.75rem;
            gap: 0.45rem;
            padding: 0.55rem;
          }

          .staff-week-stepper {
            width: 100%;
          }

          .staff-week-stepper button {
            flex: 1 1 0;
          }

          .staff-calendar-toolbar input {
            width: 2.75rem;
            min-width: 2.75rem;
            padding: 0.45rem;
            color: transparent;
          }

          .staff-week-label {
            display: none;
          }

          .staff-selected-appointment {
            top: auto;
            right: 0.75rem;
            bottom: 0.75rem;
            left: 0.75rem;
            width: auto;
            max-height: min(70vh, 36rem);
          }

          .staff-calendar-booking-actions :global(.btn),
          .staff-calendar-booking-actions a {
            width: 100%;
            justify-content: center;
          }

          .staff-week-calendar {
            grid-template-rows: minmax(0, 1fr);
            padding: 0;
            gap: 0;
            border-radius: 8px;
            background: transparent;
            box-shadow: none;
          }

          :global(.staff-week-calendar) {
            grid-template-rows: minmax(0, 1fr);
            padding: 0;
            gap: 0;
            border-radius: 8px;
            background: transparent;
            box-shadow: none;
          }

          .staff-week-scroll {
            display: none;
          }

          :global(.staff-week-scroll) {
            display: none;
          }

          .staff-week-summary,
          :global(.staff-week-summary) {
            display: none;
          }

          .staff-mobile-week-agenda {
            display: grid;
            gap: 0.55rem;
            min-height: 0;
            overflow-y: auto;
            padding-right: 0.12rem;
            scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
            scrollbar-width: thin;
          }

          :global(.staff-mobile-week-agenda) {
            display: grid;
            gap: 0.55rem;
            min-height: 0;
            overflow-y: auto;
            padding-right: 0.12rem;
            scrollbar-color: rgba(255, 107, 53, 0.45) transparent;
            scrollbar-width: thin;
          }

          .staff-mobile-agenda-day {
            display: grid;
            gap: 0.5rem;
            padding: 0.65rem;
            border: 1px solid var(--border);
            border-radius: calc(var(--radius) - 2px);
            background: rgba(15, 23, 42, 0.3);
          }

          :global(.staff-mobile-agenda-day) {
            display: grid;
            gap: 0.5rem;
            padding: 0.65rem;
            border: 1px solid var(--border);
            border-radius: calc(var(--radius) - 2px);
            background: rgba(15, 23, 42, 0.3);
          }

          .staff-mobile-agenda-day.active {
            border-color: rgba(255, 107, 53, 0.32);
            background: rgba(255, 107, 53, 0.06);
          }

          :global(.staff-mobile-agenda-day.active) {
            border-color: rgba(255, 107, 53, 0.32);
            background: rgba(255, 107, 53, 0.06);
          }

          .staff-mobile-agenda-day-heading {
            width: 100%;
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: center;
            border: 0;
            background: transparent;
            color: var(--text);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          :global(.staff-mobile-agenda-day-heading) {
            width: 100%;
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: center;
            border: 0;
            background: transparent;
            color: var(--text);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          .staff-mobile-agenda-day-heading span,
          :global(.staff-mobile-agenda-day-heading span) {
            font-weight: 900;
          }

          .staff-mobile-agenda-day-heading strong,
          :global(.staff-mobile-agenda-day-heading strong) {
            color: var(--text-muted);
            font-size: 0.78rem;
            white-space: nowrap;
          }

          .staff-mobile-agenda-list,
          :global(.staff-mobile-agenda-list) {
            display: grid;
            gap: 0.45rem;
          }

          .staff-mobile-agenda-booking {
            display: grid;
            gap: 0.12rem;
            padding: 0.65rem;
            border: 1px solid rgba(45, 212, 191, 0.24);
            border-left: 4px solid var(--success);
            border-radius: calc(var(--radius) - 4px);
            background: rgba(15, 23, 42, 0.72);
            color: var(--text);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          :global(.staff-mobile-agenda-booking) {
            display: grid;
            gap: 0.12rem;
            padding: 0.65rem;
            border: 1px solid rgba(45, 212, 191, 0.24);
            border-left: 4px solid var(--success);
            border-radius: calc(var(--radius) - 4px);
            background: rgba(15, 23, 42, 0.72);
            color: var(--text);
            font: inherit;
            text-align: left;
            cursor: pointer;
          }

          .staff-mobile-agenda-booking.pending,
          :global(.staff-mobile-agenda-booking.pending) {
            border-color: rgba(255, 107, 53, 0.28);
            border-left-color: var(--accent);
          }

          .staff-mobile-agenda-booking.cancelled,
          .staff-mobile-agenda-booking.declined,
          :global(.staff-mobile-agenda-booking.cancelled),
          :global(.staff-mobile-agenda-booking.declined) {
            border-left-color: var(--warning);
            opacity: 0.82;
          }

          .staff-mobile-agenda-booking span,
          .staff-mobile-agenda-booking small,
          :global(.staff-mobile-agenda-booking span),
          :global(.staff-mobile-agenda-booking small) {
            color: var(--text-muted);
            font-size: 0.76rem;
          }

          .staff-mobile-agenda-booking strong,
          :global(.staff-mobile-agenda-booking strong) {
            font-size: 0.9rem;
          }

          .staff-mobile-agenda-booking em,
          :global(.staff-mobile-agenda-booking em) {
            width: fit-content;
            margin-top: 0.18rem;
            padding: 0.16rem 0.5rem;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-muted);
            font-size: 0.72rem;
            font-style: normal;
            font-weight: 800;
          }

          .staff-mobile-agenda-empty,
          :global(.staff-mobile-agenda-empty) {
            margin: 0;
          }

          .staff-week-summary {
            display: grid;
            align-items: stretch;
          }

          :global(.staff-week-summary) {
            display: grid;
            align-items: stretch;
          }

          .staff-week-grid {
            grid-template-columns: 3.65rem repeat(7, minmax(5.2rem, 1fr));
            min-width: 700px;
          }

          :global(.staff-week-grid) {
            grid-template-columns: 3.65rem repeat(7, minmax(5.2rem, 1fr));
            min-width: 700px;
          }

          .staff-week-corner,
          .staff-week-day-header {
            min-height: 3.1rem;
          }

          :global(.staff-week-corner),
          :global(.staff-week-day-header) {
            min-height: 3.1rem;
          }

          .staff-week-day-header {
            padding: 0.3rem 0.15rem;
          }

          :global(.staff-week-day-header) {
            padding: 0.3rem 0.15rem;
          }

          .staff-week-day-header small {
            font-size: 0.62rem;
          }

          :global(.staff-week-day-header small) {
            font-size: 0.62rem;
          }

          .staff-week-time-rail span {
            right: 0.3rem;
            font-size: 0.66rem;
          }

          :global(.staff-week-time-rail span) {
            right: 0.3rem;
            font-size: 0.66rem;
          }

          .staff-schedule-block {
            left: 0.18rem;
            right: 0.18rem;
            padding: 0.42rem;
          }

          :global(.staff-schedule-block) {
            left: 0.18rem;
            right: 0.18rem;
            padding: 0.42rem;
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
