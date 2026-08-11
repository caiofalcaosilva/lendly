'use client'
import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

type ToastVariant = 'success' | 'error'

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastItem extends ToastInput {
  id: string
}

interface ToastApi {
  show: (input: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const AUTO_DISMISS_MS = 5000

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const t = useTranslations('Common.Toast')

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((input: ToastInput) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...input, id }])
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  const success = useCallback((title: string, description?: string) => show({ title, description, variant: 'success' }), [show])
  const error = useCallback((title: string, description?: string) => show({ title, description, variant: 'error' }), [show])

  return (
    <ToastContext.Provider value={{ show, success, error }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-[100] flex flex-col gap-2 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter flex items-start gap-3 rounded-panel border border-border bg-surface p-3.5 shadow-elevated border-l-4 ${
              toast.variant === 'error' ? 'border-l-danger' : 'border-l-primary'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              {toast.description && <p className="text-xs text-ink-muted mt-0.5">{toast.description}</p>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label={t('dismiss')}
              className="text-ink-subtle hover:text-ink flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
