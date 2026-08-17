import api from '@/lib/api'
import { Announcement, ItemsBanner, PlatformSettings } from '@/types'

export const platformSettingsService = {
  get: () => api.get<PlatformSettings>('/admin/settings').then((r) => r.data),

  update: (data: Partial<PlatformSettings>) =>
    api.patch<PlatformSettings>('/admin/settings', data).then((r) => r.data),

  // Public, unauthenticated — shown to every visitor, not just admins.
  announcement: () => api.get<Announcement>('/announcement').then((r) => r.data),

  // Public, unauthenticated — shown only on the items/browse page.
  itemsBanner: () => api.get<ItemsBanner>('/items-banner').then((r) => r.data),
}
