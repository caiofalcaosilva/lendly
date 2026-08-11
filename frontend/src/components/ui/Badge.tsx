import { cn } from '@/lib/utils'
import { RequestStatus } from '@/types'

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple'

const colors: Record<Variant, string> = {
  green: 'bg-primary-subtle text-primary',
  blue: 'bg-info-subtle text-info',
  yellow: 'bg-warning-subtle text-warning',
  red: 'bg-danger-subtle text-danger',
  gray: 'bg-surface-2 text-ink-muted',
  purple: 'bg-accent-subtle text-accent',
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
  className?: string
}

export default function Badge({ children, variant = 'gray', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        colors[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
