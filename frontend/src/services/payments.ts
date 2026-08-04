import api from '@/lib/api'
import { MercadoPagoConnectStatus, Payment } from '@/types'

export const paymentsService = {
  getForRequest: (requestId: string) => api.get<Payment>(`/requests/${requestId}/payment`).then((r) => r.data),

  getMercadoPagoConnectUrl: () =>
    api.get<{ authorization_url: string }>('/users/me/mercadopago/connect').then((r) => r.data),

  handleMercadoPagoCallback: (code: string, state: string) =>
    api.post<MercadoPagoConnectStatus>('/users/me/mercadopago/callback', { code, state }).then((r) => r.data),

  getMercadoPagoStatus: () =>
    api.get<MercadoPagoConnectStatus>('/users/me/mercadopago/status').then((r) => r.data),
}
