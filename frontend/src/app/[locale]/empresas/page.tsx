'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Store, MapPin, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BusinessSummary } from '@/types'
import { usersService } from '@/services/users'
import EmptyState from '@/components/ui/EmptyState'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import Skeleton from '@/components/ui/Skeleton'

function SkeletonCard() {
  return (
    <div className="bg-surface rounded-panel border border-border p-5">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Empresas')

  useEffect(() => {
    usersService.listBusinesses().then(setBusinesses).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-muted text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : businesses.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((biz) => (
            <Link
              key={biz.id}
              href={`/users/${biz.id}`}
              className="bg-surface rounded-panel border border-border p-5 hover:border-business/40 hover:shadow-elevated transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-business-subtle flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-business" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{biz.trade_name || biz.company_name || biz.name}</p>
                  {biz.business_category && (
                    <p className="text-xs text-ink-muted truncate">{biz.business_category}</p>
                  )}
                </div>
              </div>

              {(biz.neighborhood || biz.city) && (
                <p className="flex items-center gap-1.5 text-xs text-ink-muted mb-2">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {[biz.neighborhood, biz.city].filter(Boolean).join(', ')}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium text-ink-muted">{biz.average_rating.toFixed(1)}</span>
                </div>
                <ReliabilityBadge score={biz.reliability_score} count={biz.reliability_count} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
