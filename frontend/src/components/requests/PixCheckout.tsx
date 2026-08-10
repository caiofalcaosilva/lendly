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

// Pix confirmation is asynchronous — the requester's bank app confirms
// on its own schedule, so we poll rather than wait for a push from the
// backend (there's no websocket wired up for payment status yet).
const POLL_INTERVAL_MS = 4000

export default function PixCheckout({ requestId, onConfirmed }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.PixCheckout')

  useEffect(() => {
    const load = () => paymentsService.getForRequest(requestId).then((p) => {
      setPayment(p)
      if (p.status === 'held') {
        if (pollRef.current) clearInterval(pollRef.current)
        onConfirmed()
      }
    })

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

  if (!payment) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="w-6 h-6 text-green-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
        <QrCode className="w-4 h-4 text-green-600 dark:text-green-400" />
        {t('payToConfirm')}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payment.gross_amount, locale)}</p>

      {payment.pix_qr_code_base64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/jpeg;base64,${payment.pix_qr_code_base64}`}
          alt={t('qrCodeAlt')}
          className="w-48 h-48 rounded-lg border border-gray-100 dark:border-gray-700"
        />
      )}

      {payment.pix_qr_code && (
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('copied') : t('copyCode')}
        </button>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
        {t('autoUpdateNotice')}
      </p>
    </div>
  )
}
