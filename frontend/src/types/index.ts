export interface User {
  id: string
  name: string
  email: string
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
  average_rating: number
  rating_count: number
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
  device_token: string
}

export interface LoginResponse {
  requires_2fa: boolean
  temp_token?: string
  access_token?: string
  token_type?: string
  user?: User
  device_token?: string
}

export const CATEGORIES = [
  { value: 'tools', label: 'Ferramentas' },
  { value: 'electronics', label: 'Eletrônicos' },
  { value: 'sports', label: 'Esportes' },
  { value: 'garden', label: 'Jardim' },
  { value: 'kitchen', label: 'Cozinha' },
  { value: 'books', label: 'Livros' },
  { value: 'toys', label: 'Brinquedos' },
  { value: 'clothing', label: 'Roupas' },
  { value: 'furniture', label: 'Móveis' },
  { value: 'other', label: 'Outros' },
] as const

export type ItemCategory = (typeof CATEGORIES)[number]['value']
export type AvailabilityType = 'free' | 'paid'

export interface ItemOwner {
  id: string
  name: string
  neighborhood?: string
  city?: string
  average_rating: number
}

export interface Item {
  id: string
  owner: ItemOwner
  title: string
  description?: string
  category: ItemCategory
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

export interface LoanRequest {
  id: string
  item_id: string
  item_title: string
  requester_id: string
  requester_name: string
  owner_id: string
  owner_name: string
  status: RequestStatus
  pickup_date: string
  expected_return_date: string
  actual_return_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  loan_request_id: string
  item_id: string
  item_title: string
  reviewer_id: string
  reviewer_name: string
  reviewed_id: string
  reviewed_name: string
  /** 'owner' = reviewed person lent the item | 'requester' = reviewed person borrowed it */
  reviewed_role: 'owner' | 'requester'
  rating: number
  comment?: string
  created_at: string
}
