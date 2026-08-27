import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { CalendarPlus, Check, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { formatLocalizedDate } from "@/lib/i18n";
import { formatCurrencyAmount } from "@/lib/currency";
import { requestTransactionalEmail } from "@/lib/email/client";

type GroupService = {
  id: string;
  name: string;
  duration_minutes: number;
  group_capacity?: number | null;
  price?: number | null;
  private_booking_enabled?: boolean | null;
  private_price?: number | null;
};

type StaffMember = {
  id: string;
  name: string;
  role_title?: string | null;
};

type ManifestBooking = {
  id: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_notes?: string | null;
  party_size?: number | null;
  booking_option?: string | null;
  status: string;
  total_price?: number | null;
};

type Departure = {
  id: string;
  business_id: string;
  service_id: string;
  staff_member_id?: string | null;
  start_at: string;
  duration_minutes: number;
  capacity: number;
  meeting_point?: string | null;
  status: string;
  bookedSeats: number;
  remainingSeats: number;
  bookingCount: number;
  service?: GroupService | null;
  staffMember?: StaffMember | null;
  manifest: ManifestBooking[];
};

type Payload = {
  business: {
    id: string;
    name: string;
    timezone: string;
    currency?: string | null;
  };
  services: GroupService[];
  staffMembers: StaffMember[];
  departures: Departure[];
};

type DepartureRequestError = Error & { code?: string };

function dateInputValue(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export default function DeparturesPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffMemberId, setStaffMemberId] = useState("");
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateInputValue(tomorrow);
  });
  const [time, setTime] = useState("09:00");
  const [capacity, setCapacity] = useState(12);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [repeatCount, setRepeatCount] = useState(1);
  const [selectedDepartureId, setSelectedDepartureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedService = payload?.services.find(
    (service) => service.id === serviceId,
  );
  const selectedDeparture = payload?.departures.find(
    (departure) => departure.id === selectedDepartureId,
  );

  async function resolveBusinessId() {
    const queryBusinessId =
      typeof router.query.businessId === "string"
        ? router.query.businessId.trim()
        : "";
    if (queryBusinessId) return queryBusinessId;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return "";
    const { data } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    return data?.id || "";
  }

  async function loadDepartures(targetBusinessId?: string) {
    setLoading(true);
    setError("");
    try {
      const nextBusinessId =
        targetBusinessId || businessId || (await resolveBusinessId());
      if (!nextBusinessId) throw new Error("business_required");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace(
          "/login?redirectTo=" + encodeURIComponent(router.asPath),
        );
        return;
      }
      const response = await fetch(
        "/api/dashboard/departures?businessId=" + nextBusinessId,
        { headers: { Authorization: "Bearer " + session.access_token } },
      );
      const nextPayload = (await response.json()) as Payload & {
        error?: string;
      };
      if (!response.ok) throw new Error(nextPayload.error || "load_failed");

      setBusinessId(nextBusinessId);
      setPayload(nextPayload);
      const requestedServiceId =
        typeof router.query.serviceId === "string"
          ? router.query.serviceId
          : "";
      const initialService =
        nextPayload.services.find(
          (service) => service.id === requestedServiceId,
        ) || nextPayload.services[0];
      if (initialService && !serviceId) {
        setServiceId(initialService.id);
        setCapacity(Number(initialService.group_capacity || 12));
      }
      const requestedDepartureId =
        typeof router.query.departureId === "string"
          ? router.query.departureId
          : "";
      if (
        requestedDepartureId &&
        nextPayload.departures.some(
          (departure) => departure.id === requestedDepartureId,
        )
      ) {
        setSelectedDepartureId(requestedDepartureId);
      }
    } catch (loadError) {
      setError(
        t("departures.error.load", "Could not load scheduled departures."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadDepartures();
  }, [router.isReady]);

  async function authenticatedRequest(
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("auth_required");
    const response = await fetch("/api/dashboard/departures", {
      method,
      headers: {
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as {
      code?: string;
      error?: string;
      affectedBookingIds?: string[];
    };
    if (!response.ok) {
      throw Object.assign(new Error(result.error || "request_failed"), {
        code: result.code,
      });
    }
    return result;
  }

  function requestCode(error: unknown) {
    return (error as DepartureRequestError | null)?.code || "";
  }

  function statusLabel(status: string) {
    if (status === "scheduled")
      return t("departures.status.scheduled", "Scheduled");
    if (status === "pending")
      return t("myBookings.status.requestSent", "Request sent");
    if (status === "confirmed")
      return t("myBookings.status.confirmed", "Confirmed");
    if (status === "declined")
      return t("myBookings.status.declined", "Declined");
    if (status === "cancelled")
      return t("myBookings.status.cancelled", "Cancelled");
    if (status === "completed")
      return t("myBookings.status.completed", "Completed");
    return status;
  }

  async function createDepartures(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedServiceId = String(formData.get("serviceId") || "").trim();
    const submittedStaffMemberId = String(
      formData.get("staffMemberId") || "",
    ).trim();
    const submittedDate = String(formData.get("date") || "").trim();
    const submittedTime = String(formData.get("time") || "").trim();
    const submittedCapacity = Number(formData.get("capacity"));
    const submittedMeetingPoint = String(
      formData.get("meetingPoint") || "",
    ).trim();
    const submittedRepeatCount = Number(formData.get("repeatCount"));

    if (!submittedServiceId) {
      setError(
        t("departures.error.chooseService", "Choose a group service first."),
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await authenticatedRequest("POST", {
        businessId,
        serviceId: submittedServiceId,
        staffMemberId: submittedStaffMemberId || null,
        date: submittedDate,
        time: submittedTime,
        capacity: submittedCapacity,
        meetingPoint: submittedMeetingPoint,
        repeatCount: submittedRepeatCount,
      });
      setSuccess(
        submittedRepeatCount > 1
          ? t("departures.success.createdMany", "Departures added.")
          : t("departures.success.createdOne", "Departure added."),
      );
      await loadDepartures(businessId);
    } catch (saveError) {
      setError(
        requestCode(saveError) === "departure_already_exists"
          ? t(
              "departures.error.alreadyExists",
              "A departure already exists for this service and time.",
            )
          : requestCode(saveError) === "departure_must_be_future"
            ? t(
                "departures.error.futureOnly",
                "Choose a departure time in the future.",
              )
            : t("departures.error.create", "Could not add the departure."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(departure: Departure, status: string) {
    if (
      status === "cancelled" &&
      !window.confirm(
        t(
          "departures.confirm.cancel",
          "Cancel this departure and notify every active reservation? This cannot be undone.",
        ),
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await authenticatedRequest("PATCH", {
        businessId,
        departureId: departure.id,
        status,
      });
      for (const bookingId of result.affectedBookingIds || []) {
        void requestTransactionalEmail({
          event: "booking_status_changed",
          bookingId,
          audience: "customer_only",
        });
      }
      void requestTransactionalEmail({
        event: "departure_status_changed",
        departureId: departure.id,
      });
      setSuccess(t("departures.success.updated", "Departure updated."));
      await loadDepartures(businessId);
    } catch (updateError) {
      setError(
        requestCode(updateError) === "departure_not_finished"
          ? t(
              "departures.error.notFinished",
              "This departure cannot be completed before it finishes.",
            )
          : t("departures.error.update", "Could not update the departure."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeReservationStatus(
    booking: ManifestBooking,
    bookingStatus: "confirmed" | "declined" | "cancelled" | "completed",
  ) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await authenticatedRequest("PATCH", {
        businessId,
        bookingId: booking.id,
        bookingStatus,
      });
      void requestTransactionalEmail({
        event: "booking_status_changed",
        bookingId: booking.id,
      });
      setSuccess(
        t("departures.success.reservationUpdated", "Reservation updated."),
      );
      await loadDepartures(businessId);
    } catch (updateError) {
      setError(
        requestCode(updateError) === "reservation_action_unavailable"
          ? t(
              "departures.error.reservationChanged",
              "This reservation changed while you were reviewing it. Refresh and try again.",
            )
          : t(
              "departures.error.reservationUpdate",
              "Could not update the reservation.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  const upcomingDepartures = useMemo(
    () =>
      (payload?.departures || []).filter(
        (departure) =>
          departure.status === "scheduled" &&
          new Date(departure.start_at) >= new Date(),
      ),
    [payload?.departures],
  );

  function departureTime(departure: Departure) {
    return formatLocalizedDate(departure.start_at, locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: payload?.business.timezone || undefined,
    });
  }

  return (
    <DashboardLayout
      title={t("departures.pageTitle", "Departures")}
      subtitle={
        payload?.business.name ||
        t("departures.pageSubtitle", "Scheduled group services")
      }
    >
      {error && <div className="notice error-notice">{error}</div>}
      {success && <div className="notice success-notice">{success}</div>}

      {loading ? (
        <div className="card">
          <p className="muted">
            {t("departures.loading", "Loading departures...")}
          </p>
        </div>
      ) : payload?.services.length === 0 ? (
        <div className="card empty-departures">
          <CalendarPlus size={28} aria-hidden="true" />
          <h2>
            {t("departures.emptyService.title", "Add a group service first")}
          </h2>
          <p className="muted">
            {t(
              "departures.emptyService.body",
              "Create a Scheduled group service, then return here to add its dates and seat capacity.",
            )}
          </p>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => router.push("/dashboard/services")}
          >
            {t("departures.emptyService.cta", "Open services")}
          </button>
        </div>
      ) : (
        <div className="departures-layout">
          <section className="departures-main">
            <form className="card departure-form" onSubmit={createDepartures}>
              <div className="departure-section-heading">
                <div>
                  <p className="eyebrow">
                    {t("departures.create.kicker", "New schedule")}
                  </p>
                  <h2>{t("departures.create.title", "Add a departure")}</h2>
                </div>
                <span className="small muted">{payload.business.timezone}</span>
              </div>

              <div className="departure-fields primary-fields">
                <label>
                  <span>{t("departures.field.service", "Group service")}</span>
                  <select
                    name="serviceId"
                    value={serviceId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setServiceId(nextId);
                      const nextService = payload.services.find(
                        (service) => service.id === nextId,
                      );
                      setCapacity(Number(nextService?.group_capacity || 12));
                    }}
                    required
                  >
                    {payload.services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("departures.field.date", "Date")}</span>
                  <input
                    name="date"
                    type="date"
                    value={date}
                    min={dateInputValue(new Date())}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>{t("departures.field.time", "Start time")}</span>
                  <input
                    name="time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>{t("departures.field.capacity", "Seats")}</span>
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    max={200}
                    value={capacity}
                    onChange={(event) =>
                      setCapacity(Number(event.target.value))
                    }
                    required
                  />
                </label>
              </div>

              <div className="departure-fields secondary-fields">
                <label>
                  <span>
                    {t("departures.field.guide", "Guide or staff (optional)")}
                  </span>
                  <select
                    name="staffMemberId"
                    value={staffMemberId}
                    onChange={(event) => setStaffMemberId(event.target.value)}
                  >
                    <option value="">
                      {t("departures.field.noGuide", "Assign later")}
                    </option>
                    {payload.staffMembers.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                        {staff.role_title ? " · " + staff.role_title : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    {t("departures.field.meetingPoint", "Meeting point")}
                  </span>
                  <input
                    name="meetingPoint"
                    value={meetingPoint}
                    onChange={(event) => setMeetingPoint(event.target.value)}
                    placeholder={t(
                      "departures.field.meetingPlaceholder",
                      "Harbour, hotel, or exact meeting instructions",
                    )}
                  />
                </label>
                <label>
                  <span>
                    {t("departures.field.repeat", "Daily departures")}
                  </span>
                  <input
                    name="repeatCount"
                    type="number"
                    min={1}
                    max={31}
                    value={repeatCount}
                    onChange={(event) =>
                      setRepeatCount(Number(event.target.value))
                    }
                  />
                </label>
              </div>

              {selectedService && (
                <p className="small service-pricing-note">
                  {selectedService.duration_minutes}{" "}
                  {t("common.minutes", "minutes")} ·{" "}
                  {formatCurrencyAmount(
                    Number(selectedService.price || 0),
                    payload.business.currency,
                    locale,
                  )}{" "}
                  {t("departures.perGuest", "per guest")}
                  {selectedService.private_booking_enabled && (
                    <>
                      {" · "}
                      {formatCurrencyAmount(
                        Number(selectedService.private_price || 0),
                        payload.business.currency,
                        locale,
                      )}{" "}
                      {t("departures.privateTrip", "private trip")}
                    </>
                  )}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-accent"
                disabled={saving}
              >
                <CalendarPlus size={18} aria-hidden="true" />
                {saving
                  ? t("common.working", "Working...")
                  : repeatCount > 1
                    ? t("departures.createMany", "Add departures")
                    : t("departures.createOne", "Add departure")}
              </button>
            </form>

            <div className="departure-list-heading">
              <div>
                <p className="eyebrow">
                  {t("departures.upcoming.kicker", "Live operations")}
                </p>
                <h2>{t("departures.upcoming.title", "Upcoming departures")}</h2>
              </div>
              <span className="count-badge">{upcomingDepartures.length}</span>
            </div>

            {upcomingDepartures.length === 0 ? (
              <div className="empty-list">
                <p>
                  {t(
                    "departures.upcoming.empty",
                    "No upcoming departures yet.",
                  )}
                </p>
              </div>
            ) : (
              <div className="departure-list">
                {upcomingDepartures.map((departure) => (
                  <button
                    key={departure.id}
                    type="button"
                    className={
                      "departure-row " +
                      (selectedDepartureId === departure.id ? "selected" : "")
                    }
                    onClick={() => setSelectedDepartureId(departure.id)}
                  >
                    <span className="departure-date">
                      <strong>{departureTime(departure)}</strong>
                      <small>{departure.service?.name || ""}</small>
                    </span>
                    <span className="seat-progress">
                      <span>
                        <strong>
                          {departure.bookedSeats}/{departure.capacity}
                        </strong>
                        <small>
                          {t("departures.seatsBooked", "seats booked")}
                        </small>
                      </span>
                      <span className="progress-track" aria-hidden="true">
                        <span
                          style={{
                            width:
                              Math.min(
                                (departure.bookedSeats / departure.capacity) *
                                  100,
                                100,
                              ) + "%",
                          }}
                        />
                      </span>
                    </span>
                    <span className={"status-dot " + departure.status}>
                      {statusLabel(departure.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="departure-detail">
            {selectedDeparture ? (
              <div className="detail-panel">
                <p className="eyebrow">
                  {t("departures.detail.kicker", "Departure manifest")}
                </p>
                <h2>{selectedDeparture.service?.name}</h2>
                <p className="detail-time">
                  {departureTime(selectedDeparture)}
                </p>
                <div className="detail-stats">
                  <span>
                    <strong>{selectedDeparture.bookedSeats}</strong>
                    <small>{t("departures.detail.booked", "Booked")}</small>
                  </span>
                  <span>
                    <strong>{selectedDeparture.remainingSeats}</strong>
                    <small>
                      {t("departures.detail.remaining", "Remaining")}
                    </small>
                  </span>
                  <span>
                    <strong>{selectedDeparture.bookingCount}</strong>
                    <small>
                      {t("departures.detail.reservations", "Reservations")}
                    </small>
                  </span>
                </div>
                <dl className="departure-meta">
                  <div>
                    <dt>
                      {t("departures.field.guide", "Guide or staff (optional)")}
                    </dt>
                    <dd>
                      {selectedDeparture.staffMember?.name ||
                        t("departures.field.noGuide", "Assign later")}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t("departures.field.meetingPoint", "Meeting point")}
                    </dt>
                    <dd>
                      {selectedDeparture.meeting_point ||
                        t("departures.detail.notProvided", "Not provided")}
                    </dd>
                  </div>
                </dl>

                <div className="manifest-list">
                  <h3>{t("departures.detail.guests", "Guest list")}</h3>
                  {selectedDeparture.manifest.length === 0 ? (
                    <p className="small muted">
                      {t("departures.detail.noGuests", "No reservations yet.")}
                    </p>
                  ) : (
                    selectedDeparture.manifest.map((booking) => (
                      <div className="manifest-row" key={booking.id}>
                        <span>
                          <strong>{booking.customer_name}</strong>
                          <small>{booking.customer_email}</small>
                        </span>
                        <span className="manifest-size">
                          {booking.booking_option === "private"
                            ? `${t("departures.privateTrip", "Private trip")} · ${booking.party_size || 1} ${t(
                                "departures.guests",
                                "guests",
                              )}`
                            : `${booking.party_size || 1} ${t(
                                "departures.guests",
                                "guests",
                              )}`}
                        </span>
                        <span className="small muted">
                          {statusLabel(booking.status)}
                        </span>
                        <span className="manifest-actions">
                          {booking.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  changeReservationStatus(booking, "confirmed")
                                }
                              >
                                <Check size={15} aria-hidden="true" />
                                {t("departures.reservation.confirm", "Confirm")}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  changeReservationStatus(booking, "declined")
                                }
                              >
                                <X size={15} aria-hidden="true" />
                                {t("departures.reservation.decline", "Decline")}
                              </button>
                            </>
                          )}
                          {booking.status === "confirmed" && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                changeReservationStatus(booking, "cancelled")
                              }
                            >
                              {t("departures.reservation.cancel", "Cancel")}
                            </button>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="detail-actions">
                  {selectedDeparture.status === "scheduled" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={saving}
                        onClick={() =>
                          changeStatus(selectedDeparture, "completed")
                        }
                      >
                        <Check size={17} aria-hidden="true" />
                        {t("departures.action.complete", "Mark complete")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={saving}
                        onClick={() =>
                          changeStatus(selectedDeparture, "cancelled")
                        }
                      >
                        <X size={17} aria-hidden="true" />
                        {t("departures.action.cancel", "Cancel departure")}
                      </button>
                    </>
                  )}
                  {selectedDeparture.status === "cancelled" && (
                    <p className="small muted">
                      {t(
                        "departures.cancelled.final",
                        "Cancelled departures stay closed. Add a new departure if the trip is rescheduled.",
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="detail-placeholder">
                <CalendarPlus size={25} aria-hidden="true" />
                <p>
                  {t(
                    "departures.detail.choose",
                    "Choose a departure to see its capacity and guest list.",
                  )}
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      <style jsx>{`
        .notice {
          padding: 0.8rem 0.95rem;
          margin-bottom: 0.85rem;
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .error-notice {
          color: var(--danger);
          border-color: rgba(255, 77, 109, 0.35);
        }

        .success-notice {
          color: var(--success);
          border-color: rgba(45, 212, 191, 0.35);
        }

        .departures-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.75fr);
          gap: 1rem;
          align-items: start;
        }

        .departures-main {
          min-width: 0;
        }

        .departure-form {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.2rem;
        }

        .departure-section-heading,
        .departure-list-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .departure-section-heading h2,
        .departure-list-heading h2,
        .departure-section-heading p,
        .departure-list-heading p,
        .detail-panel h2,
        .detail-panel p {
          margin: 0;
        }

        .eyebrow {
          color: var(--accent);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .departure-fields {
          display: grid;
          gap: 0.7rem;
        }

        .primary-fields {
          grid-template-columns: minmax(180px, 1.6fr) repeat(
              3,
              minmax(120px, 0.7fr)
            );
        }

        .secondary-fields {
          grid-template-columns:
            minmax(170px, 0.8fr) minmax(220px, 1.4fr)
            minmax(125px, 0.55fr);
        }

        .departure-fields label {
          display: grid;
          gap: 0.35rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 700;
        }

        .service-pricing-note {
          margin: 0;
          padding: 0.65rem 0.75rem;
          background: var(--surface-2);
          border-radius: 8px;
          color: var(--text-muted);
        }

        .departure-list-heading {
          margin-bottom: 0.65rem;
        }

        .count-badge {
          min-width: 36px;
          min-height: 36px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--surface-2);
          font-weight: 800;
        }

        .departure-list {
          display: grid;
          gap: 0.45rem;
        }

        .departure-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(190px, 1.3fr) minmax(160px, 0.9fr) auto;
          gap: 0.85rem;
          align-items: center;
          text-align: left;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
        }

        .departure-row.selected {
          border-color: var(--accent);
          box-shadow: inset 3px 0 0 var(--accent);
        }

        .departure-date,
        .seat-progress,
        .seat-progress > span:first-child,
        .manifest-row > span:first-child {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
        }

        .departure-date small,
        .seat-progress small,
        .manifest-row small {
          color: var(--text-muted);
        }

        .progress-track {
          height: 5px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-2);
        }

        .progress-track > span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--success);
        }

        .status-dot {
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          color: var(--text-muted);
          background: var(--surface-2);
          font-size: 0.72rem;
          text-transform: capitalize;
        }

        .departure-detail {
          position: sticky;
          top: 1rem;
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .detail-panel,
        .detail-placeholder {
          padding: 1rem;
        }

        .detail-placeholder {
          display: grid;
          gap: 0.65rem;
          min-height: 180px;
          place-content: center;
          text-align: center;
          color: var(--text-muted);
        }

        .detail-time {
          color: var(--text-muted);
          margin-top: 0.25rem !important;
        }

        .detail-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          margin: 0.9rem 0;
        }

        .detail-stats span {
          display: grid;
          gap: 0.15rem;
          padding: 0.65rem;
          border-radius: 8px;
          background: var(--surface-2);
        }

        .detail-stats small {
          color: var(--text-muted);
        }

        .departure-meta {
          display: grid;
          gap: 0.55rem;
          margin: 0;
        }

        .departure-meta div {
          display: grid;
          gap: 0.15rem;
          padding-bottom: 0.55rem;
          border-bottom: 1px solid var(--border);
        }

        .departure-meta dt {
          color: var(--text-muted);
          font-size: 0.74rem;
        }

        .departure-meta dd {
          margin: 0;
        }

        .manifest-list {
          display: grid;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .manifest-list h3 {
          margin: 0;
        }

        .manifest-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto auto;
          gap: 0.5rem;
          align-items: center;
          padding: 0.6rem 0;
          border-bottom: 1px solid var(--border);
        }

        .manifest-size {
          font-size: 0.78rem;
          font-weight: 700;
        }

        .manifest-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.35rem;
        }

        .manifest-actions button {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          padding: 0.35rem 0.55rem;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface-2);
          color: var(--text);
          font: inherit;
          font-size: 0.75rem;
          font-weight: 750;
          cursor: pointer;
        }

        .manifest-actions button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .empty-departures,
        .empty-list {
          display: grid;
          gap: 0.65rem;
          place-items: start;
        }

        .empty-list {
          padding: 1rem;
          border: 1px dashed var(--border);
          border-radius: 8px;
          color: var(--text-muted);
        }

        @media (max-width: 1100px) {
          .departures-layout {
            grid-template-columns: 1fr;
          }

          .departure-detail {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .primary-fields,
          .secondary-fields {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .departure-row {
            grid-template-columns: 1fr auto;
          }

          .seat-progress {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 520px) {
          .primary-fields,
          .secondary-fields,
          .departure-row {
            grid-template-columns: 1fr;
          }

          .departure-row {
            min-height: 44px;
          }

          .seat-progress {
            grid-column: auto;
          }

          .status-dot {
            justify-self: start;
          }

          .detail-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .manifest-row {
            grid-template-columns: 1fr;
          }

          .manifest-actions {
            justify-content: stretch;
          }

          .manifest-actions button {
            flex: 1 1 7rem;
            min-height: 44px;
          }

          .detail-actions,
          .detail-actions :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
