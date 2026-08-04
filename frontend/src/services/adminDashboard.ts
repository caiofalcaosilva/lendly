import api from '@/lib/api'
import { AdminDashboardSummary } from '@/types'

export const adminDashboardService = {
  get: () => api.get<AdminDashboardSummary>('/admin/dashboard').then((r) => r.data),
}
