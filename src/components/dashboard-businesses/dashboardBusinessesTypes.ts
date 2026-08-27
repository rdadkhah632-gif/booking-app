export type Business = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  address?: string | null;
  image_url?: string | null;
  published: boolean;
  auto_accept_bookings?: boolean;
  created_at?: string;
};

export type Service = {
  id: string;
  business_id: string;
  active: boolean;
  booking_type?: "appointment" | "group" | null;
  owner_review_required?: boolean | null;
};

export type StaffMember = {
  id: string;
  business_id: string;
  user_id?: string | null;
  email?: string | null;
  active: boolean;
};

export type StaffService = {
  id: string;
  staff_member_id: string;
  service_id: string;
};

export type AvailabilityRow = {
  id: string;
  business_id: string;
  is_closed?: boolean | null;
};

export type Readiness = {
  profileComplete: boolean;
  bookingReady: boolean;
  publicListingReady: boolean;
  hasActiveServices: boolean;
  hasActiveStaff: boolean;
  hasStaffServiceAssignments: boolean;
  hasWorkingHours: boolean;
  hasBookableAppointments: boolean;
  hasScheduledDepartures: boolean;
  hasBusinessImage: boolean;
  activeServices: number;
  activeStaff: number;
  bookableStaff: number;
  staffServiceAssignments: number;
  workingDays: number;
  scheduledDepartures: number;
  missingItems: string[];
  profileMissingItems: string[];
};

export type DashboardStats = {
  total: number;
  published: number;
  hidden: number;
  ready: number;
  incompletePublished: number;
};

export type UpdateBusinessField = (
  id: string,
  field: keyof Business,
  value: string | boolean,
) => void;
