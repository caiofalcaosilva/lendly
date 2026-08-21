'use client'
import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ptBR, enUS } from 'react-day-picker/locale'
import { format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeKey } from '@/lib/useEscapeKey'

interface Props {
  label?: string
  error?: string
  required?: boolean
  value: string // 'yyyy-MM-dd', matches the native <input type="date"> shape
  onChange: (value: string) => void
  minDate?: Date
  disabledWeekdays?: number[] // JS Date#getDay() convention: 0=Sunday...6=Saturday
  locale?: 'pt' | 'en'
}

export default function DatePicker({
  label,
  error,
  required,
  value,
  onChange,
  minDate,
  disabledWeekdays,
  locale = 'pt',
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = value ? parseISO(value) : undefined

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])
  useEscapeKey(open, () => setOpen(false))

  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(disabledWeekdays && disabledWeekdays.length > 0 ? [{ dayOfWeek: disabledWeekdays }] : []),
  ]

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-ink-muted">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full flex items-center justify-between gap-2 border rounded-control px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition',
            error ? 'border-danger bg-danger-subtle' : 'border-border bg-surface',
          )}
        >
          <span className={cn('font-mono tabular-nums', value ? 'text-ink' : 'text-ink-subtle')}>
            {selected ? format(selected, 'dd/MM/yyyy') : '--/--/----'}
          </span>
          <CalendarDays className="w-4 h-4 text-ink-subtle flex-shrink-0" />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 bg-surface border border-border rounded-panel shadow-overlay p-2">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (!date) return
                onChange(format(date, 'yyyy-MM-dd'))
                setOpen(false)
              }}
              disabled={disabledMatchers}
              locale={locale === 'en' ? enUS : ptBR}
              classNames={{
                month_caption: 'flex items-center justify-center h-9 font-medium text-ink mb-1',
                caption_label: 'text-sm font-semibold',
                nav: 'flex items-center justify-between absolute inset-x-1 top-0 h-9 pointer-events-none',
                button_previous:
                  'p-1 rounded-control hover:bg-surface-2 text-ink-muted pointer-events-auto',
                button_next:
                  'p-1 rounded-control hover:bg-surface-2 text-ink-muted pointer-events-auto',
                chevron: 'w-4 h-4 fill-current',
                weekdays: 'flex',
                weekday: 'w-9 text-center text-xs font-medium text-ink-subtle',
                week: 'flex',
                day: 'w-9 h-9 text-center p-0',
                day_button:
                  'w-9 h-9 rounded-control text-sm font-mono tabular-nums text-ink hover:bg-surface-2 transition disabled:text-ink-subtle/40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                selected: '[&>button]:bg-primary [&>button]:text-primary-on [&>button]:hover:bg-primary',
                today: '[&>button]:font-bold [&>button]:text-primary',
              }}
            />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
