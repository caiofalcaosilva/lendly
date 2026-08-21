'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Bell, MessageCircle, ShieldCheck, Package, Star, ClipboardCheck, HeartHandshake, Tag, CheckCheck, ShieldAlert, X, Trash2, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { AppNotification, NotificationType } from '@/types'
import { notificationsService } from '@/services/notifications'
import { useNotifications } from '@/contexts/NotificationsContext'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

const LIMIT = 20

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-4 bg-surface rounded-panel border border-border">
      <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  request_status: ClipboardCheck,
  new_message: MessageCircle,
  verification_result: ShieldCheck,
  item_available: Package,
  review_reminder: Star,
  group_vouch: HeartHandshake,
  favorite_item_changed: Tag,
  group_new_item: Package,
  group_membership_changed: Users,
  new_login: ShieldAlert,
}

const TYPE_KEYS: NotificationType[] = [
  'request_status', 'new_message', 'verification_result', 'item_available',
  'review_reminder', 'group_vouch', 'favorite_item_changed', 'group_new_item',
  'group_membership_changed', 'new_login',
]

export default function NotificationsPage() {
  const {
    notifications: liveNotifications,
    unreadCount,
    markAllRead,
    markRead,
    deleteNotification,
    clearRead,
  } = useNotifications()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Notifications')

  useEffect(() => {
    setLoading(true)
    notificationsService
      .list(undefined, LIMIT, typeFilter || undefined)
      .then((data) => {
        setNotifications(data)
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
  }, [typeFilter])

  // Catches anything pushed live over the WebSocket while this page is
  // open — the page's own fetch above only runs once per filter change,
  // so without this a notification created mid-visit wouldn't show up
  // until a manual reload.
  useEffect(() => {
    if (liveNotifications.length === 0) return
    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id))
      const fresh = liveNotifications.filter(
        (n) => !existingIds.has(n.id) && (!typeFilter || n.type === typeFilter),
      )
      return fresh.length ? [...fresh, ...prev] : prev
    })
  }, [liveNotifications, typeFilter])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const lastId = notifications[notifications.length - 1]?.id
      const data = await notificationsService.list(lastId, LIMIT, typeFilter || undefined)
      setNotifications((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleMarkAllRead = () => {
    markAllRead()
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    )
  }

  const handleClearRead = () => {
    clearRead()
    setNotifications((prev) => prev.filter((n) => !n.read_at))
  }

  const handleDelete = (id: string) => {
    deleteNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleOpen = (n: AppNotification) => {
    if (!n.read_at) {
      markRead(n.id)
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      )
    }
  }

  const hasReadNotifications = notifications.some((n) => n.read_at)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
          <p className="text-ink-muted text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="w-3.5 h-3.5" /> {t('markAllRead')}
            </Button>
          )}
          {hasReadNotifications && (
            <Button variant="outline" size="sm" onClick={handleClearRead}>
              <Trash2 className="w-3.5 h-3.5" /> {t('clearRead')}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="notif-type-filter" className="sr-only">
          {t('filterByType')}
        </label>
        <Select
          id="notif-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NotificationType | '')}
          className="text-sm py-1.5 w-auto"
        >
          <option value="">{t('allTypes')}</option>
          {TYPE_KEYS.map((value) => (
            <option key={value} value={value}>
              {t(`types.${value}`)}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={typeFilter ? t('emptyFilteredTitle') : t('emptyTitle')}
          description={
            typeFilter
              ? t('emptyFilteredDescription')
              : t('emptyDescription')
          }
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell
              return (
                <div
                  key={n.id}
                  className={`group relative flex items-start bg-surface rounded-panel border transition-colors ${
                    n.read_at
                      ? 'border-border hover:border-border-strong'
                      : 'border-primary/30 bg-primary-subtle hover:border-primary/50'
                  }`}
                >
                  <Link
                    href={n.link || '#'}
                    onClick={() => handleOpen(n)}
                    className="flex items-start gap-3 p-4 flex-1 min-w-0"
                    aria-label={`${n.read_at ? '' : t('unreadPrefix')}${n.title}${n.body ? `, ${n.body}` : ''}, ${formatDate(n.created_at, locale)}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.body && (
                        <p className="text-sm text-ink-muted mt-0.5">{n.body}</p>
                      )}
                      <p className="text-xs text-ink-subtle mt-1.5 font-mono tabular-nums">
                        {formatDate(n.created_at, locale)}
                      </p>
                    </div>
                    {!n.read_at && (
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5"
                      />
                    )}
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(n.id)
                    }}
                    aria-label={t('deleteNotification', { title: n.title })}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-control text-ink-subtle opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger hover:bg-danger-subtle transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
