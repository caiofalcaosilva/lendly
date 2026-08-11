import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helper?: string
}

const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, error, helper, required, className, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink-muted">
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full border rounded-control px-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition',
            error ? 'border-danger bg-danger-subtle' : 'border-border',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
        {helper && !error && <p className="text-xs text-ink-muted">{helper}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'
export default Select
