import { cn } from '@/lib/utils'

export default function Radio({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label?: React.ReactNode
  disabled?: boolean
}) {
  const select = () => !disabled && onChange()
  return (
    <label className={cn('inline-flex items-center gap-2', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <span
        role="radio"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={select}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            select()
          }
        }}
        className={cn(
          'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors',
          checked ? 'border-primary' : 'border-border-strong',
        )}
      >
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  )
}
