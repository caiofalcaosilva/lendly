import { cn } from '@/lib/utils'
import { RequestStatus } from '@/types'

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple'

const colors: Record<Variant, string> = {
  green: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
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
