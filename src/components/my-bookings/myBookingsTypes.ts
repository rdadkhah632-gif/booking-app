export type Booking = {
  id: string;
  business_id?: string | null;
  customer_name: string;
  start_at: string;
  duration_minutes: number;
  status: string;
  departure_id?: string | null;
  party_size?: number | null;
  booking_option?: "appointment" | "shared" | "private" | null;
  unit_price?: number | null;
  total_price?: number | null;
  businesses?:
    | {
        name: string;
        currency?: string | null;
        timezone?: string | null;
      }
    | {
        name: string;
        currency?: string | null;
        timezone?: string | null;
      }[]
    | null;
  services?:
    | { name: string; price: number; booking_type?: string | null }
    | { name: string; price: number; booking_type?: string | null }[]
    | null;
  staff_members?:
    | { name: string; role_title?: string | null }
    | { name: string; role_title?: string | null }[]
    | null;
  service_departures?:
    | {
        id: string;
        meeting_point?: string | null;
        capacity: number;
        status: string;
        staff_members?:
          | {
              name: string;
              role_title?: string | null;
            }
          | {
              name: string;
              role_title?: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        meeting_point?: string | null;
        capacity: number;
        status: string;
        staff_members?:
          | {
              name: string;
              role_title?: string | null;
            }
          | {
              name: string;
              role_title?: string | null;
            }[]
          | null;
      }[]
    | null;
  completed_at?: string | null;
};

export type BookingRequest = {
  id: string;
  booking_id: string;
  status: string;
  requested_start_at: string;
  requested_duration_minutes: number;
  response_message?: string | null;
  created_at: string;
  requested_staff?:
    | {
        name: string;
        role_title?: string | null;
      }
    | {
        name: string;
        role_title?: string | null;
      }[]
    | null;
};

export type BookingMode = "pending" | "confirmed" | "history";
