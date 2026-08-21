'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { AppNotification } from '@/types'
import { notificationsService } from '@/services/notifications'
import { getAccessToken } from '@/lib/tokenStorage'
import { useAuth } from './AuthContext'

const RECENT_LIMIT = 20

function wsUrl(token: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const base = apiUrl.replace(/^http/, 'ws')
  return `${base}/notifications/ws?token=${encodeURIComponent(token)}`
}

interface NotificationsContextType {
  notifications: AppNotification[]
  unreadCount: number
  /** Marks every notification as read — called when the bell panel opens,
   * not via a manual button (see the roadmap decision this mirrors). Syncs
   * to any other open tab/device via the same WebSocket connection. */
  markAllRead: () => void
  /** Marks one notification as read without touching the rest. */
  markRead: (id: string) => void
  /** Deletes a single notification, read or not. */
  deleteNotification: (id: string) => void
  /** Bulk-deletes every already-read notification. Unread ones are never
   * touched by this, on either side — see the backend's clear_read_notifications. */
  clearRead: () => void
  /** TEMPORARY — Badging API diagnostic, see NotificationBell's debug block.
   * Remove both once the Android app-icon-badge investigation is closed. */
  badgeDebug: string
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const unreadCountRef = useRef(0)
  unreadCountRef.current = unreadCount
  const notificationsRef = useRef<AppNotification[]>([])
  notificationsRef.current = notifications

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const resync = () => {
      notificationsService.list(undefined, RECENT_LIMIT).then((data) => {
        if (!cancelled) setNotifications(data)
      })
      notificationsService.unreadCount().then((data) => {
        if (!cancelled) setUnreadCount(data.count)
      })
    }

    const connect = () => {
      const token = getAccessToken()
      if (!token || cancelled) return
      socket = new WebSocket(wsUrl(token))
      // Covers both the very first connect and every reconnect after a
      // dropped connection (laptop slept, tab backgrounded, flaky network)
      // — without this, anything created while disconnected never shows
      // up until some unrelated future push happens to refresh state.
      socket.onopen = resync
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.kind === 'notification') {
          const { kind: _kind, ...notif } = data
          setNotifications((prev) => [notif as AppNotification, ...prev].slice(0, RECENT_LIMIT))
          setUnreadCount((prev) => prev + 1)
        } else if (data.kind === 'read') {
          const target = notificationsRef.current.find((n) => n.id === data.id)
          const wasUnread = !!target && !target.read_at
          setNotifications((prev) =>
            prev.map((n) => (n.id === data.id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
          )
          if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
        } else if (data.kind === 'read_all') {
          setNotifications((prev) =>
            prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
          )
          setUnreadCount(0)
        } else if (data.kind === 'deleted') {
          setNotifications((prev) => prev.filter((n) => n.id !== data.id))
          if (data.was_unread) setUnreadCount((prev) => Math.max(0, prev - 1))
        } else if (data.kind === 'cleared_read') {
          setNotifications((prev) => prev.filter((n) => !n.read_at))
        }
      }
      socket.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000)
      }
    }
    connect()

    return () => {
      cancelled = true
      socket?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [isAuthenticated])

  // Surfaces the unread count in the tab title, so it's visible even when
  // Lendly is in a background tab. Always strips any prefix left by a
  // previous run first, so this stays correct without tracking the "real"
  // title separately.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '')
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${base}` : base
  }, [unreadCount])

  // Same idea as the tab title above, but on the home-screen app icon
  // (installed PWA only) — Badging API, unsupported browsers just no-op.
  // Only reflects reality while this tab's WebSocket is connected; there's
  // no push channel to update it once the app is closed.
  const [badgeDebug, setBadgeDebug] = useState('')
  useEffect(() => {
    const supported = 'setAppBadge' in navigator
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    const base = `supported=${supported} standalone=${standalone} ua=${navigator.userAgent}`
    if (!supported) {
      setBadgeDebug(`${base} | not called (unsupported)`)
      return
    }
    const call = unreadCount > 0 ? navigator.setAppBadge(unreadCount) : navigator.clearAppBadge()
    call
      .then(() => setBadgeDebug(`${base} | setAppBadge(${unreadCount}) OK`))
      .catch((e) => setBadgeDebug(`${base} | setAppBadge(${unreadCount}) ERROR: ${e}`))
  }, [unreadCount])

  const markAllRead = useCallback(() => {
    if (unreadCountRef.current === 0) return
    notificationsService.markAllRead()
    setUnreadCount(0)
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    )
  }, [])

  const markRead = useCallback((id: string) => {
    const target = notificationsRef.current.find((n) => n.id === id)
    if (!target || target.read_at) return
    notificationsService.markRead(id)
    setUnreadCount((prev) => Math.max(0, prev - 1))
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
  }, [])

  const deleteNotification = useCallback((id: string) => {
    const target = notificationsRef.current.find((n) => n.id === id)
    notificationsService.delete(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (target && !target.read_at) setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const clearRead = useCallback(() => {
    notificationsService.clearRead()
    setNotifications((prev) => prev.filter((n) => !n.read_at))
  }, [])

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, markAllRead, markRead, deleteNotification, clearRead, badgeDebug }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
