'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import {
  LayoutDashboard, Users, Package, Clock, PackageCheck, CheckCircle2, XCircle,
  Flag, ShieldCheck, TrendingUp, Tag, MapPin,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AdminDashboardSummary, Category } from '@/types'
import { adminDashboardService } from '@/services/adminDashboard'
import { categoriesService } from '@/services/categories'
import { useAuth } from '@/contexts/AuthContext'
import { getCategoryLabel } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

function StatCard({ icon: Icon, label, value, valueClassName }: { icon: any; label: string; value: string | number; valueClassName?: string }) {
  return (
    <div className="bg-surface rounded-panel border border-border p-4">
      <div className="flex items-center gap-1.5 text-ink-subtle mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className={valueClassName ?? 'text-xl font-bold text-ink'}>{value}</div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AdminDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const t = useTranslations('Admin.Dashboard')

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback(() => {
    if (!user?.is_admin) return
    setLoading(true)
    adminDashboardService.get().then(setData).finally(() => setLoading(false))
  }, [user?.is_admin])

  useEffect(() => { load() }, [load])

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-primary" /></div>
  }

  const maxWeekly = data ? Math.max(1, ...data.signups_last_8_weeks.map((w) => w.count)) : 1
  const maxCategory = data ? Math.max(1, ...data.top_categories.map((c) => c.count)) : 1
  const maxCity = data ? Math.max(1, ...data.top_cities.map((c) => c.count)) : 1

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <LayoutDashboard className="w-6 h-6 text-info" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-8">
        {t('subtitle')}
      </p>

      {loading || !data ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={Users} label={t('activeUsers')} value={data.total_users} />
            <StatCard icon={Package} label={t('activeItems')} value={data.total_items} />
            <StatCard icon={Clock} label={t('pendingLoans')} value={data.loans_pending} />
            <StatCard icon={PackageCheck} label={t('inProgress')} value={data.loans_in_progress} />
            <StatCard icon={CheckCircle2} label={t('finished')} value={data.loans_finished} valueClassName="text-xl font-bold text-primary" />
            <StatCard icon={XCircle} label={t('cancelledOrRefused')} value={data.loans_cancelled_or_refused} />
          </div>

          {/* Pending actions — shortcuts into the existing queues */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/admin/moderation"
              className="flex items-center justify-between bg-surface rounded-panel border border-border p-4 hover:border-danger/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-danger" />
                <span className="text-sm font-medium text-ink">{t('pendingReports')}</span>
              </div>
              <span className={`text-lg font-bold ${data.pending_reports > 0 ? 'text-danger' : 'text-ink-subtle'}`}>
                {data.pending_reports}
              </span>
            </Link>
            <Link
              href="/admin/verification"
              className="flex items-center justify-between bg-surface rounded-panel border border-border p-4 hover:border-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-ink">{t('pendingVerifications')}</span>
              </div>
              <span className={`text-lg font-bold ${data.pending_verifications > 0 ? 'text-accent' : 'text-ink-subtle'}`}>
                {data.pending_verifications}
              </span>
            </Link>
          </div>

          {/* Weekly signups */}
          <div className="bg-surface rounded-panel border border-border p-5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted mb-4">
              <TrendingUp className="w-4 h-4 text-primary" /> {t('weeklySignups')}
            </div>
            <div className="flex items-end gap-2 h-24">
              {data.signups_last_8_weeks.map((w) => (
                <div key={w.week_start} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-[10px] text-ink-subtle">{w.count}</span>
                  <div
                    className="w-full bg-primary rounded-t-sm min-h-[2px]"
                    style={{ height: `${(w.count / maxWeekly) * 100}%` }}
                    title={t('weekOf', { week: w.week_start, count: w.count })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Top categories */}
            <div className="bg-surface rounded-panel border border-border p-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted mb-4">
                <Tag className="w-4 h-4 text-ink-subtle" /> {t('topCategories')}
              </div>
              <div className="space-y-2.5">
                {data.top_categories.map((c) => (
                  <div key={c.category} className="flex items-center gap-2 text-sm">
                    <span className="w-28 flex-shrink-0 text-ink-muted truncate">{getCategoryLabel(categories, c.category)}</span>
                    <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-ink-subtle">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top cities */}
            <div className="bg-surface rounded-panel border border-border p-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted mb-4">
                <MapPin className="w-4 h-4 text-ink-subtle" /> {t('topCities')}
              </div>
              <div className="space-y-2.5">
                {data.top_cities.map((c) => (
                  <div key={c.city} className="flex items-center gap-2 text-sm">
                    <span className="w-28 flex-shrink-0 text-ink-muted truncate">{c.city}</span>
                    <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / maxCity) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-ink-subtle">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
