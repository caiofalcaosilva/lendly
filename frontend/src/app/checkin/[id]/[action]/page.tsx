'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PackageCheck, PackageOpen, CheckCircle2, AlertCircle } from 'lucide-react'
import { LoanRequest } from '@/types'
import { requestsService } from '@/services/requests'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

type Action = 'start' | 'finish'

const ACTION_COPY: Record<Action, { verb: string; icon: typeof PackageOpen; precondition: LoanRequest['status']; cta: string }> = {
  start: { verb: 'retirada', icon: PackageOpen, precondition: 'accepted', cta: 'Confirmar retirada' },
  finish: { verb: 'devolução', icon: PackageCheck, precondition: 'in_progress', cta: 'Confirmar devolução' },
}

export default function CheckinPage() {
  const { id, action } = useParams<{ id: string; action: string }>()
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [request, setRequest] = useState<LoanRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const load = useCallback(() => {
    requestsService.get(id).then(setRequest).catch(() => setRequest(null)).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/checkin/${id}/${action}`)
      return
    }
    if (isAuthenticated) load()
  }, [authLoading, isAuthenticated, id, action, load, router])

  const isValidAction = action === 'start' || action === 'finish'
  const copy = isValidAction ? ACTION_COPY[action as Action] : null

  const confirm = async () => {
    if (!copy) return
    setConfirming(true)
    setError('')
    try {
      if (action === 'start') await requestsService.start(id)
      else await requestsService.finish(id)
      setDone(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao confirmar')
    } finally {
      setConfirming(false)
    }
  }

  if (authLoading || loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  if (!copy) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500 dark:text-gray-400">
        Link de check-in inválido.
      </div>
    )
  }

  if (!request) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500 dark:text-gray-400">
        Solicitação não encontrada.
      </div>
    )
  }

  const isOwner = user?.id === request.owner_id
  const Icon = copy.icon

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
        <Icon className="w-7 h-7 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Confirmar {copy.verb}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {request.item_title} — {request.requester_name}
      </p>

      {done ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <p className="text-sm text-green-800 dark:text-green-300 font-medium">
            {copy.verb === 'retirada' ? 'Retirada confirmada!' : 'Devolução confirmada!'}
          </p>
          <Link href={`/requests/${id}`} className="text-sm text-green-700 dark:text-green-400 underline mt-3 inline-block">
            Ver solicitação
          </Link>
        </div>
      ) : !isOwner ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 flex items-start gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Só o dono do item pode confirmar {copy.verb}.
          </p>
        </div>
      ) : request.status !== copy.precondition ? (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-5 text-sm text-gray-500 dark:text-gray-400">
          Essa solicitação não está no estado esperado pra confirmar {copy.verb} agora.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Retirada: {formatDate(request.pickup_date)}<br />
            Devolução prevista: {formatDate(request.expected_return_date)}
          </p>
          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
          <Button onClick={confirm} loading={confirming} className="w-full">
            {copy.cta}
          </Button>
        </div>
      )}
    </div>
  )
}
