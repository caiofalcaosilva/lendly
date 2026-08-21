'use client'
import { useCallback, useEffect, useState } from 'react'
import NextImage from 'next/image'
import { Link, useRouter } from '@/i18n/navigation'
import { ArrowLeft, MapPin, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { NearbyGroup } from '@/types'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

// Best-effort live location, mirroring items/ItemsClient.tsx's useLiveLocation —
// falls back silently to the profile address alone on denial/error.
function useLiveLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  return location
}

function SkeletonCard() {
  return (
    <div className="flex items-center justify-between bg-surface rounded-panel border border-border p-4">
      <div className="flex items-center gap-3 min-w-0 mr-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-8 w-20 flex-shrink-0" />
    </div>
  )
}

export default function DiscoverClient() {
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const live = useLiveLocation()
  const [groups, setGroups] = useState<NearbyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const t = useTranslations('Groups.Discover')

  const DISCOVER_LIMIT = 20

  const hasHomeLocation = !!(user?.latitude && user?.longitude)

  const load = useCallback(() => {
    if (!hasHomeLocation && !live) {
      setLoading(false)
      return
    }
    setLoading(true)
    groupsService
      .discover({
        lat: user?.latitude ?? undefined,
        lng: user?.longitude ?? undefined,
        lat2: live?.lat,
        lng2: live?.lng,
        limit: DISCOVER_LIMIT,
      })
      .then((data) => {
        setGroups(data)
        setHasMore(data.length === DISCOVER_LIMIT)
      })
      .catch(() => toast.error(t('error')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHomeLocation, live, user?.latitude, user?.longitude])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await groupsService.discover({
        lat: user?.latitude ?? undefined,
        lng: user?.longitude ?? undefined,
        lat2: live?.lat,
        lng2: live?.lng,
        skip: groups.length,
        limit: DISCOVER_LIMIT,
      })
      setGroups((prev) => [...prev, ...data])
      setHasMore(data.length === DISCOVER_LIMIT)
    } catch {
      toast.error(t('error'))
    } finally {
      setLoadingMore(false)
    }
  }

  const handleJoin = async (groupId: string) => {
    setJoiningId(groupId)
    try {
      await groupsService.joinDiscoverable(groupId)
      setJoinedIds((prev) => new Set(prev).add(groupId))
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g)),
      )
      toast.success(t('joined'))
    } catch {
      toast.error(t('joinError'))
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> {t('back')}
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-muted text-sm mt-1">{t('subtitle')}</p>
      </div>

      {!hasHomeLocation && !live ? (
        <EmptyState
          icon={MapPin}
          title={t('noLocationTitle')}
          description={t('noLocationDescription')}
          action={{ label: t('goToProfile'), onClick: () => router.push('/profile') }}
        />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const joined = joinedIds.has(group.id)
            return (
              <div
                key={group.id}
                className="flex items-center justify-between gap-3 bg-surface rounded-panel border border-border p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {group.photo_url ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <NextImage src={group.photo_url} alt={group.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-subtle flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{group.name}</p>
                    <p className="text-xs text-ink-subtle truncate">
                      {t('memberCount', { count: group.member_count })}
                      {' · '}
                      {t('distanceAway', { km: group.distance_km })}
                      {group.neighborhood ? ` · ${group.neighborhood}` : ''}
                    </p>
                    {group.description && (
                      <p className="text-xs text-ink-muted truncate mt-0.5">{group.description}</p>
                    )}
                  </div>
                </div>
                {joined ? (
                  <Link href={`/groups/${group.id}`} className="flex-shrink-0">
                    <Button size="sm" variant="outline">
                      {t('viewGroup')}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    loading={joiningId === group.id}
                    onClick={() => handleJoin(group.id)}
                    className="flex-shrink-0"
                  >
                    {t('join')}
                  </Button>
                )}
              </div>
            )
          })}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
