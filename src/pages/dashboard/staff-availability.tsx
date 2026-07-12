import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/lib/useI18n";

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const mondayFirstDayOrder = [1, 2, 3, 4, 5, 6, 0];
const dayTranslationKeys = [
  "common.days.sunday",
  "common.days.monday",
  "common.days.tuesday",
  "common.days.wednesday",
  "common.days.thursday",
  "common.days.friday",
  "common.days.saturday",
];

type StaffMember = {
  id: string;
  name: string;
  role_title?: string | null;
  business_id: string;
  active?: boolean;
  businesses?: {
    id: string;
    name: string;
    user_id: string;
  } | null;
};

type StaffAvailabilityRow = {
  id?: string;
  business_id: string;
  staff_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

function normaliseTimeValue(value?: string | null) {
  if (!value) return "";
  const [hour = "", minute = ""] = value.split(":");
  if (!hour || !minute) return "";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function formTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function rowsFromAvailabilityForm(
  formData: FormData,
  currentRows: StaffAvailabilityRow[],
) {
  return currentRows.map((row) => {
    const day = row.day_of_week;

    return {
      ...row,
      is_closed: formData.get(`closed-${day}`) === "on",
      start_time:
        normaliseTimeValue(formTextValue(formData, `start-${day}`)) ||
        normaliseTimeValue(row.start_time) ||
        "09:00",
      end_time:
        normaliseTimeValue(formTextValue(formData, `end-${day}`)) ||
        normaliseTimeValue(row.end_time) ||
        "17:00",
    };
  });
}

export default function StaffAvailabilityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { staffId } = router.query;

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [rows, setRows] = useState<StaffAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function defaultRows(
    currentStaffId: string,
    currentBusinessId: string,
  ): StaffAvailabilityRow[] {
    return days.map((_, i) => ({
      staff_member_id: currentStaffId,
      business_id: currentBusinessId,
      day_of_week: i,
      start_time: "09:00",
      end_time: "17:00",
      is_closed: i === 0,
    }));
  }

  async function loadPage(options?: { keepSuccess?: boolean }) {
    setLoading(true);
    setError(null);
    if (!options?.keepSuccess) setSuccess(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!staffId || Array.isArray(staffId)) {
      setError(
        t(
          "dashboardStaff.availability.missingStaff",
          "Choose a staff member to manage their working hours.",
        ),
      );
      setLoading(false);
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staff_members")
      .select(
        `
        id,
        name,
        role_title,
        business_id,
        active,
        businesses (
          id,
          name,
          user_id
        )
      `,
      )
      .eq("id", staffId)
      .single();

    if (staffError || !staffData) {
      setError(
        t(
          "dashboardStaff.availability.staffNotFound",
          "This staff member could not be found.",
        ),
      );
      setLoading(false);
      return;
    }

    const linkedBusiness = Array.isArray(staffData.businesses)
      ? staffData.businesses[0]
      : staffData.businesses;

    if (linkedBusiness?.user_id !== session.user.id) {
      setError(
        t(
          "dashboardStaff.availability.noAccess",
          "You do not have access to manage this staff member.",
        ),
      );
      setLoading(false);
      return;
    }

    setStaff({
      ...staffData,
      businesses: linkedBusiness,
    });

    const { data: existing, error: availabilityError } = await supabase
      .from("staff_availability")
      .select("*")
      .eq("business_id", staffData.business_id)
      .eq("staff_member_id", staffId)
      .order("day_of_week");

    if (availabilityError) {
      setError(availabilityError.message);
      setLoading(false);
      return;
    }

    if (existing && existing.length > 0) {
      const existingByDay = new Map<number, StaffAvailabilityRow>();
      existing.forEach((row: StaffAvailabilityRow) =>
        existingByDay.set(row.day_of_week, row),
      );

      setRows(
        days.map((_, i) => {
          const existingRow = existingByDay.get(i);
          return existingRow
            ? {
                ...existingRow,
                start_time:
                  normaliseTimeValue(existingRow.start_time) || "09:00",
                end_time: normaliseTimeValue(existingRow.end_time) || "17:00",
              }
            : {
                staff_member_id: staffId,
                business_id: staffData.business_id,
                day_of_week: i,
                start_time: "09:00",
                end_time: "17:00",
                is_closed: i === 0,
              };
        }),
      );
    } else {
      setRows(defaultRows(staffId, staffData.business_id));
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadPage();
  }, [router.isReady, staffId]);

  const availabilityStats = useMemo(() => {
    const openRows = rows.filter((row) => !row.is_closed);
    const closedRows = rows.filter((row) => row.is_closed);
    const invalidRows = openRows.filter(
      (row) => row.start_time >= row.end_time,
    );

    return {
      openDays: openRows.length,
      closedDays: closedRows.length,
      invalidDays: invalidRows.length,
      ready: openRows.length > 0 && invalidRows.length === 0,
    };
  }, [rows]);
  const displayRows = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index }))
        .sort(
          (left, right) =>
            mondayFirstDayOrder.indexOf(left.row.day_of_week) -
            mondayFirstDayOrder.indexOf(right.row.day_of_week),
        ),
    [rows],
  );

  function updateRow(
    index: number,
    field: keyof StaffAvailabilityRow,
    value: string | boolean,
  ) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function saveErrorMessage(message?: string | null) {
    if (message && process.env.NODE_ENV !== "production") {
      console.warn("[staff-availability] Save failed", message);
    }

    return t(
      "staffAvailability.error.save",
      "Working hours could not be saved. Refresh and try again, or check this staff member still belongs to your business.",
    );
  }

  function applyWeekdayPreset() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        start_time:
          row.day_of_week === 0 || row.day_of_week === 6
            ? row.start_time
            : "09:00",
        end_time:
          row.day_of_week === 0 || row.day_of_week === 6
            ? row.end_time
            : "17:00",
        is_closed: row.day_of_week === 0 || row.day_of_week === 6,
      })),
    );
  }

  function applyEverydayPreset() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        start_time: "09:00",
        end_time: "17:00",
        is_closed: false,
      })),
    );
  }

  function closeAllDays() {
    const confirmed = confirm(
      t(
        "dashboardStaff.availability.closeAllConfirm",
        "Close every day for this staff member? Customers will not see them as available until you reopen a day.",
      ),
    );
    if (!confirmed) return;

    setRows((prev) => prev.map((row) => ({ ...row, is_closed: true })));
  }

  async function saveAvailability(rowsToSave = rows) {
    if (!staff || !staffId || Array.isArray(staffId)) return;

    const openRowsToSave = rowsToSave.filter((row) => !row.is_closed);
    const invalidRow = rowsToSave.find(
      (row) => !row.is_closed && row.start_time >= row.end_time,
    );

    if (invalidRow) {
      setError(
        t(
          "dashboardStaff.availability.invalidRange",
          "An open day has an invalid time range. Start time must be before end time.",
        ),
      );
      return;
    }

    if (openRowsToSave.length === 0) {
      const confirmed = confirm(
        t(
          "dashboardStaff.availability.noOpenDaysConfirm",
          "This staff member has no open days and will not appear available for bookings. Save anyway?",
        ),
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const cleanRows = rowsToSave.map((row) => ({
      business_id: staff.business_id,
      staff_member_id: staffId,
      day_of_week: row.day_of_week,
      start_time: normaliseTimeValue(row.start_time) || "09:00",
      end_time: normaliseTimeValue(row.end_time) || "17:00",
      is_closed: row.is_closed,
    }));

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError(saveErrorMessage("auth_required"));
      setSaving(false);
      return;
    }

    const response = await fetch("/api/dashboard/staff-availability", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staffId,
        rows: cleanRows,
      }),
    });
    const result = await response.json().catch(() => ({}));

    setSaving(false);

    if (!response.ok) {
      setError(saveErrorMessage(result?.error || result?.code));
      return;
    }

    const savedRows = Array.isArray(result?.rows)
      ? (result.rows as StaffAvailabilityRow[])
      : cleanRows;

    const savedRowsByDay = new Map<number, StaffAvailabilityRow>();
    savedRows.forEach((row) => {
      savedRowsByDay.set(row.day_of_week, {
        ...row,
        start_time: normaliseTimeValue(row.start_time) || "09:00",
        end_time: normaliseTimeValue(row.end_time) || "17:00",
      });
    });

    setRows(cleanRows.map((row) => savedRowsByDay.get(row.day_of_week) || row));
    const savedMessage = t(
      "staffAvailability.success.saved",
      "Working hours saved.",
    );
    setSuccess(savedMessage);
    await loadPage({ keepSuccess: true });
    setSuccess(savedMessage);
  }

  return (
    <DashboardLayout
      title={t("dashboardStaff.availability.pageTitle", "Staff working hours")}
      subtitle={
        staff
          ? `${staff.name} · ${staff.businesses?.name || t("common.business", "Business")}`
          : t(
              "dashboardStaff.availability.pageSubtitle",
              "Set staff availability.",
            )
      }
    >
      {loading && (
        <div className="card">
          <p className="muted">
            {t("staffAvailability.loading", "Loading working hours...")}
          </p>
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
          <div className="staff-availability-banner-row">
            <div>
              <p className="small" style={{ color: "var(--success)" }}>
                {t("dashboardAvailability.success.title", "Saved")}
              </p>
              <strong>{success}</strong>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSuccess(null)}
            >
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{ borderColor: "rgba(255,77,109,0.35)", marginBottom: "1rem" }}
        >
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {!loading && staff && (
        <>
          <div className="staff-availability-summary">
            <div className="staff-availability-identity">
              <div>
                <strong>
                  {staff.role_title || t("common.staff", "Staff member")}
                </strong>
                <span className="small muted">
                  {availabilityStats.openDays}{" "}
                  {t("dashboardAvailability.stats.openDays", "open days")} ·{" "}
                  {availabilityStats.closedDays}{" "}
                  {t("dashboardAvailability.stats.closedDays", "closed days")}
                </span>
              </div>
              <span
                className={
                  availabilityStats.ready
                    ? "hours-status ready"
                    : "hours-status needs-work"
                }
              >
                {availabilityStats.ready
                  ? t("dashboardStaff.availability.hoursReady", "Hours ready")
                  : t(
                      "dashboardStaff.availability.hoursNeedAttention",
                      "Hours need attention",
                    )}
              </span>
            </div>

            <Link
              href={`/dashboard/staff?businessId=${staff.business_id}`}
              className="btn btn-ghost"
            >
              {t("dashboardStaff.availability.backToTeam", "Back to Team")}
            </Link>
          </div>

          {availabilityStats.invalidDays > 0 && (
            <p role="alert" className="staff-availability-invalid">
              {availabilityStats.invalidDays}{" "}
              {t(
                "dashboardStaff.availability.invalidDays",
                "open days have an invalid time range.",
              )}
            </p>
          )}

          <div className="staff-availability-presets">
            <strong>
              {t("dashboardAvailability.presets.compactTitle", "Quick presets")}
            </strong>
            <div className="staff-availability-action-row">
              <button
                type="button"
                onClick={applyWeekdayPreset}
                className="btn btn-ghost"
              >
                {t("dashboardAvailability.presets.weekday", "Mon-Fri 9-5")}
              </button>
              <button
                type="button"
                onClick={applyEverydayPreset}
                className="btn btn-ghost"
              >
                {t(
                  "dashboardStaff.availability.everyDayPreset",
                  "Every day 9-5",
                )}
              </button>
              <button
                type="button"
                onClick={closeAllDays}
                className="btn btn-danger"
              >
                {t("dashboardAvailability.presets.closeAll", "Close all days")}
              </button>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const nextRows = rowsFromAvailabilityForm(
                new FormData(event.currentTarget),
                rows,
              );
              setRows(nextRows);
              void saveAvailability(nextRows);
            }}
          >
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {displayRows.map(({ row, index }) => {
                const invalid =
                  !row.is_closed && row.start_time >= row.end_time;

                return (
                  <div
                    key={row.day_of_week}
                    className="card staff-availability-row"
                    style={{
                      borderColor: invalid
                        ? "rgba(255,77,109,0.35)"
                        : row.is_closed
                          ? "rgba(255,190,11,0.20)"
                          : "var(--border)",
                      opacity: row.is_closed ? 0.76 : 1,
                    }}
                  >
                    <div>
                      <strong>
                        {t(
                          dayTranslationKeys[row.day_of_week],
                          days[row.day_of_week],
                        )}
                      </strong>
                      <p
                        className="small"
                        style={{
                          color: invalid
                            ? "var(--danger)"
                            : row.is_closed
                              ? "var(--warning)"
                              : "var(--success)",
                          marginTop: "0.25rem",
                        }}
                      >
                        {invalid
                          ? t(
                              "dashboardAvailability.day.invalid",
                              "Invalid time range",
                            )
                          : row.is_closed
                            ? t(
                                "dashboardAvailability.day.closedBody",
                                "Closed / day off",
                              )
                            : t(
                                "dashboardStaff.availability.openForBookings",
                                "Open for bookings",
                              )}
                      </p>
                    </div>

                    <label
                      className="small muted"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <input
                        name={`closed-${row.day_of_week}`}
                        type="checkbox"
                        checked={row.is_closed}
                        onChange={(e) =>
                          updateRow(index, "is_closed", e.target.checked)
                        }
                      />
                      {t("dashboardAvailability.day.closed", "Closed")}
                    </label>

                    <label className="small muted">
                      {t("dashboardAvailability.day.start", "Start")}
                      <input
                        name={`start-${row.day_of_week}`}
                        type="time"
                        value={row.start_time}
                        disabled={row.is_closed}
                        onChange={(e) =>
                          updateRow(index, "start_time", e.target.value)
                        }
                        style={{ marginTop: "0.25rem" }}
                      />
                    </label>

                    <label className="small muted">
                      {t("dashboardAvailability.day.end", "End")}
                      <input
                        name={`end-${row.day_of_week}`}
                        type="time"
                        value={row.end_time}
                        disabled={row.is_closed}
                        onChange={(e) =>
                          updateRow(index, "end_time", e.target.value)
                        }
                        style={{ marginTop: "0.25rem" }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="staff-availability-save-row">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-accent"
              >
                {saving
                  ? t("common.saving", "Saving...")
                  : t(
                      "dashboardStaff.availability.saveCta",
                      "Save staff working hours",
                    )}
              </button>

              <Link
                href={`/dashboard/staff?businessId=${staff.business_id}`}
                className="btn btn-ghost"
              >
                {t("dashboardStaff.availability.backToTeam", "Back to Team")}
              </Link>
            </div>
          </form>
        </>
      )}

      <style jsx>{`
        .staff-availability-banner-row,
        .staff-availability-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .staff-availability-action-row,
        .staff-availability-save-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-availability-summary,
        .staff-availability-identity,
        .staff-availability-presets {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .staff-availability-summary {
          margin-bottom: 0.7rem;
          padding: 0.65rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .staff-availability-identity > div {
          display: grid;
          gap: 0.15rem;
        }

        .hours-status {
          padding: 0.3rem 0.6rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .hours-status.ready {
          color: var(--success);
          border-color: rgba(45, 212, 191, 0.3);
          background: rgba(45, 212, 191, 0.08);
        }

        .hours-status.needs-work,
        .staff-availability-invalid {
          color: var(--warning);
        }

        .staff-availability-invalid {
          margin: 0 0 0.7rem;
        }

        .staff-availability-presets {
          margin-bottom: 0.7rem;
          padding-bottom: 0.7rem;
          border-bottom: 1px solid var(--border);
        }

        .staff-availability-save-row {
          margin-top: 1.25rem;
        }

        .staff-availability-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 1fr;
          gap: 0.75rem;
          align-items: center;
        }

        @media (max-width: 760px) {
          .staff-availability-banner-row,
          .staff-availability-card-row {
            display: grid;
            grid-template-columns: 1fr;
          }

          .staff-availability-row {
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .staff-availability-action-row,
          .staff-availability-save-row {
            width: 100%;
            justify-content: stretch;
          }

          .staff-availability-summary,
          .staff-availability-presets {
            align-items: stretch;
          }

          .staff-availability-action-row :global(.btn),
          .staff-availability-action-row a,
          .staff-availability-action-row button,
          .staff-availability-save-row :global(.btn),
          .staff-availability-save-row a,
          .staff-availability-save-row button,
          .staff-availability-banner-row :global(.btn),
          .staff-availability-banner-row button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
