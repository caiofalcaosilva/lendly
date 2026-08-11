'use client'
import { Control, Controller } from 'react-hook-form'
import { CheckCircle2, XCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CepStatus, maskCEP } from '@/lib/useCepLookup'
import Spinner from './Spinner'

interface Props {
  control: Control<any>
  status: CepStatus
  onBlurLookup: (value: string) => void
  label: string
  required?: boolean
  placeholder: string
  error?: string
  autoFilledText: string
  notFoundText: string
  errorText: string
}

// The CEP input, its lookup status icon, and the feedback line underneath —
// shared by AddressFields and LocationFields, which otherwise render a
// different set of fields around it.
export default function CepField({
  control,
  status,
  onBlurLookup,
  label,
  required,
  placeholder,
  error,
  autoFilledText,
  notFoundText,
  errorText,
}: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="relative">
        <Controller
          name="zip_code"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              value={field.value ?? ''}
              placeholder={placeholder}
              maxLength={9}
              onChange={(e) => field.onChange(maskCEP(e.target.value))}
              onBlur={(e) => { field.onBlur(); onBlurLookup(e.target.value) }}
              className={cn(
                'w-full border rounded-control px-3 py-2 pr-10 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-primary transition',
                error ? 'border-danger bg-danger-subtle' : 'border-border',
              )}
            />
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {status === 'idle' && <Search className="w-4 h-4 text-ink-subtle" />}
          {status === 'loading' && <Spinner className="w-4 h-4 text-primary" />}
          {status === 'found' && <CheckCircle2 className="w-4 h-4 text-primary" />}
          {(status === 'not_found' || status === 'error') && <XCircle className="w-4 h-4 text-danger" />}
        </div>
      </div>

      {status === 'found' && (
        <p className="text-xs text-primary mt-1 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> {autoFilledText}
        </p>
      )}
      {status === 'not_found' && <p className="text-xs text-danger mt-1">{notFoundText}</p>}
      {status === 'error' && <p className="text-xs text-warning mt-1">{errorText}</p>}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
