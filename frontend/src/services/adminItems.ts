import api from '@/lib/api'
import { AdminItemSummary, BulkActionResult } from '@/types'

export const adminItemsService = {
  list: (params?: { search?: string; skip?: number; limit?: number }) =>
    api.get<AdminItemSummary[]>('/admin/items', { params }).then((r) => r.data),

  get: (id: string) => api.get<AdminItemSummary>(`/admin/items/${id}`).then((r) => r.data),

  deactivate: (id: string) => api.patch<AdminItemSummary>(`/admin/items/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) => api.patch<AdminItemSummary>(`/admin/items/${id}/activate`).then((r) => r.data),

  bulkActivate: (ids: string[]) =>
    api.post<BulkActionResult>('/admin/items/bulk-activate', { ids }).then((r) => r.data),

  bulkDeactivate: (ids: string[]) =>
    api.post<BulkActionResult>('/admin/items/bulk-deactivate', { ids }).then((r) => r.data),
}
