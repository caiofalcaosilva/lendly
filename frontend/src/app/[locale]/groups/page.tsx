'use client'
import { useEffect, useState } from 'react'
import NextImage from 'next/image'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { Users, Plus, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GroupSummary } from '@/types'
import { groupsService } from '@/services/groups'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between bg-surface rounded-panel border border-border p-4">
      <div className="flex items-center gap-3 min-w-0 mr-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-3 w-16 flex-shrink-0" />
    </div>
  )
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Groups')

  useEffect(() => {
    groupsService.mine().then(setGroups).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
          <p className="text-ink-muted text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href="/groups/discover">
            <Button variant="outline">
              <MapPin className="w-4 h-4" /> {t('discoverNearby')}
            </Button>
          </Link>
          <Link href="/groups/new">
            <Button>
              <Plus className="w-4 h-4" /> {t('createGroup')}
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={{ label: t('createGroup'), onClick: () => router.push('/groups/new') }}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex items-center justify-between bg-surface rounded-panel border border-border p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 mr-3">
                {group.photo_url ? (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <NextImage src={group.photo_url} alt={group.name} fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-subtle flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                )}
                <span className="font-medium text-ink truncate">{group.name}</span>
              </div>
              <span className="text-xs text-ink-subtle flex-shrink-0">
                {t('memberCount', { count: group.member_count })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
