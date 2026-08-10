'use client'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { UsersRound, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GroupSummary } from '@/types'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

export default function AdminGroupsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Admin.Groups')

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (!user?.is_admin) return
    groupsService.all().then(setGroups).finally(() => setLoading(false))
  }, [user?.is_admin])

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <UsersRound className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        {t('subtitle')}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : groups.length === 0 ? (
        <EmptyState icon={UsersRound} title={t('emptyTitle')} />
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-green-300 dark:hover:border-green-700 transition-colors"
            >
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate min-w-0 mr-3">{g.name}</span>
              <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                <Users className="w-3.5 h-3.5" /> {g.member_count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
