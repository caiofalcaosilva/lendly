'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Groups.Join.Code')

  const handleJoin = async () => {
    setJoining(true)
    setError('')
    try {
      const group = await groupsService.join(code)
      router.push(`/groups/${group.id}`)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('invalidInvite'))
    } finally {
      setJoining(false)
    }
  }

  // Admins never join as members — the invite link just takes them
  // straight to the group's (already-accessible) read-only view.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.is_admin) {
      handleJoin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user?.is_admin])

  if (!isLoading && isAuthenticated && user?.is_admin && !error) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('title')}</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('subtitle')}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!isLoading && !isAuthenticated ? (
        <Link href={`/login?redirect=/groups/join/${code}`}>
          <Button className="w-full" size="lg">{t('loginToAccept')}</Button>
        </Link>
      ) : (
        <Button className="w-full" size="lg" loading={joining} onClick={handleJoin}>
          {t('joinGroup')}
        </Button>
      )}
    </div>
  )
}
