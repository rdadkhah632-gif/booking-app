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

type Service = {
  id: string;
  name: string;
  duration_minutes?: number | null;
  price?: number | null;
  active?: boolean | null;
};

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
  const dateLocale = locale === "sq" ? "sq-AL" : "en-GB";

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
        "Add yourself as bookable staff for this business? You will still manage the business from the business dashboard, but this creates a personal staff profile for your own appointments.",
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
      return startAt >= start && startAt <= end;
    });
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        ["pending", "confirmed"].includes(booking.status) &&
        new Date(booking.start_at) >= now,
    );
  }, [bookings, now]);

  const nextBooking = useMemo(() => {
    return (
      [...upcomingBookings].sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )[0] || null
    );
  }, [upcomingBookings]);

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const confirmedUpcomingBookings = useMemo(() => {
    return upcomingBookings.filter((booking) => booking.status === "confirmed");
  }, [upcomingBookings]);

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
              {t(
                "staff.loadingSchedule",
                "Loading your Mirëbook staff schedule...",
              )}
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
                  "Business access stays unchanged. Add a staff profile only when customers should book appointments directly with you.",
                )}
              </p>
            ) : (
              <div className="staff-unlinked-steps">
                <div className="staff-unlinked-step">
                  <strong>
                    {t("staff.unlinked.stepEmailTitle", "Use the same email")}
                  </strong>
                  <p className="small muted">
                    {currentUserEmail ||
                      t(
                        "staff.unlinked.emailFallback",
                        "Use the email address shown in your account.",
                      )}
                  </p>
                </div>
                <div className="staff-unlinked-step">
                  <strong>
                    {t(
                      "staff.unlinked.stepInviteTitle",
                      "Ask the business to invite you",
                    )}
                  </strong>
                  <p className="small muted">
                    {t(
                      "staff.unlinked.stepInviteBody",
                      "The business should add this exact email from Team.",
                    )}
                  </p>
                </div>
                <div className="staff-unlinked-step">
                  <strong>
                    {t("staff.unlinked.stepLinkTitle", "Refresh after linking")}
                  </strong>
                  <p className="small muted">
                    {t(
                      "staff.unlinked.stepLinkBody",
                      "Once linked, your schedule, availability and staff notifications will appear here.",
                    )}
                  </p>
                </div>
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
              <div>
                <h2>
                  {todayBookings.length > 0
                    ? t(
                        "staff.today.titleWithBookings",
                        "You have appointments today",
                      )
                    : t("staff.today.titleEmpty", "No appointments today")}
                </h2>
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  {nextBooking
                    ? `${t("staff.today.nextPrefix", "Next appointment")}: ${nextBooking.customer_name || t("common.customer", "Customer")} · ${new Date(nextBooking.start_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}`
                    : t(
                        "staff.today.noUpcoming",
                        "No upcoming assigned appointments are waiting in your schedule.",
                      )}
                </p>
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

            <div className="staff-quick-links">
              <Link href="/staff/calendar" className="staff-quick-link">
                <strong>
                  {t("dashboardLayout.staffNav.calendar", "Calendar")}
                </strong>
                <span>
                  {t(
                    "staff.home.calendarBody",
                    "Review appointment details and upcoming work.",
                  )}
                </span>
              </Link>
              <Link href="/staff/availability" className="staff-quick-link">
                <strong>
                  {t("dashboardLayout.staffNav.availability", "Availability")}
                </strong>
                <span>
                  {t(
                    "staff.home.availabilityBody",
                    "Set the days and hours customers can book you.",
                  )}
                </span>
              </Link>
              <Link href="/staff/notifications" className="staff-quick-link">
                <strong>
                  {t("dashboardLayout.staffNav.notifications", "Notifications")}
                </strong>
                <span>
                  {t(
                    "staff.home.notificationsBody",
                    "See booking, schedule and profile updates.",
                  )}
                </span>
              </Link>
            </div>

            <div className="staff-service-summary">
              <div>
                <strong>
                  {t(
                    "staff.assignedServices.title",
                    "What you can be booked for",
                  )}
                </strong>
                <p className="small muted">
                  {assignedServices.length > 0
                    ? assignedServices
                        .map((service) => service.name)
                        .join(" · ")
                    : t(
                        "staff.assignedServices.emptyCompact",
                        "No services are assigned yet. Ask the business to update your Team profile.",
                      )}
                </p>
              </div>
              {hasBusinessWorkspace && (
                <span className="staff-owner-context">
                  {t(
                    "staff.home.ownerContext",
                    "Business admin stays in the business dashboard.",
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

        .staff-unlinked-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 0.75rem;
        }

        .staff-unlinked-step {
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          display: grid;
          gap: 0.35rem;
        }

        .staff-unlinked-step p {
          margin-top: 0;
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

        .staff-quick-links {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.8rem;
          margin-bottom: 1rem;
        }

        .staff-quick-link {
          display: grid;
          gap: 0.35rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          text-decoration: none;
          background: var(--surface);
        }

        .staff-quick-link:hover {
          border-color: rgba(255, 107, 53, 0.35);
        }

        .staff-quick-link span {
          color: var(--text-muted);
          font-size: 0.84rem;
          line-height: 1.45;
        }

        :global(.staff-quick-link) {
          display: grid;
          gap: 0.35rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          text-decoration: none;
          background: var(--surface);
        }

        :global(.staff-quick-link:hover) {
          border-color: rgba(255, 107, 53, 0.35);
        }

        :global(.staff-quick-link strong),
        :global(.staff-quick-link span) {
          display: block;
        }

        :global(.staff-quick-link span) {
          color: var(--text-muted);
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .staff-service-summary {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border);
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

        @media (max-width: 820px) {
          .staff-quick-links {
            grid-template-columns: 1fr;
          }
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

          .staff-owner-context {
            text-align: left;
          }

          .staff-unlinked-steps {
            grid-template-columns: 1fr;
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
