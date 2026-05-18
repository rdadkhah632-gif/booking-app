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
  auto_accept_bookings?: boolean | null
  published?: boolean | null
  created_at?: string | null
  services?: { id: string; active: boolean }[] | null
  staff_members?: { id: string; active: boolean }[] | null
  availability?: { id: string; is_closed?: boolean | null }[] | null
}

export type BusinessCardStats = {
  activeServices: number
  activeStaff: number
  openDays: number
  missing: string[]
  bookable: boolean
}

export type MarketplaceStats = {
  businesses: number
  cities: number
  categories: number
  visible: number
}

export type SortOption = 'newest' | 'name' | 'city' | 'services'