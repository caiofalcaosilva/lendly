import {
  History,
  Package,
  ClipboardCheck,
  CreditCard,
  Star,
  ShieldCheck,
  HeartHandshake,
  Flag,
  HandCoins,
  Lock,
  Shield,
} from 'lucide-react'
import { ACTIVITY_EVENTS, ActivityEventType, ActivityResourceType } from '@/types'

// One icon per domain (the event's prefix before the dot) rather than per
// exact event — 56 distinct events is too many to give each a unique icon
// without it becoming noise; the domain is what a glance needs to convey.
export const ACTIVITY_DOMAIN_ICONS: Record<string, typeof History> = {
  item: Package,
  rental: ClipboardCheck,
  payment: CreditCard,
  review: Star,
  verification: ShieldCheck,
  group: HeartHandshake,
  report: Flag,
  claim: HandCoins,
  account: Lock,
  admin: Shield,
}

// All 56-ish events, grouped by domain (the prefix before the dot) — same
// shape an event-type filter <select> needs, whether it's the admin's
// cross-user view or a user's own activity history.
export const EVENTS_BY_DOMAIN = ACTIVITY_EVENTS.reduce<Record<string, ActivityEventType[]>>(
  (acc, event) => {
    const domain = event.split('.')[0]
    ;(acc[domain] ??= []).push(event)
    return acc
  },
  {},
)

export function humanizeEventAction(event: string): string {
  const action = event.split('.')[1] ?? event
  const spaced = action.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function activityResourceHref(
  type: ActivityResourceType,
  id: string,
  opts: { asAdmin?: boolean } = {},
): string | null {
  switch (type) {
    case 'item':
      return `/items/${id}`
    case 'group':
      return `/groups/${id}`
    case 'loan_request':
      // GET /requests/{id} only allows the request's own owner/requester —
      // fine on the personal timeline (every row there is the viewer's
      // own), but an admin browsing someone else's activity isn't a
      // participant and would just hit a 403.
      return opts.asAdmin ? null : `/requests/${id}`
    default:
      // payment/review/verification/report/user don't have a page a
      // viewer can usefully land on — see historico-de-atividades.md.
      return null
  }
}
