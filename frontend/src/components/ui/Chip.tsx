import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: 'px-3.5 py-1.5 text-xs',
  xs: 'px-2.5 py-1 text-[11px]',
}
const SELECTED_TONE = {
  solid: 'bg-primary text-primary-on border-primary',
  subtle: 'bg-primary-subtle text-primary border-primary/40',
}
const UNSELECTED = 'bg-surface text-ink-muted border-border hover:border-primary/50 hover:text-primary'

export default function Chip({
  children,
  selected = false,
  tone = 'solid',
  size = 'sm',
  icon,
  onRemove,
  removeLabel = 'Remover',
  onClick,
  className,
}: {
  children: React.ReactNode
  selected?: boolean
  tone?: 'solid' | 'subtle'
  size?: 'sm' | 'xs'
  icon?: React.ReactNode
  onRemove?: () => void
  removeLabel?: string
  onClick?: () => void
  className?: string
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full font-medium border transition-all',
        SIZE[size],
        selected ? SELECTED_TONE[tone] : UNSELECTED,
        className,
      )}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:text-primary-hover transition-colors ml-0.5"
          aria-label={removeLabel}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Tag>
  )
}
