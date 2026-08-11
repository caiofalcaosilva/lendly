'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LoanRequest } from '@/types'
import { requestsService } from '@/services/requests'
import { useAuth } from '@/contexts/AuthContext'
import RequestCard from '@/components/requests/RequestCard'
import ChatPanel from '@/components/requests/ChatPanel'
import Spinner from '@/components/ui/Spinner'

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [request, setRequest] = useState<LoanRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Requests.Id')

  const load = useCallback(() => {
    requestsService.get(id).then(setRequest).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-ink-muted">{t('notFound')}</h1>
      </div>
    )
  }

  const role = request.owner_id === user.id ? 'owner' : 'requester'

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> {t('backToDashboard')}
      </button>

      <h1 className="text-xl font-extrabold tracking-tight text-ink mb-4">{request.item_title}</h1>

      <div className="space-y-4">
        <RequestCard request={request} role={role} onUpdate={load} />
        <ChatPanel requestId={request.id} currentUserId={user.id} />
      </div>
    </div>
  )
}
