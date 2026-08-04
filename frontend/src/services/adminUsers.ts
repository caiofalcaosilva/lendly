import api from '@/lib/api'
import { AdminUserSummary, BulkActionResult } from '@/types'

export const adminUsersService = {
  list: (params?: { search?: string; skip?: number; limit?: number }) =>
    api.get<AdminUserSummary[]>('/admin/users', { params }).then((r) => r.data),

  get: (id: string) => api.get<AdminUserSummary>(`/admin/users/${id}`).then((r) => r.data),

  deactivate: (id: string) => api.patch<AdminUserSummary>(`/admin/users/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) => api.patch<AdminUserSummary>(`/admin/users/${id}/activate`).then((r) => r.data),

  promote: (id: string) => api.patch<AdminUserSummary>(`/admin/users/${id}/promote`).then((r) => r.data),

  demote: (id: string) => api.patch<AdminUserSummary>(`/admin/users/${id}/demote`).then((r) => r.data),

  bulkActivate: (ids: string[]) =>
    api.post<BulkActionResult>('/admin/users/bulk-activate', { ids }).then((r) => r.data),

  bulkDeactivate: (ids: string[]) =>
    api.post<BulkActionResult>('/admin/users/bulk-deactivate', { ids }).then((r) => r.data),
}
