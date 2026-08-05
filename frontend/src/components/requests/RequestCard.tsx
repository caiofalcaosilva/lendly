'use client'
import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Calendar, MessageCircle, Package, CalendarClock, Check, X as XIcon, QrCode, Phone } from 'lucide-react'
import { LoanRequest, PaymentStatus, REQUEST_STATUS_LABELS } from '@/types'
import { requestsService } from '@/services/requests'
import { formatDate } from '@/lib/utils'
import Badge, { STATUS_COLORS } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ReviewModal from '@/components/reviews/ReviewModal'
import ExtensionModal from '@/components/requests/ExtensionModal'
import PixCheckout from '@/components/requests/PixCheckout'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const PAYMENT_STATUS_LABELS: Partial<Record<PaymentStatus, string>> = {
  processing: 'Aguardando pagamento',
  held: 'Pagamento confirmado',
  released: 'Pagamento repassado',
  refunded: 'Pagamento estornado',
  failed: 'Pagamento falhou',
}

const PAYMENT_STATUS_COLORS: Partial<Record<PaymentStatus, 'green' | 'blue' | 'yellow' | 'red' | 'gray'>> = {
  processing: 'yellow',
  held: 'blue',
  released: 'green',
  refunded: 'gray',
  failed: 'red',
}

interface Props {
  request: LoanRequest
  role: 'requester' | 'owner'
  onUpdate: () => void
}

export default function RequestCard({ request: req, role, onUpdate }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [showExtension, setShowExtension] = useState(false)
  const [showQr, setShowQr] = useState<'start' | 'finish' | null>(null)

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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">{req.item_title}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {role === 'requester' ? `Dono: ${req.owner_name}` : `Solicitante: ${req.requester_name}`}
          </p>
          {(() => {
            const phone = role === 'requester' ? req.owner_phone : req.requester_phone
            return phone ? (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 mt-0.5"
              >
                <Phone className="w-3 h-3" /> {phone}
              </a>
            ) : null
          })()}
        </div>
        <div className="flex flex-col gap-1 items-end">
          <Badge variant={STATUS_COLORS[req.status]}>
            {REQUEST_STATUS_LABELS[req.status]}
          </Badge>
          {req.payment_status !== 'unpaid' && PAYMENT_STATUS_LABELS[req.payment_status] && (
            <Badge variant={PAYMENT_STATUS_COLORS[req.payment_status]}>
              {PAYMENT_STATUS_LABELS[req.payment_status]}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Retirada: {formatDate(req.pickup_date)}
        </span>
        <span>Devolução: {formatDate(req.expected_return_date)}</span>
      </div>

      {req.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 mb-4">"{req.notes}"</p>
      )}

      {req.extension_status === 'pending' && req.requested_extension_date && (
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {role === 'owner'
                ? `Pediu prorrogação até ${formatDate(req.requested_extension_date)}`
                : `Prorrogação pedida até ${formatDate(req.requested_extension_date)} — aguardando resposta`}
            </p>
            {role === 'owner' && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" loading={loading === 'approveExt'} onClick={() => act(() => requestsService.approveExtension(req.id), 'approveExt')}>
                  <Check className="w-3.5 h-3.5" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" loading={loading === 'rejectExt'} onClick={() => act(() => requestsService.rejectExtension(req.id), 'rejectExt')}>
                  <XIcon className="w-3.5 h-3.5" /> Recusar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {role === 'requester' && req.status === 'accepted' && req.payment_status === 'processing' && (
        <div className="mb-4">
          <PixCheckout requestId={req.id} onConfirmed={onUpdate} />
        </div>
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
              req.payment_status === 'processing' ? (
                <span className="text-xs text-amber-600 dark:text-amber-400 self-center">
                  Aguardando o solicitante pagar pra liberar a retirada
                </span>
              ) : (
                <>
                  <Button size="sm" variant="secondary" loading={loading === 'start'} onClick={() => act(() => requestsService.start(req.id), 'start')}>
                    Marcar retirada
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowQr(showQr === 'start' ? null : 'start')}>
                    <QrCode className="w-3.5 h-3.5" /> QR code
                  </Button>
                </>
              )
            )}
            {req.status === 'in_progress' && (
              <>
                <Button size="sm" loading={loading === 'finish'} onClick={() => act(() => requestsService.finish(req.id), 'finish')}>
                  Finalizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowQr(showQr === 'finish' ? null : 'finish')}>
                  <QrCode className="w-3.5 h-3.5" /> QR code
                </Button>
              </>
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

        {role === 'requester' && req.status === 'in_progress' && req.extension_status !== 'pending' && (
          <Button size="sm" variant="outline" onClick={() => setShowExtension(true)}>
            <CalendarClock className="w-3.5 h-3.5" /> Pedir prorrogação
          </Button>
        )}

        <Link
          href={`/requests/${req.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
        >
          <MessageCircle className="w-4 h-4" /> Ver conversa
        </Link>
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2 mt-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
          <QRCodeSVG value={`${SITE_URL}/checkin/${req.id}/${showQr}`} size={160} level="M" />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[220px]">
            Escaneie com seu celular na hora da {showQr === 'start' ? 'retirada' : 'devolução'} pra confirmar rapidinho, sem precisar navegar até aqui
          </p>
        </div>
      )}

      {showReview && (
        <ReviewModal
          requestId={req.id}
          reviewedName={role === 'requester' ? req.owner_name : req.requester_name}
          onClose={() => setShowReview(false)}
          onSuccess={() => { setShowReview(false); onUpdate() }}
        />
      )}

      {showExtension && (
        <ExtensionModal
          requestId={req.id}
          currentExpectedReturnDate={req.expected_return_date}
          onClose={() => setShowExtension(false)}
          onSuccess={() => { setShowExtension(false); onUpdate() }}
        />
      )}
    </div>
  )
}
