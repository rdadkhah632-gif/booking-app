export type RelatedBusiness = {
  name: string
}

export type RelatedService = {
  name: string
  price?: number | null
}

export type RelatedStaff = {
  name: string
  role_title?: string | null
}

export type RequestBooking = {
  customer_name?: string | null
  start_at?: string | null
  duration_minutes?: number | null
  status?: string | null
  businesses?: RelatedBusiness | RelatedBusiness[] | null
  services?: RelatedService | RelatedService[] | null
  staff_members?: RelatedStaff | RelatedStaff[] | null
}

export type BookingRequest = {
  id: string
  booking_id: string
  status: string
  requested_start_at: string
  requested_duration_minutes: number
  response_message?: string | null
  created_at: string
  updated_at?: string | null
  bookings?: RequestBooking | RequestBooking[] | null
  requested_staff?: RelatedStaff | RelatedStaff[] | null
}

export type Booking = {
  id: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: RelatedBusiness | RelatedBusiness[] | null
  services?: RelatedService | RelatedService[] | null
  staff_members?: RelatedStaff | RelatedStaff[] | null
}

export type NotificationRow = {
  id: string
  user_id?: string | null
  business_id?: string | null
  booking_id?: string | null
  booking_request_id?: string | null
  audience: string
  type: string
  title: string
  message?: string | null
  action_url?: string | null
  read_at?: string | null
  created_at?: string | null
}