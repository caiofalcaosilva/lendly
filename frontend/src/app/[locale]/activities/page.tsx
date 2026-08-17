'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { History } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Activity, ActivityEventType } from '@/types'
import { activitiesService } from '@/services/activities'
import { useAuth } from '@/contexts/AuthContext'
import { ACTIVITY_DOMAIN_ICONS, EVENTS_BY_DOMAIN, humanizeEventAction, activityResourceHref } from '@/lib/activityDisplay'
import { formatCurrency, formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import Select from '@/components/ui/Select'

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

// A handful of events carry metadata worth a second line — the same
// restraint the backend applied when deciding what goes in `metadata` at
// all (see docs/historico-de-atividades.md).
function activityDetail(a: Activity, locale: 'pt' | 'en'): React.ReactNode {
  if (a.event === 'account.new_login') {
    const ua = a.metadata.user_agent as string | undefined
    const ip = a.metadata.ip_address as string | undefined
    return ua ? `${ua}${ip ? ` · ${ip}` : ''}` : ip || null
  }
  if (a.event === 'verification.rejected' && a.metadata.reason) {
    return String(a.metadata.reason)
  }
  if (a.event === 'account.email_changed' && a.metadata.new_email) {
    return String(a.metadata.new_email)
  }
  if (a.event.startsWith('payment.') && typeof a.metadata.gross_amount === 'number') {
    return <span className="font-mono tabular-nums">{formatCurrency(a.metadata.gross_amount, locale)}</span>
  }
  if (a.event === 'group.item_shared' && a.metadata.item_title) {
    return String(a.metadata.item_title)
  }
  return null
}

export default function ActivitiesPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [event, setEvent] = useState<ActivityEventType | ''>('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Activities')

  useEffect(() => {
    setLoading(true)
    activitiesService
      .list(undefined, LIMIT, event || undefined)
      .then((data) => {
        setActivities(data)
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
  }, [event])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const lastId = activities[activities.length - 1]?.id
      const data = await activitiesService.list(lastId, LIMIT, event || undefined)
      setActivities((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <History className="w-6 h-6 text-info" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-6">{t('subtitle')}</p>

      <div className="mb-6 max-w-xs">
        <Select
          label={t('filters.event')}
          value={event}
          onChange={(e) => setEvent(e.target.value as ActivityEventType | '')}
        >
          <option value="">{t('filters.allEvents')}</option>
          {Object.entries(EVENTS_BY_DOMAIN).map(([domain, events]) => (
            <optgroup key={domain} label={t(`domains.${domain}`)}>
              {events.map((ev) => (
                <option key={ev} value={ev}>
                  {humanizeEventAction(ev)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <EmptyState icon={History} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="space-y-2.5">
            {activities.map((a) => {
              const domain = a.event.split('.')[0]
              const Icon = ACTIVITY_DOMAIN_ICONS[domain] ?? History
              const isSelf = !!(a.actor && user && a.actor.id === user.id)
              const actorLabel = a.actor ? (isSelf ? t('you') : a.actor.name) : ''
              const href = activityResourceHref(a.resource.type, a.resource.id)
              const text = t(`events.${a.event}`, {
                actor: actorLabel,
                resource: a.resource.title || '',
              })
              const detail = activityDetail(a, locale)

              const content = (
                <>
                  <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{text}</p>
                    {detail && <p className="text-xs text-ink-subtle mt-0.5">{detail}</p>}
                    <p className="text-xs text-ink-subtle mt-1.5 font-mono tabular-nums">
                      {formatDate(a.created_at, locale)}
                    </p>
                  </div>
                </>
              )

              return href ? (
                <Link
                  key={a.id}
                  href={href}
                  className="flex items-start gap-3 bg-surface rounded-panel border border-border p-4 hover:border-border-strong transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={a.id}
                  className="flex items-start gap-3 bg-surface rounded-panel border border-border p-4"
                >
                  {content}
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
