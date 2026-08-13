import api from '@/lib/api'
import { Claim, FundSummary } from '@/types'

export const claimsService = {
  create: (requestId: string, data: { description: string; requested_amount: number }) =>
    api.post<Claim>(`/requests/${requestId}/claims`, data).then((r) => r.data),

  uploadPhoto: (claimId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<Claim>(`/claims/${claimId}/photos`, formData).then((r) => r.data)
  },

  get: (claimId: string) => api.get<Claim>(`/claims/${claimId}`).then((r) => r.data),

  list: (status?: string) =>
    api.get<Claim[]>('/claims', { params: status ? { status } : undefined }).then((r) => r.data),

  approve: (claimId: string, approvedAmount: number) =>
    api
      .patch<Claim>(`/claims/${claimId}/approve`, { approved_amount: approvedAmount })
      .then((r) => r.data),

  reject: (claimId: string, reason: string) =>
    api.patch<Claim>(`/claims/${claimId}/reject`, { reason }).then((r) => r.data),

  markPaid: (claimId: string) =>
    api.patch<Claim>(`/claims/${claimId}/mark-paid`).then((r) => r.data),

  fundSummary: () => api.get<FundSummary>('/claims/fund-summary').then((r) => r.data),
}
