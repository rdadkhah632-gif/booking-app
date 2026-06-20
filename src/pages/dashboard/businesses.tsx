import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import { uploadMirebookImage } from "@/lib/imageUpload";
import BusinessSetupHero from "@/components/dashboard-businesses/BusinessSetupHero";
import BusinessSetupStats from "@/components/dashboard-businesses/BusinessSetupStats";
import CreateBusinessCard from "@/components/dashboard-businesses/CreateBusinessCard";
import BusinessProfileCard from "@/components/dashboard-businesses/BusinessProfileCard";
import {
  AvailabilityRow,
  Business,
  Readiness,
  Service,
  StaffMember,
  StaffService,
} from "@/components/dashboard-businesses/dashboardBusinessesTypes";
import { useI18n } from "@/lib/useI18n";

export default function Businesses() {
  const router = useRouter();
  const { t } = useI18n();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>(
    [],
  );
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string | null;
  } | null>(null);

  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null);
  const [publishingBusinessId, setPublishingBusinessId] = useState<
    string | null
  >(null);
  const [uploadingBusinessId, setUploadingBusinessId] = useState<string | null>(
    null,
  );
  const [creatingOwnerStaffId, setCreatingOwnerStaffId] = useState<
    string | null
  >(null);
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadBusinesses() {
    setError(null);
    setPageLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setCurrentUser({
      id: session.user.id,
      email: session.user.email?.trim().toLowerCase() || null,
    });

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (businessError) {
      setError(businessError.message);
      setPageLoading(false);
      return;
    }

    const ownedBusinesses = businessData || [];
    setBusinesses(ownedBusinesses);

    const businessIds = ownedBusinesses.map((business) => business.id);

    if (businessIds.length === 0) {
      setServices([]);
      setStaffMembers([]);
      setStaffServices([]);
      setAvailabilityRows([]);
      setPageLoading(false);
      return;
    }

    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .select("id, business_id, active")
      .in("business_id", businessIds);

    if (serviceError) {
      setError(serviceError.message);
      setPageLoading(false);
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staff_members")
      .select("id, business_id, user_id, email, active")
      .in("business_id", businessIds);

    if (staffError) {
      setError(staffError.message);
      setPageLoading(false);
      return;
    }

    const activeStaffIds = (staffData || [])
      .filter((staff) => staff.active)
      .map((staff) => staff.id);

    let staffServiceData: StaffService[] = [];

    if (activeStaffIds.length > 0) {
      const { data: staffServiceRows, error: staffServiceError } =
        await supabase
          .from("staff_services")
          .select("id, staff_member_id, service_id")
          .in("staff_member_id", activeStaffIds);

      if (staffServiceError) {
        setError(staffServiceError.message);
        setPageLoading(false);
        return;
      }

      staffServiceData = (staffServiceRows || []) as StaffService[];
    }

    const { data: availabilityData, error: availabilityError } = await supabase
      .from("availability")
      .select("id, business_id, is_closed")
      .in("business_id", businessIds);

    if (availabilityError) {
      setError(availabilityError.message);
      setPageLoading(false);
      return;
    }

    setServices(serviceData || []);
    setStaffMembers(staffData || []);
    setStaffServices(staffServiceData);
    setAvailabilityRows(availabilityData || []);
    setPageLoading(false);
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  function ownerStaffProfileForBusiness(businessId: string) {
    if (!currentUser) return null;

    return (
      staffMembers.find(
        (staff: any) =>
          staff.business_id === businessId &&
          (staff.user_id === currentUser.id ||
            (currentUser.email &&
              staff.email?.toLowerCase() === currentUser.email)),
      ) || null
    );
  }

  async function addOwnerAsStaff(business: Business) {
    if (!currentUser) return;

    const existingOwnerStaff = ownerStaffProfileForBusiness(business.id);

    if (existingOwnerStaff) {
      setSuccess(
        t(
          "dashboardBusinesses.ownerStaff.alreadyLinked",
          "You already have a staff profile for this business. Use the Staff page to manage your services and hours.",
        ),
      );
      return;
    }

    setCreatingOwnerStaffId(business.id);
    setError(null);
    setSuccess(null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", currentUser.id)
      .maybeSingle();

    const fallbackName =
      profile?.full_name?.trim() ||
      business.name?.trim() ||
      t("dashboardBusinesses.ownerStaff.defaultName", "Business owner");

    const { error } = await supabase.from("staff_members").insert({
      business_id: business.id,
      user_id: currentUser.id,
      name: fallbackName,
      role_title: t("dashboardBusinesses.ownerStaff.roleTitle", "Owner"),
      email: currentUser.email,
      phone: profile?.phone || business.phone || null,
      invite_status: "linked",
      permission_role: "manager",
      active: true,
    });

    setCreatingOwnerStaffId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      t(
        "dashboardBusinesses.ownerStaff.success",
        "You have been added as bookable staff. Assign services and set your working hours from the Staff page.",
      ),
    );
    await loadBusinesses();
  }

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();

    if (!newName.trim()) return;

    if (businesses.length > 0) {
      setError(
        t(
          "dashboardBusinesses.create.limitReached",
          "Your account already has a business profile. To add another business or location, contact Mirëbook support.",
        ),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("businesses").insert({
      name: newName.trim(),
      user_id: session.user.id,
      published: false,
      auto_accept_bookings: true,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setNewName("");
    setSuccess(
      t(
        "dashboardBusinesses.create.success",
        "Business created. Complete the setup hub, then publish it to Mirëbook.",
      ),
    );
    await loadBusinesses();
    setLoading(false);
  }

  function updateLocalBusiness(
    id: string,
    field: keyof Business,
    value: string | boolean,
  ) {
    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === id ? { ...business, [field]: value } : business,
      ),
    );
  }

  async function uploadBusinessImage(business: Business, file: File | null) {
    if (!file) return;

    setUploadingBusinessId(business.id);
    setError(null);
    setSuccess(null);

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: "businesses",
        recordId: business.id,
      });

      const { error: updateError } = await supabase
        .from("businesses")
        .update({ image_url: uploaded.publicUrl })
        .eq("id", business.id);

      if (updateError) throw updateError;

      updateLocalBusiness(business.id, "image_url", uploaded.publicUrl);
      setSuccess(
        `${business.name || t("common.business", "Business")} ${t("dashboardBusinesses.image.uploaded", "image uploaded.")}`,
      );
      await loadBusinesses();
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "dashboardBusinesses.image.uploadError",
            "Could not upload business image.",
          ),
      );
    } finally {
      setUploadingBusinessId(null);
    }
  }

  async function removeBusinessImage(business: Business) {
    const confirmed = confirm(
      t(
        "dashboardBusinesses.image.confirmRemove",
        "Remove this business image from the public marketplace profile?",
      ),
    );
    if (!confirmed) return;

    setUploadingBusinessId(business.id);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("businesses")
      .update({ image_url: null })
      .eq("id", business.id);

    setUploadingBusinessId(null);

    if (error) {
      setError(error.message);
      return;
    }

    updateLocalBusiness(business.id, "image_url", "");
    setSuccess(
      `${business.name || t("common.business", "Business")} ${t("dashboardBusinesses.image.removed", "image removed.")}`,
    );
    await loadBusinesses();
  }
  function getReadiness(business: Business): Readiness {
    const activeServices = services.filter(
      (service) => service.business_id === business.id && service.active,
    ).length;
    const activeStaff = staffMembers.filter(
      (staff) => staff.business_id === business.id && staff.active,
    ).length;
    const workingDays = availabilityRows.filter(
      (row) => row.business_id === business.id && row.is_closed !== true,
    ).length;

    const activeServiceIds = services
      .filter(
        (service) => service.business_id === business.id && service.active,
      )
      .map((service) => service.id);

    const activeStaffIds = staffMembers
      .filter((staff) => staff.business_id === business.id && staff.active)
      .map((staff) => staff.id);

    const staffServiceAssignments = staffServices.filter(
      (assignment) =>
        activeStaffIds.includes(assignment.staff_member_id) &&
        activeServiceIds.includes(assignment.service_id),
    ).length;

    const profileComplete = Boolean(
      business.name?.trim() &&
      business.category?.trim() &&
      business.city?.trim() &&
      business.description?.trim() &&
      business.phone?.trim(),
    );

    const hasActiveServices = activeServices > 0;
    const hasActiveStaff = activeStaff > 0;
    const hasStaffServiceAssignments = staffServiceAssignments > 0;
    const hasWorkingHours = workingDays > 0;
    const hasBusinessImage = Boolean(business.image_url?.trim());
    const missingItems: string[] = [];
    const profileMissingItems: string[] = [];

    if (!profileComplete)
      profileMissingItems.push(
        t("dashboardBusinesses.missing.profile", "profile details"),
      );
    if (!hasBusinessImage)
      profileMissingItems.push(
        t("dashboardBusinesses.missing.image", "business image"),
      );
    if (!hasActiveServices)
      missingItems.push(
        t("dashboardBusinesses.missing.services", "active services"),
      );
    if (!hasActiveStaff)
      missingItems.push(t("dashboardBusinesses.missing.staff", "active staff"));
    if (!hasStaffServiceAssignments)
      missingItems.push(
        t(
          "dashboardBusinesses.missing.assignments",
          "staff-service assignments",
        ),
      );
    if (!hasWorkingHours)
      missingItems.push(
        t("dashboardBusinesses.missing.hours", "working hours"),
      );

    const bookingReady =
      hasActiveServices &&
      hasActiveStaff &&
      hasStaffServiceAssignments &&
      hasWorkingHours;

    return {
      profileComplete,
      bookingReady,
      publicListingReady: business.published && bookingReady,
      hasActiveServices,
      hasActiveStaff,
      hasStaffServiceAssignments,
      hasWorkingHours,
      hasBusinessImage,
      activeServices,
      activeStaff,
      staffServiceAssignments,
      workingDays,
      missingItems,
      profileMissingItems,
    };
  }

  const dashboardStats = useMemo(() => {
    const published = businesses.filter(
      (business) => business.published,
    ).length;
    const ready = businesses.filter(
      (business) => getReadiness(business).bookingReady,
    ).length;
    const incompletePublished = businesses.filter(
      (business) => business.published && !getReadiness(business).bookingReady,
    ).length;

    return {
      total: businesses.length,
      published,
      hidden: businesses.length - published,
      ready,
      incompletePublished,
    };
  }, [businesses, services, staffMembers, staffServices, availabilityRows]);

  const primaryBusiness = businesses[0] || null;
  const primaryReadiness = primaryBusiness
    ? getReadiness(primaryBusiness)
    : null;
  const ownerStaffProfile = primaryBusiness
    ? ownerStaffProfileForBusiness(primaryBusiness.id)
    : null;
  const setupSteps =
    primaryBusiness && primaryReadiness
      ? [
          {
            key: "profile",
            complete: primaryReadiness.profileComplete,
            href: "#business-profile-details",
            label: t("dashboardBusinesses.setup.profile", "Business profile"),
            helper: t(
              "dashboardBusinesses.setup.profileBody",
              "Add the customer details people need before booking.",
            ),
            action: t(
              "dashboardBusinesses.setup.profileAction",
              "Edit profile",
            ),
          },
          {
            key: "services",
            complete: primaryReadiness.hasActiveServices,
            href: "/dashboard/services",
            label: t("dashboardBusinesses.setup.services", "Services"),
            helper: t(
              "dashboardBusinesses.setup.servicesBody",
              "Create at least one active service customers can choose.",
            ),
            action: t(
              "dashboardBusinesses.setup.servicesAction",
              "Add service",
            ),
          },
          {
            key: "team",
            complete:
              primaryReadiness.hasActiveStaff &&
              primaryReadiness.hasStaffServiceAssignments,
            href: "/dashboard/staff",
            label: t("dashboardBusinesses.setup.team", "Team"),
            helper: t(
              "dashboardBusinesses.setup.teamBody",
              "Add bookable people and connect them to services.",
            ),
            action: t("dashboardBusinesses.setup.teamAction", "Manage team"),
          },
          {
            key: "hours",
            complete: primaryReadiness.hasWorkingHours,
            href: "/dashboard/availability",
            label: t("dashboardBusinesses.setup.hours", "Working hours"),
            helper: t(
              "dashboardBusinesses.setup.hoursBody",
              "Set the days and times customers can book.",
            ),
            action: t("dashboardBusinesses.setup.hoursAction", "Set hours"),
          },
          {
            key: "preview",
            complete: primaryReadiness.publicListingReady,
            href: primaryReadiness.bookingReady
              ? `/explore/${primaryBusiness.id}`
              : "#business-profile-details",
            label: t(
              "dashboardBusinesses.setup.preview",
              "Preview and publish",
            ),
            helper: t(
              "dashboardBusinesses.setup.previewBody",
              "Check the customer page, then publish when ready.",
            ),
            action: primaryReadiness.bookingReady
              ? t("dashboardBusinesses.setup.previewAction", "Preview profile")
              : t("dashboardBusinesses.setup.finishFirst", "Finish setup"),
          },
        ]
      : [];
  const completedSetupSteps = setupSteps.filter((step) => step.complete).length;
  const nextSetupStep =
    setupSteps.find((step) => !step.complete) ||
    setupSteps[setupSteps.length - 1];
  const setupStatus =
    primaryBusiness && primaryReadiness
      ? primaryReadiness.publicListingReady
        ? t("dashboardBusinesses.setup.statusReady", "Ready to take bookings")
        : primaryBusiness.published && !primaryReadiness.bookingReady
          ? t("dashboardBusinesses.setup.statusHidden", "Hidden from Explore")
          : primaryReadiness.bookingReady
            ? t("dashboardBusinesses.setup.statusPublish", "Ready to publish")
            : t("dashboardBusinesses.setup.statusNeeded", "Setup needed")
      : "";

  function shouldOpenProfileDetails(href: string) {
    return href === "#business-profile-details";
  }

  function openProfileDetails() {
    setProfileDetailsOpen(true);
  }

  async function saveBusiness(business: Business) {
    setSavingBusinessId(business.id);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("businesses")
      .update({
        name: business.name,
        description: business.description || null,
        category: business.category || null,
        city: business.city || null,
        country: business.country || null,
        address: business.address || null,
        phone: business.phone || null,
        image_url: business.image_url || null,
        auto_accept_bookings: business.auto_accept_bookings ?? true,
      })
      .eq("id", business.id);

    if (error) {
      setError(error.message);
      setSavingBusinessId(null);
      return;
    }

    setSuccess(
      `${business.name || t("common.business", "Business")} ${t("dashboardBusinesses.save.success", "setup saved.")}`,
    );
    setSavingBusinessId(null);
    await loadBusinesses();
  }

  async function togglePublished(business: Business) {
    setError(null);
    setSuccess(null);
    setPublishingBusinessId(business.id);

    const readiness = getReadiness(business);

    if (!business.published && !readiness.bookingReady) {
      setError(
        `${t("dashboardBusinesses.publish.completeFirst", "Complete")} ${readiness.missingItems.join(", ")} ${t("dashboardBusinesses.publish.beforePublishing", "before publishing this business to Mirëbook.")}`,
      );
      setPublishingBusinessId(null);
      return;
    }

    const { error } = await supabase
      .from("businesses")
      .update({ published: !business.published })
      .eq("id", business.id);

    setPublishingBusinessId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      !business.published
        ? `${business.name} ${t("dashboardBusinesses.publish.visibleSuccess", "is now visible on Mirëbook.")}`
        : `${business.name} ${t("dashboardBusinesses.publish.hiddenSuccess", "is now hidden from customers.")}`,
    );
    await loadBusinesses();
  }

  // readinessRow and setupCard functions deleted
  return (
    <DashboardLayout
      title={t(
        "dashboardBusinesses.pageTitle",
        businesses.length > 0 ? "Setup" : "Create your business",
      )}
      subtitle={t(
        "dashboardBusinesses.pageSubtitle",
        businesses.length > 0
          ? "Get your business ready for customers to book."
          : "Create your first business profile, then add services, team, working hours and publish it to Mirëbook.",
      )}
    >
      {businesses.length === 0 && <BusinessSetupHero />}

      {businesses.length === 0 && <BusinessSetupStats stats={dashboardStats} />}

      {businesses.length === 0 && (
        <CreateBusinessCard
          value={newName}
          loading={loading}
          existingBusinessCount={businesses.length}
          onChange={setNewName}
          onSubmit={createBusiness}
        />
      )}

      {businesses.length > 0 && primaryBusiness && primaryReadiness && (
        <section className="setup-workspace">
          <div className="setup-hero">
            <div>
              <p className="small muted">
                {t("dashboardBusinesses.setup.progressLabel", "Setup progress")}
              </p>
              <h2>
                {primaryBusiness.name ||
                  t(
                    "dashboardBusinesses.untitledBusiness",
                    "Untitled business",
                  )}
              </h2>
              <p className="small muted">
                {t(
                  "dashboardBusinesses.setup.body",
                  "Follow the next step, then preview what customers will see.",
                )}
              </p>
            </div>
            <span
              className={
                primaryReadiness.publicListingReady
                  ? "setup-status ready"
                  : "setup-status"
              }
            >
              {setupStatus}
            </span>
          </div>

          <div className="setup-progress-panel">
            <div className="setup-progress-main">
              <span className="setup-progress-count">
                {completedSetupSteps} {t("dashboardBusinesses.setup.of", "of")}{" "}
                {setupSteps.length}
              </span>
              <div>
                <h3>{t("dashboardBusinesses.setup.nextTitle", "Next step")}</h3>
                <p className="muted">
                  {nextSetupStep
                    ? `${nextSetupStep.label}: ${nextSetupStep.helper}`
                    : t(
                        "dashboardBusinesses.setup.completeBody",
                        "Your booking setup is ready.",
                      )}
                </p>
              </div>
            </div>
            {nextSetupStep && (
              <a
                href={nextSetupStep.href}
                className="btn btn-accent"
                onClick={
                  shouldOpenProfileDetails(nextSetupStep.href)
                    ? openProfileDetails
                    : undefined
                }
              >
                {nextSetupStep.action}
              </a>
            )}
          </div>

          <div className="setup-grid">
            <div className="setup-checklist">
              {setupSteps.map((item, index) => (
                <a
                  key={item.key}
                  href={item.href}
                  className={
                    item.complete ? "setup-step complete" : "setup-step"
                  }
                  onClick={
                    shouldOpenProfileDetails(item.href)
                      ? openProfileDetails
                      : undefined
                  }
                >
                  <span className="setup-step-marker">
                    {item.complete ? "✓" : index + 1}
                  </span>
                  <span className="setup-step-copy">
                    <strong>{item.label}</strong>
                    <small>{item.helper}</small>
                  </span>
                  <span className="setup-step-action">
                    {item.complete
                      ? t("dashboardBusinesses.setup.done", "Done")
                      : item.action}
                  </span>
                </a>
              ))}
            </div>

            <aside className="setup-preview">
              <div>
                <p className="small muted">
                  {t(
                    "dashboardBusinesses.setup.previewLabel",
                    "Customer preview",
                  )}
                </p>
                <h3>
                  {primaryBusiness.name ||
                    t(
                      "dashboardBusinesses.untitledBusiness",
                      "Untitled business",
                    )}
                </h3>
                <p className="small muted">
                  {[primaryBusiness.category, primaryBusiness.city]
                    .filter(Boolean)
                    .join(" · ") ||
                    t(
                      "dashboardBusinesses.addCategoryLocation",
                      "Add category and location",
                    )}
                </p>
              </div>
              <span
                className={
                  primaryReadiness.publicListingReady
                    ? "preview-status live"
                    : "preview-status"
                }
              >
                {primaryReadiness.publicListingReady
                  ? t("dashboardBusinesses.status.live", "Published")
                  : primaryBusiness.published
                    ? t(
                        "dashboardBusinesses.setup.statusHidden",
                        "Hidden from Explore",
                      )
                    : t("dashboardBusinesses.hidden", "Hidden")}
              </span>
              <Link
                href={`/explore/${primaryBusiness.id}`}
                className="btn btn-ghost"
              >
                {t(
                  "dashboardBusinesses.profileTools.preview",
                  "Preview public page",
                )}
              </Link>
            </aside>
          </div>

          <div className="setup-secondary">
            <div className="setup-advanced">
              <strong>
                {t("dashboardBusinesses.setup.advancedTitle", "Advanced")}
              </strong>
              <div>
                <Link href="/dashboard/settings">
                  {t(
                    "dashboardBusinesses.myBusiness.bookingRules",
                    "Booking rules",
                  )}
                </Link>
                <Link href="/dashboard/billing">
                  {t("dashboardLayout.nav.membership", "Membership")}
                </Link>
                <Link href="/support/business">
                  {t("dashboardLayout.nav.help", "Help")}
                </Link>
              </div>
            </div>
            {ownerStaffProfile ? (
              <p className="small muted setup-owner-note">
                {t(
                  "dashboardBusinesses.onboarding.ownerStaffLinked",
                  "You also take appointments. Manage your personal schedule in My Work.",
                )}{" "}
                <Link href="/staff">
                  {t(
                    "dashboardBusinesses.onboarding.openMyWork",
                    "Open My Work",
                  )}
                </Link>
              </p>
            ) : (
              <div className="setup-owner-note">
                <span className="small muted">
                  {t(
                    "dashboardBusinesses.ownerStaff.body",
                    "Add yourself only if customers can book appointments with you.",
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => addOwnerAsStaff(primaryBusiness)}
                  disabled={creatingOwnerStaffId === primaryBusiness.id}
                >
                  {creatingOwnerStaffId === primaryBusiness.id
                    ? t(
                        "dashboardBusinesses.ownerStaff.creating",
                        "Adding you as staff...",
                      )
                    : t(
                        "staff.ownerSetup.addSelf",
                        "Add myself as bookable staff",
                      )}
                </button>
              </div>
            )}
          </div>
        </section>
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

      {pageLoading && (
        <div className="card">
          <p className="muted">
            {t(
              "dashboardBusinesses.loading",
              "Loading your Mirëbook businesses...",
            )}
          </p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>{t("dashboardBusinesses.empty.title", "No businesses yet")}</h3>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "dashboardBusinesses.empty.body",
              "Create your first business above. Then add services, staff, working hours and publish it to Mirëbook.",
            )}
          </p>
        </div>
      )}

      {businesses.length > 0 && (
        <details
          id="business-profile-details"
          className="setup-details-panel"
          open={profileDetailsOpen}
          onToggle={(event) => setProfileDetailsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>
              <strong>
                {t(
                  "dashboardBusinesses.setup.detailsTitle",
                  "Business profile details",
                )}
              </strong>
              <small>
                {t(
                  "dashboardBusinesses.setup.detailsBody",
                  "Edit the customer-facing details and publish when ready.",
                )}
              </small>
            </span>
          </summary>
          <div className="business-profile-list">
            {businesses.map((business) => (
              <BusinessProfileCard
                key={business.id}
                business={business}
                readiness={getReadiness(business)}
                savingBusinessId={savingBusinessId}
                publishingBusinessId={publishingBusinessId}
                uploadingBusinessId={uploadingBusinessId}
                updateLocalBusiness={updateLocalBusiness}
                onSave={saveBusiness}
                onTogglePublished={togglePublished}
                onUploadImage={uploadBusinessImage}
                onRemoveImage={removeBusinessImage}
              />
            ))}
          </div>
        </details>
      )}
      <style jsx>{`
        .setup-workspace {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }

        .setup-hero,
        .setup-progress-panel,
        .setup-secondary {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .setup-hero h2,
        .setup-hero p,
        .setup-progress-panel h3,
        .setup-progress-panel p,
        .setup-preview h3,
        .setup-preview p {
          margin-top: 0;
        }

        .setup-status,
        .preview-status {
          flex: 0 0 auto;
          padding: 0.3rem 0.65rem;
          border-radius: 999px;
          background: rgba(255, 190, 11, 0.1);
          color: var(--warning);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .setup-status.ready,
        .preview-status.live {
          background: rgba(45, 212, 191, 0.1);
          color: var(--success);
        }

        .setup-progress-panel,
        .setup-preview,
        .setup-details-panel {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .setup-progress-panel {
          padding: 1rem;
        }

        .setup-progress-main {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          min-width: min(100%, 28rem);
        }

        .setup-progress-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 4rem;
          height: 4rem;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--accent-dim);
          color: var(--accent);
          font-weight: 900;
        }

        .setup-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
          gap: 1rem;
          align-items: start;
        }

        .setup-checklist {
          display: grid;
          gap: 0.45rem;
        }

        .setup-step {
          display: grid;
          grid-template-columns: 2.15rem minmax(0, 1fr) auto;
          gap: 0.75rem;
          align-items: center;
          min-width: 0;
          padding: 0.8rem 0;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          text-decoration: none;
        }

        .setup-step-marker {
          width: 2.15rem;
          height: 2.15rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255, 107, 53, 0.12);
          color: var(--accent);
          font-weight: 900;
        }

        .setup-step.complete .setup-step-marker {
          background: rgba(45, 212, 191, 0.12);
          color: var(--success);
        }

        .setup-step-copy {
          display: grid;
          gap: 0.16rem;
          min-width: 0;
        }

        .setup-step-copy small,
        .setup-step-action {
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .setup-step-action {
          color: var(--accent);
          font-weight: 800;
          white-space: nowrap;
        }

        .setup-step.complete .setup-step-action {
          color: var(--success);
        }

        .setup-preview {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
        }

        .setup-advanced {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .setup-advanced div {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .setup-advanced a,
        .setup-owner-note a {
          color: var(--text-muted);
          text-decoration: none;
        }

        .setup-advanced a:hover,
        .setup-owner-note a:hover {
          color: var(--accent);
        }

        .setup-owner-note {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin: 0;
        }

        .setup-details-panel {
          margin-top: 1rem;
          overflow: hidden;
        }

        .setup-details-panel summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem;
          cursor: pointer;
          list-style: none;
        }

        .setup-details-panel summary::-webkit-details-marker {
          display: none;
        }

        .setup-details-panel summary span {
          display: grid;
          gap: 0.2rem;
        }

        .setup-details-panel summary small {
          color: var(--text-muted);
          font-size: 0.84rem;
        }

        .business-profile-list {
          display: grid;
          gap: 1.25rem;
          padding: 0 1rem 1rem;
        }

        @media (max-width: 700px) {
          .setup-hero,
          .setup-progress-panel,
          .setup-progress-main,
          .setup-secondary,
          .setup-owner-note,
          .setup-advanced {
            display: grid;
            width: 100%;
          }

          .setup-status,
          .preview-status {
            justify-self: start;
          }

          .setup-grid {
            grid-template-columns: 1fr;
          }

          .setup-step {
            grid-template-columns: 2.15rem minmax(0, 1fr);
          }

          .setup-step-action {
            grid-column: 2;
            white-space: normal;
          }

          .setup-progress-panel :global(.btn),
          .setup-preview :global(.btn),
          .setup-owner-note :global(.btn),
          .setup-owner-note button {
            width: 100%;
            justify-content: center;
          }

          .setup-details-panel summary {
            align-items: flex-start;
          }

          .business-profile-list {
            padding: 0 0.75rem 0.75rem;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
