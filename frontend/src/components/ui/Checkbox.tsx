import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
}) {
  const toggle = () => !disabled && onChange(!checked)
  return (
    <label className={cn('inline-flex items-center gap-2', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className={cn(
          'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors',
          checked ? 'bg-primary border-primary text-primary-on' : 'bg-surface border-border-strong text-transparent',
        )}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  )
}
