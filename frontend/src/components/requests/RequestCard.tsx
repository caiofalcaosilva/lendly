'use client'
import { useState } from 'react'
import { Calendar, Package } from 'lucide-react'
import { LoanRequest, REQUEST_STATUS_LABELS } from '@/types'
import { requestsService } from '@/services/requests'
import { formatDate } from '@/lib/utils'
import Badge, { STATUS_COLORS } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ReviewModal from '@/components/reviews/ReviewModal'

interface Props {
  request: LoanRequest
  role: 'requester' | 'owner'
  onUpdate: () => void
}

export default function RequestCard({ request: req, role, onUpdate }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)

  const act = async (action: () => Promise<unknown>, key: string) => {
    setLoading(key)
    try {
      await action()
      onUpdate()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{req.item_title}</span>
          </div>
          <p className="text-xs text-gray-500">
            {role === 'requester' ? `Dono: ${req.owner_name}` : `Solicitante: ${req.requester_name}`}
          </p>
        </div>
        <Badge variant={STATUS_COLORS[req.status]}>
          {REQUEST_STATUS_LABELS[req.status]}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Retirada: {formatDate(req.pickup_date)}
        </span>
        <span>Devolução: {formatDate(req.expected_return_date)}</span>
      </div>

      {req.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">"{req.notes}"</p>
      )}

      <div className="flex flex-wrap gap-2">
        {role === 'owner' && (
          <>
            {req.status === 'pending' && (
              <>
                <Button size="sm" loading={loading === 'accept'} onClick={() => act(() => requestsService.accept(req.id), 'accept')}>
                  Aceitar
                </Button>
                <Button size="sm" variant="danger" loading={loading === 'refuse'} onClick={() => act(() => requestsService.refuse(req.id), 'refuse')}>
                  Recusar
                </Button>
              </>
            )}
            {req.status === 'accepted' && (
              <Button size="sm" variant="secondary" loading={loading === 'start'} onClick={() => act(() => requestsService.start(req.id), 'start')}>
                Marcar retirada
              </Button>
            )}
            {req.status === 'in_progress' && (
              <Button size="sm" loading={loading === 'finish'} onClick={() => act(() => requestsService.finish(req.id), 'finish')}>
                Finalizar
              </Button>
            )}
          </>
        )}

        {(req.status === 'pending' || req.status === 'accepted') && (
          <Button size="sm" variant="outline" loading={loading === 'cancel'} onClick={() => act(() => requestsService.cancel(req.id), 'cancel')}>
            Cancelar
          </Button>
        )}

        {req.status === 'finished' && (
          <Button size="sm" variant="secondary" onClick={() => setShowReview(true)}>
            Avaliar
          </Button>
        )}
      </div>

      {showReview && (
        <ReviewModal
          requestId={req.id}
          reviewedName={role === 'requester' ? req.owner_name : req.requester_name}
          onClose={() => setShowReview(false)}
          onSuccess={() => { setShowReview(false); onUpdate() }}
        />
      )}
    </div>
  )
}
