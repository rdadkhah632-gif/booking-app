import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import {
  BILLING_STATUSES,
  BillingState,
  BillingStatus,
  defaultBillingState,
  formatBillingAmount
} from '@/lib/billing'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

type AdminProfile = {
  id: string
  email?: string | null
  is_admin?: boolean | null
}

type OwnerProfile = {
  id: string
  email?: string | null
  full_name?: string | null
  phone?: string | null
  role?: string | null
  is_admin?: boolean | null
}

type BusinessRow = {
  id: string
  user_id?: string | null
  name: string
  description?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  category?: string | null
  published?: boolean | null
  created_at?: string | null
  billing_email?: string | null
  auto_accept_bookings?: boolean | null
  booking_interval_minutes?: number | null
  min_notice_minutes?: number | null
  max_advance_days?: number | null
  buffer_before_minutes?: number | null
  buffer_after_minutes?: number | null
  timezone?: string | null
  currency?: string | null
}

type BusinessWithOwner = BusinessRow & {
  owner?: OwnerProfile | null
}

type BusinessCounts = {
  services: number
  activeServices: number
  staff: number
  activeStaff: number
  staffServiceAssignments: number
  bookings: number
  pendingBookings: number
}

type AdminBillingState = BillingState & {
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  notes?: string | null
}

type BillingDraft = {
  billingStatus: BillingStatus
  priceMajor: string
  currency: string
  trialStart: string
  trialEnd: string
  foundingBusiness: boolean
  secondMonthFreeEligible: boolean
  notes: string
  changeReason: string
}

type FoundingOfferReviewStatus =
  | 'pending'
  | 'needs_review'
  | 'potentially_eligible'
  | 'approved'
  | 'declined'

type FoundingOfferMetrics = {
  windowStart: string
  windowEnd: string
  totalBookings: number
  pendingBookings: number
  confirmedBookings: number
  completedBookings: number
  cancelledBookings: number
  declinedBookings: number
  qualifyingBookings: number
  uniqueCustomers: number
  qualifyingUniqueCustomers: number
  verifiedCustomers: number
  unverifiedCustomers: number
  unknownVerificationCustomers: number
  concentratedActivity: boolean
  guidance:
    | 'not_founding'
    | 'potentially_eligible'
    | 'needs_manual_review'
    | 'needs_more_activity'
}

