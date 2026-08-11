import {
  History,
  Package,
  ClipboardCheck,
  CreditCard,
  Star,
  ShieldCheck,
  HeartHandshake,
  Flag,
  Lock,
  Shield,
} from 'lucide-react'
import { ActivityResourceType } from '@/types'

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
  account: Lock,
  admin: Shield,
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
