export type RangeFilter =
  | "today"
  | "tomorrow"
  | "week"
  | "upcoming"
  | "history"
  | "custom";

export type Business = {
  id: string;
  name: string;
  timezone?: string | null;
};

export type Booking = {
  id: string;
  business_id: string;
  staff_member_id?: string | null;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
  start_at: string;
  end_at?: string | null;
  duration_minutes: number;
  status: string;
  created_at?: string | null;
  services?: {
    name: string;
    price: number;
  } | null;
  staff_members?: {
    name: string;
    role_title?: string | null;
  } | null;
};

export type GroupedBookings = {
  dateKey: string;
  label: string;
  bookings: Booking[];
};

export type BookingSummary = {
  pendingCount: number;
  todayCount: number;
  upcomingConfirmedCount: number;
  historyCount: number;
  filteredCount: number;
};
