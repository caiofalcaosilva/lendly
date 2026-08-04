import api from '@/lib/api'
import { Message } from '@/types'

export const messagesService = {
  list: (requestId: string) =>
    api.get<Message[]>(`/requests/${requestId}/messages`).then((r) => r.data),

  send: (requestId: string, text: string) =>
    api.post<Message>(`/requests/${requestId}/messages`, { text }).then((r) => r.data),
}
