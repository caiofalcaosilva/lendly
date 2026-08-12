'use client'
import { useEffect, useId, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const t = useTranslations('Common.Modal')

  // Callers pass onClose as a fresh inline function on every render; keeping
  // it out of the effect's deps (via this ref) stops the effect from
  // re-running - and re-stealing focus - on every keystroke inside the modal.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Land focus inside the dialog as soon as it mounts, instead of leaving
    // it on the trigger button now hidden behind the overlay.
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(focusables?.[0] ?? dialogRef.current)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      // Wrap Tab/Shift+Tab at the dialog's edges so keyboard focus can't
      // escape to the page underneath the overlay.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-surface rounded-panel shadow-overlay w-full ${maxWidth} max-h-[90vh] overflow-y-auto focus:outline-none`}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-border">
          <h2 id={titleId} className="text-lg font-semibold text-ink truncate min-w-0">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-1 rounded-control hover:bg-surface-2 text-ink-muted flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
