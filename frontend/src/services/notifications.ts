import api from '@/lib/api'
import { AppNotification, InAppNotificationPreferences, User } from '@/types'

export const notificationsService = {
  list: (skip = 0, limit = 20) =>
    api
      .get<AppNotification[]>('/notifications/', { params: { skip, limit } })
      .then((r) => r.data),

  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),

  markRead: (id: string) =>
    api.patch<AppNotification>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    api.patch<{ marked: number }>('/notifications/read-all').then((r) => r.data),

  updatePreferences: (data: Partial<InAppNotificationPreferences>) =>
    api.put<User>('/notifications/preferences', data).then((r) => r.data),
}
