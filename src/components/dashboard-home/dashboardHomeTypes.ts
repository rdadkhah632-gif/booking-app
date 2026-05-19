export type Business = {
  id: string
  name: string
  published: boolean
  category?: string | null
  city?: string | null
}

export type Booking = {
  id: string
  business_id: string
  customer_name: string
  start_at: string
  duration_minutes: number
  service_id?: string | null
  status: string
  created_at?: string
  businesses?: {
    name: string
  } | null
  services?: {
    id?: string
    name: string
    price?: number | null
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

export type BookingRequest = {
  id: string
  booking_id: string
  business_id: string
  status: string
  created_at: string
}

export type Service = {
  id: string
  business_id: string
  active: boolean
}

export type StaffMember = {
  id: string
  business_id: string
  active: boolean
}

export type AvailabilityRow = {
  id: string
  business_id: string
  is_closed?: boolean | null
}

export type ScheduleDay = {
  date: Date
  dateString: string
  label: string
  shortLabel: string
  bookings: Booking[]
}

export type SetupWarning = {
  title: string
  body: string
  href: string
  cta: string
}

export type DashboardAnalytics = {
  recentBookings: Booking[]
  recentCompleted: Booking[]
  recentConfirmed: Booking[]
  recentCancelled: Booking[]
  estimatedRevenue: number
  estimatedUpcomingValue: number
  topServices: {
    name: string
    count: number
    value: number
  }[]
  averageBookingValue: number
}