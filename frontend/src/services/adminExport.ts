import api from '@/lib/api'

async function downloadCsv(url: string, filenamePrefix: string) {
  const response = await api.get(url, { responseType: 'blob' })
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
}
