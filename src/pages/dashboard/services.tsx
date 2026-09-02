import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import IllustratedEmptyState from "@/components/dashboard/IllustratedEmptyState";
import { uploadMirebookImage } from "@/lib/imageUpload";
import CreateServiceCard from "@/components/dashboard-services/CreateServiceCard";
import PreparedServiceReviewGuide from "@/components/dashboard-services/PreparedServiceReviewGuide";
import ServiceCard from "@/components/dashboard-services/ServiceCard";
import {
  Business,
  Service,
  StaffMember,
  StaffService,
} from "@/components/dashboard-services/dashboardServicesTypes";
import { useI18n } from "@/lib/useI18n";
import { getRoleLoginHref } from "@/lib/auth/getRoleLoginHref";

export default function Services() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { businessId } = router.query;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [bookingType, setBookingType] = useState<"appointment" | "group">(
    "appointment",
  );
  const [groupCapacity, setGroupCapacity] = useState(12);
  const [privateBookingEnabled, setPrivateBookingEnabled] = useState(false);
  const [privatePrice, setPrivatePrice] = useState(0);
  const [departureCounts, setDepartureCounts] = useState<
    Record<string, number>
  >({});
  const [formExpanded, setFormExpanded] = useState(false);

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    setPageLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(getRoleLoginHref(router.asPath, "/dashboard/services"));
        return;
      }
      const query = new URLSearchParams();
      if (businessId && !Array.isArray(businessId)) {
        query.set("businessId", businessId);
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      let contextResponse: Response;
      try {
        contextResponse = await fetch(
          `/api/dashboard/services-context${query.size ? `?${query}` : ""}`,
          {
            cache: "no-store",
            headers: {
              Authorization: "Bearer " + session.access_token,
            },
            signal: controller.signal,
          },
        );
      } finally {
        window.clearTimeout(timeout);
      }

      const payload = (await contextResponse.json().catch(() => ({}))) as {
        error?: string;
        businesses?: Business[];
        business?: Business | null;
        services?: Service[];
        staffMembers?: StaffMember[];
        staffServices?: StaffService[];
        departureCounts?: Record<string, number>;
      };
      if (!contextResponse.ok) {
        throw new Error(payload.error || "services_context_failed");
      }

      setBusinesses(payload.businesses || []);
      setBusiness(payload.business || null);
      setServices(payload.services || []);
      setStaffMembers(payload.staffMembers || []);
      setStaffServices(payload.staffServices || []);
      setDepartureCounts(payload.departureCounts || {});
    } catch (err: any) {
      setError(
        err?.name === "AbortError"
          ? t(
              "dashboardServices.error.timeout",
              "Services are taking longer than expected. Try again.",
            )
          : t("dashboardServices.error.load", "Could not load services."),
      );
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadData();
  }, [router.isReady, businessId]);

  useEffect(() => {
    if (!router.isReady || router.query.onboarding !== "connected") return;

    setSuccess(
      t(
        "dashboardServices.assisted.connected",
        "Profile connected. Review the prepared services below before showing anything to customers.",
      ),
    );

    const nextQuery = { ...router.query };
    delete nextQuery.onboarding;
    void router.replace(
      { pathname: router.pathname, query: nextQuery },
      undefined,
      { shallow: true },
    );
  }, [router.isReady, router.query.onboarding]);

  function assignedStaffForService(serviceId: string) {
    return staffMembers.filter((staff) =>
      staffServices.some(
        (link) =>
          link.service_id === serviceId && link.staff_member_id === staff.id,
      ),
    );
  }

  function resetForm() {
    setName("");
    setDescription("");
    setImageUrl("");
    setImageFile(null);
    setImagePreviewUrl("");
    setDuration(30);
    setPrice(0);
    setBookingType("appointment");
    setGroupCapacity(12);
    setPrivateBookingEnabled(false);
    setPrivatePrice(0);
  }

  function openCreateServiceForm() {
    setFormExpanded(true);
    window.setTimeout(() => {
      document
        .getElementById("create-service-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function handleCreateImageChange(file: File | null) {
    setError(null);
    setImageFile(file);

    if (!file) {
      setImagePreviewUrl("");
      return;
    }

    setImagePreviewUrl(URL.createObjectURL(file));
    await uploadCreateImage(file);
  }

  async function uploadCreateImage(selectedFile: File | null = imageFile) {
    if (!selectedFile) {
      setError(
        t("dashboardServices.image.chooseFirst", "Choose an image file first."),
      );
      return null;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const uploaded = await uploadMirebookImage({
        file: selectedFile,
        folder: "services",
        recordId: business?.id || "new-service",
      });

      setImageUrl(uploaded.publicUrl);
      setImageFile(null);
      setImagePreviewUrl(uploaded.publicUrl);
      setSuccess(
        t("dashboardServices.image.uploaded", "Service image uploaded."),
      );
      return uploaded.publicUrl;
    } catch (err: any) {
      setError(
        err.message ||
          t("dashboardServices.image.uploadError", "Could not upload image."),
      );
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function uploadServiceImage(service: Service, file: File | null) {
    if (!file) return;

    setUploadingServiceId(service.id);
    setError(null);
    setSuccess(null);

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: "services",
        recordId: service.id,
      });

      const { error: updateError } = await supabase
        .from("services")
        .update({ image_url: uploaded.publicUrl })
        .eq("id", service.id);

      if (updateError) throw updateError;

      updateLocalService(service.id, "image_url", uploaded.publicUrl);
      setSuccess(
        `${service.name} ${t("dashboardServices.image.uploadedLower", "image uploaded.")}`,
      );
      await loadData();
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "dashboardServices.image.serviceUploadError",
            "Could not upload service image.",
          ),
      );
    } finally {
      setUploadingServiceId(null);
    }
  }

  async function removeServiceImage(service: Service) {
    const confirmed = confirm(
      t(
        "dashboardServices.image.confirmRemove",
        "Remove this service image from the public booking page?",
      ),
    );
    if (!confirmed) return;

    setUploadingServiceId(service.id);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("services")
      .update({ image_url: null })
      .eq("id", service.id);

    setUploadingServiceId(null);

    if (error) {
      setError(
        error.message.includes("service_booking_type_locked")
          ? t(
              "dashboardServices.error.bookingTypeLocked",
              "This service already has departure history. Keep it as a scheduled group service, or create a new appointment service.",
            )
          : error.message,
      );
      return;
    }

    updateLocalService(service.id, "image_url", "");
    setSuccess(
      `${service.name} ${t("dashboardServices.image.removedLower", "image removed.")}`,
    );
    await loadData();
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();

    if (!business) {
      setError(
        t("dashboardServices.error.chooseBusiness", "Choose a business first."),
      );
      return;
    }

    if (!name.trim()) {
      setError(
        t("dashboardServices.error.nameRequired", "Service name is required."),
      );
      return;
    }

    if (duration < 5) {
      setError(
        t(
          "dashboardServices.error.durationMin",
          "Service duration must be at least 5 minutes.",
        ),
      );
      return;
    }

    if (bookingType === "group" && (groupCapacity < 1 || groupCapacity > 200)) {
      setError(
        t(
          "dashboardServices.error.capacityRange",
          "Group capacity must be between 1 and 200.",
        ),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    let finalImageUrl = imageUrl.trim() || null;

    if (imageFile) {
      const uploadedUrl = await uploadCreateImage();
      if (!uploadedUrl) {
        setLoading(false);
        return;
      }
      finalImageUrl = uploadedUrl;
    }

    const { error } = await supabase.from("services").insert({
      business_id: business.id,
      name: name.trim(),
      description: description.trim() || null,
      image_url: finalImageUrl,
      duration_minutes: duration,
      price,
      active: true,
      booking_type: bookingType,
      group_capacity: bookingType === "group" ? groupCapacity : null,
      private_booking_enabled: bookingType === "group" && privateBookingEnabled,
      private_price:
        bookingType === "group" && privateBookingEnabled ? privatePrice : null,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    resetForm();
    setFormExpanded(false);
    setSuccess(
      bookingType === "group"
        ? t(
            "dashboardServices.group.created",
            "Group service added. Add its first departure so customers can reserve seats.",
          )
        : t(
            "dashboardServices.create.success",
            "Service added. Assign staff to this service so customers can book it on Mirëbook.",
          ),
    );

    await loadData();
    setLoading(false);
  }

  function updateLocalService(
    id: string,
    field: keyof Service,
    value: string | number | boolean,
  ) {
    setServices((prev) =>
      prev.map((service) =>
        service.id === id ? { ...service, [field]: value } : service,
      ),
    );
  }

  async function saveService(service: Service) {
    if (!service.name.trim()) {
      setError(
        t("dashboardServices.error.nameRequired", "Service name is required."),
      );
      return;
    }

    if (Number(service.duration_minutes) < 5) {
      setError(
        t(
          "dashboardServices.error.durationMin",
          "Service duration must be at least 5 minutes.",
        ),
      );
      return;
    }

    if (
      service.booking_type === "group" &&
      (Number(service.group_capacity) < 1 ||
        Number(service.group_capacity) > 200)
    ) {
      setError(
        t(
          "dashboardServices.error.capacityRange",
          "Group capacity must be between 1 and 200.",
        ),
      );
      return;
    }

    setSavingServiceId(service.id);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from("services")
      .update({
        name: service.name.trim(),
        description: service.description?.trim() || null,
        image_url: service.image_url?.trim() || null,
        duration_minutes: Number(service.duration_minutes),
        price: Number(service.price),
        active: service.active,
        booking_type: service.booking_type || "appointment",
        group_capacity:
          service.booking_type === "group"
            ? Number(service.group_capacity)
            : null,
        private_booking_enabled:
          service.booking_type === "group" &&
          Boolean(service.private_booking_enabled),
        private_price:
          service.booking_type === "group" && service.private_booking_enabled
            ? Number(service.private_price || 0)
            : null,
        owner_review_required: false,
      })
      .eq("id", service.id);

    setSavingServiceId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingServiceId(null);
    setSuccess(
      `${service.name} ${t("dashboardServices.save.savedLower", "saved.")}`,
    );
    await loadData();
  }

  async function toggleService(service: Service) {
    setError(null);
    setSuccess(null);

    const assignedStaff = assignedStaffForService(service.id);

    if (!service.active && service.owner_review_required) {
      setError(
        t(
          "dashboardServices.assisted.reviewBeforeShow",
          "Review and save this prepared service before showing it to customers.",
        ),
      );
      setEditingServiceId(service.id);
      return;
    }

    if (
      !service.active &&
      service.booking_type !== "group" &&
      assignedStaff.length === 0
    ) {
      const confirmed = confirm(
        t(
          "dashboardServices.toggle.confirmNoStaff",
          "This service has no staff assigned yet. Customers will not be able to book it properly until staff are assigned. Show it anyway?",
        ),
      );
      if (!confirmed) return;
    }

    const { error } = await supabase
      .from("services")
      .update({ active: !service.active })
      .eq("id", service.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      !service.active
        ? `${service.name} ${t("dashboardServices.toggle.visibleSuccess", "is now visible to customers.")}`
        : `${service.name} ${t("dashboardServices.toggle.hiddenSuccess", "is now hidden from customers.")}`,
    );
    await loadData();
  }

  function serviceBookable(service: Service) {
    if (service.booking_type === "group") {
      return service.active && (departureCounts[service.id] || 0) > 0;
    }
    return service.active && assignedStaffForService(service.id).length > 0;
  }
  function serviceReadinessText(service: Service) {
    if (service.owner_review_required) {
      return t(
        "dashboardServices.assisted.reviewHint",
        "Prepared for you. Check the duration, price and booking format, then save it.",
      );
    }
    if (service.booking_type === "group") {
      if (!service.active) {
        return t(
          "dashboardServices.group.hidden",
          "Hidden from customers. Show it when its departures are ready.",
        );
      }
      if ((departureCounts[service.id] || 0) === 0) {
        return t(
          "dashboardServices.group.needsDeparture",
          "Add an upcoming departure before customers can reserve seats.",
        );
      }
      return t(
        "dashboardServices.group.ready",
        "Customers can reserve seats on upcoming departures.",
      );
    }

    const assignedStaff = assignedStaffForService(service.id);

    if (!service.active && assignedStaff.length === 0) {
      return t(
        "dashboardServices.readiness.hiddenNoStaff",
        "Hidden and needs staff assignment before customers can book.",
      );
    }

    if (!service.active) {
      return t(
        "dashboardServices.readiness.hidden",
        "Hidden from customers. Show it when you are ready to take bookings.",
      );
    }

    if (assignedStaff.length === 0) {
      return t(
        "dashboardServices.readiness.visibleNoStaff",
        "Visible but not bookable yet because no staff are assigned.",
      );
    }

    return t(
      "dashboardServices.readiness.ready",
      "Ready for customers to book through Mirëbook.",
    );
  }

  function durationOptions() {
    return [15, 30, 45, 60, 75, 90, 120, 180, 240, 300, 360, 480, 600];
  }

  const preparedServices = services.filter(
    (service) => service.owner_review_required,
  );
  const preparedGroupCount = preparedServices.filter(
    (service) => service.booking_type === "group",
  ).length;
  const preparedAppointmentCount = preparedServices.length - preparedGroupCount;

  function reviewNextPreparedService() {
    const nextService = preparedServices[0];
    if (!nextService) return;

    setEditingServiceId(nextService.id);
    window.setTimeout(() => {
      document.getElementById(`service-${nextService.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  return (
    <DashboardLayout
      title={t("dashboardServices.pageTitle", "Services")}
      subtitle={
        business
          ? business.name
          : t("dashboardServices.pageSubtitle", "Create a business first.")
      }
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">
            {t("dashboardServices.loading", "Loading Mirëbook services...")}
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
          {!pageLoading && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void loadData()}
              style={{ marginTop: "0.75rem" }}
            >
              {t("common.retry", "Retry")}
            </button>
          )}
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>
            {t("dashboardServices.noBusiness.title", "No business found")}
          </h3>
          <p className="muted">
            {t(
              "dashboardServices.noBusiness.body",
              "Create a business profile first, then add Mirëbook services customers can book.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "0.75rem" }}
          >
            {t("dashboardServices.noBusiness.cta", "Create business")}
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
                  "dashboardServices.multiBusinessNotice",
                  "This account has more than one business. Mirëbook is using your primary business for this launch version. Contact support if this needs changing.",
                )}
              </p>
            </div>
          )}
          <PreparedServiceReviewGuide
            reviewCount={preparedServices.length}
            groupCount={preparedGroupCount}
            appointmentCount={preparedAppointmentCount}
            onReviewNext={reviewNextPreparedService}
          />
          {(services.length > 0 || formExpanded) && (
            <div id="create-service-panel">
              <CreateServiceCard
                formExpanded={formExpanded}
                loading={loading}
                uploadingImage={uploadingImage}
                name={name}
                description={description}
                imageUrl={imageUrl}
                imagePreviewUrl={imagePreviewUrl}
                imageFile={imageFile}
                duration={duration}
                price={price}
                bookingType={bookingType}
                groupCapacity={groupCapacity}
                privateBookingEnabled={privateBookingEnabled}
                privatePrice={privatePrice}
                businessCategory={business.category}
                currency={business.currency}
                durationOptions={durationOptions}
                setFormExpanded={setFormExpanded}
                setName={setName}
                setDescription={setDescription}
                setDuration={setDuration}
                setPrice={setPrice}
                setBookingType={setBookingType}
                setGroupCapacity={setGroupCapacity}
                setPrivateBookingEnabled={setPrivateBookingEnabled}
                setPrivatePrice={setPrivatePrice}
                handleCreateImageChange={handleCreateImageChange}
                clearCreateImage={() => {
                  setImageUrl("");
                  setImageFile(null);
                  setImagePreviewUrl("");
                }}
                resetForm={resetForm}
                addService={addService}
              />
            </div>
          )}

          <div className="services-list-grid">
            {services.length === 0 && !formExpanded && (
              <IllustratedEmptyState
                variant="services"
                title={t("dashboardServices.empty.title", "No services yet")}
                body={t(
                  "dashboardServices.empty.body",
                  "Add your first service so customers can see what you offer.",
                )}
                action={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={openCreateServiceForm}
                  >
                    <span className="empty-action-icon" aria-hidden="true">
                      +
                    </span>
                    {t("dashboardServices.empty.cta", "Add your first service")}
                  </button>
                }
              />
            )}

            {services.map((service) => (
              <ServiceCard
                key={service.id}
                business={business}
                locale={locale}
                service={service}
                assignedStaff={assignedStaffForService(service.id)}
                isEditing={editingServiceId === service.id}
                isBookable={serviceBookable(service)}
                departureCount={departureCounts[service.id] || 0}
                savingServiceId={savingServiceId}
                uploadingServiceId={uploadingServiceId}
                durationOptions={durationOptions}
                serviceReadinessText={serviceReadinessText}
                updateLocalService={updateLocalService}
                saveService={saveService}
                toggleService={toggleService}
                setEditingServiceId={setEditingServiceId}
                loadData={loadData}
                uploadServiceImage={uploadServiceImage}
                removeServiceImage={removeServiceImage}
              />
            ))}
          </div>
        </>
      )}
      <style jsx>{`
        .services-list-grid {
          display: grid;
          gap: 1rem;
        }
      `}</style>
    </DashboardLayout>
  );
}
