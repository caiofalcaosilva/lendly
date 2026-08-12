import api from '@/lib/api'
import { AdminGroupSummary, Group, GroupMember, GroupSummary, Item, NearbyGroup } from '@/types'

export const groupsService = {
  create: (data: { name: string; description?: string }) =>
    api.post<Group>('/groups', data).then((r) => r.data),

  mine: () => api.get<GroupSummary[]>('/groups/me').then((r) => r.data),

  get: (id: string) => api.get<Group>(`/groups/${id}`).then((r) => r.data),

  // Paginated and alphabetical — a group can have hundreds or thousands of
  // members, so these are never fetched in full by `get` above.
  members: (id: string, params: { search?: string; skip?: number; limit?: number } = {}) =>
    api.get<GroupMember[]>(`/groups/${id}/members`, { params }).then((r) => r.data),

  update: (id: string, data: { name?: string; description?: string; is_discoverable?: boolean }) =>
    api.patch<Group>(`/groups/${id}`, data).then((r) => r.data),

  join: (inviteCode: string) =>
    api.post<Group>('/groups/join', { invite_code: inviteCode }).then((r) => r.data),

  discover: (
    params: {
      lat?: number
      lng?: number
      lat2?: number
      lng2?: number
      radius_km?: number
      skip?: number
      limit?: number
    },
  ) => api.get<NearbyGroup[]>('/groups/discover', { params }).then((r) => r.data),

  joinDiscoverable: (id: string) =>
    api.post<Group>(`/groups/${id}/join`).then((r) => r.data),

  leave: (id: string) => api.post(`/groups/${id}/leave`).then((r) => r.data),

  remove: (id: string) => api.delete(`/groups/${id}`),

  // Newest first, paginated — a long-lived group can accumulate far more
  // items than fit on one screen.
  items: (id: string, params: { skip?: number; limit?: number } = {}) =>
    api.get<Item[]>(`/groups/${id}/items`, { params }).then((r) => r.data),

  vouch: (id: string, userId: string, note?: string) =>
    api
      .post<GroupMember>(`/groups/${id}/members/${userId}/vouch`, { note })
      .then((r) => r.data),

  unvouch: (id: string, userId: string) =>
    api.delete<GroupMember>(`/groups/${id}/members/${userId}/vouch`).then((r) => r.data),

  // Co-admins — creator-only to grant/revoke.
  addModerator: (id: string, userId: string) =>
    api.post<GroupMember>(`/groups/${id}/members/${userId}/moderator`).then((r) => r.data),

  removeModerator: (id: string, userId: string) =>
    api.delete<GroupMember>(`/groups/${id}/members/${userId}/moderator`).then((r) => r.data),

  regenerateInviteCode: (id: string) =>
    api.post<Group>(`/groups/${id}/invite-code/regenerate`).then((r) => r.data),

  refreshLocation: (id: string) =>
    api.post<Group>(`/groups/${id}/refresh-location`).then((r) => r.data),

  transferOwnership: (id: string, newCreatorId: string) =>
    api
      .post<Group>(`/groups/${id}/transfer-ownership`, { new_creator_id: newCreatorId })
      .then((r) => r.data),

  uploadPhoto: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<Group>(`/groups/${id}/photo`, formData).then((r) => r.data)
  },

  removePhoto: (id: string) => api.delete<Group>(`/groups/${id}/photo`).then((r) => r.data),

  // Group-level moderation (creator or a moderator) — distinct from
  // adminRemoveMember below, which is platform staff acting on any group.
  removeMember: (id: string, userId: string) =>
    api.delete<Group>(`/groups/${id}/members/${userId}`).then((r) => r.data),

  // Admin-only — every group on the platform, not just ones the admin
  // belongs to. GET /groups/{id} itself already lets an admin view any
  // group's detail, so this only needs a listing endpoint.
  all: (params: { search?: string; skip?: number; limit?: number } = {}) =>
    api.get<AdminGroupSummary[]>('/admin/groups', { params }).then((r) => r.data),

  // Admin-only moderation — delete any group, or kick a member out of one,
  // regardless of who created it.
  adminDelete: (id: string) => api.delete(`/admin/groups/${id}`),

  adminRemoveMember: (id: string, userId: string) =>
    api.delete<Group>(`/admin/groups/${id}/members/${userId}`).then((r) => r.data),
}
