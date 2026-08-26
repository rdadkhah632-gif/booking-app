export type Service = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  duration_minutes: number;
  price: number;
  active?: boolean | null;
  booking_type?: "appointment" | "group" | null;
  group_capacity?: number | null;
  private_booking_enabled?: boolean | null;
  private_price?: number | null;
};

export type StaffMember = {
  id: string;
  name: string;
  role_title?: string | null;
  image_url?: string | null;
  active?: boolean | null;
};

export type AvailabilityRow = {
  id?: string;
  day_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  is_closed?: boolean | null;
};

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
  auto_accept_bookings?: boolean | null;
  reschedule_policy?: string | null;
  cancellation_policy?: string | null;
  published?: boolean | null;
};

export type StaffService = {
  staff_member_id: string;
  service_id: string;
};

export type TimeSlot = {
  startAt: string;
  label: string;
  staffMemberId?: string | null;
};

export type PublicDeparture = {
  id: string;
  service_id: string;
  staff_member_id?: string | null;
  start_at: string;
  duration_minutes: number;
  capacity: number;
  remaining_seats: number;
  meeting_point?: string | null;
};
