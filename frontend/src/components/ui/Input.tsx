import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  prefix?: string
}

const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, helper, required, prefix, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-muted">
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-subtle pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full border rounded-control px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition',
              prefix && 'pl-9',
              error ? 'border-danger bg-danger-subtle' : 'border-border bg-surface',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {helper && !error && <p className="text-xs text-ink-muted">{helper}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
export default Input
