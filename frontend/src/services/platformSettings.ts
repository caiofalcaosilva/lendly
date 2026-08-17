import api from '@/lib/api'
import { Announcement, PlatformSettings } from '@/types'

export const platformSettingsService = {
  get: () => api.get<PlatformSettings>('/admin/settings').then((r) => r.data),

  update: (data: Partial<PlatformSettings>) =>
    api.patch<PlatformSettings>('/admin/settings', data).then((r) => r.data),

  // Public, unauthenticated — shown to every visitor, not just admins.
  announcement: () => api.get<Announcement>('/announcement').then((r) => r.data),
}
