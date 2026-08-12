import api from '@/lib/api'
import { Report, ReportReason } from '@/types'

export const reportsService = {
  create: (data: {
    item_id?: string
    reported_user_id?: string
    reported_group_id?: string
    reason: ReportReason
    description?: string
  }) => api.post<Report>('/reports/', data).then((r) => r.data),

  list: (status?: string) =>
    api.get<Report[]>('/reports/', { params: status ? { status } : undefined }).then((r) => r.data),

  dismiss: (id: string) => api.patch<Report>(`/reports/${id}/dismiss`).then((r) => r.data),

  action: (id: string) => api.patch<Report>(`/reports/${id}/action`).then((r) => r.data),
}
