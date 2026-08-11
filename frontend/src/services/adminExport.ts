import api from '@/lib/api'
import { AdminActivityFilters } from '@/types'

async function downloadCsv(
  url: string,
  filenamePrefix: string,
  params?: Record<string, string | undefined>,
) {
  const response = await api.get(url, { responseType: 'blob', params })
  const blob = new Blob([response.data], { type: 'text/csv' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export const adminExportService = {
  users: () => downloadCsv('/admin/export/users', 'lendly-usuarios'),
  items: () => downloadCsv('/admin/export/items', 'lendly-itens'),
  loanRequests: () => downloadCsv('/admin/export/loan-requests', 'lendly-emprestimos'),
  // Unlike the three above, this one is a filtered slice — whatever the
  // admin currently has set in /admin/activities, not the whole collection.
  activities: (filters: AdminActivityFilters) =>
    downloadCsv('/admin/export/activities', 'lendly-atividades', {
      recipient_id: filters.recipientId,
      actor_id: filters.actorId,
      event: filters.event,
      resource_type: filters.resourceType,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
    }),
}
