import api from '@/lib/api'
import { Item, ItemAvailability } from '@/types'

export interface ItemFilters {
  search?: string
  category?: string
  subcategory?: string
  availability_type?: string
  neighborhood?: string
  city?: string
  lat?: number
  lng?: number
  lat2?: number
  lng2?: number
  radius_km?: number
  sort?: 'nearest' | 'price_asc'
  skip?: number
  limit?: number
}

export interface ItemPayload {
  title: string
  description?: string
  category: string
  subcategory?: string
  photos?: string[]
  availability_type: string
  daily_rate?: number | null
  weekly_rate?: number | null
  monthly_rate?: number | null
  delivery_fee?: number | null
  declared_value?: number | null
  usage_rules?: string
  zip_code?: string
  neighborhood?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  group_ids?: string[]
  is_public?: boolean
  available_days?: number[]
  requires_identity_verification?: boolean
  fulfillment_options?: ('pickup' | 'delivery')[]
  quantity_total?: number
}

export const itemsService = {
  list: (params?: ItemFilters) =>
    api.get<Item[]>('/items', { params }).then((r) => r.data),

  get: (id: string) => api.get<Item>(`/items/${id}`).then((r) => r.data),

  create: (data: ItemPayload) => api.post<Item>('/items', data).then((r) => r.data),

  update: (id: string, data: Partial<ItemPayload>) =>
    api.put<Item>(`/items/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/items/${id}`),

  uploadPhoto: (itemId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<Item>(`/items/${itemId}/photos`, formData).then((r) => r.data)
  },

  activate: (id: string) => api.patch<Item>(`/items/${id}/activate`).then((r) => r.data),

  deactivate: (id: string) => api.patch<Item>(`/items/${id}/deactivate`).then((r) => r.data),

  myItems: () => api.get<Item[]>('/users/me/items').then((r) => r.data),

  favorite: (id: string) => api.post<Item>(`/items/${id}/favorite`).then((r) => r.data),
  unfavorite: (id: string) => api.delete<Item>(`/items/${id}/favorite`).then((r) => r.data),
  myFavorites: () => api.get<Item[]>('/users/me/favorites').then((r) => r.data),

  joinWaitlist: (id: string) => api.post<Item>(`/items/${id}/waitlist`).then((r) => r.data),
  leaveWaitlist: (id: string) => api.delete<Item>(`/items/${id}/waitlist`).then((r) => r.data),

  checkAvailability: (id: string, pickupDate: string, expectedReturnDate: string) =>
    api
      .get<ItemAvailability>(`/items/${id}/availability`, {
        params: { pickup_date: pickupDate, expected_return_date: expectedReturnDate },
      })
      .then((r) => r.data),
}
