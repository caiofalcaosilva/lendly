import api from '@/lib/api'
import { Item } from '@/types'

export interface ItemFilters {
  search?: string
  category?: string
  availability_type?: string
  neighborhood?: string
  city?: string
  lat?: number
  lng?: number
  radius_km?: number
  skip?: number
  limit?: number
}

export interface ItemPayload {
  title: string
  description?: string
  category: string
  photos?: string[]
  availability_type: string
  daily_rate?: number | null
  usage_rules?: string
  zip_code?: string
  neighborhood?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
}

export const itemsService = {
  list: (params?: ItemFilters) =>
    api.get<Item[]>('/items', { params }).then((r) => r.data),

  get: (id: string) => api.get<Item>(`/items/${id}`).then((r) => r.data),

  create: (data: ItemPayload) => api.post<Item>('/items', data).then((r) => r.data),

  update: (id: string, data: Partial<ItemPayload>) =>
    api.put<Item>(`/items/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/items/${id}`),

  activate: (id: string) => api.patch<Item>(`/items/${id}/activate`).then((r) => r.data),

  deactivate: (id: string) => api.patch<Item>(`/items/${id}/deactivate`).then((r) => r.data),

  myItems: () => api.get<Item[]>('/users/me/items').then((r) => r.data),
}
