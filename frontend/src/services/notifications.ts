import api from '@/lib/api'
import { AppNotification, InAppNotificationPreferences, NotificationType, User } from '@/types'

export const notificationsService = {
  // Cursor-based, not skip-based — pass the id of the last notification
  // already loaded to get the page right after it. Stays correct even if
  // new notifications arrive between page loads.
  list: (beforeId?: string, limit = 20, type?: NotificationType) =>
    api
      .get<AppNotification[]>('/notifications/', { params: { before_id: beforeId, limit, type } })
      .then((r) => r.data),

  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),

  markRead: (id: string) =>
    api.patch<AppNotification>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    api.patch<{ marked: number }>('/notifications/read-all').then((r) => r.data),

  delete: (id: string) => api.delete(`/notifications/${id}`),

  clearRead: () => api.delete<{ cleared: number }>('/notifications/read').then((r) => r.data),

  updatePreferences: (data: Partial<InAppNotificationPreferences>) =>
    api.put<User>('/notifications/preferences', data).then((r) => r.data),
}
