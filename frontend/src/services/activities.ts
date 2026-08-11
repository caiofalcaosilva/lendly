import api from '@/lib/api'
import { Activity, ActivityEventType, ActivityResourceType } from '@/types'

export const activitiesService = {
  // Cursor-based, not skip-based — same reasoning as notificationsService.list:
  // pass the id of the last activity already loaded to get the page right
  // after it, so a page stays stable even if new activity lands mid-visit.
  list: (
    beforeId?: string,
    limit = 20,
    event?: ActivityEventType,
    resourceType?: ActivityResourceType,
  ) =>
    api
      .get<Activity[]>('/activities/', {
        params: { before_id: beforeId, limit, event, resource_type: resourceType },
      })
      .then((r) => r.data),
}
