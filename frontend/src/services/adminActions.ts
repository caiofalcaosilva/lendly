import api from '@/lib/api'
import { AdminActionEntry } from '@/types'

export const adminActionsService = {
  list: (limit?: number) =>
    api.get<AdminActionEntry[]>('/admin/actions', { params: limit ? { limit } : undefined }).then((r) => r.data),
}
