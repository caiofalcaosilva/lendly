import api from '@/lib/api'
import { Group, GroupSummary, Item } from '@/types'

export const groupsService = {
  create: (data: { name: string; description?: string }) =>
    api.post<Group>('/groups', data).then((r) => r.data),

  mine: () => api.get<GroupSummary[]>('/groups/me').then((r) => r.data),

  get: (id: string) => api.get<Group>(`/groups/${id}`).then((r) => r.data),

  join: (inviteCode: string) =>
    api.post<Group>('/groups/join', { invite_code: inviteCode }).then((r) => r.data),

  leave: (id: string) => api.post(`/groups/${id}/leave`).then((r) => r.data),

  remove: (id: string) => api.delete(`/groups/${id}`),

  items: (id: string) => api.get<Item[]>(`/groups/${id}/items`).then((r) => r.data),

  vouch: (id: string, userId: string) =>
    api.post<Group>(`/groups/${id}/members/${userId}/vouch`).then((r) => r.data),

  unvouch: (id: string, userId: string) =>
    api.delete<Group>(`/groups/${id}/members/${userId}/vouch`).then((r) => r.data),

  // Admin-only — every group on the platform, not just ones the admin
  // belongs to. GET /groups/{id} itself already lets an admin view any
  // group's detail, so this only needs a listing endpoint.
  all: () => api.get<GroupSummary[]>('/admin/groups').then((r) => r.data),

  // Admin-only moderation — delete any group, or kick a member out of one,
  // regardless of who created it.
  adminDelete: (id: string) => api.delete(`/admin/groups/${id}`),

  adminRemoveMember: (id: string, userId: string) =>
    api.delete<Group>(`/admin/groups/${id}/members/${userId}`).then((r) => r.data),
}
