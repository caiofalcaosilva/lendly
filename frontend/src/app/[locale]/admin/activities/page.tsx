'use client'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Download, History, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  ACTIVITY_EVENTS,
  ActivityEventType,
  ActivityResourceType,
  AdminActivity,
  AdminActivityFilters,
  AdminUserSummary,
} from '@/types'
import { adminActivitiesService } from '@/services/adminActivities'
import { adminExportService } from '@/services/adminExport'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { ACTIVITY_DOMAIN_ICONS, activityResourceHref } from '@/lib/activityDisplay'
import { formatCurrency, formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import Spinner from '@/components/ui/Spinner'
import UserPicker from '@/components/admin/UserPicker'

const LIMIT = 25

const RESOURCE_TYPES: ActivityResourceType[] = [
  'item', 'loan_request', 'payment', 'review', 'verification', 'group', 'report', 'user',
]

const EVENTS_BY_DOMAIN = ACTIVITY_EVENTS.reduce<Record<string, ActivityEventType[]>>(
  (acc, event) => {
    const domain = event.split('.')[0]
    ;(acc[domain] ??= []).push(event)
    return acc
  },
  {},
)

function humanizeEventAction(event: string): string {
  const action = event.split('.')[1] ?? event
  const spaced = action.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

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

export default function AdminActivitiesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Activities')
  const tEvents = useTranslations('Activities.events')
  const tExport = useTranslations('Admin.Export')
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const [recipient, setRecipient] = useState<AdminUserSummary | null>(null)
  const [actor, setActor] = useState<AdminUserSummary | null>(null)
  const [event, setEvent] = useState<ActivityEventType | ''>('')
  const [resourceType, setResourceType] = useState<ActivityResourceType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const buildFilters = (): AdminActivityFilters => ({
    recipientId: recipient?.id,
    actorId: actor?.id,
    event: event || undefined,
    resourceType: resourceType || undefined,
    dateFrom: dateFrom || undefined,
    // Inclusive of the whole selected day, not just its first instant.
    dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
  })

  useEffect(() => {
    if (!user?.is_admin) return
    setLoading(true)
    adminActivitiesService
      .list(buildFilters(), undefined, LIMIT)
      .then((data) => {
        setActivities(data)
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.is_admin, recipient, actor, event, resourceType, dateFrom, dateTo])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const lastId = activities[activities.length - 1]?.id
      const data = await adminActivitiesService.list(buildFilters(), lastId, LIMIT)
      setActivities((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await adminExportService.activities(buildFilters())
      toast.success(tExport('started'))
    } catch {
      toast.error(tExport('error'))
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setRecipient(null)
    setActor(null)
    setEvent('')
    setResourceType('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    recipient || actor || event || resourceType || dateFrom || dateTo

  if (authLoading || !user?.is_admin) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-info" />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          loading={exporting}
          onClick={handleExport}
          className="flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> {tExport('downloadCsv')}
        </Button>
      </div>
      <p className="text-ink-muted text-sm mb-6">{t('subtitle')}</p>

      <div className="bg-surface border border-border rounded-panel p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UserPicker
            label={t('filters.recipient')}
            placeholder={t('filters.searchUser')}
            selected={recipient}
            onChange={setRecipient}
          />
          <UserPicker
            label={t('filters.actor')}
            placeholder={t('filters.searchUser')}
            selected={actor}
            onChange={setActor}
          />
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
          <Select
            label={t('filters.resourceType')}
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value as ActivityResourceType | '')}
          >
            <option value="">{t('filters.allResourceTypes')}</option>
            {RESOURCE_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {t(`resourceTypes.${rt}`)}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            label={t('filters.dateFrom')}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            label={t('filters.dateTo')}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <div className="flex justify-end mt-3">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="w-3.5 h-3.5" /> {t('filters.clear')}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          icon={History}
          title={hasActiveFilters ? t('emptyFilteredTitle') : t('emptyTitle')}
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {activities.map((a) => {
              const domain = a.event.split('.')[0]
              const Icon = ACTIVITY_DOMAIN_ICONS[domain] ?? History
              const href = activityResourceHref(a.resource.type, a.resource.id, {
                asAdmin: true,
              })
              const actorLabel = a.actor?.name ?? t('system')
              const text = tEvents(a.event, {
                actor: actorLabel,
                resource: a.resource.title || '',
              })

              const content = (
                <>
                  <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{text}</p>
                    <p className="text-xs text-ink-subtle mt-0.5">
                      {t('recipientLabel', { name: a.recipient.name })}
                      {a.event.startsWith('payment.') &&
                        typeof a.metadata.gross_amount === 'number' &&
                        ` · ${formatCurrency(a.metadata.gross_amount as number, locale)}`}
                    </p>
                    <p className="text-xs text-ink-subtle mt-1.5">
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
