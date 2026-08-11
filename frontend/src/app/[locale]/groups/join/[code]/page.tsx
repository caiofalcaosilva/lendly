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
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-primary-subtle rounded-full flex items-center justify-center mx-auto mb-4">
        <Users className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink mb-2">{t('title')}</h1>
      <p className="text-ink-muted text-sm mb-6">
        {t('subtitle')}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
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
