import api from '@/lib/api'
import { User } from '@/types'

export interface UpdateProfileData {
  name?: string
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
}

export const usersService = {
  getMe: () => api.get<User>('/users/me').then((r) => r.data),

  updateMe: (data: UpdateProfileData) =>
    api.put<User>('/users/me', data).then((r) => r.data),

  getPublic: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),

  getPublicItems: (id: string) =>
    api.get<import('@/types').Item[]>(`/users/${id}/items`).then((r) => r.data),
}
