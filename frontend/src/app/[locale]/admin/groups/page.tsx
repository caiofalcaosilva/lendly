'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { UsersRound, Users, MapPin, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { AdminGroupSummary } from '@/types'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

const LIMIT = 50

export default function AdminGroupsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const locale = useLocale() as 'pt' | 'en'
  const [groups, setGroups] = useState<AdminGroupSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const t = useTranslations('Admin.Groups')

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback((searchTerm: string) => {
    setLoading(true)
    groupsService
      .all({ search: searchTerm || undefined, limit: LIMIT })
      .then((data) => {
        setGroups(data)
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user?.is_admin) return
    const handle = setTimeout(() => load(search), 300)
    return () => clearTimeout(handle)
  }, [user?.is_admin, search, load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await groupsService.all({
        search: search || undefined,
        skip: groups.length,
        limit: LIMIT,
      })
      setGroups((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-primary" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <UsersRound className="w-6 h-6 text-info" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-6">
        {t('subtitle')}
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-surface text-ink border border-border rounded-panel text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : groups.length === 0 ? (
        <EmptyState icon={UsersRound} title={t('emptyTitle')} />
      ) : (
        <>
          <div className="space-y-2.5">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="flex items-center justify-between gap-3 bg-surface rounded-panel border border-border p-4 hover:border-primary/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink truncate">{g.name}</span>
                    {g.is_discoverable && (
                      <Badge variant="blue" className="gap-1">
                        <MapPin className="w-3 h-3" /> {t('discoverable')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    {t('createdBy', { name: g.created_by_name, date: formatDate(g.created_at, locale) })}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-sm text-ink-muted flex-shrink-0">
                  <Users className="w-3.5 h-3.5" /> <span className="font-mono tabular-nums">{g.member_count}</span>
                </span>
              </Link>
            ))}
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
