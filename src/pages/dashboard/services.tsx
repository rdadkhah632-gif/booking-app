import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import IllustratedEmptyState from "@/components/dashboard/IllustratedEmptyState";
import { uploadMirebookImage } from "@/lib/imageUpload";
import CreateServiceCard from "@/components/dashboard-services/CreateServiceCard";
import ServiceCard from "@/components/dashboard-services/ServiceCard";
import {
  Business,
  Service,
  StaffMember,
  StaffService,
} from "@/components/dashboard-services/dashboardServicesTypes";
import { useI18n } from "@/lib/useI18n";

export default function Services() {
  const router = useRouter();
  const { t } = useI18n();
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
            "dashboardServices.error.noAccess",
            "You do not have access to this business.",
          ),
        );
      }

      return selected;
    }

    return owned[0];
  }

  async function loadData() {
    setError(null);
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
        setServices([]);
        setStaffMembers([]);
        setStaffServices([]);
        setPageLoading(false);
        return;
      }

      setBusiness(selectedBusiness);

      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", selectedBusiness.id)
        .order("created_at", { ascending: false });

      if (serviceError) throw serviceError;

      setServices(serviceData || []);

      const { data: staffData, error: staffError } = await supabase
        .from("staff_members")
        .select("id, business_id, name, role_title, active")
        .eq("business_id", selectedBusiness.id)
        .order("created_at", { ascending: false });

      if (staffError) throw staffError;

      setStaffMembers(staffData || []);

      const staffIds = (staffData || []).map((staff) => staff.id);

      if (staffIds.length > 0) {
        const { data: staffServiceData, error: staffServiceError } =
          await supabase
            .from("staff_services")
            .select("staff_member_id, service_id")
            .in("staff_member_id", staffIds);

        if (staffServiceError) throw staffServiceError;

        setStaffServices(staffServiceData || []);
      } else {
        setStaffServices([]);
      }

      setPageLoading(false);
    } catch (err: any) {
      setError(
        err.message ||
          t("dashboardServices.error.load", "Could not load services."),
      );
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadData();
  }, [router.isReady, businessId]);

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
  }

  function openCreateServiceForm() {
    setFormExpanded(true);
    document
      .getElementById("create-service-panel")
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
        t("dashboardServices.image.chooseFirst", "Choose an image file first."),
      );
      return null;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const uploaded = await uploadMirebookImage({
        file: imageFile,
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
      setError(error.message);
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
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    resetForm();
    setFormExpanded(false);
    setSuccess(
      t(
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

    if (!service.active && assignedStaff.length === 0) {
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
    return service.active && assignedStaffForService(service.id).length > 0;
  }
  function serviceReadinessText(service: Service) {
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
    return [15, 30, 45, 60, 75, 90, 120];
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
              durationOptions={durationOptions}
              setFormExpanded={setFormExpanded}
              setName={setName}
              setDescription={setDescription}
              setDuration={setDuration}
              setPrice={setPrice}
              handleCreateImageChange={handleCreateImageChange}
              uploadCreateImage={uploadCreateImage}
              clearCreateImage={() => {
                setImageUrl("");
                setImageFile(null);
                setImagePreviewUrl("");
              }}
              resetForm={resetForm}
              addService={addService}
            />
          </div>

          <div className="services-list-grid">
            {services.length === 0 && (
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
                service={service}
                assignedStaff={assignedStaffForService(service.id)}
                isEditing={editingServiceId === service.id}
                isBookable={serviceBookable(service)}
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
