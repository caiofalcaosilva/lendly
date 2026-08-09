'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, MessageCircle, ShieldCheck, Package, Star, ClipboardCheck, HeartHandshake, Tag } from 'lucide-react'
import { AppNotification, NotificationType } from '@/types'
import { notificationsService } from '@/services/notifications'
import { useNotifications } from '@/contexts/NotificationsContext'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

const LIMIT = 20

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  request_status: ClipboardCheck,
  new_message: MessageCircle,
  verification_result: ShieldCheck,
  item_available: Package,
  review_reminder: Star,
  group_vouch: HeartHandshake,
  favorite_item_changed: Tag,
}

export default function NotificationsPage() {
  const { markAllRead } = useNotifications()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    notificationsService
      .list(0, LIMIT)
      .then((data) => {
        setNotifications(data)
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
    markAllRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await notificationsService.list(notifications.length, LIMIT)
      setNotifications((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notificações</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Histórico completo — as mais recentes primeiro.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8 text-green-600" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhuma notificação ainda"
          description="Avisos sobre suas solicitações, mensagens e verificações aparecem aqui."
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell
              return (
                <Link
                  key={n.id}
                  href={n.link || '#'}
                  className={`flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl border p-4 transition-colors ${
                    n.read_at
                      ? 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                      : 'border-green-200 dark:border-green-800 bg-green-50/40 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                    {n.body && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {formatDate(n.created_at)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