type FoundingOfferReview = {
  business_id: string
  review_status: FoundingOfferReviewStatus
  reviewed_at?: string | null
  reviewed_by?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type FoundingOfferState = {
  metrics: FoundingOfferMetrics
  review: FoundingOfferReview | null
  reviewSchemaAvailable: boolean
  sqlRequired?: string | null
}

const FOUNDING_REVIEW_STATUSES: FoundingOfferReviewStatus[] = [
  'pending',
  'needs_review',
  'potentially_eligible',
  'approved',
  'declined'
]

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function billingDraftFromState(billing: AdminBillingState): BillingDraft {
  return {
    billingStatus: billing.billing_status,
    priceMajor:
      billing.price_amount === null ? '' : (billing.price_amount / 100).toFixed(2),
    currency: billing.currency || 'GBP',
    trialStart: dateInputValue(billing.trial_start),
    trialEnd: dateInputValue(billing.trial_end),
    foundingBusiness: billing.founding_business,
    secondMonthFreeEligible: billing.second_month_free_eligible,
    notes: billing.notes || '',
    changeReason: ''
  }
}

function ownerEmail(business: BusinessWithOwner) {
  return business.owner?.email || 'No owner email'
}

function ownerName(business: BusinessWithOwner) {
  return business.owner?.full_name || 'No owner name'
}

function ownerId(business: BusinessWithOwner) {
  return business.owner?.id || business.user_id || ''
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString()
}

function statusLabel(value?: string | null) {
  if (!value) return 'Not configured'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function daysUntil(value?: string | null) {
  if (!value) return null
  const target = new Date(value).getTime()
  const now = new Date().getTime()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export default function AdminBusinessesPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [businesses, setBusinesses] = useState<BusinessWithOwner[]>([])
  const [billingByBusiness, setBillingByBusiness] = useState<Record<string, BillingState>>({})
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithOwner | null>(null)
  const [countsByBusiness, setCountsByBusiness] = useState<Record<string, BusinessCounts>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [publishedFilter, setPublishedFilter] = useState('all')
  const [attentionFilter, setAttentionFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingSaving, setBillingSaving] = useState(false)
  const [adminBilling, setAdminBilling] = useState<AdminBillingState | null>(null)
  const [billingDraft, setBillingDraft] = useState<BillingDraft | null>(null)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [foundingOffer, setFoundingOffer] = useState<FoundingOfferState | null>(null)
  const [foundingOfferLoading, setFoundingOfferLoading] = useState(false)
  const [foundingOfferSaving, setFoundingOfferSaving] = useState(false)
  const [foundingOfferError, setFoundingOfferError] = useState<string | null>(null)
  const [foundingReviewStatus, setFoundingReviewStatus] =
    useState<FoundingOfferReviewStatus>('pending')
  const [foundingReviewNotes, setFoundingReviewNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function getCounts(businessId?: string | null) {
    if (!businessId) {
      return {
        services: 0,
        activeServices: 0,
        staff: 0,
        activeStaff: 0,
        staffServiceAssignments: 0,
        bookings: 0,
        pendingBookings: 0
      }
    }

    return countsByBusiness[businessId] || {
      services: 0,
      activeServices: 0,
      staff: 0,
      activeStaff: 0,
      staffServiceAssignments: 0,
      bookings: 0,
      pendingBookings: 0
    }
  }

  function readinessIssues(business: BusinessWithOwner) {
    const counts = getCounts(business.id)
    const issues: string[] = []

    if (!business.name?.trim()) issues.push('business name')
    if (!business.category?.trim()) issues.push('category')
    if (!business.city?.trim() && !business.address?.trim()) issues.push('location')
    if (counts.activeServices === 0) issues.push('active service')
    if (counts.activeStaff === 0) issues.push('active staff')
    if (counts.staffServiceAssignments === 0) issues.push('staff-service assignment')

    return issues
  }

  function getBillingState(businessId?: string | null) {
    if (!businessId) return defaultBillingState('')
    return billingByBusiness[businessId] || defaultBillingState(businessId)
  }

  function needsAttention(business: BusinessWithOwner) {
    const counts = getCounts(business.id)
    const billing = getBillingState(business.id)
    const trialDays = daysUntil(billing.trial_end)

    return (
      readinessIssues(business).length > 0 ||
      counts.pendingBookings > 0 ||
      ['past_due', 'paused', 'cancelled'].includes(billing.billing_status) ||
      (billing.billing_status === 'free_trial' && trialDays !== null && trialDays <= 7)
    )
  }

  const filteredBusinesses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return businesses.filter((business) => {
      const counts = getCounts(business.id)
      const matchesSearch = !term || [
        business.name,
        business.city,
        business.country,
        business.category,
        business.billing_email,
        business.phone,
        ownerEmail(business),
        ownerName(business)
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))

      const matchesStatus =
        statusFilter === 'all' ||
        getBillingState(business.id).billing_status === statusFilter

      const matchesPublished =
        publishedFilter === 'all' ||
        (publishedFilter === 'published' && business.published) ||
        (publishedFilter === 'draft' && !business.published)

      const matchesAttention =
        attentionFilter === 'all' ||
        (attentionFilter === 'attention' && needsAttention(business)) ||
        (attentionFilter === 'ready' && readinessIssues(business).length === 0) ||
        (attentionFilter === 'pending' && counts.pendingBookings > 0) ||
        (attentionFilter === 'trial_ending' &&
          getBillingState(business.id).billing_status === 'free_trial' &&
          daysUntil(getBillingState(business.id).trial_end) !== null &&
          Number(daysUntil(getBillingState(business.id).trial_end)) <= 7)

      return matchesSearch && matchesStatus && matchesPublished && matchesAttention
    })
  }, [businesses, billingByBusiness, countsByBusiness, searchTerm, statusFilter, publishedFilter, attentionFilter])

  const visibleBusinesses = filteredBusinesses.slice(0, 75)

  const summary = useMemo(() => {
    return {
      total: businesses.length,
      published: businesses.filter((business) => business.published).length,
      active: businesses.filter((business) =>
        ['active', 'manual_comped'].includes(getBillingState(business.id).billing_status)
      ).length,
      trial: businesses.filter((business) =>
        ['free_trial', 'founding_free'].includes(getBillingState(business.id).billing_status)
      ).length,
      paymentAttention: businesses.filter((business) =>
        ['past_due', 'cancelled', 'paused'].includes(getBillingState(business.id).billing_status)
      ).length,
      attention: businesses.filter((business) => needsAttention(business)).length,
      monthlyValue: businesses.reduce((total, business) => {
        const billing = getBillingState(business.id)
        if (billing.billing_status !== 'active') return total
        return total + Number(billing.price_amount || 0)
      }, 0)
    }
  }, [businesses, billingByBusiness, countsByBusiness])

  async function loadAdminBusinesses() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/admin/businesses')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, is_admin')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError

      if (!profileData?.is_admin) {
        setAdminProfile(profileData as AdminProfile)
        setBusinesses([])
        setBillingByBusiness({})
        setSelectedBusiness(null)
        setLoading(false)
        return
      }

      setAdminProfile(profileData as AdminProfile)

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select(`
          id,
          user_id,
          name,
          description,
          phone,
          address,
          city,
          country,
          category,
          published,
          created_at,
          billing_email,
          auto_accept_bookings,
          booking_interval_minutes,
          min_notice_minutes,
          max_advance_days,
          buffer_before_minutes,
          buffer_after_minutes,
          timezone,
          currency
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (businessError) throw businessError

      const rawBusinesses = (businessData || []) as BusinessRow[]
      const ownerIds = Array.from(new Set(rawBusinesses.map((business) => business.user_id).filter(Boolean))) as string[]

      let ownerMap: Record<string, OwnerProfile> = {}

      if (ownerIds.length > 0) {
        const { data: ownerData, error: ownerError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone, role, is_admin')
          .in('id', ownerIds)

        if (ownerError) throw ownerError

        ownerMap = (ownerData || []).reduce((map: Record<string, OwnerProfile>, profile: OwnerProfile) => {
          map[profile.id] = profile
          return map
        }, {})
      }

      const rows = rawBusinesses.map((business) => ({
        ...business,
        owner: business.user_id ? ownerMap[business.user_id] || null : null
      }))

      setBusinesses(rows)

      const businessIds = rows.map((business) => business.id)

      await Promise.all([
        loadCounts(businessIds),
        loadBillingState(businessIds)
      ])

      const queryBusinessId = typeof router.query.businessId === 'string' ? router.query.businessId : ''
      const nextSelected =
        rows.find((business) => business.id === queryBusinessId) ||
        rows[0] ||
        null

      if (nextSelected) {
        setSelectedBusinessId(nextSelected.id)
        setSelectedBusiness(nextSelected)
      } else {
        setSelectedBusinessId('')
        setSelectedBusiness(null)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load admin businesses.')
      setLoading(false)
    }
  }

  async function loadCounts(businessIds: string[]) {
    if (businessIds.length === 0) {
      setCountsByBusiness({})
      return
    }

    const nextCounts: Record<string, BusinessCounts> = {}

    businessIds.forEach((businessId) => {
      nextCounts[businessId] = {
        services: 0,
        activeServices: 0,
        staff: 0,
        activeStaff: 0,
        staffServiceAssignments: 0,
        bookings: 0,
        pendingBookings: 0
      }
    })

    const { data: serviceData } = await supabase
      .from('services')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, business_id, active')
      .in('business_id', businessIds)

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, business_id, status')
      .in('business_id', businessIds)

    const staffIds = (staffData || []).map((row: any) => row.id).filter(Boolean)

    const { data: staffServiceData } = staffIds.length > 0
      ? await supabase
          .from('staff_services')
          .select('id, staff_member_id')
          .in('staff_member_id', staffIds)
      : { data: [] as any[] }

    const staffBusinessMap = (staffData || []).reduce((map: Record<string, string>, row: any) => {
      if (row.id && row.business_id) map[row.id] = row.business_id
      return map
    }, {})

    ;(serviceData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].services += 1
        if (row.active) nextCounts[row.business_id].activeServices += 1
      }
    })

    ;(staffData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].staff += 1
        if (row.active) nextCounts[row.business_id].activeStaff += 1
      }
    })

    ;(bookingData || []).forEach((row: any) => {
      if (row.business_id && nextCounts[row.business_id]) {
        nextCounts[row.business_id].bookings += 1
        if (['pending', 'requested', 'awaiting_approval'].includes(String(row.status || '').toLowerCase())) {
          nextCounts[row.business_id].pendingBookings += 1
        }
      }
    })

    ;(staffServiceData || []).forEach((row: any) => {
      const businessId = staffBusinessMap[row.staff_member_id]
      if (businessId && nextCounts[businessId]) {
        nextCounts[businessId].staffServiceAssignments += 1
      }
    })

    setCountsByBusiness(nextCounts)
  }

  async function loadBillingState(businessIds: string[]) {
    if (businessIds.length === 0) {
      setBillingByBusiness({})
      return
    }

    const { data, error: billingError } = await supabase
      .from('business_billing')
      .select(`
        id,
        business_id,
        billing_status,
        plan_name,
        price_amount,
        currency,
        trial_start,
        trial_end,
        founding_business,
        second_month_free_eligible,
        current_period_end,
        created_at,
        updated_at
      `)
      .in('business_id', businessIds)

    if (billingError) throw billingError

    const nextBilling = ((data || []) as BillingState[]).reduce(
      (map: Record<string, BillingState>, billing) => {
        map[billing.business_id] = billing
        return map
      },
      {}
    )

    setBillingByBusiness(nextBilling)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadAdminBusinesses()
  }, [router.isReady])

  useEffect(() => {
    if (!adminProfile?.is_admin || !selectedBusinessId) return
    loadAdminBilling(selectedBusinessId)
    loadFoundingOffer(selectedBusinessId)
  }, [adminProfile?.is_admin, selectedBusinessId])

  async function loadAdminBilling(businessId: string) {
    setBillingLoading(true)
    setBillingError(null)
    setAdminBilling(null)
    setBillingDraft(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/login?redirectTo=/admin/businesses')
        return
      }

      const response = await fetch(
        `/api/admin/business-billing?businessId=${encodeURIComponent(businessId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('admin.businesses.billing.loadError', 'Could not load private billing controls.'))
      }

      const billing = (result.billing || defaultBillingState(businessId)) as AdminBillingState
      setAdminBilling(billing)
      setBillingDraft(billingDraftFromState(billing))
    } catch (err: any) {
      setBillingError(
        err.message ||
          t('admin.businesses.billing.loadError', 'Could not load private billing controls.')
      )
    } finally {
      setBillingLoading(false)
    }
  }

  async function loadFoundingOffer(businessId: string) {
    setFoundingOfferLoading(true)
    setFoundingOfferError(null)
    setFoundingOffer(null)
    setFoundingReviewStatus('pending')
    setFoundingReviewNotes('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/login?redirectTo=/admin/businesses')
        return
      }

      const response = await fetch(
        `/api/admin/founding-offer?businessId=${encodeURIComponent(businessId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
            t(
              'admin.businesses.founding.loadError',
              'Could not load founding offer tracking.'
            )
        )
      }

      const nextState = result as FoundingOfferState
      setFoundingOffer(nextState)
      setFoundingReviewStatus(nextState.review?.review_status || 'pending')
      setFoundingReviewNotes(nextState.review?.notes || '')
    } catch (err: any) {
      setFoundingOfferError(
        err.message ||
          t(
            'admin.businesses.founding.loadError',
            'Could not load founding offer tracking.'
          )
      )
    } finally {
      setFoundingOfferLoading(false)
    }
  }

  async function saveFoundingOfferReview() {
    if (!selectedBusiness || !foundingOffer?.reviewSchemaAvailable) return

    setFoundingOfferSaving(true)
    setFoundingOfferError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/login?redirectTo=/admin/businesses')
        return
      }

      const response = await fetch('/api/admin/founding-offer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessId: selectedBusiness.id,
          reviewStatus: foundingReviewStatus,
          notes: foundingReviewNotes
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
            t(
              'admin.businesses.founding.saveError',
              'Could not save founding offer review.'
            )
        )
      }

      const review = result.review as FoundingOfferReview
      setFoundingOffer((current) =>
        current ? { ...current, review } : current
      )
      setSuccess(
        t(
          'admin.businesses.founding.saved',
          'Founding offer review saved. No billing action was taken.'
        )
      )
    } catch (err: any) {
      setFoundingOfferError(
        err.message ||
          t(
            'admin.businesses.founding.saveError',
            'Could not save founding offer review.'
          )
      )
    } finally {
      setFoundingOfferSaving(false)
    }
  }

  function foundingGuidanceLabel(guidance: FoundingOfferMetrics['guidance']) {
    if (guidance === 'potentially_eligible') {
      return t(
        'admin.businesses.founding.guidance.potential',
        'Potentially eligible'
      )
    }
    if (guidance === 'needs_manual_review') {
      return t(
        'admin.businesses.founding.guidance.review',
        'Needs manual review'
      )
    }
    if (guidance === 'needs_more_activity') {
      return t(
        'admin.businesses.founding.guidance.moreActivity',
        'Not enough genuine activity yet'
      )
    }
    return t(
      'admin.businesses.founding.guidance.notFounding',
      'Not marked as a founding business'
    )
  }

  function foundingReviewStatusLabel(status: FoundingOfferReviewStatus) {
    return t(
      `admin.businesses.founding.reviewStatus.${status}`,
      status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    )
  }

  function selectBusiness(business: BusinessWithOwner) {
    setSelectedBusinessId(business.id)
    setSelectedBusiness(business)
    setSuccess(null)
    setError(null)
    setBillingError(null)
    setAdminBilling(null)
    setBillingDraft(null)
    setFoundingOffer(null)
    setFoundingOfferError(null)
    router.replace(`/admin/businesses?businessId=${business.id}`, undefined, { shallow: true })
  }

  function updateBillingDraft<K extends keyof BillingDraft>(
    key: K,
    value: BillingDraft[K]
  ) {
    setBillingDraft((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: value
      }
    })
  }

  async function saveBillingState() {
    if (!selectedBusiness || !billingDraft || billingSaving) return

    if (
      ['cancelled', 'paused'].includes(billingDraft.billingStatus) &&
      !confirm(
        t(
          'admin.businesses.billing.riskyConfirm',
          'Confirm this paused or cancelled billing status. This remains informational and will not restrict product access.'
        )
      )
    ) {
      return
    }

    const majorPrice = billingDraft.priceMajor.trim()
    const parsedPrice = majorPrice === '' ? null : Number(majorPrice)

    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setBillingError(
        t(
          'admin.businesses.billing.invalidPrice',
          'Enter a valid non-negative monthly price.'
        )
      )
      return
    }

    setBillingSaving(true)
    setBillingError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/login?redirectTo=/admin/businesses')
        return
      }

      const response = await fetch('/api/admin/business-billing', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessId: selectedBusiness.id,
          billingStatus: billingDraft.billingStatus,
          priceAmount:
            parsedPrice === null ? null : Math.round(parsedPrice * 100),
          currency: billingDraft.currency,
          trialStart: billingDraft.trialStart || null,
          trialEnd: billingDraft.trialEnd || null,
          foundingBusiness: billingDraft.foundingBusiness,
          secondMonthFreeEligible: billingDraft.secondMonthFreeEligible,
          notes: billingDraft.notes,
          changeReason: billingDraft.changeReason
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('admin.businesses.billing.saveError', 'Could not save billing changes.'))
      }

      const billing = result.billing as AdminBillingState
      setAdminBilling(billing)
      setBillingDraft(billingDraftFromState(billing))
      setBillingByBusiness((current) => ({
        ...current,
        [billing.business_id]: billing
      }))
      setSuccess(
        result.auditStored
          ? t('admin.businesses.billing.saved', 'Manual billing state saved and audited.')
          : t(
              'admin.businesses.billing.savedWithoutAudit',
              'Manual billing state saved. Install the Stage 5 audit SQL to retain a durable change record.'
            )
      )
    } catch (err: any) {
      setBillingError(
        err.message ||
          t('admin.businesses.billing.saveError', 'Could not save billing changes.')
      )
    } finally {
      setBillingSaving(false)
    }
  }

  function updateSelected<K extends keyof BusinessWithOwner>(key: K, value: BusinessWithOwner[K]) {
    setSelectedBusiness((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: value
      }
    })
  }

  async function saveSelectedBusiness() {
    if (!selectedBusiness) return

    const confirmed = confirm('Save admin changes for this business?')
    if (!confirmed) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      published: Boolean(selectedBusiness.published),
      billing_email: selectedBusiness.billing_email?.trim() || null,
      auto_accept_bookings: Boolean(selectedBusiness.auto_accept_bookings),
      booking_interval_minutes: Number(selectedBusiness.booking_interval_minutes || 30),
      min_notice_minutes: Number(selectedBusiness.min_notice_minutes || 120),
      max_advance_days: Number(selectedBusiness.max_advance_days || 60),
      buffer_before_minutes: Number(selectedBusiness.buffer_before_minutes || 0),
      buffer_after_minutes: Number(selectedBusiness.buffer_after_minutes || 0)
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', selectedBusiness.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    const updatedSelected = { ...selectedBusiness, ...payload }

    setSuccess(`Saved admin changes for ${selectedBusiness.name}.`)

    setBusinesses((current) =>
      current.map((business) =>
        business.id === selectedBusiness.id ? { ...business, ...payload } : business
      )
    )

    setSelectedBusiness(updatedSelected)
  }

  function togglePublished() {
    if (!selectedBusiness) return

    setSelectedBusiness({
      ...selectedBusiness,
      published: !selectedBusiness.published
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
          <div className="card">
            <p className="muted">Loading Mirëbook business admin...</p>
          </div>
        </section>
      </main>
    )
  }

  if (!adminProfile?.is_admin) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
          <div className="admin-shell">
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p className="small" style={{ color: 'var(--danger)' }}>Admin only</p>
              <h1 className="page-title" style={{ marginTop: '0.35rem' }}>No access</h1>
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                This page is only for Mirëbook admin users.
              </p>

              <div className="admin-actions">
                <Link href="/" className="btn btn-ghost">
                  Back to Mirëbook
                </Link>

                <button type="button" className="btn btn-danger" onClick={logout}>
                  Log out
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const selectedCounts = getCounts(selectedBusiness?.id)
  const selectedIssues = selectedBusiness ? readinessIssues(selectedBusiness) : []
  const selectedBilling = adminBilling || getBillingState(selectedBusiness?.id)
  const trialDays = daysUntil(selectedBilling.trial_end)

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="admin-shell">
          <div className="admin-header">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook operator</p>
              <h1 className="page-title">Business control centre</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Review business onboarding, publishing, operational readiness and synchronized billing context without entering the business workspace.
              </p>
            </div>

            <div className="admin-actions">
              <Link href="/admin" className="btn btn-ghost">Overview</Link>
              <Link href="/admin/users" className="btn btn-ghost">Users</Link>
              <Link href="/admin/notifications" className="btn btn-ghost">Notifications</Link>
              <button type="button" className="btn btn-accent" onClick={loadAdminBusinesses}>Refresh</button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)' }}>
              <p style={{ color: 'var(--success)' }}>{success}</p>
            </div>
          )}

          <div className="grid-4">
            <div className="card">
              <p className="small muted">Businesses</p>
              <h2>{summary.total}</h2>
              <p className="small muted">{summary.published} published · {summary.total - summary.published} draft</p>
            </div>

            <div className="card">
              <p className="small muted">Needs attention</p>
              <h2>{summary.attention}</h2>
              <p className="small muted">Setup, trial, billing or pending action</p>
            </div>

            <div className="card">
              <p className="small muted">Trial / active</p>
              <h2>{summary.trial} / {summary.active}</h2>
              <p className="small muted">{summary.paymentAttention} payment attention</p>
            </div>

            <div className="card">
              <p className="small muted">Active monthly value</p>
              <h2>{formatBillingAmount(summary.monthlyValue, 'GBP')}</h2>
              <p className="small muted">Authoritative active billing rows</p>
            </div>
          </div>

          <div className="admin-layout-grid">
            <div className="card admin-list-card">
              <div className="admin-section-header">
                <div>
                  <p className="small muted">Business accounts</p>
                  <h2>Search and filter</h2>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Showing {visibleBusinesses.length} of {filteredBusinesses.length} matching businesses.
                  </p>
                </div>
              </div>

              <div className="admin-filter-grid">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search business, owner, city, category, billing email..."
                />

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {BILLING_STATUSES.map((status) => (
                    <option key={status} value={status}>{statusLabel(status)}</option>
                  ))}
                </select>

                <select value={publishedFilter} onChange={(event) => setPublishedFilter(event.target.value)}>
                  <option value="all">Published + draft</option>
                  <option value="published">Published only</option>
                  <option value="draft">Draft only</option>
                </select>

                <select value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value)}>
                  <option value="all">All readiness states</option>
                  <option value="attention">Needs attention</option>
                  <option value="ready">Setup ready</option>
                  <option value="pending">Pending bookings</option>
                  <option value="trial_ending">Trial ending soon</option>
                </select>
              </div>

              {filteredBusinesses.length > 75 && (
                <div className="admin-hint-box">
                  <p className="small muted">
                    Refine search to narrow the list. Large accounts are intentionally limited for admin performance.
                  </p>
                </div>
              )}

              {visibleBusinesses.length === 0 ? (
                <div className="admin-empty">
                  <h3>No matching businesses</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Clear search or change filters.
                  </p>
                </div>
              ) : (
                <div className="admin-business-list">
                  {visibleBusinesses.map((business) => {
                    const counts = getCounts(business.id)
                    const issues = readinessIssues(business)
                    const attention = needsAttention(business)

                    return (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => selectBusiness(business)}
                        className={business.id === selectedBusinessId ? 'admin-business-row admin-business-row-active' : 'admin-business-row'}
                      >
                        <span>
                          <strong>{business.name}</strong>
                          <span className="small muted">
                            {[business.category, business.city, business.country].filter(Boolean).join(' · ') || 'No category/location'}
                          </span>
                          <span className="small muted">Owner: {ownerEmail(business)}</span>
                        </span>

                        <span className="admin-row-meta">
                          <span className={business.published ? 'admin-pill admin-pill-success' : 'admin-pill admin-pill-muted'}>
                            {business.published ? 'Published' : 'Draft'}
                          </span>
                          <span className="admin-pill admin-pill-accent">
                            {statusLabel(getBillingState(business.id).billing_status)}
                          </span>
                          {attention && (
                            <span className="admin-pill admin-pill-warning">
                              Needs attention
                            </span>
                          )}
                          <span className="small muted">
                            {counts.activeServices}/{counts.services} services · {counts.activeStaff}/{counts.staff} staff · {counts.bookings} bookings
                          </span>
                          {issues.length > 0 && (
                            <span className="small muted">Missing: {issues.slice(0, 3).join(', ')}</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card admin-editor-card">
              {!selectedBusiness ? (
                <div className="admin-empty">
                  <h3>Select a business</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    Choose a business to review onboarding, billing and operational context.
                  </p>
                </div>
              ) : (
                <>
                  <div className="admin-editor-header">
                    <div>
                      <p className="small muted">Selected business</p>
                      <h2>{selectedBusiness.name}</h2>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        Owner: {ownerName(selectedBusiness)} · {ownerEmail(selectedBusiness)}
                      </p>
                    </div>

                    <div className="admin-actions">
                      <Link href={`/explore/${selectedBusiness.id}`} className="btn btn-ghost">Public page</Link>
                      {ownerId(selectedBusiness) && (
                        <Link href={`/admin/users?userId=${ownerId(selectedBusiness)}`} className="btn btn-ghost">Owner account</Link>
                      )}
                      <Link href={`/admin/notifications?businessId=${selectedBusiness.id}`} className="btn btn-ghost">Notify</Link>
                      <button type="button" className="btn btn-accent" onClick={saveSelectedBusiness} disabled={saving}>
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </div>

                  <div className={selectedIssues.length > 0 ? 'admin-alert-box admin-alert-warning' : 'admin-alert-box admin-alert-success'}>
                    <div>
                      <p className="small muted">Launch readiness</p>
                      <strong>{selectedIssues.length === 0 ? 'Business setup looks ready' : `Missing ${selectedIssues.length} setup item${selectedIssues.length === 1 ? '' : 's'}`}</strong>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        {selectedIssues.length === 0 ? 'Core business setup is complete enough for marketplace publishing.' : `Missing: ${selectedIssues.join(', ')}.`}
                      </p>
                    </div>
                  </div>

                  <div className="admin-founding-box">
                    <div className="admin-section-header">
                      <div>
                        <p className="small muted">
                          {t(
                            'admin.businesses.founding.kicker',
                            'Admin only · Launch offer tracking'
                          )}
                        </p>
                        <h3>
                          {t(
                            'admin.businesses.founding.title',
                            'Founding offer review'
                          )}
                        </h3>
                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          {t(
                            'admin.businesses.founding.body',
                            'Raw signups are not enough. Review confirmed and completed bookings, unique customers and verification status before granting a second free month.'
                          )}
                        </p>
                      </div>
                      {foundingOffer && (
                        <span className="admin-pill admin-pill-warning">
                          {foundingGuidanceLabel(foundingOffer.metrics.guidance)}
                        </span>
                      )}
                    </div>

                    {foundingOfferLoading && (
                      <div className="admin-hint-box">
                        <p className="small muted">
                          {t(
                            'admin.businesses.founding.loading',
                            'Calculating first-month activity...'
                          )}
                        </p>
                      </div>
                    )}

                    {foundingOfferError && (
                      <div className="admin-alert-box admin-alert-warning">
                        <p style={{ color: 'var(--danger)' }}>{foundingOfferError}</p>
                      </div>
                    )}

                    {!foundingOfferLoading && foundingOffer && (
                      <>
                        <div className="admin-offer-window">
                          <div>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.offerWindow',
                                'First offer window'
                              )}
                            </p>
                            <strong>
                              {formatDate(foundingOffer.metrics.windowStart)} -{' '}
                              {formatDate(foundingOffer.metrics.windowEnd)}
                            </strong>
                          </div>
                          <div>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.billingContext',
                                'Billing context'
                              )}
                            </p>
                            <strong>
                              {selectedBilling.founding_business
                                ? t(
                                    'admin.businesses.billing.founding',
                                    'Founding business'
                                  )
                                : t(
                                    'admin.businesses.billing.standard',
                                    'Standard launch'
                                  )}
                            </strong>
                          </div>
                          <div>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.currentDecision',
                                'Current billing flag'
                              )}
                            </p>
                            <strong>
                              {selectedBilling.second_month_free_eligible
                                ? t(
                                    'admin.businesses.founding.flagEligible',
                                    'Second month marked eligible'
                                  )
                                : t(
                                    'admin.businesses.founding.flagNotEligible',
                                    'Not marked eligible'
                                  )}
                            </strong>
                          </div>
                        </div>

                        <div className="admin-founding-metrics">
                          <div>
                            <strong>{foundingOffer.metrics.qualifyingBookings}</strong>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.qualifyingBookings',
                                'Confirmed + completed'
                              )}
                            </p>
                          </div>
                          <div>
                            <strong>
                              {foundingOffer.metrics.qualifyingUniqueCustomers}
                            </strong>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.qualifyingCustomers',
                                'Unique qualifying customers'
                              )}
                            </p>
                          </div>
                          <div>
                            <strong>{foundingOffer.metrics.verifiedCustomers}</strong>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.verifiedCustomers',
                                'Verified customer accounts'
                              )}
                            </p>
                          </div>
                          <div>
                            <strong>
                              {foundingOffer.metrics.unknownVerificationCustomers}
                            </strong>
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.unknownCustomers',
                                'Unknown / guest verification'
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="admin-offer-breakdown">
                          <span>
                            {t('admin.businesses.founding.total', 'Total')}:{' '}
                            <strong>{foundingOffer.metrics.totalBookings}</strong>
                          </span>
                          <span>
                            {t('admin.businesses.founding.pending', 'Pending')}:{' '}
                            <strong>{foundingOffer.metrics.pendingBookings}</strong>
                          </span>
                          <span>
                            {t('admin.businesses.founding.confirmed', 'Confirmed')}:{' '}
                            <strong>{foundingOffer.metrics.confirmedBookings}</strong>
                          </span>
                          <span>
                            {t('admin.businesses.founding.completed', 'Completed')}:{' '}
                            <strong>{foundingOffer.metrics.completedBookings}</strong>
                          </span>
                          <span>
                            {t('admin.businesses.founding.cancelled', 'Cancelled')}:{' '}
                            <strong>{foundingOffer.metrics.cancelledBookings}</strong>
                          </span>
                          <span>
                            {t('admin.businesses.founding.declined', 'Declined')}:{' '}
                            <strong>{foundingOffer.metrics.declinedBookings}</strong>
                          </span>
                          <span>
                            {t(
                              'admin.businesses.founding.unverified',
                              'Unverified accounts'
                            )}:{' '}
                            <strong>{foundingOffer.metrics.unverifiedCustomers}</strong>
                          </span>
                        </div>

                        {foundingOffer.metrics.concentratedActivity && (
                          <div className="admin-alert-box admin-alert-warning">
                            <p className="small">
                              {t(
                                'admin.businesses.founding.concentrated',
                                'Activity is concentrated across relatively few customers. Review the booking pattern before making a decision.'
                              )}
                            </p>
                          </div>
                        )}

                        <div className="admin-hint-box">
                          <p className="small muted">
                            {t(
                              'admin.businesses.founding.manualOnly',
                              'Final eligibility is manually reviewed by Mirëbook. Saving a review does not grant free time, update Stripe or change the billing eligibility flag.'
                            )}
                          </p>
                        </div>

                        {foundingOffer.reviewSchemaAvailable ? (
                          <div className="admin-founding-review">
                            <label className="small muted">
                              {t(
                                'admin.businesses.founding.reviewStatus',
                                'Manual review status'
                              )}
                              <select
                                value={foundingReviewStatus}
                                onChange={(event) =>
                                  setFoundingReviewStatus(
                                    event.target.value as FoundingOfferReviewStatus
                                  )
                                }
                              >
                                {FOUNDING_REVIEW_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {foundingReviewStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="small muted">
                              {t(
                                'admin.businesses.founding.reviewNotes',
                                'Private review notes'
                              )}
                              <textarea
                                value={foundingReviewNotes}
                                onChange={(event) =>
                                  setFoundingReviewNotes(event.target.value)
                                }
                                maxLength={2000}
                                placeholder={t(
                                  'admin.businesses.founding.reviewNotesPlaceholder',
                                  'Record the evidence reviewed and any follow-up needed.'
                                )}
                              />
                            </label>

                            <div className="admin-billing-save">
                              <p className="small muted">
                                {foundingOffer.review?.reviewed_at
                                  ? `${t(
                                      'admin.businesses.founding.lastReviewed',
                                      'Last reviewed'
                                    )}: ${formatDate(
                                      foundingOffer.review.reviewed_at
                                    )}`
                                  : t(
                                      'admin.businesses.founding.notReviewed',
                                      'No manual review has been saved yet.'
                                    )}
                              </p>
                              <button
                                type="button"
                                className="btn btn-accent"
                                onClick={saveFoundingOfferReview}
                                disabled={foundingOfferSaving}
                              >
                                {foundingOfferSaving
                                  ? t(
                                      'admin.businesses.founding.saving',
                                      'Saving review...'
                                    )
                                  : t(
                                      'admin.businesses.founding.save',
                                      'Save offer review'
                                    )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-alert-box admin-alert-warning">
                            <p className="small muted">
                              {t(
                                'admin.businesses.founding.sqlRequired',
                                'Metrics are available read-only. Run sources/sql/07_founding_offer_reviews.sql in Supabase to save review status and notes.'
                              )}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="admin-billing-box">
                    <div className="admin-section-header">
                      <div>
                        <p className="small muted">
                          {t('admin.businesses.billing.adminOnly', 'Admin only · Manual billing control')}
                        </p>
                        <h3>{selectedBilling.plan_name}</h3>
                        <p className="small muted" style={{ marginTop: '0.35rem' }}>
                          {t(
                            'admin.businesses.billing.softAccess',
                            'Billing remains informational. These changes do not restrict bookings, staff access or public listing.'
                          )}
                        </p>
                      </div>
                      <span className="admin-pill admin-pill-accent">
                        {statusLabel(selectedBilling.billing_status)}
                      </span>
                    </div>

                    <div className="admin-billing-grid">
                      <div>
                        <p className="small muted">{t('admin.businesses.billing.price', 'Agreed monthly price')}</p>
                        <strong>
                          {selectedBilling.price_amount === null
                            ? t('admin.operations.priceNotSet', 'Price not set')
                            : formatBillingAmount(
                                selectedBilling.price_amount,
                                selectedBilling.currency
                              )}
                        </strong>
                      </div>
                      <div>
                        <p className="small muted">{t('admin.businesses.billing.trialEnd', 'Trial end')}</p>
                        <strong>{formatDate(selectedBilling.trial_end)}</strong>
                        {trialDays !== null && selectedBilling.billing_status === 'free_trial' && (
                          <p className="small muted" style={{ marginTop: '0.25rem' }}>
                            {trialDays >= 0
                              ? `${trialDays} day${trialDays === 1 ? '' : 's'} remaining`
                              : t('admin.businesses.billing.trialEnded', 'Trial ended')}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="small muted">{t('admin.businesses.billing.periodEnd', 'Current period end')}</p>
                        <strong>{formatDate(selectedBilling.current_period_end)}</strong>
                      </div>
                      <div>
                        <p className="small muted">{t('admin.businesses.billing.offer', 'Commercial offer')}</p>
                        <strong>
                          {selectedBilling.founding_business
                            ? t('admin.businesses.billing.founding', 'Founding business')
                            : t('admin.businesses.billing.standard', 'Standard launch')}
                        </strong>
                      </div>
                    </div>

                    {billingLoading && (
                      <div className="admin-hint-box" style={{ marginTop: '1rem' }}>
                        <p className="small muted">
                          {t('admin.businesses.billing.loadingControls', 'Loading private billing controls...')}
                        </p>
                      </div>
                    )}

                    {billingError && (
                      <div className="admin-alert-box admin-alert-warning" style={{ marginTop: '1rem' }}>
                        <p style={{ color: 'var(--danger)' }}>{billingError}</p>
                      </div>
                    )}

                    {!billingLoading && billingDraft && adminBilling && (
                      <>
                        <div className="admin-provider-box">
                          <div>
                            <p className="small muted">
                              {t('admin.businesses.billing.managementContext', 'Management context')}
                            </p>
                            <strong>
                              {adminBilling.stripe_subscription_id
                                ? t('admin.businesses.billing.stripeManaged', 'Stripe-managed subscription')
                                : t('admin.businesses.billing.manualManaged', 'Manual / founding record')}
                            </strong>
                          </div>
                          <div>
                            <p className="small muted">
                              {t('admin.businesses.billing.stripeCustomer', 'Stripe customer ID')}
                            </p>
                            <code>
                              {adminBilling.stripe_customer_id ||
                                t('admin.businesses.billing.notSet', 'Not set')}
                            </code>
                          </div>
                          <div>
                            <p className="small muted">
                              {t('admin.businesses.billing.stripeSubscription', 'Stripe subscription ID')}
                            </p>
                            <code>
                              {adminBilling.stripe_subscription_id ||
                                t('admin.businesses.billing.notSet', 'Not set')}
                            </code>
                          </div>
                        </div>

                        <div className="admin-billing-editor">
                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.status', 'Billing status')}
                            </label>
                            <select
                              value={billingDraft.billingStatus}
                              onChange={(event) =>
                                updateBillingDraft(
                                  'billingStatus',
                                  event.target.value as BillingStatus
                                )
                              }
                            >
                              {BILLING_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.priceMajor', 'Agreed monthly price')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={billingDraft.priceMajor}
                              onChange={(event) =>
                                updateBillingDraft('priceMajor', event.target.value)
                              }
                              placeholder="19.00"
                            />
                          </div>

                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.currency', 'Currency')}
                            </label>
                            <input
                              value={billingDraft.currency}
                              maxLength={3}
                              onChange={(event) =>
                                updateBillingDraft(
                                  'currency',
                                  event.target.value.toUpperCase()
                                )
                              }
                              placeholder="GBP"
                            />
                          </div>

                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.trialStart', 'Trial start')}
                            </label>
                            <input
                              type="date"
                              value={billingDraft.trialStart}
                              onChange={(event) =>
                                updateBillingDraft('trialStart', event.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.trialEnd', 'Trial end')}
                            </label>
                            <input
                              type="date"
                              value={billingDraft.trialEnd}
                              onChange={(event) =>
                                updateBillingDraft('trialEnd', event.target.value)
                              }
                            />
                          </div>

                          <label className="admin-check-row">
                            <input
                              type="checkbox"
                              checked={billingDraft.foundingBusiness}
                              onChange={(event) =>
                                updateBillingDraft(
                                  'foundingBusiness',
                                  event.target.checked
                                )
                              }
                            />
                            <span>
                              <strong>
                                {t('admin.businesses.billing.founding', 'Founding business')}
                              </strong>
                              <small>
                                {t(
                                  'admin.businesses.billing.foundingBody',
                                  'Marks this business as part of the founding launch offer.'
                                )}
                              </small>
                            </span>
                          </label>

                          <label className="admin-check-row">
                            <input
                              type="checkbox"
                              checked={billingDraft.secondMonthFreeEligible}
                              onChange={(event) =>
                                updateBillingDraft(
                                  'secondMonthFreeEligible',
                                  event.target.checked
                                )
                              }
                            />
                            <span>
                              <strong>
                                {t(
                                  'admin.businesses.billing.secondMonth',
                                  'Second free month eligible'
                                )}
                              </strong>
                              <small>
                                {t(
                                  'admin.businesses.billing.secondMonthBody',
                                  'Records eligibility only; it does not change Stripe automatically.'
                                )}
                              </small>
                            </span>
                          </label>
                        </div>

                        <div className="admin-billing-notes">
                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.privateNotes', 'Private billing notes')}
                            </label>
                            <textarea
                              value={billingDraft.notes}
                              onChange={(event) =>
                                updateBillingDraft('notes', event.target.value)
                              }
                              maxLength={2000}
                              placeholder={t(
                                'admin.businesses.billing.privateNotesPlaceholder',
                                'Internal commercial context. Never shown to the business.'
                              )}
                            />
                          </div>

                          <div>
                            <label className="small muted">
                              {t('admin.businesses.billing.changeReason', 'Reason for this change')}
                            </label>
                            <textarea
                              value={billingDraft.changeReason}
                              onChange={(event) =>
                                updateBillingDraft('changeReason', event.target.value)
                              }
                              maxLength={500}
                              placeholder={t(
                                'admin.businesses.billing.changeReasonPlaceholder',
                                'Required for operator accountability.'
                              )}
                            />
                          </div>
                        </div>

                        <div className="admin-billing-save">
                          <p className="small muted">
                            {t(
                              'admin.businesses.billing.webhookPreservation',
                              'Stripe webhooks may update status and period dates later. Founding flags, agreed price and private notes remain manual fields.'
                            )}
                          </p>
                          <button
                            type="button"
                            className="btn btn-accent"
                            onClick={saveBillingState}
                            disabled={billingSaving}
                          >
                            {billingSaving
                              ? t('admin.businesses.billing.saving', 'Saving billing...')
                              : t('admin.businesses.billing.save', 'Save billing state')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="admin-editor-grid">
                    <div>
                      <label className="small muted">Published status</label>
                      <button
                        type="button"
                        className={selectedBusiness.published ? 'admin-toggle admin-toggle-on' : 'admin-toggle'}
                        onClick={togglePublished}
                      >
                        {selectedBusiness.published ? 'Published on marketplace' : 'Hidden / draft'}
                      </button>
                      <p className="small muted" style={{ marginTop: '0.35rem' }}>
                        Use this to manually hide a business while onboarding or if there is an issue.
                      </p>
                    </div>

                    <div>
                      <label className="small muted">Billing email</label>
                      <input
                        type="email"
                        value={selectedBusiness.billing_email || ''}
                        onChange={(event) => updateSelected('billing_email', event.target.value)}
                        placeholder="billing@example.com"
                        style={{ marginTop: '0.4rem' }}
                      />
                    </div>

                    <div>
                      <label className="small muted">Booking approval</label>
                      <select
                        value={selectedBusiness.auto_accept_bookings ? 'yes' : 'no'}
                        onChange={(event) => updateSelected('auto_accept_bookings', event.target.value === 'yes')}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value="yes">Instant confirmation</option>
                        <option value="no">Manual approval</option>
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Booking interval</label>
                      <select
                        value={selectedBusiness.booking_interval_minutes || 30}
                        onChange={(event) => updateSelected('booking_interval_minutes', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Minimum notice</label>
                      <select
                        value={selectedBusiness.min_notice_minutes || 120}
                        onChange={(event) => updateSelected('min_notice_minutes', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value={0}>No minimum</option>
                        <option value={60}>1 hour</option>
                        <option value={120}>2 hours</option>
                        <option value={240}>4 hours</option>
                        <option value={1440}>24 hours</option>
                      </select>
                    </div>

                    <div>
                      <label className="small muted">Max advance booking</label>
                      <select
                        value={selectedBusiness.max_advance_days || 60}
                        onChange={(event) => updateSelected('max_advance_days', Number(event.target.value))}
                        style={{ marginTop: '0.4rem' }}
                      >
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                        <option value={180}>180 days</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-readiness-box">
                    <p className="small muted">Operational snapshot</p>
                    <div className="grid-3" style={{ marginTop: '0.75rem' }}>
                      <div>
                        <strong>{selectedCounts.activeServices}/{selectedCounts.services}</strong>
                        <p className="small muted">Active services</p>
                      </div>
                      <div>
                        <strong>{selectedCounts.activeStaff}/{selectedCounts.staff}</strong>
                        <p className="small muted">Active staff</p>
                      </div>
                      <div>
                        <strong>{selectedCounts.pendingBookings}/{selectedCounts.bookings}</strong>
                        <p className="small muted">Pending / total bookings</p>
                      </div>
                    </div>
                  </div>

                  <div className="admin-owner-box">
                    <div>
                      <p className="small muted">Owner account</p>
                      <strong>{ownerName(selectedBusiness)}</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        {ownerEmail(selectedBusiness)}
                      </p>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        Role: {selectedBusiness.owner?.role || 'unknown'} · Admin: {selectedBusiness.owner?.is_admin ? 'yes' : 'no'}
                      </p>
                    </div>

                    <div className="admin-actions">
                      {ownerId(selectedBusiness) && (
                        <Link href={`/admin/users?userId=${ownerId(selectedBusiness)}`} className="btn btn-ghost">Manage owner</Link>
                      )}
                      <Link href={`/admin/notifications?businessId=${selectedBusiness.id}`} className="btn btn-ghost">Send notice</Link>
                    </div>
                  </div>

                  <div className="admin-save-footer">
                    <div>
                      <p className="small muted">{t('admin.businesses.currentState', 'Current operational state')}</p>
                      <strong>
                        {selectedBusiness.published ? 'Published' : 'Draft'} · {
                          selectedBusiness.auto_accept_bookings
                            ? 'Instant confirmation'
                            : 'Booking requests'
                        }
                      </strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        {t(
                          'admin.businesses.saveScope',
                          'This button updates publishing, billing contact and booking settings only. Use the separate admin-only billing control for commercial state.'
                        )}
                      </p>
                    </div>

                    <button type="button" className="btn btn-accent" onClick={saveSelectedBusiness} disabled={saving}>
                      {saving ? 'Saving...' : 'Save admin changes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .admin-shell {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .admin-header,
        .admin-section-header,
        .admin-editor-header,
        .admin-save-footer {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .admin-actions,
        .admin-business-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .admin-layout-grid {
          display: grid;
          grid-template-columns: minmax(310px, 0.82fr) minmax(0, 1.18fr);
          gap: 1rem;
          align-items: start;
        }

        .admin-list-card,
        .admin-editor-card {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .admin-filter-grid {
          display: grid;
          gap: 0.75rem;
        }

        .admin-business-list {
          display: grid;
          gap: 0.75rem;
          max-height: 760px;
          overflow: auto;
          padding-right: 0.25rem;
        }

        .admin-business-row {
          width: 100%;
          text-align: left;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          padding: 1rem;
          display: grid;
          gap: 0.65rem;
        }

        .admin-business-row-active {
          border-color: rgba(255,107,53,0.42);
          background: rgba(255,107,53,0.08);
        }

        .admin-business-row span {
          display: grid;
          gap: 0.2rem;
        }

        .admin-row-meta {
          display: flex !important;
          gap: 0.45rem !important;
          flex-wrap: wrap;
          align-items: center;
        }

        .admin-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.16rem 0.55rem;
          font-size: 0.76rem;
          font-weight: 700;
          border: 1px solid var(--border);
          width: fit-content;
        }

        .admin-pill-success {
          background: var(--success-dim);
          color: var(--success);
          border-color: rgba(6,214,160,0.22);
        }

        .admin-pill-muted {
          background: var(--surface);
          color: var(--text-muted);
        }

        .admin-pill-accent {
          background: var(--accent-dim);
          color: var(--accent);
          border-color: rgba(255,107,53,0.22);
          text-transform: capitalize;
        }

        .admin-pill-warning {
          background: rgba(255,190,11,0.12);
          color: var(--warning);
          border-color: rgba(255,190,11,0.22);
        }

        .admin-empty,
        .admin-hint-box,
        .admin-alert-box,
        .admin-founding-box,
        .admin-billing-box,
        .admin-readiness-box,
        .admin-owner-box {
          padding: 1rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }

        .admin-founding-box {
          display: grid;
          gap: 1rem;
          border-color: rgba(255,190,11,0.28);
          background: linear-gradient(
            145deg,
            rgba(255,190,11,0.07),
            var(--surface-2)
          );
        }

        .admin-offer-window,
        .admin-founding-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.75rem;
        }

        .admin-offer-window > div,
        .admin-founding-metrics > div {
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .admin-founding-metrics strong {
          font-size: 1.35rem;
        }

        .admin-offer-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .admin-offer-breakdown span {
          padding: 0.35rem 0.6rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface);
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .admin-founding-review {
          display: grid;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .admin-founding-review > label {
          display: grid;
          gap: 0.4rem;
        }

        .admin-founding-review textarea {
          min-height: 96px;
          resize: vertical;
        }

        .admin-alert-success {
          border-color: rgba(45,212,191,0.28);
          background: rgba(45,212,191,0.06);
        }

        .admin-alert-warning {
          border-color: rgba(255,190,11,0.28);
          background: rgba(255,190,11,0.06);
        }

        .admin-editor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 1rem;
        }

        .admin-billing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .admin-provider-box,
        .admin-billing-editor,
        .admin-billing-notes {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .admin-provider-box {
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .admin-provider-box code {
          display: block;
          margin-top: 0.25rem;
          color: var(--text);
          overflow-wrap: anywhere;
          font-size: 0.78rem;
        }

        .admin-billing-editor > div,
        .admin-billing-notes > div {
          display: grid;
          gap: 0.4rem;
        }

        .admin-check-row {
          display: flex;
          gap: 0.7rem;
          align-items: flex-start;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .admin-check-row input {
          width: auto;
          margin-top: 0.2rem;
        }

        .admin-check-row span {
          display: grid;
          gap: 0.2rem;
        }

        .admin-check-row small {
          color: var(--text-muted);
          line-height: 1.45;
        }

        .admin-billing-notes textarea {
          min-height: 96px;
          resize: vertical;
        }

        .admin-billing-save {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .admin-billing-save p {
          max-width: 620px;
        }

        .admin-toggle {
          width: 100%;
          margin-top: 0.4rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          border-radius: var(--radius);
          padding: 0.8rem 1rem;
          font-weight: 700;
          text-align: left;
        }

        .admin-toggle-on {
          border-color: rgba(6,214,160,0.28);
          background: var(--success-dim);
          color: var(--success);
        }

        .admin-owner-box {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .admin-save-footer {
          background: rgba(255,107,53,0.06);
          border: 1px solid rgba(255,107,53,0.22);
          border-radius: var(--radius);
          padding: 1rem;
          align-items: center;
        }

        @media (max-width: 980px) {
          .admin-layout-grid {
            grid-template-columns: 1fr;
          }

          .admin-business-list {
            max-height: none;
          }
        }

        @media (max-width: 640px) {
          .admin-header,
          .admin-section-header,
          .admin-editor-header,
          .admin-save-footer,
          .admin-owner-box {
            display: grid;
          }

          .admin-billing-save {
            display: grid;
          }

          .admin-actions,
          .admin-business-actions,
          .admin-actions :global(.btn),
          .admin-business-actions :global(.btn),
          .admin-save-footer :global(.btn),
          .admin-owner-box :global(.btn),
          .admin-actions a,
          .admin-business-actions a,
          .admin-save-footer button,
          .admin-owner-box a {
            width: 100%;
            justify-content: center;
          }

          .admin-billing-save :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}
