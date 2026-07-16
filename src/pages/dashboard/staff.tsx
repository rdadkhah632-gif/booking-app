import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import IllustratedEmptyState from "@/components/dashboard/IllustratedEmptyState";
import { uploadMirebookImage } from "@/lib/imageUpload";

import CreateStaffCard from "@/components/dashboard-staff/CreateStaffCard";
import StaffProfileCard from "@/components/dashboard-staff/StaffProfileCard";
import {
  AvailabilityRow,
  Business,
  Service,
  StaffMember,
  StaffService,
} from "@/components/dashboard-staff/dashboardStaffTypes";
import { useI18n } from "@/lib/useI18n";
import { getAccountCapabilities } from "@/lib/accountCapabilities";

export default function StaffPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { businessId } = router.query;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<AvailabilityRow[]>(
    [],
  );

  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [permissionRole, setPermissionRole] = useState<
    "staff" | "manager" | "reception"
  >("staff");
  const [formExpanded, setFormExpanded] = useState(false);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(
    null,
  );

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, name, currency")
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
            "dashboardStaff.error.noAccess",
            "You do not have access to this business.",
          ),
        );
      }

      return selected;
    }

    return owned[0];
  }

  async function loadPage() {
    setPageLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAccountUserId(null);
        router.replace("/login");
        return;
      }
      setAccountUserId(session.user.id);

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      if (!capabilities.canUseBusiness) {
        router.replace(capabilities.defaultRoute);
        return;
      }

      const selectedBusiness = await getBusinessContext(session.user.id);

      if (!selectedBusiness) {
        setBusiness(null);
        setStaff([]);
        setServices([]);
        setStaffServices([]);
        setStaffAvailability([]);
        setPageLoading(false);
        return;
      }

      setBusiness(selectedBusiness);

      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .select("id, business_id, name, active, duration_minutes, price")
        .eq("business_id", selectedBusiness.id)
        .order("created_at", { ascending: false });

      if (serviceError) throw serviceError;

      setServices(serviceData || []);

      const { data: staffData, error: staffError } = await supabase
        .from("staff_members")
        .select("*")
        .eq("business_id", selectedBusiness.id)
        .order("created_at", { ascending: false });

      if (staffError) throw staffError;

      setStaff(staffData || []);

      const staffIds = (staffData || []).map((s) => s.id);

      if (staffIds.length > 0) {
        const { data: linkData, error: linkError } = await supabase
          .from("staff_services")
          .select("staff_member_id, service_id")
          .in("staff_member_id", staffIds);

        if (linkError) throw linkError;

        setStaffServices(linkData || []);

        const { data: availabilityData, error: availabilityError } =
          await supabase
            .from("staff_availability")
            .select("id, staff_member_id, day_of_week, is_closed")
            .in("staff_member_id", staffIds);

        if (availabilityError) throw availabilityError;

        setStaffAvailability(availabilityData || []);
      } else {
        setStaffServices([]);
        setStaffAvailability([]);
      }

      setPageLoading(false);
    } catch (err: any) {
      setError(
        err.message || t("dashboardStaff.error.load", "Could not load staff."),
      );
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadPage();
  }, [router.isReady, businessId]);

  function assignedServicesForStaff(staffId: string) {
    return services.filter((service) => staffCanDoService(staffId, service.id));
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();

    if (!business) return;

    if (!name.trim()) {
      setError(
        t("dashboardStaff.error.nameRequired", "Staff name is required."),
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    let finalImageUrl = imageUrl.trim() || null;

    if (imageFile) {
      const uploadedUrl = await uploadCreateImage();
      if (!uploadedUrl) {
        setSaving(false);
        return;
      }
      finalImageUrl = uploadedUrl;
    }

    const cleanStaffEmail = email.trim().toLowerCase();

    const { data: createdStaff, error } = await supabase
      .from("staff_members")
      .insert({
        business_id: business.id,
        name: name.trim(),
        role_title: roleTitle.trim() || null,
        email: cleanStaffEmail || null,
        phone: phone.trim() || null,
        image_url: finalImageUrl,
        invite_status: cleanStaffEmail ? "invited" : "not_invited",
        permission_role: permissionRole,
        active: true,
      })
      .select("id, name")
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    let successMessage = t(
      "dashboardStaff.create.success",
      "Staff member added. Assign services and working hours so Mirëbook can show real bookable times for them.",
    );

    if (cleanStaffEmail && createdStaff?.id) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const response = await fetch("/api/staff/invite", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ staffMemberId: createdStaff.id }),
        });
        const payload = await response.json();

        if (response.ok && payload.delivery?.status === "sent") {
          successMessage = `${successMessage} ${t(
            "dashboardStaff.invite.emailSent",
            "Invite saved and the invitation email was sent.",
          )}`;
        } else if (
          response.ok &&
          payload.manualInviteUrl &&
          [
            "config_missing",
            "provider_disabled",
            "unsupported_provider",
          ].includes(payload.delivery?.reason)
        ) {
          successMessage = `${successMessage} ${t(
            "dashboardStaff.invite.appUrlMissing",
            "Invite saved, but the invite email could not be sent. Manual invite link:",
          )} ${payload.manualInviteUrl}`;
        } else if (response.ok && payload.manualInviteUrl) {
          successMessage = `${successMessage} ${t(
            "dashboardStaff.invite.savedManualLink",
            "Invite saved. Manual invite link:",
          )} ${payload.manualInviteUrl}`;
        }
      } catch {
        // Staff creation is authoritative; invite email/link generation is best-effort.
      }
    }

    resetForm();
    setFormExpanded(false);
    setSuccess(successMessage);

    await loadPage();
  }

  function resetForm() {
    setName("");
    setRoleTitle("");
    setEmail("");
    setPhone("");
    setImageUrl("");
    setImageFile(null);
    setImagePreviewUrl("");
    setPermissionRole("staff");
  }

  function openCreateStaffForm() {
    setFormExpanded(true);
    document
      .getElementById("create-staff-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCreateImageChange(file: File | null) {
    setError(null);
    setImageFile(file);

    if (!file) {
      setImagePreviewUrl("");
      return;
    }

    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function uploadCreateImage() {
    if (!imageFile) {
      setError(
        t("dashboardStaff.image.chooseFirst", "Choose an image file first."),
      );
      return null;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const uploaded = await uploadMirebookImage({
        file: imageFile,
        folder: "staff",
        recordId: business?.id || "new-staff",
      });

      setImageUrl(uploaded.publicUrl);
      setImageFile(null);
      setImagePreviewUrl(uploaded.publicUrl);
      setSuccess(t("dashboardStaff.image.uploaded", "Staff image uploaded."));
      return uploaded.publicUrl;
    } catch (err: any) {
      setError(
        err.message ||
          t("dashboardStaff.image.uploadError", "Could not upload image."),
      );
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function uploadStaffImage(member: StaffMember, file: File | null) {
    if (!file) return;

    setUploadingStaffId(member.id);
    setError(null);
    setSuccess(null);

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: "staff",
        recordId: member.id,
      });

      const { error: updateError } = await supabase
        .from("staff_members")
        .update({ image_url: uploaded.publicUrl })
        .eq("id", member.id);

      if (updateError) throw updateError;

      updateLocalStaff(member.id, "image_url", uploaded.publicUrl);
      setSuccess(
        `${member.name} ${t("dashboardStaff.image.uploadedLower", "image uploaded.")}`,
      );
      await loadPage();
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "dashboardStaff.image.uploadStaffError",
            "Could not upload staff image.",
          ),
      );
    } finally {
      setUploadingStaffId(null);
    }
  }

  async function removeStaffImage(member: StaffMember) {
    setUploadingStaffId(member.id);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("staff_members")
      .update({ image_url: null })
      .eq("id", member.id);

    setUploadingStaffId(null);

    if (error) {
      setError(error.message);
      return;
    }

    updateLocalStaff(member.id, "image_url", "");
    setSuccess(
      `${member.name} ${t("dashboardStaff.image.removed", "photo removed.")}`,
    );
    await loadPage();
  }

  function updateLocalStaff(
    id: string,
    field: keyof StaffMember,
    value: string | boolean,
  ) {
    setStaff((prev) =>
      prev.map((member) =>
        member.id === id ? { ...member, [field]: value } : member,
      ),
    );
  }

  async function saveStaff(member: StaffMember) {
    if (!member.name.trim()) {
      setError(
        t("dashboardStaff.error.nameRequired", "Staff name is required."),
      );
      return;
    }

    setSavingStaffId(member.id);
    setError(null);
    setSuccess(null);

    const cleanStaffEmail = member.email?.trim().toLowerCase() || null;

    const { error } = await supabase
      .from("staff_members")
      .update({
        name: member.name.trim(),
        role_title: member.role_title?.trim() || null,
        email: cleanStaffEmail,
        phone: member.phone?.trim() || null,
        image_url: member.image_url?.trim() || null,
        permission_role: member.permission_role || "staff",
        active: member.active,
        invite_status:
          cleanStaffEmail && member.invite_status === "not_invited"
            ? "invited"
            : member.invite_status,
      })
      .eq("id", member.id);

    setSavingStaffId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingStaffId(null);
    setSuccess(`${member.name} ${t("dashboardStaff.save.saved", "saved.")}`);
    await loadPage();
  }

  async function markStaffInvited(member: StaffMember) {
    if (!member.email) {
      setError(
        t(
          "dashboardStaff.invite.emailRequired",
          "Add an email before marking this staff member as invited.",
        ),
      );
      return;
    }

    const cleanStaffEmail = member.email.trim().toLowerCase();

    setActionLoadingKey(`invite-${member.id}`);
    setError(null);
    setSuccess(null);
    setGeneratedInviteUrl(null);

    const { error } = await supabase
      .from("staff_members")
      .update({ invite_status: "invited", email: cleanStaffEmail })
      .eq("id", member.id);

    if (error) {
      setActionLoadingKey(null);
      setError(error.message);
      return;
    }

    let deliveryMessage = t(
      "dashboardStaff.invite.savedNoEmail",
      "Invite saved. Share the secure invite link or ask them to sign in with the invited email.",
    );

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ staffMemberId: member.id }),
      });
      const payload = await response.json();

      if (response.ok && payload.delivery?.status === "sent") {
        deliveryMessage = t(
          "dashboardStaff.invite.emailSent",
          "Invite saved and the invitation email was sent.",
        );
      } else if (
        response.ok &&
        payload.manualInviteUrl &&
        [
          "config_missing",
          "provider_disabled",
          "unsupported_provider",
        ].includes(payload.delivery?.reason)
      ) {
        deliveryMessage = `${t(
          "dashboardStaff.invite.appUrlMissing",
          "Invite saved, but the invite email could not be sent. Manual invite link:",
        )} ${payload.manualInviteUrl}`;
      } else if (response.ok && payload.manualInviteUrl) {
        deliveryMessage = `${t(
          "dashboardStaff.invite.savedManualLink",
          "Invite saved. Manual invite link:",
        )} ${payload.manualInviteUrl}`;
      }
    } catch {
      // The staff record is already saved; email delivery is best-effort only.
    }

    setActionLoadingKey(null);
    setSuccess(`${member.name}: ${deliveryMessage}`);
    await loadPage();
  }

  async function copyStaffInviteLink(member: StaffMember) {
    if (!member.email || member.user_id) return;

    setActionLoadingKey(`copy-invite-${member.id}`);
    setError(null);
    setSuccess(null);
    setGeneratedInviteUrl(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffMemberId: member.id,
          deliveryMode: "link_only",
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.manualInviteUrl) {
        throw new Error(
          payload.error ||
            t(
              "dashboardStaff.invite.copyError",
              "Could not create a secure invite link.",
            ),
        );
      }

      let copiedToClipboard = false;
      try {
        await navigator.clipboard.writeText(payload.manualInviteUrl);
        copiedToClipboard = true;
      } catch {
        // The secure link remains visible below when clipboard access is blocked.
      }

      setSuccess(
        `${
          copiedToClipboard
            ? t(
                "dashboardStaff.invite.copied",
                "Secure invite link copied. The previous unused link is no longer valid.",
              )
            : t(
                "dashboardStaff.invite.copyFallback",
                "Copy this secure invite link:",
              )
        } ${payload.manualInviteUrl}`,
      );
      setGeneratedInviteUrl(payload.manualInviteUrl);

      await loadPage();
    } catch (inviteError: any) {
      setError(
        inviteError.message ||
          t(
            "dashboardStaff.invite.copyError",
            "Could not create a secure invite link.",
          ),
      );
    } finally {
      setActionLoadingKey(null);
    }
  }

  async function revokeStaffInvite(member: StaffMember) {
    if (member.user_id) return;

    setActionLoadingKey(`revoke-invite-${member.id}`);
    setError(null);
    setSuccess(null);
    setGeneratedInviteUrl(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/staff/invite", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ staffMemberId: member.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.error ||
            t(
              "dashboardStaff.invite.revokeError",
              "Could not revoke this invite.",
            ),
        );
      }

      setSuccess(
        t(
          "dashboardStaff.invite.revoked",
          "Pending invite revoked. The staff profile remains saved.",
        ),
      );
      await loadPage();
    } catch (inviteError: any) {
      setError(
        inviteError.message ||
          t(
            "dashboardStaff.invite.revokeError",
            "Could not revoke this invite.",
          ),
      );
    } finally {
      setActionLoadingKey(null);
    }
  }

  async function toggleStaffActive(member: StaffMember) {
    setActionLoadingKey(`staff-${member.id}`);
    setError(null);
    setSuccess(null);

    const assignedServices = assignedServicesForStaff(member.id);
    const openDays = openDaysForStaff(member.id);

    if (member.active) {
      try {
        const futureBookingCount = await futureBookingsForStaff(member.id);

        if (futureBookingCount > 0) {
          const confirmed = confirm(
            t(
              "dashboardStaff.active.confirmFutureBookings",
              "This staff member has upcoming pending or confirmed bookings. Deactivating them will hide them from new bookings, but existing bookings will still need reviewing or moving manually. Continue?",
            ),
          );

          if (!confirmed) {
            setActionLoadingKey(null);
            return;
          }
        }
      } catch (err: any) {
        setActionLoadingKey(null);
        setError(
          err.message ||
            t(
              "dashboardStaff.active.futureBookingCheckError",
              "Could not check upcoming bookings for this staff member.",
            ),
        );
        return;
      }
    }

    if (member.active && member.user_id && member.user_id === accountUserId) {
      const confirmed = confirm(
        t(
          "dashboardStaff.ownerAsStaff.confirmDeactivateSelf",
          "This is your own bookable staff profile. Deactivating it keeps your business access, but customers will no longer be able to book you for new appointments. Continue?",
        ),
      );

      if (!confirmed) {
        setActionLoadingKey(null);
        return;
      }
    }

    if (!member.active && (assignedServices.length === 0 || openDays === 0)) {
      const confirmed = confirm(
        t(
          "dashboardStaff.active.confirmIncomplete",
          "This staff member is missing assigned services or working hours. They may still not appear as bookable until both are complete. Show them anyway?",
        ),
      );
      if (!confirmed) {
        setActionLoadingKey(null);
        return;
      }
    }

    const { error } = await supabase
      .from("staff_members")
      .update({ active: !member.active })
      .eq("id", member.id);

    setActionLoadingKey(null);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      !member.active
        ? `${member.name} ${t("dashboardStaff.active.nowActive", "is now active for booking.")}`
        : `${member.name} ${t("dashboardStaff.active.nowHidden", "is hidden from new bookings. Existing bookings were not changed.")}`,
    );
    await loadPage();
  }

  function staffCanDoService(staffId: string, serviceId: string) {
    return staffServices.some(
      (link) =>
        link.staff_member_id === staffId && link.service_id === serviceId,
    );
  }

  function openDaysForStaff(staffId: string) {
    return staffAvailability.filter(
      (row) => row.staff_member_id === staffId && row.is_closed !== true,
    ).length;
  }

  async function futureBookingsForStaff(staffId: string) {
    const { count, error } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("staff_member_id", staffId)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", new Date().toISOString());

    if (error) throw error;
    return count || 0;
  }

  async function toggleStaffService(
    staffId: string,
    serviceId: string,
    currentlyAssigned?: boolean,
  ) {
    const exists = currentlyAssigned ?? staffCanDoService(staffId, serviceId);

    setActionLoadingKey(`service-${staffId}-${serviceId}`);
    setError(null);
    setSuccess(null);

    if (exists) {
      const { error } = await supabase
        .from("staff_services")
        .delete()
        .eq("staff_member_id", staffId)
        .eq("service_id", serviceId);

      setActionLoadingKey(null);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("staff_services").insert({
        staff_member_id: staffId,
        service_id: serviceId,
      });

      setActionLoadingKey(null);

      if (error) {
        setError(error.message);
        return;
      }
    }

    setSuccess(
      exists
        ? t(
            "dashboardStaff.assignments.removedSuccess",
            "Service removed from staff member.",
          )
        : t(
            "dashboardStaff.assignments.addedSuccess",
            "Service assigned to staff member.",
          ),
    );
    setStaffServices((current) =>
      exists
        ? current.filter(
            (link) =>
              !(
                link.staff_member_id === staffId &&
                link.service_id === serviceId
              ),
          )
        : [
            ...current,
            {
              staff_member_id: staffId,
              service_id: serviceId,
            },
          ],
    );
  }

  function readinessBadge(member: StaffMember) {
    const assignedServices = assignedServicesForStaff(member.id);
    const openDays = openDaysForStaff(member.id);
    const ready = member.active && assignedServices.length > 0 && openDays > 0;

    return (
      <span
        className="small"
        style={{
          background: ready ? "rgba(45,212,191,0.12)" : "rgba(255,190,11,0.12)",
          color: ready ? "var(--success)" : "var(--warning)",
          padding: "0.2rem 0.55rem",
          borderRadius: 999,
        }}
      >
        {ready
          ? t("dashboardStaff.readiness.bookable", "Bookable on Mirëbook")
          : t("dashboardStaff.readiness.setupNeeded", "Setup needed")}
      </span>
    );
  }

  return (
    <DashboardLayout
      title={t("dashboardLayout.nav.team", "Team")}
      subtitle={
        business
          ? business.name
          : t("dashboardStaff.teamSubtitle", "Create a business first.")
      }
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">
            {t("dashboardStaff.loading", "Loading Mirëbook staff setup...")}
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
          {generatedInviteUrl && (
            <label
              className="small muted"
              style={{ display: "grid", gap: "0.35rem", marginTop: "0.7rem" }}
            >
              {t("dashboardStaff.invite.secureLink", "Secure invite link")}
              <input
                type="text"
                value={generatedInviteUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                aria-label={t(
                  "dashboardStaff.invite.secureLink",
                  "Secure invite link",
                )}
              />
            </label>
          )}
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
          <h3>{t("dashboardStaff.noBusiness.title", "No business found")}</h3>
          <p className="muted">
            {t(
              "dashboardStaff.noBusiness.body",
              "Create a business profile first, then add staff.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "0.75rem" }}
          >
            {t("dashboardStaff.noBusiness.cta", "Create business")}
          </Link>
        </div>
      )}
      {!pageLoading && business && (
        <>
          {businesses.length > 1 && (
            <div
              className="card"
              style={{
                borderColor: "rgba(255,190,11,0.28)",
                marginBottom: "1rem",
              }}
            >
              <p className="small muted">
                {t(
                  "dashboardStaff.multiBusinessNotice",
                  "This account has more than one business. Mirëbook is using your primary business for this launch version. Contact support if this needs changing.",
                )}
              </p>
            </div>
          )}

          <div id="create-staff-panel">
            <CreateStaffCard
              loading={saving}
              formExpanded={formExpanded}
              name={name}
              roleTitle={roleTitle}
              email={email}
              phone={phone}
              imagePreviewUrl={imagePreviewUrl}
              uploadingImage={uploadingImage}
              setFormExpanded={setFormExpanded}
              setName={setName}
              setRoleTitle={setRoleTitle}
              setEmail={setEmail}
              setPhone={setPhone}
              onImageChange={handleCreateImageChange}
              clearImage={() => {
                setImageUrl("");
                setImageFile(null);
                setImagePreviewUrl("");
              }}
              resetForm={resetForm}
              addStaff={addStaff}
            />
          </div>

          {services.length === 0 && (
            <div
              className="card"
              style={{
                marginBottom: "1rem",
                borderColor: "rgba(255,190,11,0.35)",
              }}
            >
              <h3>{t("dashboardStaff.noServices.title", "No services yet")}</h3>
              <p className="muted">
                {t(
                  "dashboardStaff.noServices.body",
                  "Add services first, then assign staff to those services.",
                )}
              </p>
              <Link
                href="/dashboard/services"
                className="btn btn-accent"
                style={{ marginTop: "0.75rem" }}
              >
                {t("dashboardStaff.noServices.cta", "Add services")}
              </Link>
            </div>
          )}

          <div className="staff-card-list">
            {staff.length === 0 && (
              <IllustratedEmptyState
                variant="staff"
                title={t("dashboardStaff.empty.title", "No staff yet")}
                body={t(
                  "dashboardStaff.empty.body",
                  "Add your team members to manage appointments and keep services covered.",
                )}
                action={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={openCreateStaffForm}
                  >
                    <span className="empty-action-icon" aria-hidden="true">
                      +
                    </span>
                    {t(
                      "dashboardStaff.empty.cta",
                      "Add your first staff member",
                    )}
                  </button>
                }
              />
            )}

            {staff.map((member) => (
              <StaffProfileCard
                key={member.id}
                staff={member}
                currency={business.currency}
                locale={locale}
                services={services}
                assignedServiceIds={assignedServicesForStaff(member.id).map(
                  (service) => service.id,
                )}
                availabilityRows={staffAvailability}
                isEditing={editingStaffId === member.id}
                savingStaffId={savingStaffId}
                uploadingStaffId={uploadingStaffId}
                savingAssignmentKey={
                  actionLoadingKey?.startsWith(`service-${member.id}-`)
                    ? actionLoadingKey.replace(
                        `service-${member.id}-`,
                        `${member.id}:`,
                      )
                    : null
                }
                actionLoadingKey={actionLoadingKey}
                updateLocalStaff={updateLocalStaff}
                saveStaff={saveStaff}
                uploadStaffImage={uploadStaffImage}
                removeStaffImage={removeStaffImage}
                toggleStaffActive={toggleStaffActive}
                setEditingStaffId={setEditingStaffId}
                loadData={loadPage}
                toggleStaffService={toggleStaffService}
                resendStaffInvite={markStaffInvited}
                copyStaffInviteLink={copyStaffInviteLink}
                revokeStaffInvite={revokeStaffInvite}
                isCurrentUser={Boolean(
                  member.user_id && member.user_id === accountUserId,
                )}
              />
            ))}
          </div>
        </>
      )}
      <style jsx>{`
        .staff-card-list {
          display: grid;
          gap: 1rem;
        }
      `}</style>
    </DashboardLayout>
  );
}
