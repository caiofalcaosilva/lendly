'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, Package, Clock, PackageCheck, CheckCircle2, XCircle,
  Flag, ShieldCheck, TrendingUp, Tag, MapPin,
} from 'lucide-react'
import { AdminDashboardSummary, Category } from '@/types'
import { adminDashboardService } from '@/services/adminDashboard'
import { categoriesService } from '@/services/categories'
import { useAuth } from '@/contexts/AuthContext'
import { getCategoryLabel } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

function StatCard({ icon: Icon, label, value, valueClassName }: { icon: any; label: string; value: string | number; valueClassName?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className={valueClassName ?? 'text-xl font-bold text-gray-900 dark:text-gray-100'}>{value}</div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AdminDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

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
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  const maxWeekly = data ? Math.max(1, ...data.signups_last_8_weeks.map((w) => w.count)) : 1
  const maxCategory = data ? Math.max(1, ...data.top_categories.map((c) => c.count)) : 1
  const maxCity = data ? Math.max(1, ...data.top_cities.map((c) => c.count)) : 1

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <LayoutDashboard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard administrativo</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Visão geral da plataforma.
      </p>

      {loading || !data ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={Users} label="Usuários ativos" value={data.total_users} />
            <StatCard icon={Package} label="Itens ativos" value={data.total_items} />
            <StatCard icon={Clock} label="Empréstimos pendentes" value={data.loans_pending} />
            <StatCard icon={PackageCheck} label="Em andamento" value={data.loans_in_progress} />
            <StatCard icon={CheckCircle2} label="Concluídos" value={data.loans_finished} valueClassName="text-xl font-bold text-green-600 dark:text-green-400" />
            <StatCard icon={XCircle} label="Cancelados / recusados" value={data.loans_cancelled_or_refused} />
          </div>

          {/* Pending actions — shortcuts into the existing queues */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/admin/moderation"
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-red-300 dark:hover:border-red-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Denúncias pendentes</span>
              </div>
              <span className={`text-lg font-bold ${data.pending_reports > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {data.pending_reports}
              </span>
            </Link>
            <Link
              href="/admin/verification"
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Verificações pendentes</span>
              </div>
              <span className={`text-lg font-bold ${data.pending_verifications > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {data.pending_verifications}
              </span>
            </Link>
          </div>

          {/* Weekly signups */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" /> Cadastros por semana
            </div>
            <div className="flex items-end gap-2 h-24">
              {data.signups_last_8_weeks.map((w) => (
                <div key={w.week_start} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{w.count}</span>
                  <div
                    className="w-full bg-green-500 dark:bg-green-600 rounded-t-sm min-h-[2px]"
                    style={{ height: `${(w.count / maxWeekly) * 100}%` }}
                    title={`Semana de ${w.week_start}: ${w.count} cadastros`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Top categories */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Top categorias
              </div>
              <div className="space-y-2.5">
                {data.top_categories.map((c) => (
                  <div key={c.category} className="flex items-center gap-2 text-sm">
                    <span className="w-28 flex-shrink-0 text-gray-700 dark:text-gray-300 truncate">{getCategoryLabel(categories, c.category)}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-gray-400 dark:text-gray-500">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top cities */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Top cidades
              </div>
              <div className="space-y-2.5">
                {data.top_cities.map((c) => (
                  <div key={c.city} className="flex items-center gap-2 text-sm">
                    <span className="w-28 flex-shrink-0 text-gray-700 dark:text-gray-300 truncate">{c.city}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(c.count / maxCity) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-gray-400 dark:text-gray-500">{c.count}</span>
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
