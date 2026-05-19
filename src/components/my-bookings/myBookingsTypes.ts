export type Booking = {
  id: string
  business_id?: string | null
  customer_name: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: { name: string } | { name: string }[] | null
  services?: { name: string; price: number } | { name: string; price: number }[] | null
  staff_members?: { name: string; role_title?: string | null } | { name: string; role_title?: string | null }[] | null
  completed_at?: string | null
}

export type BookingRequest = {
  id: string
  booking_id: string
  status: string
  requested_start_at: string
  requested_duration_minutes: number
  response_message?: string | null
  created_at: string
  requested_staff?: {
    name: string
    role_title?: string | null
  } | {
    name: string
    role_title?: string | null
  }[] | null
}

export type BookingMode = 'pending' | 'confirmed' | 'history'