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

// applicationServerKey needs raw bytes, not the base64url string the
// backend/env var carries.
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}

type PushStatus = 'unsupported' | 'unsubscribed' | 'subscribed'

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
  /** 'unsupported' when the browser has no Push API (or no VAPID key is
   * configured), 'unsubscribed'/'subscribed' otherwise. */
  pushStatus: PushStatus
  /** Requests notification permission and subscribes this device/browser
   * to Web Push — no-ops if pushStatus is 'unsupported'. */
  subscribeToPush: () => void
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

  // Home-screen app icon badge on installed PWAs — Badging API,
  // unsupported browsers just no-op. Only reflects reality while this
  // tab's WebSocket is connected (no push channel updates it once the
  // app is closed) — the real Web Push subscription below is what makes
  // a fresh notification arrive (and re-set this) even while closed.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    if (unreadCount > 0) {
      navigator.setAppBadge(unreadCount).catch(() => {})
    } else {
      navigator.clearAppBadge().catch(() => {})
    }
  }, [unreadCount])

  // Service Worker registration — Web Push only (see public/sw.js): no
  // fetch handler, doesn't cache or intercept anything.
  const [pushStatus, setPushStatus] = useState<PushStatus>('unsupported')
  useEffect(() => {
    if (!isAuthenticated) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const existing = await registration.pushManager.getSubscription()
      setPushStatus(existing ? 'subscribed' : 'unsubscribed')
    })
  }, [isAuthenticated])

  const subscribeToPush = useCallback(() => {
    if (pushStatus === 'unsupported') return
    Notification.requestPermission().then((permission) => {
      if (permission !== 'granted') return
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        })
        await notificationsService.pushSubscribe(subscription.toJSON())
        setPushStatus('subscribed')
      })
    })
  }, [pushStatus])

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
      value={{
        notifications,
        unreadCount,
        markAllRead,
        markRead,
        deleteNotification,
        clearRead,
        pushStatus,
        subscribeToPush,
      }}
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
