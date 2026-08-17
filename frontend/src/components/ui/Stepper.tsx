import { cn } from '@/lib/utils'

/// Presentational only — the caller owns current-step state and
/// next/back navigation (see ItemForm.tsx).
export default function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold border flex-shrink-0',
                i < current
                  ? 'bg-primary text-primary-on border-primary'
                  : i === current
                    ? 'border-primary text-primary'
                    : 'border-border text-ink-subtle bg-surface-2',
              )}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span className={cn('text-sm whitespace-nowrap', i <= current ? 'text-ink font-medium' : 'text-ink-subtle')}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('flex-1 h-px mx-3', i < current ? 'bg-primary' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  )
}
