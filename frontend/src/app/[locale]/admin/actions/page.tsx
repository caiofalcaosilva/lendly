'use client'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { History, Ban, CheckCircle2, ShieldCheck, ShieldX, Flag, ShieldPlus, ShieldMinus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { AdminActionEntry, AdminActionType } from '@/types'
import { adminActionsService } from '@/services/adminActions'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

const ACTION_ICONS: Record<AdminActionType, { icon: any; color: string }> = {
  report_dismissed: { icon: Flag, color: 'text-gray-400 dark:text-gray-500' },
  report_actioned: { icon: Ban, color: 'text-red-500' },
  verification_approved: { icon: ShieldCheck, color: 'text-green-500' },
  verification_rejected: { icon: ShieldX, color: 'text-red-500' },
  user_activated: { icon: CheckCircle2, color: 'text-green-500' },
  user_deactivated: { icon: Ban, color: 'text-red-500' },
  item_activated: { icon: CheckCircle2, color: 'text-green-500' },
  item_deactivated: { icon: Ban, color: 'text-red-500' },
  user_promoted: { icon: ShieldPlus, color: 'text-purple-500' },
  user_demoted: { icon: ShieldMinus, color: 'text-gray-400 dark:text-gray-500' },
}

export default function AdminActionsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<AdminActionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Actions')

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (!user?.is_admin) return
    adminActionsService.list().then(setEntries).finally(() => setLoading(false))
  }, [user?.is_admin])

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        {t('subtitle')}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title={t('emptyTitle')} />
      ) : (
        <div className="space-y-2.5">
          {entries.map((e, i) => {
            const { icon: Icon, color } = ACTION_ICONS[e.action_type]
            const href = e.target_kind === 'user' ? `/users/${e.target_id}` : `/items/${e.target_id}`
            return (
              <div key={i} className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{e.actor_name}</span>
                    {' '}{t(`actionLabels.${e.action_type}`)}{' '}
                    <Link href={href} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                      {e.target_label}
                    </Link>
                  </p>
                  {e.detail && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{e.detail}</p>}
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(e.occurred_at, locale)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
