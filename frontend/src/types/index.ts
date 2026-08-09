export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  bio?: string | null
  phone?: string
  zip_code?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  is_verified: boolean
  totp_enabled: boolean
  is_admin: boolean
  is_paused: boolean
  cpf?: string | null
  identity_status: 'none' | 'pending' | 'approved' | 'rejected'
  average_rating: number
  rating_count: number
  reliability_score?: number | null
  reliability_count: number
  on_time_rate?: number | null
  finished_loans_count: number
  avg_response_minutes?: number | null
  response_count: number
  account_type: 'individual' | 'business'
  company_name?: string
  trade_name?: string
  cnpj?: string
  business_category?: string
  business_phone?: string
  business_hours?: string
  website?: string
  instagram?: string
  whatsapp?: string
  featured_item_ids: string[]
  notification_prefs: NotificationPreferences
  inapp_notification_prefs: InAppNotificationPreferences
  created_at: string
}

export interface NotificationPreferences {
  request_status: boolean
  new_message: boolean
  verification_result: boolean
  item_available: boolean
  review_reminder: boolean
}

// Same 5 categories as NotificationPreferences, but for the in-app bell —
// a separate toggle set, kept as its own type so the two never get mixed
// up at a call site.
export interface InAppNotificationPreferences {
  request_status: boolean
  new_message: boolean
  verification_result: boolean
  item_available: boolean
  review_reminder: boolean
  // Bell-only categories — no email equivalent.
  group_vouch: boolean
  favorite_item_changed: boolean
}

export type NotificationType =
  | 'request_status'
  | 'new_message'
  | 'verification_result'
  | 'item_available'
  | 'review_reminder'
  | 'group_vouch'
  | 'favorite_item_changed'
  | 'new_login'

// Named AppNotification, not Notification — the DOM lib already declares a
// global `Notification` (the browser Notifications API), and shadowing it
// would break any future code that needs the real one.
export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  read_at?: string | null
  created_at: string
}

// What GET /users/{id} returns — no email, cpf, phone, address detail,
// is_admin, totp_enabled or identity_status. See PublicUserResponse on the
// backend for why this is deliberately narrower than User.
export interface PublicUser {
  id: string
  name: string
  avatar_url?: string | null
  bio?: string | null
  neighborhood?: string
  city?: string
  state?: string
  average_rating: number
  rating_count: number
  reliability_score?: number | null
  reliability_count: number
  on_time_rate?: number | null
  finished_loans_count: number
  avg_response_minutes?: number | null
  response_count: number
  account_type: 'individual' | 'business'
  trade_name?: string
  business_category?: string
  business_phone?: string
  business_hours?: string
  website?: string
  instagram?: string
  whatsapp?: string
  featured_item_ids: string[]
  is_favorited: boolean
  created_at: string
}

export interface SessionSummary {
  id: string
  created_at: string
  expires_at: string
  ip_address?: string | null
  user_agent?: string | null
}

export interface LoginHistoryEntry {
  created_at: string
  ip_address?: string | null
  user_agent?: string | null
  revoked: boolean
}

export interface FavoriteUserSummary {
  id: string
  name: string
  avatar_url?: string | null
  trade_name?: string
  account_type: 'individual' | 'business'
  business_category?: string
  city?: string
  neighborhood?: string
  average_rating: number
  reliability_score?: number | null
  reliability_count: number
}

export type ReportReason = 'spam' | 'fake_item' | 'inappropriate' | 'fraud' | 'other'
export type ReportStatus = 'pending' | 'dismissed' | 'actioned'

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  fake_item: 'Item falso ou enganoso',
  inappropriate: 'Conteúdo inadequado',
  fraud: 'Fraude',
  other: 'Outro',
}

export interface Report {
  id: string
  reporter_id: string
  reporter_name: string
  item_id?: string
  item_title?: string
  reported_user_id?: string
  reported_user_name?: string
  reason: ReportReason
  description?: string
  status: ReportStatus
  reviewed_by_name?: string
  reviewed_at?: string
  created_at: string
}

export type IdentityStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface VerificationSubmission {
  id: string
  user_id: string
  user_name: string
  cpf: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
  created_at: string
}

export interface VerificationStatus {
  identity_status: IdentityStatus
  rejection_reason?: string | null
}

export interface ItemAnalytics {
  item_id: string
  title: string
  category: ItemCategory
  times_borrowed: number
  revenue: number
  occupancy_rate: number
}

export interface OwnerAnalyticsSummary {
  total_items: number
  total_loans: number
  total_revenue: number
  average_occupancy_rate: number
  most_popular_item?: string | null
  items: ItemAnalytics[]
}

export interface SpendingEntry {
  loan_request_id: string
  item_title: string
  amount: number
  status: string
  created_at: string
}

export interface RequesterSpendingSummary {
  total_spent: number
  payments_count: number
  payments: SpendingEntry[]
}

export interface WeeklySignups {
  week_start: string
  count: number
}

export interface CategoryCount {
  category: string
  count: number
}

export interface CityCount {
  city: string
  count: number
}

export interface AdminDashboardSummary {
  total_users: number
  total_items: number
  active_items: number
  loans_pending: number
  loans_in_progress: number
  loans_finished: number
  loans_cancelled_or_refused: number
  pending_reports: number
  pending_verifications: number
  signups_last_8_weeks: WeeklySignups[]
  top_categories: CategoryCount[]
  top_cities: CityCount[]
}

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  account_type: 'individual' | 'business'
  trade_name?: string | null
  city?: string | null
  neighborhood?: string | null
  is_active: boolean
  is_admin: boolean
  is_verified: boolean
  identity_status: IdentityStatus
  average_rating: number
  rating_count: number
  finished_loans_count: number
  created_at: string
}

