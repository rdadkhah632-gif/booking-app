export type Business = {
  id: string
  name: string
  published?: boolean | null
  auto_accept_bookings?: boolean | null
  booking_interval_minutes?: number | null
  min_notice_minutes?: number | null
  max_advance_days?: number | null
  buffer_before_minutes?: number | null
  buffer_after_minutes?: number | null
  cancellation_policy?: string | null
  reschedule_policy?: string | null
  timezone?: string | null
  currency?: string | null
}

export type UpdateBusinessSetting = <K extends keyof Business>(
  key: K,
  value: Business[K]
) => void