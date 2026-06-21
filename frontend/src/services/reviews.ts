import api from '@/lib/api'
import { Review } from '@/types'

export const reviewsService = {
  create: (requestId: string, data: { rating: number; comment?: string }) =>
    api.post<Review>(`/reviews/request/${requestId}`, data).then((r) => r.data),

  forUser: (userId: string) =>
    api.get<Review[]>(`/reviews/user/${userId}`).then((r) => r.data),
}
