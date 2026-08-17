import api from '@/lib/api'
import { ItemsBannerSlide } from '@/types'

export const itemsBannerSlidesService = {
  // Public, unauthenticated — the ordered carousel shown on the items page.
  list: () => api.get<ItemsBannerSlide[]>('/items-banner-slides').then((r) => r.data),

  // Admin — the rest require an admin session.
  upload: (file: File, linkUrl?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (linkUrl) formData.append('link_url', linkUrl)
    return api
      .post<ItemsBannerSlide>('/admin/items-banner-slides', formData)
      .then((r) => r.data)
  },

  updateLink: (id: string, linkUrl: string) =>
    api
      .patch<ItemsBannerSlide>(`/admin/items-banner-slides/${id}`, { link_url: linkUrl || null })
      .then((r) => r.data),

  remove: (id: string) => api.delete(`/admin/items-banner-slides/${id}`),

  reorder: (slideIds: string[]) =>
    api
      .put<ItemsBannerSlide[]>('/admin/items-banner-slides/reorder', { slide_ids: slideIds })
      .then((r) => r.data),
}
