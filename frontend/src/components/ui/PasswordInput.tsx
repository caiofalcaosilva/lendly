import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  helper?: string
}

const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ label, error, helper, required, className, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const t = useTranslations('Common.PasswordInput')
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
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={cn(
              'w-full border rounded-control px-3 py-2 pr-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition',
              error ? 'border-danger bg-danger-subtle' : 'border-border bg-surface',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('hide') : t('show')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {helper && !error && <p className="text-xs text-ink-muted">{helper}</p>}
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
export default PasswordInput
