import api from '@/lib/api'
import { User } from '@/types'

export const viewAsService = {
  start: (userId: string) =>
    api.post<{ access_token: string; user: User }>(`/admin/users/${userId}/view-as`).then((r) => r.data),
}
