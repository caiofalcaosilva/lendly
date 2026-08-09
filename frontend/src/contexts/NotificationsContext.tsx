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
   * not via a manual button (see the roadmap decision this mirrors). */
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const unreadCountRef = useRef(0)
  unreadCountRef.current = unreadCount

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    notificationsService.list(0, RECENT_LIMIT).then((data) => {
      if (!cancelled) setNotifications(data)
    })
    notificationsService.unreadCount().then((data) => {
      if (!cancelled) setUnreadCount(data.count)
    })

    const connect = () => {
      const token = getAccessToken()
      if (!token || cancelled) return
      socket = new WebSocket(wsUrl(token))
      socket.onmessage = (event) => {
        const notif: AppNotification = JSON.parse(event.data)
        setNotifications((prev) => [notif, ...prev].slice(0, RECENT_LIMIT))
        setUnreadCount((prev) => prev + 1)
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

  const markAllRead = useCallback(() => {
    if (unreadCountRef.current === 0) return
    notificationsService.markAllRead()
    setUnreadCount(0)
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    )
  }, [])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
