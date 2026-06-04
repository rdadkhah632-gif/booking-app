import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import AuthNav from "@/components/AuthNav";
import { useI18n } from "@/lib/useI18n";

type Booking = {
  id: string;
  business_id?: string;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  start_at: string;
  duration_minutes: number;
  status: string;
  businesses?:
    | {
        id?: string;
        user_id?: string;
        name: string;
        address?: string | null;
        city?: string | null;
        country?: string | null;
        phone?: string | null;
      }
    | {
        id?: string;
        user_id?: string;
        name: string;
        address?: string | null;
        city?: string | null;
        country?: string | null;
        phone?: string | null;
      }[]
    | null;
  services?:
    | {
        name: string;
        price: number;
      }
    | {
        name: string;
        price: number;
      }[]
    | null;
  staff_members?:
    | {
        name: string;
        role_title?: string | null;
      }
    | {
        name: string;
        role_title?: string | null;
      }[]
    | null;
};

export default function BookingConfirmation() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useI18n();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"customer" | "business" | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    async function loadBooking() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          businesses (
            id,
            name,
            user_id,
            address,
            city,
            country,
            phone
          ),
          services (
            name,
            price
          ),
          staff_members (
            name,
            role_title
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const normalisedBooking = {
        ...data,
        businesses: Array.isArray(data.businesses)
          ? data.businesses[0] || null
          : data.businesses,
        services: Array.isArray(data.services)
          ? data.services[0] || null
          : data.services,
        staff_members: Array.isArray(data.staff_members)
          ? data.staff_members[0] || null
          : data.staff_members,
      };

      const isCustomerOwner =
        normalisedBooking.customer_user_id === session.user.id;
      const isBusinessOwner =
        businessRelation(normalisedBooking)?.user_id === session.user.id;

      setRole(isBusinessOwner && !isCustomerOwner ? "business" : "customer");

      if (!isCustomerOwner && !isBusinessOwner) {
        setError(
          t(
            "bookingConfirmation.error.noPermission",
            "You do not have permission to view this booking.",
          ),
        );
        setLoading(false);
        return;
      }

      setBooking(normalisedBooking as Booking);
      setLoading(false);
    }

    loadBooking();
  }, [router.isReady, id]);

  function statusLabel(status: string) {
    if (status === "pending")
      return t("bookingConfirmation.status.pending", "Request sent");
    if (status === "confirmed")
      return t("bookingConfirmation.status.confirmed", "Confirmed");
    if (status === "declined")
      return t("bookingConfirmation.status.declined", "Declined");
    if (status === "completed")
      return t("bookingConfirmation.status.completed", "Completed");
    if (status === "cancelled")
      return t("bookingConfirmation.status.cancelled", "Cancelled");
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

  function firstRelation<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  function businessRelation(value: Booking | null = booking) {
    if (!value) return null;
    return firstRelation(value.businesses) || null;
  }

  function serviceRelation(value: Booking | null = booking) {
    if (!value) return null;
    return firstRelation(value.services) || null;
  }

  function staffRelation(value: Booking | null = booking) {
    if (!value) return null;
    return firstRelation(value.staff_members) || null;
  }

  function businessName() {
    return (
      businessRelation()?.name ||
      t("bookingConfirmation.fallback.business", "this business")
    );
  }

  function serviceName() {
    return serviceRelation()?.name || t("common.service", "Service");
  }

  function servicePrice() {
    const value = serviceRelation()?.price;
    if (value === null || value === undefined) return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : null;
  }

  function priceLabel() {
    const price = servicePrice();
    if (price === null)
      return t("bookingConfirmation.priceNotSet", "Price not shown");
    return `£${price.toFixed(2)}`;
  }

  function staffName() {
    const staff = staffRelation();
    if (!staff)
      return t("publicBusiness.anyAvailableStaff", "Any available staff");
    return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ""}`;
  }

  function businessLocation() {
    const business = businessRelation();
    return (
      [business?.address, business?.city, business?.country]
        .filter(Boolean)
        .join(", ") ||
      t("bookingConfirmation.locationNotAdded", "Location not added")
    );
  }

  function primaryHeading() {
    if (booking?.status === "pending")
      return t("bookingConfirmation.heading.pending", "Request sent");
    if (booking?.status === "confirmed")
      return t("bookingConfirmation.heading.confirmed", "Confirmed");
    if (booking?.status === "completed")
      return t("bookingConfirmation.heading.completed", "Completed");
    if (booking?.status === "declined")
      return t("bookingConfirmation.heading.declined", "Declined");
    if (booking?.status === "cancelled")
      return t("bookingConfirmation.heading.cancelled", "Cancelled");
    return t("bookingConfirmation.heading.received", "Booking received.");
  }

  function leadCopy() {
    if (booking?.status === "pending") {
      return `${t("bookingConfirmation.lead.pendingStart", "Waiting for")} ${businessName()} ${t("bookingConfirmation.lead.pendingEnd", "to confirm.")}`;
    }

    if (booking?.status === "confirmed") {
      return `${t("bookingConfirmation.lead.confirmedStart", "Your booking is confirmed with")} ${businessName()}. ${t("bookingConfirmation.lead.confirmedEnd", "Your booking is confirmed.")}`;
    }

    if (booking?.status === "completed") {
      return t(
        "bookingConfirmation.lead.completed",
        "This booking is complete.",
      );
    }

    if (booking?.status === "declined") {
      return t(
        "bookingConfirmation.lead.declined",
        "The business declined this request.",
      );
    }

    if (booking?.status === "cancelled") {
      return t(
        "bookingConfirmation.lead.cancelled",
        "This booking has been cancelled.",
      );
    }

    return t(
      "bookingConfirmation.lead.default",
      "Your booking details are below.",
    );
  }

  function isPendingApproval() {
    return booking?.status === "pending";
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: "42px 24px 80px" }}>
        {loading && (
          <div className="card">
            <p className="muted">
              {t(
                "bookingConfirmation.loading",
                "Loading your Mirëbook booking confirmation...",
              )}
            </p>
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{ borderColor: "rgba(255,77,109,0.35)" }}
          >
            <h1 className="page-title">
              {t("bookingConfirmation.error.title", "Could not load booking")}
            </h1>
            <p style={{ color: "var(--danger)", marginTop: "0.75rem" }}>
              {error}
            </p>
            <Link
              href="/my-bookings"
              className="btn btn-accent"
              style={{ marginTop: "1rem" }}
            >
              {t(
                "bookingConfirmation.actions.goToMyBookings",
                "Go to my bookings",
              )}
            </Link>
          </div>
        )}

        {!loading && !error && booking && (
          <div className="booking-confirmation-shell">
            <div className="card booking-confirmation-hero">
              <div
                className="booking-confirmation-icon"
                style={{
                  background: statusBackground(booking.status),
                  color: statusColor(booking.status),
                }}
              >
                {booking.status === "pending"
                  ? "…"
                  : booking.status === "cancelled" ||
                      booking.status === "declined"
                    ? "!"
                    : "✓"}
              </div>

              <p
                className="small"
                style={{ color: statusColor(booking.status) }}
              >
                {statusLabel(booking.status)}
              </p>

              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2.4rem",
                  marginTop: "0.35rem",
                }}
              >
                {primaryHeading()}
              </h1>

              <p className="muted" style={{ marginTop: "0.75rem" }}>
                {leadCopy()}
              </p>
            </div>

            <div
              className="card"
              style={{
                borderColor: isPendingApproval()
                  ? "rgba(255,107,53,0.28)"
                  : booking.status === "declined"
                    ? "rgba(255,190,11,0.28)"
                    : "rgba(45,212,191,0.28)",
                background: isPendingApproval()
                  ? "rgba(255,107,53,0.06)"
                  : booking.status === "declined"
                    ? "rgba(255,190,11,0.06)"
                    : "rgba(45,212,191,0.06)",
              }}
            >
              <div className="booking-confirmation-note-row">
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: isPendingApproval()
                      ? "rgba(255,107,53,0.12)"
                      : "rgba(45,212,191,0.12)",
                    color: isPendingApproval()
                      ? "var(--accent)"
                      : booking.status === "declined"
                        ? "var(--warning)"
                        : "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {isPendingApproval() ? "!" : "✓"}
                </div>

                <div>
                  <strong>
                    {booking.status === "pending"
                      ? t(
                          "bookingConfirmation.note.pendingTitle",
                          "Request sent",
                        )
                      : booking.status === "confirmed"
                        ? t(
                            "bookingConfirmation.note.confirmedTitle",
                            "Confirmed",
                          )
                        : booking.status === "completed"
                          ? t(
                              "bookingConfirmation.note.completedTitle",
                              "Completed",
                            )
                          : booking.status === "declined"
                            ? t(
                                "bookingConfirmation.note.declinedTitle",
                                "Declined",
                              )
                            : t(
                                "bookingConfirmation.note.cancelledTitle",
                                "Cancelled",
                              )}
                  </strong>
                  <p className="small muted" style={{ marginTop: "0.35rem" }}>
                    {booking.status === "pending"
                      ? t(
                          "bookingConfirmation.note.pendingBody",
                          "Waiting for the business to confirm.",
                        )
                      : booking.status === "confirmed"
                        ? t(
                            "bookingConfirmation.note.confirmedBody",
                            "Your booking is confirmed.",
                          )
                        : booking.status === "completed"
                          ? t(
                              "bookingConfirmation.note.completedBody",
                              "This booking is complete.",
                            )
                          : booking.status === "declined"
                            ? t(
                                "bookingConfirmation.note.declinedBody",
                                "The business declined this request.",
                              )
                            : t(
                                "bookingConfirmation.note.cancelledBody",
                                "This booking has been cancelled.",
                              )}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="booking-confirmation-details-header">
                <h2 style={{ fontFamily: "var(--font-display)" }}>
                  {t(
                    "bookingConfirmation.details.title",
                    "Appointment details",
                  )}
                </h2>

                <span
                  className="small"
                  style={{
                    background: statusBackground(booking.status),
                    color: statusColor(booking.status),
                    padding: "0.2rem 0.65rem",
                    borderRadius: 999,
                  }}
                >
                  {statusLabel(booking.status)}
                </span>
              </div>

              <div className="booking-confirmation-details-grid">
                <div>
                  <p className="small muted">
                    {t("common.business", "Business")}
                  </p>
                  <strong>{businessName()}</strong>
                </div>

                <div>
                  <p className="small muted">
                    {t("common.service", "Service")}
                  </p>
                  <strong>{serviceName()}</strong>
                </div>
                <div>
                  <p className="small muted">
                    {t(
                      "bookingConfirmation.details.staffMember",
                      "Staff member",
                    )}
                  </p>
                  <strong>{staffName()}</strong>
                </div>

                <div
                  style={{
                    padding: "0.9rem",
                    borderRadius: "var(--radius)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="small muted">
                    {isPendingApproval()
                      ? t(
                          "bookingConfirmation.details.requestedDateTime",
                          "Requested date and time",
                        )
                      : t(
                          "bookingConfirmation.details.confirmedDateTime",
                          "Confirmed date and time",
                        )}
                  </p>
                  <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                </div>

                <div>
                  <p className="small muted">
                    {t("bookingConfirmation.details.duration", "Duration")}
                  </p>
                  <strong>
                    {booking.duration_minutes} {t("common.minutes", "minutes")}
                  </strong>
                </div>

                <div>
                  <p className="small muted">
                    {t("bookingConfirmation.details.price", "Price")}
                  </p>
                  <strong>{priceLabel()}</strong>
                </div>

                <div>
                  <p className="small muted">
                    {t("bookingConfirmation.details.customer", "Customer")}
                  </p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                  {booking.customer_phone && (
                    <p className="small muted">{booking.customer_phone}</p>
                  )}
                </div>

                <div>
                  <p className="small muted">
                    {t("bookingConfirmation.details.location", "Location")}
                  </p>
                  <strong>{businessLocation()}</strong>
                </div>

                {businessRelation()?.phone && (
                  <div>
                    <p className="small muted">
                      {t(
                        "bookingConfirmation.details.businessPhone",
                        "Business phone",
                      )}
                    </p>
                    <strong>{businessRelation()?.phone}</strong>
                  </div>
                )}

                <div>
                  <p className="small muted">
                    {t("bookingConfirmation.details.status", "Status")}
                  </p>
                  <strong style={{ color: statusColor(booking.status) }}>
                    {statusLabel(booking.status)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="booking-confirmation-actions">
              <Link href="/my-bookings" className="btn btn-accent">
                {isPendingApproval()
                  ? t(
                      "bookingConfirmation.actions.trackRequest",
                      "Track booking request",
                    )
                  : t(
                      "bookingConfirmation.actions.manageBooking",
                      "View or manage this booking",
                    )}
              </Link>

              <Link href="/notifications" className="btn btn-ghost">
                {t("nav.notifications", "Notifications")}
              </Link>

              <Link href="/explore" className="btn btn-ghost">
                {t("bookingConfirmation.actions.explore", "Explore Mirëbook")}
              </Link>

              {role === "business" && booking.business_id && (
                <Link
                  href={`/dashboard/bookings?businessId=${booking.business_id}&date=${booking.start_at.slice(0, 10)}`}
                  className="btn btn-ghost"
                >
                  {t(
                    "bookingConfirmation.actions.businessBookings",
                    "Business bookings",
                  )}
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .booking-confirmation-shell {
          max-width: 760px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .booking-confirmation-hero {
          text-align: center;
          padding: 2.2rem;
        }

        .booking-confirmation-icon {
          width: 72px;
          height: 72px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto 1rem;
        }

        .booking-confirmation-note-row {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .booking-confirmation-details-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .booking-confirmation-details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .booking-confirmation-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .booking-confirmation-details-grid {
            grid-template-columns: 1fr;
          }
          .booking-confirmation-hero {
            padding: 1.5rem;
          }

          .booking-confirmation-note-row {
            display: grid;
          }

          .booking-confirmation-actions :global(.btn),
          .booking-confirmation-actions a,
          .booking-confirmation-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
