import api from '@/lib/api'
import { Review } from '@/types'

export const reviewsService = {
  create: (requestId: string, data: { rating: number; comment?: string }) =>
    api.post<Review>(`/reviews/request/${requestId}`, data).then((r) => r.data),

  forUser: (userId: string) =>
    api.get<Review[]>(`/reviews/user/${userId}`).then((r) => r.data),

  mine: () => api.get<Review[]>('/reviews/me/given').then((r) => r.data),

  // Admin-only moderation — removes a review directly, no report required.
  remove: (id: string) => api.delete(`/admin/reviews/${id}`),
}
