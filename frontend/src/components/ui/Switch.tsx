import { cn } from '@/lib/utils'

export default function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-primary' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  )
}
