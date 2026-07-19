export type Business = {
  resultType?: 'business'
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
  location?: {
    latitude: number
    longitude: number
    precision: string
  } | null
  distanceMeters?: number | null
  services?: {
    id: string
    active: boolean
    staff_services?: { staff_member_id: string }[] | null
  }[] | null
  staff_members?: { id: string; active: boolean }[] | null
  availability?: { id: string; is_closed?: boolean | null }[] | null
}

export type DirectoryCategoryKey =
  | 'beauty_grooming'
  | 'dental_health'
  | 'wellness_fitness'
  | 'events'
  | 'learning_lessons'
  | 'tours_activities'
  | 'rentals'
  | 'attractions'
  | 'food_drink'
  | 'lodging'

export type DirectoryPlace = {
  id: string
  resultType: 'directory_place'
  name: string
  categoryKey: DirectoryCategoryKey
  description?: string | null
  address?: string | null
  city?: string | null
  region?: string | null
  countryCode: string
  postcode?: string | null
  phone?: string | null
  website?: string | null
  location: {
    latitude: number
    longitude: number
    precision: string
  }
  distanceMeters?: number | null
  bookable: false
  claimable: boolean
  linkedBusinessId?: string | null
  attribution: {
    label: string
    url?: string | null
  }
}

export type DiscoveryMapItem = {
  id: string
  resultType: 'business' | 'directory_place'
  name: string
  category: string
  locationLabel: string
  latitude: number
  longitude: number
  distanceMeters?: number | null
  href?: string | null
}

export type BusinessCardStats = {
  activeServices: number
  activeStaff: number
  openDays: number
  assignedServices: number
  missing: string[]
  bookable: boolean
}

export type MarketplaceStats = {
  businesses: number
  places: number
  cities: number
  categories: number
  visible: number
}

export type SortOption = 'newest' | 'distance' | 'name' | 'city' | 'services'

export type ExploreView = 'list' | 'map'
