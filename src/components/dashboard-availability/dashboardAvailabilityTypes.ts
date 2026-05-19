export type Business = {
  id: string
  name: string
  published?: boolean | null
}

export type AvailabilityRow = {
  id?: string
  business_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

export type AvailabilityStats = {
  openDays: number
  closedDays: number
  invalidDays: number
  totalHours: number
  ready: boolean
}