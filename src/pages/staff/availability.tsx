import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

type StaffMember = {
  id: string;
  business_id: string;
  user_id?: string | null;
  name: string;
  role_title?: string | null;
  email?: string | null;
  phone?: string | null;
  image_url?: string | null;
  invite_status?: string | null;
  permission_role?: string | null;
  active: boolean;
  businesses?:
    | {
        name: string;
        city?: string | null;
        category?: string | null;
      }
    | {
        name: string;
        city?: string | null;
        category?: string | null;
      }[]
    | null;
};

type StaffAvailability = {
  id?: string;
  staff_member_id: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

type Booking = {
  id: string;
};

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function defaultAvailabilityRow(
  staff: StaffMember,
  day: number,
): StaffAvailability {
  const isWeekend = day === 0;

  return {
    staff_member_id: staff.id,
    business_id: staff.business_id,
    day_of_week: day,
    start_time: "09:00",
    end_time: "17:00",
    is_closed: isWeekend,
  };
}

function businessName(staff: StaffMember | null, fallback = "Your business") {
  if (!staff?.businesses) return fallback;
  return Array.isArray(staff.businesses)
    ? staff.businesses[0]?.name || fallback
    : staff.businesses.name || fallback;
}

function formatHours(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export default function StaffAvailabilityPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null);
  const [availability, setAvailability] = useState<StaffAvailability[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/staff/availability");
        return;
      }

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      if (!capabilities.canUseStaff || !capabilities.primaryStaffId) {
        setStaffProfile(null);
        setAvailability([]);
        setUpcomingBookings([]);
        setLoading(false);
        return;
      }

      const { data: linkedStaff, error: staffError } = await supabase
        .from("staff_members")
        .select(
          `
          id,
          business_id,
          user_id,
          name,
          role_title,
          email,
          phone,
          image_url,
          invite_status,
          permission_role,
          active,
          businesses (
            name,
            city,
            category
          )
        `,
        )
        .eq("id", capabilities.primaryStaffId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (staffError) throw staffError;

      if (!linkedStaff) {
        setStaffProfile(null);
        setAvailability([]);
        setUpcomingBookings([]);
        setLoading(false);
        return;
      }

      const normalisedStaff = linkedStaff as unknown as StaffMember;
      setStaffProfile(normalisedStaff);

      const { data: availabilityData, error: availabilityError } =
        await supabase
          .from("staff_availability")
          .select(
            "id, staff_member_id, business_id, day_of_week, start_time, end_time, is_closed",
          )
          .eq("staff_member_id", normalisedStaff.id)
          .order("day_of_week", { ascending: true });

      if (availabilityError) throw availabilityError;

      const existingRows = (availabilityData || []) as StaffAvailability[];
      const mergedRows = DAYS.map((day) => {
        const existing = existingRows.find((row) => row.day_of_week === day);
        return existing || defaultAvailabilityRow(normalisedStaff, day);
      });

      setAvailability(mergedRows);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("id")
        .eq("staff_member_id", normalisedStaff.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(8);

      if (bookingError) throw bookingError;

      setUpcomingBookings((bookingData || []) as unknown as Booking[]);
      setLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t("staffAvailability.error.load", "Could not load working hours."),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadPage();
  }, [router.isReady]);

  const openDays = useMemo(() => {
    return availability.filter((row) => !row.is_closed).length;
  }, [availability]);

  const closedDays = useMemo(() => {
    return availability.filter((row) => row.is_closed).length;
  }, [availability]);
  const totalWeeklyHours = useMemo(() => {
    return availability.reduce((total, row) => {
      if (row.is_closed) return total;

      const start = new Date(`2026-01-01T${row.start_time}`);
      const end = new Date(`2026-01-01T${row.end_time}`);

      if (end <= start) return total;

      return total + (end.getTime() - start.getTime()) / 3600000;
    }, 0);
  }, [availability]);

  function updateAvailabilityRow(
    day: number,
    field: keyof StaffAvailability,
    value: string | boolean,
  ) {
    setAvailability((current) =>
      current.map((row) =>
        row.day_of_week === day ? { ...row, [field]: value } : row,
      ),
    );
  }

  function applyWeekdayTemplate() {
    setAvailability((current) =>
      current.map((row) => {
        if (row.day_of_week >= 1 && row.day_of_week <= 5) {
          return {
            ...row,
            start_time: "09:00",
            end_time: "17:00",
            is_closed: false,
          };
        }

        return {
          ...row,
          is_closed: true,
        };
      }),
    );
  }

  function applyExtendedTemplate() {
    setAvailability((current) =>
      current.map((row) => {
        if (row.day_of_week >= 1 && row.day_of_week <= 6) {
          return {
            ...row,
            start_time: "09:00",
            end_time: "19:00",
            is_closed: false,
          };
        }

        return {
          ...row,
          is_closed: true,
        };
      }),
    );
  }

  async function saveAvailability() {
    if (!staffProfile) return;

    const invalidRow = availability.find((row) => {
      if (row.is_closed) return false;
      return !row.start_time || !row.end_time || row.end_time <= row.start_time;
    });

    if (invalidRow) {
      setError(
        t(
          "staffAvailability.error.invalidTime",
          "Each open day needs a valid start and end time. End time must be after start time.",
        ),
      );
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const rowsToSave = availability.map((row) => ({
      staff_member_id: staffProfile.id,
      business_id: staffProfile.business_id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed,
    }));

    const { error: deleteError } = await supabase
      .from("staff_availability")
      .delete()
      .eq("staff_member_id", staffProfile.id);

    if (deleteError) {
      setSaving(false);
      setError(deleteError.message);
      return;
    }

    const { error } = await supabase
      .from("staff_availability")
      .insert(rowsToSave);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(t("staffAvailability.success.saved", "Working hours saved."));
    await loadPage();
  }

  if (loading) {
    return (
      <DashboardLayout workspace="staff">
        <section className="staff-workspace-page">
          <div className="card">
            <p className="muted">
              {t("staffAvailability.loading", "Loading working hours...")}
            </p>
          </div>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      workspace="staff"
      title={
        staffProfile ? t("staffAvailability.title", "Working hours") : undefined
      }
      subtitle={
        staffProfile
          ? businessName(
              staffProfile,
              t("staff.fallback.business", "Your business"),
            )
          : undefined
      }
    >
      <section className="staff-workspace-page">
        {!staffProfile && (
          <div className="card">
            <h1 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>
              {t(
                "staffAvailability.noProfile.title",
                "Working hours are not available yet",
              )}
            </h1>
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              {t(
                "staffAvailability.noProfile.body",
                "Ask the business to add your email to Team, then log in again. Once linked, you can manage your own working hours.",
              )}
            </p>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginTop: "1rem",
              }}
            >
              <Link href="/staff" className="btn btn-accent">
                {t("staff.actions.backToToday", "Back to Today")}
              </Link>
            </div>
          </div>
        )}

        {staffProfile && (
          <>
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

            {success && (
              <div
                className="card"
                style={{
                  borderColor: "rgba(45,212,191,0.35)",
                  background: "rgba(45,212,191,0.06)",
                  marginBottom: "1rem",
                }}
              >
                <p style={{ color: "var(--success)" }}>{success}</p>
              </div>
            )}

            <div className="staff-availability-summary">
              <span>
                <strong>{openDays}</strong>{" "}
                {t("staffAvailability.summary.openDays", "open days")}
              </span>
              <span>
                <strong>{closedDays}</strong>{" "}
                {t("staffAvailability.summary.closedDays", "closed days")}
              </span>
              <span>
                <strong>{formatHours(totalWeeklyHours)}</strong>{" "}
                {t("staffAvailability.summary.hoursShort", "hours per week")}
              </span>
            </div>

            <div className="staff-template-card">
              <div className="staff-template-header">
                <strong>
                  {t("staffAvailability.templates.compactTitle", "Templates")}
                </strong>

                <div className="staff-template-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={applyWeekdayTemplate}
                  >
                    {t("staffAvailability.templates.weekday", "Mon-Fri 9-5")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={applyExtendedTemplate}
                  >
                    {t("staffAvailability.templates.extended", "Mon-Sat 9-7")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={saveAvailability}
                    disabled={saving}
                  >
                    {saving
                      ? t("common.saving", "Saving...")
                      : t(
                          "staffAvailability.actions.saveWeekly",
                          "Save working hours",
                        )}
                  </button>
                </div>
              </div>
            </div>

            <div className="staff-availability-grid">
              {DAYS.map((day) => {
                const row =
                  availability.find((item) => item.day_of_week === day) ||
                  defaultAvailabilityRow(staffProfile, day);

                return (
                  <div key={day} className="staff-day-card">
                    <div className="staff-day-card-header">
                      <div>
                        <h3>
                          {t(
                            `calendar.days.${day}`,
                            [
                              "Sunday",
                              "Monday",
                              "Tuesday",
                              "Wednesday",
                              "Thursday",
                              "Friday",
                              "Saturday",
                            ][day],
                          )}
                        </h3>
                      </div>

                      <label
                        className={`staff-toggle-row ${row.is_closed ? "closed" : "open"}`}
                      >
                        <input
                          type="checkbox"
                          checked={!row.is_closed}
                          onChange={(e) =>
                            updateAvailabilityRow(
                              day,
                              "is_closed",
                              !e.target.checked,
                            )
                          }
                        />
                        <span>
                          {row.is_closed
                            ? t("staffAvailability.day.closed", "Closed")
                            : t("staffAvailability.day.open", "Open")}
                        </span>
                      </label>
                    </div>

                    {!row.is_closed ? (
                      <div className="staff-time-editor">
                        <div className="staff-time-grid">
                          <label className="small muted">
                            {t("staffAvailability.day.start", "Start")}
                            <input
                              type="time"
                              value={row.start_time}
                              onChange={(e) =>
                                updateAvailabilityRow(
                                  day,
                                  "start_time",
                                  e.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="small muted">
                            {t("staffAvailability.day.end", "End")}
                            <input
                              type="time"
                              value={row.end_time}
                              onChange={(e) =>
                                updateAvailabilityRow(
                                  day,
                                  "end_time",
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <p className="muted small staff-closed-copy">
                        {t(
                          "staffAvailability.day.closedBody",
                          "Closed to customers.",
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {upcomingBookings.length > 0 && (
              <div className="staff-calendar-note">
                <span>
                  {upcomingBookings.length}{" "}
                  {t(
                    "staffAvailability.upcoming.count",
                    "upcoming appointments stay as booked.",
                  )}
                </span>
                <Link href="/staff/calendar">
                  {t(
                    "staffAvailability.upcoming.openCalendar",
                    "Open calendar",
                  )}
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <style jsx>{`
        .staff-workspace-page {
          width: 100%;
          min-width: 0;
        }

        .staff-template-actions {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .staff-template-card {
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
        }

        .staff-availability-note {
          margin: -0.5rem 0 1.25rem;
          color: var(--text-muted);
          font-size: 0.88rem;
        }

        .staff-availability-note,
        .staff-template-header,
        .staff-day-card,
        .staff-summary-grid :global(.card) {
          gap: 0.75rem;
        }

        .staff-availability-note p,
        .staff-template-header p,
        .staff-day-card p,
        .staff-summary-grid p {
          margin-top: 0;
        }

        .staff-availability-summary {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
          padding: 0.7rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .staff-availability-summary strong {
          color: var(--text);
        }

        .staff-calendar-note {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .staff-calendar-note a {
          color: var(--accent);
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }
        .staff-template-header {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-availability-grid {
          display: grid;
          gap: 0;
        }

        .staff-day-card {
          display: grid;
          grid-template-columns: minmax(8rem, 1fr) auto minmax(14rem, 1.25fr);
          gap: 0.75rem;
          align-items: center;
          padding: 0.7rem 0;
          border-bottom: 1px solid var(--border);
        }

        .staff-day-card-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        .staff-toggle-row {
          display: inline-flex;
          gap: 0.45rem;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1;
          white-space: nowrap;
          min-width: 92px;
          padding: 0.45rem 0.65rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
        }

        .staff-toggle-row.open {
          color: var(--success);
          border-color: rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.08);
        }

        .staff-toggle-row.closed {
          color: var(--text-muted);
        }

        .staff-toggle-row input {
          width: 1rem;
          height: 1rem;
          flex: 0 0 auto;
        }

        .staff-time-editor {
          display: grid;
        }

        .staff-time-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.55rem;
        }

        .staff-time-grid input {
          margin-top: 0.35rem;
          width: 100%;
        }

        .staff-closed-copy {
          margin-top: 0;
          max-width: 32ch;
        }

        .staff-upcoming-empty {
          display: grid;
          gap: 0.75rem;
          justify-items: start;
        }

        @media (max-width: 620px) {
          .staff-template-header {
            display: grid;
          }

          .staff-template-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .staff-template-actions,
          .staff-template-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .staff-template-actions :global(.btn:last-child) {
            grid-column: 1 / -1;
          }

          .staff-day-card-header {
            align-items: center;
          }

          .staff-day-card {
            grid-template-columns: 1fr auto;
          }

          .staff-time-editor,
          .staff-time-grid,
          .staff-closed-copy {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
