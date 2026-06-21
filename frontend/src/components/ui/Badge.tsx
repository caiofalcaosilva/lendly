import { cn } from '@/lib/utils'
import { RequestStatus } from '@/types'

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple'

const colors: Record<Variant, string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
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
