import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import AvailabilityBusinessPicker from "@/components/dashboard-availability/AvailabilityBusinessPicker";
import AvailabilityStats from "@/components/dashboard-availability/AvailabilityStats";
import AvailabilityPresetsCard from "@/components/dashboard-availability/AvailabilityPresetsCard";
import AvailabilityDayRow from "@/components/dashboard-availability/AvailabilityDayRow";
import {
  AvailabilityRow,
  Business,
} from "@/components/dashboard-availability/dashboardAvailabilityTypes";
import { useI18n } from "@/lib/useI18n";

const dayKeys = [
  "common.days.sunday",
  "common.days.monday",
  "common.days.tuesday",
  "common.days.wednesday",
  "common.days.thursday",
  "common.days.friday",
  "common.days.saturday",
];

const fallbackDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function Availability() {
  const router = useRouter();
  const { t } = useI18n();
  const { businessId } = router.query;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [rows, setRows] = useState<AvailabilityRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function defaultRows(currentBusinessId: string): AvailabilityRow[] {
    return fallbackDays.map((_, i) => ({
      business_id: currentBusinessId,
      day_of_week: i,
      start_time: "09:00",
      end_time: "17:00",
      is_closed: i === 0,
    }));
  }

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, name, published")
      .eq("user_id", sessionUserId)
      .order("created_at", { ascending: false });

    if (businessesError) throw businessesError;

    const owned = ownedBusinesses || [];
    setBusinesses(owned);

    if (owned.length === 0) return null;

    if (businessId && !Array.isArray(businessId)) {
      const selected = owned.find((b) => b.id === businessId);

      if (!selected) {
        throw new Error(
          t(
            "dashboardAvailability.error.noAccess",
            "You do not have access to this business.",
          ),
        );
      }

      return selected;
    }

    if (owned.length === 1) return owned[0];

    return null;
  }

  async function init(options?: { keepSuccess?: boolean }) {
    setError(null);
    if (!options?.keepSuccess) setSuccess(null);
    setPageLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const selectedBusiness = await getBusinessContext(session.user.id);

      if (!selectedBusiness) {
        setBusiness(null);
        setRows([]);
        setPageLoading(false);
        return;
      }

      setBusiness(selectedBusiness);

      const { data: existing, error: availabilityError } = await supabase
        .from("availability")
        .select("*")
        .eq("business_id", selectedBusiness.id)
        .order("day_of_week");

      if (availabilityError) throw availabilityError;

      if (existing && existing.length > 0) {
        const existingByDay = new Map<number, AvailabilityRow>();
        existing.forEach((row: AvailabilityRow) =>
          existingByDay.set(row.day_of_week, row),
        );

        setRows(
          fallbackDays.map(
            (_, i) =>
              existingByDay.get(i) || {
                business_id: selectedBusiness.id,
                day_of_week: i,
                start_time: "09:00",
                end_time: "17:00",
                is_closed: i === 0,
              },
          ),
        );
      } else {
        setRows(defaultRows(selectedBusiness.id));
      }

      setPageLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "dashboardAvailability.error.load",
            "Could not load working hours.",
          ),
      );
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    init();
  }, [router.isReady, businessId]);

  const availabilityStats = useMemo(() => {
    const openRows = rows.filter((row) => !row.is_closed);
    const closedRows = rows.filter((row) => row.is_closed);
    const invalidRows = openRows.filter(
      (row) => row.start_time >= row.end_time,
    );
    const totalHours = openRows.reduce((total, row) => {
      if (row.start_time >= row.end_time) return total;

      const start = new Date(`2026-01-01T${row.start_time}`);
      const end = new Date(`2026-01-01T${row.end_time}`);

      return total + (end.getTime() - start.getTime()) / 3600000;
    }, 0);

    return {
      openDays: openRows.length,
      closedDays: closedRows.length,
      invalidDays: invalidRows.length,
      totalHours,
      ready: openRows.length > 0 && invalidRows.length === 0,
    };
  }, [rows]);

  function updateRow(
    index: number,
    field: keyof AvailabilityRow,
    value: string | boolean,
  ) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
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

  function applyExtendedPreset() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        start_time: row.day_of_week === 0 ? row.start_time : "09:00",
        end_time: row.day_of_week === 0 ? row.end_time : "19:00",
        is_closed: row.day_of_week === 0,
      })),
    );
  }

  function closeAllDays() {
    const confirmed = confirm(
      t(
        "dashboardAvailability.confirm.closeAll",
        "Close every day for this business? Customers may not see any available booking days unless staff-specific hours still allow bookings.",
      ),
    );
    if (!confirmed) return;

    setRows((prev) => prev.map((row) => ({ ...row, is_closed: true })));
  }

  async function saveAvailability() {
    if (!business) return;

    const invalidRow = rows.find(
      (row) => !row.is_closed && row.start_time >= row.end_time,
    );

    if (invalidRow) {
      setError(
        `${t(dayKeys[invalidRow.day_of_week], fallbackDays[invalidRow.day_of_week])} ${t("dashboardAvailability.error.invalidRange", "has an invalid time range. Start time must be before end time.")}`,
      );
      return;
    }

    if (availabilityStats.openDays === 0) {
      const confirmed = confirm(
        t(
          "dashboardAvailability.confirm.noOpenDays",
          "This business has no open days. Customers may not be able to book unless staff-specific availability is configured. Save anyway?",
        ),
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: deleteError } = await supabase
      .from("availability")
      .delete()
      .eq("business_id", business.id);

    if (deleteError) {
      setError(deleteError.message);
      setLoading(false);
      return;
    }

    const cleanRows = rows.map((row) => ({
      business_id: business.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed,
    }));

    const { error } = await supabase.from("availability").insert(cleanRows);

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    const savedMessage = t(
      "dashboardAvailability.success.saved",
      "Working hours saved.",
    );
    setSuccess(savedMessage);
    await init({ keepSuccess: true });
    setSuccess(savedMessage);
  }

  return (
    <DashboardLayout
      title={t("dashboardAvailability.pageTitle", "Working hours")}
      subtitle={
        business
          ? business.name
          : t(
              "dashboardAvailability.pageSubtitle",
              "Choose a business to manage.",
            )
      }
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">
            {t(
              "dashboardAvailability.loading",
              "Loading Mirëbook working hours...",
            )}
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
          <p style={{ color: "var(--success)" }}>{success}</p>
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

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>
            {t("dashboardAvailability.noBusiness.title", "No business found")}
          </h3>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "dashboardAvailability.noBusiness.body",
              "Create a business profile first, then set Mirëbook working hours.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "1rem" }}
          >
            {t("dashboardAvailability.noBusiness.cta", "Create business")}
          </Link>
        </div>
      )}

      {!pageLoading && !business && businesses.length > 1 && (
        <AvailabilityBusinessPicker businesses={businesses} />
      )}

      {!pageLoading && business && (
        <>
          <AvailabilityStats stats={availabilityStats} />

          <AvailabilityPresetsCard
            onApplyWeekdayPreset={applyWeekdayPreset}
            onApplyExtendedPreset={applyExtendedPreset}
            onCloseAllDays={closeAllDays}
          />

          <div className="availability-day-list">
            {rows.map((row, index) => (
              <AvailabilityDayRow
                key={row.day_of_week}
                row={row}
                index={index}
                dayLabel={t(
                  dayKeys[row.day_of_week],
                  fallbackDays[row.day_of_week],
                )}
                updateRow={updateRow}
              />
            ))}
          </div>

          <div className="availability-save-actions">
            <button
              onClick={saveAvailability}
              disabled={loading}
              className="btn btn-accent"
            >
              {loading
                ? t("account.saving", "Saving...")
                : t("dashboardAvailability.saveCta", "Save working hours")}
            </button>

            <Link href="/dashboard/businesses" className="btn btn-ghost">
              {t("dashboardSettings.backToSetup", "Back to setup hub")}
            </Link>
          </div>
        </>
      )}

      <style jsx>{`
        .availability-day-list {
          display: grid;
          gap: 0;
        }

        .availability-save-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
          margin-top: 1.25rem;
        }

        @media (max-width: 760px) {
          .availability-day-list {
            grid-template-columns: 1fr;
          }

          .availability-save-actions,
          .availability-save-actions :global(.btn),
          .availability-save-actions button,
          .availability-save-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
