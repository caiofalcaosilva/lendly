'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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

  const load = useCallback(() => {
    requestsService.get(id).then(setRequest).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500 dark:text-gray-400">
        Solicitação não encontrada
      </div>
    )
  }

  const role = request.owner_id === user.id ? 'owner' : 'requester'

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao painel
      </button>

      <div className="space-y-4">
        <RequestCard request={request} role={role} onUpdate={load} />
        <ChatPanel requestId={request.id} currentUserId={user.id} />
      </div>
    </div>
  )
}
