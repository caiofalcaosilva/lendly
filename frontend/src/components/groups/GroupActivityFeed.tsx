'use client'
import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Activity } from '@/types'
import { activitiesService } from '@/services/activities'
import { useAuth } from '@/contexts/AuthContext'
import { ACTIVITY_DOMAIN_ICONS } from '@/lib/activityDisplay'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

const LIMIT = 20

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-3 bg-surface-2 rounded-control">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  )
}

export default function GroupActivityFeed({ groupId }: { groupId: string }) {
  const { user } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Activities')
  const tMural = useTranslations('Groups.ActivityFeed')

  const load = useCallback(() => {
    setLoading(true)
    activitiesService
      .list(undefined, LIMIT, undefined, 'group', groupId)
      .then((data) => {
        setActivities(data)
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
  }, [groupId])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const lastId = activities[activities.length - 1]?.id
      const data = await activitiesService.list(lastId, LIMIT, undefined, 'group', groupId)
      setActivities((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div>
      <p className="text-xs text-ink-subtle mb-3">{tMural('subtitle')}</p>
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : activities.length === 0 ? (
        <EmptyState icon={History} title={tMural('emptyTitle')} description={tMural('emptyDescription')} />
      ) : (
        <>
          <div className="space-y-2.5">
            {activities.map((a) => {
              const domain = a.event.split('.')[0]
              const Icon = ACTIVITY_DOMAIN_ICONS[domain] ?? History
              const isSelf = !!(a.actor && user && a.actor.id === user.id)
              const actorLabel = a.actor ? (isSelf ? t('you') : a.actor.name) : ''
              const text = t(`events.${a.event}`, {
                actor: actorLabel,
                resource: a.resource.title || '',
              })
              const detail =
                a.event === 'group.item_shared' && a.metadata.item_title
                  ? String(a.metadata.item_title)
                  : null

              return (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-surface-2 rounded-control">
                  <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{text}</p>
                    {detail && <p className="text-xs text-ink-subtle mt-0.5">{detail}</p>}
                    <p className="text-xs text-ink-subtle mt-1 font-mono tabular-nums">{formatDate(a.created_at, locale)}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
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
