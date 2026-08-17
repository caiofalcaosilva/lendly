'use client'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Bell } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useNotifications } from '@/contexts/NotificationsContext'
import { formatDate } from '@/lib/utils'
import { useEscapeKey } from '@/lib/useEscapeKey'

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.NotificationBell')

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEscapeKey(open, () => setOpen(false))

  const toggle = () => {
    setOpen((v) => {
      const next = !v
      if (next) markAllRead()
      return next
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative text-ink-muted hover:text-ink transition-colors"
        aria-label={unreadCount > 0 ? t('ariaLabelUnread', { count: unreadCount }) : t('ariaLabel')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-danger text-danger-on text-[10px] font-semibold leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {unreadCount > 0 ? t('unreadStatus', { count: unreadCount }) : ''}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-panel shadow-overlay z-50 max-h-96 flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              {t('title')}
            </span>
          </div>

          <div className="overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3.5 py-8 text-sm text-ink-subtle text-center">
                {t('empty')}
              </p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || '/notifications'}
                  onClick={() => setOpen(false)}
                  className={`block px-3.5 py-2.5 hover:bg-surface-2 transition-colors border-b border-border last:border-0 ${
                    !n.read_at ? 'bg-primary-subtle' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-ink leading-snug">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[11px] font-mono tabular-nums text-ink-subtle mt-1">
                    {formatDate(n.created_at, locale)}
                  </p>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-center text-xs font-medium text-primary hover:bg-surface-2 border-t border-border transition-colors flex-shrink-0"
          >
            {t('viewAll')}
          </Link>
        </div>
      )}
    </div>
  )
}
