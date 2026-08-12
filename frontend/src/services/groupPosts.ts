import api from '@/lib/api'
import { GroupPost } from '@/types'

export const groupPostsService = {
  list: (groupId: string, beforeId?: string, limit = 20) =>
    api
      .get<GroupPost[]>(`/groups/${groupId}/posts`, { params: { before_id: beforeId, limit } })
      .then((r) => r.data),

  create: (groupId: string, body: string) =>
    api.post<GroupPost>(`/groups/${groupId}/posts`, { body }).then((r) => r.data),

  remove: (groupId: string, postId: string) =>
    api.delete(`/groups/${groupId}/posts/${postId}`),
}
