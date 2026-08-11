import api from '@/lib/api'
import { AdminActivity, AdminActivityFilters } from '@/types'

export const adminActivitiesService = {
  // Cursor-based, same reasoning as activitiesService.list — pass the id
  // of the last row already loaded to get the page right after it.
  list: (filters: AdminActivityFilters, beforeId?: string, limit = 20) =>
    api
      .get<AdminActivity[]>('/admin/activities', {
        params: {
          recipient_id: filters.recipientId,
          actor_id: filters.actorId,
          event: filters.event,
          resource_type: filters.resourceType,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          before_id: beforeId,
          limit,
        },
      })
      .then((r) => r.data),
}
