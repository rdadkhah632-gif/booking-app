export type Business = {
  id: string
  name: string
  published?: boolean | null
  currency?: string | null
}

export type StaffMember = {
  id: string
  business_id: string
  name: string
  role_title?: string | null
  email?: string | null
  phone?: string | null
  image_url?: string | null
  invite_status?: 'not_invited' | 'invited' | 'linked' | string | null
  permission_role?: 'staff' | 'manager' | 'reception' | string | null
  active: boolean
  user_id?: string | null
  created_at?: string | null
}

export type Service = {
  id: string
  business_id: string
  name: string
  active: boolean
  duration_minutes?: number | null
  price?: number | null
}

export type StaffService = {
  id?: string
  staff_member_id: string
  service_id: string
}

export type AvailabilityRow = {
  id: string
  staff_member_id?: string | null
  business_id?: string | null
  day_of_week?: number | null
  start_time?: string | null
  end_time?: string | null
  is_closed?: boolean | null
}

export type StaffStats = {
  total: number
  active: number
  inactive: number
  linkedAccounts: number
  withEmail: number
  assignedToServices: number
  unassignedToServices: number
  activeServices: number
}

export type UpdateStaffField = (
  id: string,
  field: keyof StaffMember,
  value: string | boolean
) => void