export interface BulkActionResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export interface AdminItemSummary {
  id: string
  title: string
  category: ItemCategory
  subcategory?: string | null
  owner_id: string
  owner_name: string
  owner_email: string
  city?: string | null
  neighborhood?: string | null
  availability_type: AvailabilityType
  daily_rate?: number | null
  is_active: boolean
  is_available: boolean
  is_public: boolean
  created_at: string
}

export type AdminActionType =
  | 'report_dismissed'
  | 'report_actioned'
  | 'verification_approved'
  | 'verification_rejected'
  | 'user_activated'
  | 'user_deactivated'
  | 'item_activated'
  | 'item_deactivated'
  | 'user_promoted'
  | 'user_demoted'

export interface AdminActionEntry {
  action_type: AdminActionType
  actor_name: string
  target_label: string
  target_id: string
  target_kind: 'user' | 'item'
  detail?: string | null
  occurred_at: string
}

export interface PlatformSettings {
  access_token_expire_minutes: number
  refresh_token_expire_days: number
  email_verification_expire_hours: number
  login_rate_limit_per_minute: number
  register_rate_limit_per_minute: number
  complete_2fa_rate_limit_per_minute: number
  refresh_rate_limit_per_minute: number
  resend_verification_rate_limit_per_minute: number
  chat_message_rate_limit_per_minute: number
  password_reset_rate_limit_per_minute: number
  handoff_confirmation_grace_hours: number
  announcement_message?: string | null
  announcement_active: boolean
  updated_by_name?: string | null
  updated_at?: string | null
}

export interface Announcement {
  message?: string | null
  active: boolean
}

export interface BusinessSummary {
  id: string
  name: string
  avatar_url?: string | null
  company_name?: string
  trade_name?: string
  business_category?: string
  city?: string
  neighborhood?: string
  average_rating: number
  reliability_score?: number | null
  reliability_count: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
  device_token: string
}

export interface LoginResponse {
  requires_2fa: boolean
  temp_token?: string
  access_token?: string
  refresh_token?: string
  token_type?: string
  user?: User
  device_token?: string
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// Categories/subcategories are admin-editable (see /admin/categories) and
// fetched at runtime from GET /categories — categoriesService.list() caches
// the result. ItemCategory stays a plain string since the valid set can
// change without a deploy.
export type ItemCategory = string
export type AvailabilityType = 'free' | 'paid'

export interface Subcategory {
  key: string
  label: string
  is_active: boolean
}

export interface Category {
  key: string
  label: string
  is_active: boolean
  subcategories: Subcategory[]
}

export interface ItemOwner {
  id: string
  name: string
  neighborhood?: string
  city?: string
  average_rating: number
  reliability_score?: number | null
  reliability_count: number
  account_type: 'individual' | 'business'
  trade_name?: string
}

export interface Item {
  id: string
  owner: ItemOwner
  title: string
  description?: string
  category: ItemCategory
  subcategory?: string
  photos: string[]
  availability_type: AvailabilityType
  daily_rate?: number
  usage_rules?: string
  zip_code?: string
  neighborhood?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  is_available: boolean
  is_active: boolean
  is_favorited: boolean
  is_waitlisted: boolean
  is_public: boolean
  groups: string[]
  available_days: number[]
  requires_identity_verification: boolean
  created_at: string
}

export interface GroupMember {
  id: string
  name: string
  average_rating: number
  vouch_count: number
  vouched_by_me: boolean
}

export interface GroupSummary {
  id: string
  name: string
  member_count: number
}

export interface Group {
  id: string
  name: string
  description?: string
  invite_code: string
  member_count: number
  members: GroupMember[]
  created_by: string
  created_at: string
}

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'refused'
  | 'in_progress'
  | 'finished'
  | 'cancelled'

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  refused: 'Recusada',
  in_progress: 'Em andamento',
  finished: 'Finalizada',
  cancelled: 'Cancelada',
}

export type PaymentStatus = 'unpaid' | 'processing' | 'held' | 'released' | 'refunded' | 'failed'

export interface LoanRequest {
  id: string
  item_id: string
  item_title: string
  requester_id: string
  requester_name: string
  requester_phone?: string | null
  owner_id: string
  owner_name: string
  owner_phone?: string | null
  status: RequestStatus
  payment_status: PaymentStatus
  pickup_date: string
  expected_return_date: string
  actual_return_date?: string
  notes?: string
  requested_extension_date?: string
  extension_status: 'none' | 'pending' | 'approved' | 'rejected'
  pickup_confirmed_by_owner_at?: string | null
  pickup_confirmed_by_requester_at?: string | null
  pickup_forced: boolean
  return_confirmed_by_owner_at?: string | null
  return_confirmed_by_requester_at?: string | null
  return_forced: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  loan_request_id: string
  status: 'pending' | 'held' | 'released' | 'refunded' | 'failed'
  gross_amount: number
  platform_fee_amount: number
  pix_qr_code?: string | null
  pix_qr_code_base64?: string | null
  expires_at?: string | null
  created_at: string
}

export interface MercadoPagoConnectStatus {
  connected: boolean
  connected_at?: string | null
}

export interface Message {
  id: string
  request_id: string
  sender_id: string
  sender_name: string
  text: string
  created_at: string
}

export interface Review {
  id: string
  loan_request_id: string
  item_id: string
  item_title: string
  reviewer_id: string
  reviewer_name: string
  reviewer_avatar_url?: string | null
  reviewed_id: string
  reviewed_name: string
  /** 'owner' = reviewed person lent the item | 'requester' = reviewed person borrowed it */
  reviewed_role: 'owner' | 'requester'
  rating: number
  comment?: string
  created_at: string
}
