import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import { formatLocalizedDate } from "@/lib/i18n";

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

type Service = {
  id: string;
  name: string;
  duration_minutes?: number | null;
  price?: number | null;
  active?: boolean | null;
};

function calendarDateValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type StaffService = {
  staff_member_id: string;
  service_id: string;
  services?: Service | Service[] | null;
};

type Booking = {
  id: string;
  customer_name: string;
  start_at: string;
  status: string;
};

const CONFIRMED_STAFF_BOOKING_STATUS = "confirmed";
const PENDING_STAFF_BOOKING_STATUS = "pending";

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

export default function StaffDashboardPage() {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null);
  const [hasBusinessWorkspace, setHasBusinessWorkspace] = useState(false);
  const [ownerBusinessId, setOwnerBusinessId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [addingOwnerStaff, setAddingOwnerStaff] = useState(false);
  const [isStaffIntentAccount, setIsStaffIntentAccount] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [assignedServices, setAssignedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadStaffDashboard() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setIsStaffIntentAccount(false);
        router.replace("/login?redirectTo=/staff");
        return;
      }

      setCurrentUserEmail(session.user.email || null);

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      setHasBusinessWorkspace(capabilities.canUseBusiness);
      setOwnerBusinessId(capabilities.primaryBusinessId);
      setIsStaffIntentAccount(capabilities.isStaffIntent);

      if (!capabilities.canUseStaff || !capabilities.primaryStaffId) {
        setStaffProfile(null);
        setBookings([]);
        setAssignedServices([]);
        setLoading(false);
        return;
      }

      const { data: linkedStaff, error: linkedStaffError } = await supabase
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

      if (linkedStaffError) throw linkedStaffError;

      if (!linkedStaff) {
        setStaffProfile(null);
        setBookings([]);
        setAssignedServices([]);
        setLoading(false);
        return;
      }

      setStaffProfile(linkedStaff as unknown as StaffMember);

      const { data: assignedServiceData, error: assignedServiceError } =
        await supabase
          .from("staff_services")
          .select(
            `
          staff_member_id,
          service_id,
          services (
            id,
            name,
            duration_minutes,
            price,
            active
          )
        `,
          )
          .eq("staff_member_id", linkedStaff.id);

      if (assignedServiceError) throw assignedServiceError;

      const normalisedAssignedServices = (assignedServiceData || [])
        .map((row: any) =>
          Array.isArray(row.services) ? row.services[0] : row.services,
        )
        .filter(Boolean);

      setAssignedServices(normalisedAssignedServices as Service[]);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          customer_name,
          start_at,
          status
        `,
        )
        .eq("staff_member_id", linkedStaff.id)
        .order("start_at", { ascending: true });

      if (bookingError) throw bookingError;

      setBookings((bookingData || []) as unknown as Booking[]);

      setLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "staff.error.loadDashboard",
            "Could not load your staff dashboard.",
          ),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadStaffDashboard();
  }, [router.isReady]);

  async function addOwnerAsStaff() {
    if (!ownerBusinessId) {
      setError(
        t(
          "staff.ownerSetup.noBusiness",
          "No business profile was found for this account.",
        ),
      );
      return;
    }

    const confirmed = confirm(
      t(
        "staff.ownerSetup.confirm",
        "Add yourself as bookable staff for this business? Business controls stay separate, and this creates your personal staff profile for appointments.",
      ),
    );

    if (!confirmed) return;

    setAddingOwnerStaff(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/staff");
        return;
      }

      const { data: existingStaff, error: existingError } = await supabase
        .from("staff_members")
        .select("id")
        .eq("business_id", ownerBusinessId)
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingStaff?.id) {
        setSuccess(
          t(
            "staff.ownerSetup.alreadyLinked",
            "You are already linked as staff for this business.",
          ),
        );
        await loadStaffDashboard();
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .maybeSingle<{ full_name?: string | null; email?: string | null }>();

      const fallbackName =
        profile?.full_name?.trim() ||
        session.user.email?.split("@")[0] ||
        t("staff.ownerSetup.defaultName", "Owner");

      const { error: insertError } = await supabase
        .from("staff_members")
        .insert({
          business_id: ownerBusinessId,
          user_id: session.user.id,
          name: fallbackName,
          email: session.user.email || profile?.email || null,
          role_title: t("staff.ownerSetup.defaultRole", "Owner"),
          permission_role: "staff",
          invite_status: "linked",
          active: true,
        });

      if (insertError) throw insertError;

      setSuccess(
        t(
          "staff.ownerSetup.success",
          "You have been added as bookable staff. Assign services and set your availability next.",
        ),
      );
      await loadStaffDashboard();
    } catch (err: any) {
      setError(
        err.message ||
          t("staff.ownerSetup.error", "Could not add you as bookable staff."),
      );
    } finally {
      setAddingOwnerStaff(false);
    }
  }

  const now = useMemo(() => new Date(), [bookings]);

  const todayBookings = useMemo(() => {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

    return bookings.filter((booking) => {
      const startAt = new Date(booking.start_at);
      return (
        booking.status === CONFIRMED_STAFF_BOOKING_STATUS &&
        startAt >= start &&
        startAt <= end
      );
    });
  }, [bookings]);

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === CONFIRMED_STAFF_BOOKING_STATUS &&
        new Date(booking.start_at) >= now,
    );
  }, [bookings, now]);

  const nextBooking = useMemo(() => {
    return (
      [...confirmedUpcomingBookings].sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )[0] || null
    );
  }, [confirmedUpcomingBookings]);

  const pendingBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === PENDING_STAFF_BOOKING_STATUS &&
        new Date(booking.start_at) >= now,
    );
  }, [bookings, now]);

  const staffBusinessLabel =
    (Array.isArray(staffProfile?.businesses)
      ? staffProfile.businesses[0]?.name
      : staffProfile?.businesses?.name) ||
    t("staff.fallback.business", "Your business");

  const staffRoleLabel =
    staffProfile?.role_title ||
    staffProfile?.permission_role ||
    t("staff.fallback.member", "Staff member");

  if (loading) {
    return (
      <DashboardLayout workspace="staff">
        <section className="staff-workspace-page">
          <div className="card">
            <p className="muted">
              {t("staff.loadingSchedule", "Loading your staff schedule...")}
            </p>
          </div>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      workspace="staff"
      title={staffProfile ? t("staff.workspace.title", "Today") : undefined}
      subtitle={
        staffProfile ? `${staffBusinessLabel} · ${staffRoleLabel}` : undefined
      }
    >
      <section className="staff-workspace-page">
        {!staffProfile && (
          <div className="card staff-unlinked-card">
            <p className="small" style={{ color: "var(--warning)" }}>
              {hasBusinessWorkspace
                ? t("staff.ownerSetup.kicker", "Business account")
                : isStaffIntentAccount
                  ? t("staff.unlinked.kicker", "Staff account created")
                  : t("staff.noProfile.kicker", "No staff profile linked")}
            </p>
            <h1 className="staff-unlinked-title">
              {hasBusinessWorkspace
                ? t(
                    "staff.ownerSetup.title",
                    "You are not set up as bookable staff yet",
                  )
                : isStaffIntentAccount
                  ? t("staff.unlinked.title", "No business linked yet")
                  : t(
                      "staff.noProfile.title",
                      "Ask the business to invite you",
                    )}
            </h1>
            <p className="muted staff-unlinked-body">
              {hasBusinessWorkspace
                ? t(
                    "staff.ownerSetup.body",
                    "You can run the business without taking appointments. If customers should book you directly, add yourself as staff, then assign services and working hours.",
                  )
                : isStaffIntentAccount
                  ? t(
                      "staff.unlinked.body",
                      "Your staff account is ready, but it is not connected to a business staff profile yet.",
                    )
                  : t(
                      "staff.noProfile.body",
                      "This account is not linked to a staff profile yet. Ask the business to add your email to Team, then log in again.",
                    )}
            </p>
            {hasBusinessWorkspace ? (
              <p className="small staff-owner-setup-note">
                {t(
                  "staff.ownerSetup.compactRule",
                  "Add a staff profile only when customers should book appointments directly with you.",
                )}
              </p>
            ) : (
              <div className="staff-link-note">
                <span>
                  {t("staff.unlinked.stepEmailTitle", "Use the same email")}
                </span>
                <strong>
                  {currentUserEmail ||
                    t(
                      "staff.unlinked.emailFallback",
                      "Use the email address shown in your account.",
                    )}
                </strong>
                <p className="small muted">
                  {t(
                    "staff.unlinked.stepInviteBody",
                    "The business should add this exact email from Team.",
                  )}{" "}
                  {t(
                    "staff.unlinked.stepLinkBody",
                    "Once linked, your schedule, availability and staff notifications will appear here.",
                  )}
                </p>
              </div>
            )}
            <div className="staff-unlinked-actions">
              {hasBusinessWorkspace && (
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={addingOwnerStaff}
                  onClick={addOwnerAsStaff}
                >
                  {addingOwnerStaff
                    ? t("common.saving", "Saving...")
                    : t(
                        "staff.ownerSetup.addSelf",
                        "Add myself as bookable staff",
                      )}
                </button>
              )}
              <button
                type="button"
                className={
                  hasBusinessWorkspace ? "btn btn-ghost" : "btn btn-accent"
                }
                onClick={() => loadStaffDashboard()}
              >
                {t("common.refresh", "Refresh")}
              </button>
            </div>
          </div>
        )}

        {staffProfile && (
          <>
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
                style={{
                  borderColor: "rgba(255,77,109,0.35)",
                  marginBottom: "1rem",
                }}
              >
                <p style={{ color: "var(--danger)" }}>{error}</p>
              </div>
            )}

            <div className="card staff-today-card">
              <div className="staff-today-copy">
                <h2>
                  {todayBookings.length > 0
                    ? t(
                        "staff.today.titleWithBookings",
                        "You have appointments today",
                      )
                    : t("staff.today.titleEmpty", "No appointments today")}
                </h2>
                {nextBooking ? (
                  <Link
                    href={`/staff/calendar?date=${calendarDateValue(nextBooking.start_at)}&bookingId=${nextBooking.id}`}
                    className="staff-next-appointment"
                  >
                    <span className="staff-next-label">
                      {t("staff.today.nextPrefix", "Next appointment")}
                    </span>
                    <span className="staff-next-details">
                      <strong>
                        {nextBooking.customer_name ||
                          t("common.customer", "Customer")}
                      </strong>
                      <span>
                        {formatLocalizedDate(nextBooking.start_at, locale, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <p className="muted small" style={{ marginTop: "0.35rem" }}>
                    {t(
                      "staff.today.noUpcoming",
                      "No assigned appointments coming up.",
                    )}
                  </p>
                )}
              </div>

              <div className="staff-home-stats">
                <div>
                  <strong>{todayBookings.length}</strong>
                  <span>{t("staff.home.todayAppointments", "today")}</span>
                </div>
                <div>
                  <strong>{confirmedUpcomingBookings.length}</strong>
                  <span>{t("staff.home.upcomingConfirmed", "upcoming")}</span>
                </div>
                <div>
                  <strong>{pendingBookings.length}</strong>
                  <span>
                    {t("staff.home.awaitingApproval", "awaiting approval")}
                  </span>
                </div>
              </div>
            </div>

            <div className="staff-service-summary">
              <div>
                <strong>{t("staff.assignedServices.title", "Services")}</strong>
                <p className="small muted">
                  {assignedServices.length > 0
                    ? assignedServices
                        .map((service) => service.name)
                        .join(" · ")
                    : t(
                        "staff.assignedServices.emptyCompact",
                        "No services assigned yet. Ask the business to update Team.",
                      )}
                </p>
              </div>
              {hasBusinessWorkspace && (
                <span className="staff-owner-context">
                  {t(
                    "staff.home.ownerContext",
                    "Business controls stay in the business workspace.",
                  )}
                </span>
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

        .staff-unlinked-card {
          display: grid;
          gap: 0.85rem;
          border-color: rgba(255, 190, 11, 0.28);
        }

        .staff-unlinked-title {
          font-family: var(--font-display);
          margin-top: 0;
        }

        .staff-unlinked-body {
          margin-top: 0;
          max-width: 760px;
        }

        .staff-link-note {
          display: grid;
          gap: 0.3rem;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
        }

        .staff-link-note span {
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .staff-link-note p {
          margin: 0;
        }

        .staff-unlinked-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .staff-owner-setup-note {
          margin: 0;
          padding-top: 0.85rem;
          border-top: 1px solid var(--border);
          color: var(--text-muted);
        }
        .staff-today-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1rem;
          border-color: rgba(255, 107, 53, 0.24);
          background: linear-gradient(
            135deg,
            rgba(255, 107, 53, 0.08),
            rgba(11, 18, 32, 0)
          );
        }

        .staff-next-appointment:hover strong,
        .staff-next-appointment:focus-visible strong {
          color: var(--accent);
        }

        .staff-home-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(5rem, 1fr));
          gap: 0.75rem;
          min-width: min(100%, 22rem);
        }

        .staff-home-stats div {
          display: grid;
          gap: 0.2rem;
          padding-left: 0.75rem;
          border-left: 1px solid var(--border);
        }

        .staff-home-stats strong {
          font-size: 1.25rem;
        }

        .staff-home-stats span {
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .staff-service-summary {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          padding: 0.95rem 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .staff-service-summary p {
          margin: 0.35rem 0 0;
        }

        .staff-owner-context {
          color: var(--text-muted);
          font-size: 0.82rem;
          text-align: right;
        }

        .staff-today-card {
          gap: 0.75rem;
        }

        .staff-today-card p {
          margin-top: 0;
        }

        .staff-today-copy {
          min-width: 0;
          flex: 1 1 auto;
        }

        .staff-next-appointment {
          display: grid;
          gap: 0.2rem;
          width: fit-content;
          max-width: 100%;
          margin-top: 0.45rem;
          color: var(--text);
          text-decoration: none;
        }

        .staff-next-label {
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .staff-next-details {
          display: flex;
          gap: 0.25rem 0.5rem;
          align-items: baseline;
          flex-wrap: wrap;
          overflow-wrap: anywhere;
        }

        .staff-next-details > span {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .staff-next-details > span::before {
          content: "\\00b7";
          margin-right: 0.5rem;
        }

        @media (max-width: 620px) {
          .staff-today-card,
          .staff-service-summary {
            display: grid;
          }

          .staff-home-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            min-width: 0;
          }

          .staff-home-stats span {
            overflow-wrap: anywhere;
          }

          .staff-next-details {
            display: grid;
            gap: 0.15rem;
          }

          .staff-next-details > span::before {
            content: none;
          }

          .staff-owner-context {
            text-align: left;
          }

          .staff-unlinked-actions,
          .staff-unlinked-actions :global(.btn),
          .staff-unlinked-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
