'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationsContext'
import { formatDate } from '@/lib/utils'

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-96 flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Notificações
            </span>
          </div>

          <div className="overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3.5 py-8 text-sm text-gray-400 dark:text-gray-500 text-center">
                Nenhuma notificação ainda.
              </p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || '/notifications'}
                  onClick={() => setOpen(false)}
                  className={`block px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${
                    !n.read_at ? 'bg-green-50/60 dark:bg-green-900/10' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    {formatDate(n.created_at)}
                  </p>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-center text-xs font-medium text-green-700 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 transition-colors flex-shrink-0"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
