import { cn } from '@/lib/utils'
import { RequestStatus } from '@/types'

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple' | 'business' | 'clay'

const colors: Record<Variant, string> = {
  green: 'bg-primary-subtle text-primary',
  blue: 'bg-info-subtle text-info',
  yellow: 'bg-warning-subtle text-warning',
  red: 'bg-danger-subtle text-danger',
  gray: 'bg-surface-2 text-ink-muted',
  purple: 'bg-accent-subtle text-accent',
  business: 'bg-business-subtle text-business',
  clay: 'bg-clay-subtle text-clay',
}

// Only used when `bordered` is set (identity/trust badges — BusinessBadge,
// ReliabilityBadge, ReputationBadges). `gray` is the "new account" tone and
// deliberately isn't a tint of its own text color like the others.
const borderColors: Record<Variant, string> = {
  green: 'border-primary/30',
  blue: 'border-info/30',
  yellow: 'border-warning/30',
  red: 'border-danger/30',
  gray: 'border-border-strong',
  purple: 'border-accent/30',
  business: 'border-business/30',
  clay: 'border-clay/30',
}

export const STATUS_COLORS: Record<RequestStatus, Variant> = {
  pending: 'yellow',
  accepted: 'green',
  refused: 'red',
  in_progress: 'blue',
  finished: 'gray',
  cancelled: 'red',
}

interface Props {
  children: React.ReactNode
  variant?: Variant
  icon?: React.ReactNode
  bordered?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export default function Badge({ children, variant = 'gray', icon, bordered = false, size, className }: Props) {
  const sizeClasses =
    size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : size === 'md' ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-0.5'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium flex-shrink-0',
        colors[variant],
        bordered && ['border', borderColors[variant]],
        sizeClasses,
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
