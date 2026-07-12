import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import DashboardLayout from "@/components/DashboardLayout";
import { getAccountCapabilities } from "@/lib/accountCapabilities";
import { useI18n } from "@/lib/useI18n";
import CustomerHistoryView from "@/components/dashboard-customers/CustomerHistoryView";

type Business = {
  id: string;
  name: string;
};

type Booking = {
  id: string;
  business_id: string;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
  services?: {
    name: string;
    price?: number | null;
  } | null;
  staff_members?: {
    name: string;
    role_title?: string | null;
  } | null;
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { customerId, businessId } = router.query;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null,
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomer() {
    if (!customerId || Array.isArray(customerId)) return;

    setPageLoading(true);
    setError(null);

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        customerId,
      )
    ) {
      setError(
        t(
          "dashboardCustomers.error.invalidCustomer",
          "This customer link is not valid. Return to Calendar and open the appointment again.",
        ),
      );
      setPageLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const capabilities = await getAccountCapabilities(
        session.user.id,
        session.user.email,
      );

      if (!capabilities.canUseBusiness) {
        router.replace(capabilities.defaultRoute);
        return;
      }

      const { data: ownedBusinesses, error: businessesError } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (businessesError) throw businessesError;

      const owned = ownedBusinesses || [];
      setBusinesses(owned);

      if (owned.length === 0) {
        setBookings([]);
        setSelectedBusiness(null);
        setPageLoading(false);
        return;
      }

      let businessScope = owned;

      if (businessId && !Array.isArray(businessId)) {
        const selected = owned.find((business) => business.id === businessId);

        if (!selected) {
          throw new Error("You do not have access to this business.");
        }

        setSelectedBusiness(selected);
        businessScope = [selected];
      } else if (owned.length === 1) {
        setSelectedBusiness(owned[0]);
        businessScope = [owned[0]];
      } else {
        setSelectedBusiness(null);
      }

      const businessIds = businessScope.map((business) => business.id);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
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
        .eq("customer_user_id", customerId)
        .in("business_id", businessIds)
        .order("start_at", { ascending: false });

      if (bookingError) throw bookingError;

      const normalisedBookings = (bookingData || []).map((booking: any) => ({
        ...booking,
        services: Array.isArray(booking.services)
          ? booking.services[0] || null
          : booking.services,
        staff_members: Array.isArray(booking.staff_members)
          ? booking.staff_members[0] || null
          : booking.staff_members,
      }));

      setBookings(normalisedBookings);
      setPageLoading(false);
    } catch (err: any) {
      setError(err.message || "Could not load customer details.");
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    loadCustomer();
  }, [router.isReady, customerId, businessId]);

  const customer = useMemo(() => {
    const latest = bookings[0];

    return {
      name: latest?.customer_name || "Customer",
      email: latest?.customer_email || "",
      phone: latest?.customer_phone || "",
    };
  }, [bookings]);

  return (
    <DashboardLayout
      title={t("dashboardCustomers.page.title", "Customer")}
      subtitle={
        selectedBusiness
          ? t(
              "dashboardCustomers.page.subtitleBusiness",
              "Appointments for this business.",
            )
          : t(
              "dashboardCustomers.page.subtitle",
              "Appointments across your business profiles.",
            )
      }
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">
            {t("dashboardCustomers.loading", "Loading customer...")}
          </p>
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
            {t("dashboardCustomers.empty.noBusinessTitle", "No business")}
          </h3>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "dashboardCustomers.empty.noBusinessBody",
              "Create a business before viewing customer history.",
            )}
          </p>
          <Link
            href="/dashboard/businesses"
            className="btn btn-accent"
            style={{ marginTop: "1rem" }}
          >
            {t("dashboardCustomers.actions.setup", "Setup")}
          </Link>
        </div>
      )}

      {!pageLoading && bookings.length === 0 && businesses.length > 0 && (
        <div className="card">
          <h3>
            {t(
              "dashboardCustomers.empty.noHistoryTitle",
              "No customer history",
            )}
          </h3>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {t(
              "dashboardCustomers.empty.noHistoryBody",
              "No appointments were found for this customer in the selected business.",
            )}
          </p>
          <Link
            href="/dashboard/bookings"
            className="btn btn-accent"
            style={{ marginTop: "1rem" }}
          >
            {t("dashboardBookings.businessPicker.cta", "Open calendar")}
          </Link>
        </div>
      )}

      {!pageLoading && bookings.length > 0 && (
        <CustomerHistoryView
          customer={customer}
          bookings={bookings}
          selectedBusiness={selectedBusiness}
          matchMode="account"
        />
      )}
    </DashboardLayout>
  );
}
