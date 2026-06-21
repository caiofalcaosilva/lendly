import api from '@/lib/api'
import { LoanRequest } from '@/types'

export const requestsService = {
  create: (data: { item_id: string; pickup_date: string; expected_return_date: string; notes?: string }) =>
    api.post<LoanRequest>('/requests', data).then((r) => r.data),

  get: (id: string) => api.get<LoanRequest>(`/requests/${id}`).then((r) => r.data),

  accept: (id: string) => api.patch<LoanRequest>(`/requests/${id}/accept`).then((r) => r.data),
  refuse: (id: string) => api.patch<LoanRequest>(`/requests/${id}/refuse`).then((r) => r.data),
  start: (id: string) => api.patch<LoanRequest>(`/requests/${id}/start`).then((r) => r.data),
  finish: (id: string) => api.patch<LoanRequest>(`/requests/${id}/finish`).then((r) => r.data),
  cancel: (id: string) => api.patch<LoanRequest>(`/requests/${id}/cancel`).then((r) => r.data),

  sent: () => api.get<LoanRequest[]>('/users/me/requests/sent').then((r) => r.data),
  received: () => api.get<LoanRequest[]>('/users/me/requests/received').then((r) => r.data),
  history: () => api.get<LoanRequest[]>('/users/me/history').then((r) => r.data),
}
