'use client'
import { useEffect, useRef, useState } from 'react'
import { Copy, Check, QrCode } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Payment } from '@/types'
import { paymentsService } from '@/services/payments'
import { formatCurrency } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

interface Props {
  requestId: string
  onConfirmed: () => void
}

// Same polling shape as PixCheckout.tsx/ExtensionPixCheckout.tsx, pointed
// at the active claim charge — either the original requester -> owner one,
// or the requester -> platform debt one once the platform has advanced an
// overdue paid-item claim (see payment_service.get_claim_payment_for_request).
const POLL_INTERVAL_MS = 4000

export default function ClaimPixCheckout({ requestId, onConfirmed }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.PixCheckout')
  const tClaim = useTranslations('Common.RequestCard')

  useEffect(() => {
    const load = () => paymentsService.getClaimPaymentForRequest(requestId).then((p) => {
      setPayment(p)
      if (p.status === 'released' || p.status === 'held') {
        if (pollRef.current) clearInterval(pollRef.current)
        onConfirmed()
      }
    }).catch(() => {})

    load()
    pollRef.current = setInterval(load, POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const copyCode = () => {
    if (!payment?.pix_qr_code) return
    navigator.clipboard.writeText(payment.pix_qr_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!payment || payment.status !== 'pending') {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-surface border border-border rounded-panel">
      <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <QrCode className="w-4 h-4 text-primary" />
        {payment.kind === 'claim_debt' ? tClaim('payClaimDebt') : tClaim('payClaimCharge')}
      </div>
      <p className="text-2xl font-extrabold tracking-tight font-mono tabular-nums text-ink">{formatCurrency(payment.gross_amount, locale)}</p>

      {payment.pix_qr_code_base64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/jpeg;base64,${payment.pix_qr_code_base64}`}
          alt={t('qrCodeAlt')}
          className="w-48 h-48 rounded-control border border-border"
        />
      )}

      {payment.pix_qr_code && (
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('copied') : t('copyCode')}
        </button>
      )}

      <p className="text-xs text-ink-subtle text-center max-w-xs">
        {t('autoUpdateNotice')}
      </p>
    </div>
  )
}
