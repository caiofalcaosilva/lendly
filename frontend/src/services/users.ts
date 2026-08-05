import api from '@/lib/api'
import { BusinessSummary, OwnerAnalyticsSummary, PublicUser, User } from '@/types'

export interface UpdateProfileData {
  name?: string
  bio?: string
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
  company_name?: string
  trade_name?: string
  cnpj?: string
  business_category?: string
  business_phone?: string
  business_hours?: string
  website?: string
}

export const usersService = {
  getMe: () => api.get<User>('/users/me').then((r) => r.data),

  updateMe: (data: UpdateProfileData) =>
    api.put<User>('/users/me', data).then((r) => r.data),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<User>('/users/me/avatar', formData).then((r) => r.data)
  },

  removeAvatar: () => api.delete<User>('/users/me/avatar').then((r) => r.data),

  getPublic: (id: string) => api.get<PublicUser>(`/users/${id}`).then((r) => r.data),

  getPublicItems: (id: string) =>
    api.get<import('@/types').Item[]>(`/users/${id}/items`).then((r) => r.data),

  listBusinesses: () => api.get<BusinessSummary[]>('/users/businesses').then((r) => r.data),

  getMyAnalytics: () => api.get<OwnerAnalyticsSummary>('/users/me/analytics').then((r) => r.data),

  exportMyData: () => api.get<Record<string, unknown>>('/users/me/export').then((r) => r.data),

  deleteAccount: (password: string) =>
    api.delete('/users/me', { data: { password } }).then(() => undefined),
}
