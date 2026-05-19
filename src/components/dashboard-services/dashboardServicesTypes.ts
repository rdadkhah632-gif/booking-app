export type Business = {
  id: string
  name: string
  published?: boolean | null
}

export type Service = {
  id: string
  business_id: string
  name: string
  description?: string | null
  duration_minutes: number
  price: number
  image_url?: string | null
  active: boolean
}

export type StaffService = {
  staff_member_id: string
  service_id: string
}

export type StaffMember = {
  id: string
  business_id: string
  name: string
  role_title?: string | null
  active: boolean
}

export type ServiceStats = {
  total: number
  active: number
  inactive: number
  assigned: number
  unassigned: number
  averagePrice: number
  averageDuration: number
  bookable: number
  withImages: number
  totalValue: number
}