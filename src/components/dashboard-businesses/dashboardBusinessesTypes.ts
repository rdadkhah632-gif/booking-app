export type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  image_url?: string | null
  published: boolean
  auto_accept_bookings?: boolean
  created_at?: string
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

export type StaffService = {
  id: string
  staff_member_id: string
  service_id: string
}

export type AvailabilityRow = {
  id: string
  business_id: string
  is_closed?: boolean | null
}

export type Readiness = {
  profileComplete: boolean
  hasActiveServices: boolean
  hasActiveStaff: boolean
  hasStaffServiceAssignments: boolean
  hasWorkingHours: boolean
  hasBusinessImage: boolean
  readyToPublish: boolean
  activeServices: number
  activeStaff: number
  staffServiceAssignments: number
  workingDays: number
  missingItems: string[]
}

export type DashboardStats = {
  total: number
  published: number
  hidden: number
  ready: number
  incompletePublished: number
}

export type UpdateBusinessField = (
  id: string,
  field: keyof Business,
  value: string | boolean
) => void