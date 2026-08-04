import api from '@/lib/api'
import { Category } from '@/types'

let cache: Category[] | null = null
let inflight: Promise<Category[]> | null = null

export const categoriesService = {
  // Public, unauthenticated — cached in memory after the first call so
  // every form/filter/label lookup on the page doesn't refetch. Dedupes
  // concurrent callers too (e.g. a grid of many ItemCards mounting at
  // once) so they share one request instead of firing one each.
  list: async (): Promise<Category[]> => {
    if (cache) return cache
    if (!inflight) {
      inflight = api.get<Category[]>('/categories').then((r) => {
        cache = r.data
        inflight = null
        return r.data
      })
    }
    return inflight
  },

  admin: {
    listAll: () => api.get<Category[]>('/admin/categories').then((r) => r.data),

    create: (data: { key: string; label: string }) =>
      api.post<Category>('/admin/categories', data).then((r) => {
        cache = null
        return r.data
      }),

    update: (key: string, data: { label?: string; is_active?: boolean }) =>
      api.patch<Category>(`/admin/categories/${key}`, data).then((r) => {
        cache = null
        return r.data
      }),

    createSubcategory: (categoryKey: string, data: { key: string; label: string }) =>
      api.post<Category>(`/admin/categories/${categoryKey}/subcategories`, data).then((r) => {
        cache = null
        return r.data
      }),

    updateSubcategory: (categoryKey: string, subcategoryKey: string, data: { label?: string; is_active?: boolean }) =>
      api.patch<Category>(`/admin/categories/${categoryKey}/subcategories/${subcategoryKey}`, data).then((r) => {
        cache = null
        return r.data
      }),
  },
}
