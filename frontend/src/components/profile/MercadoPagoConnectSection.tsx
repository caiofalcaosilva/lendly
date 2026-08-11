'use client'
import { useEffect, useState } from 'react'
import { BadgeCheck, Wallet } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { paymentsService } from '@/services/payments'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/contexts/ToastContext'

export default function MercadoPagoConnectSection() {
  const [connected, setConnected] = useState(false)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.MercadoPagoConnectSection')
  const toast = useToast()

  useEffect(() => {
    paymentsService.getMercadoPagoStatus()
      .then((s) => { setConnected(s.connected); setConnectedAt(s.connected_at ?? null) })
      .finally(() => setLoading(false))
  }, [])

  const connect = async () => {
    setRedirecting(true)
    try {
      const { authorization_url } = await paymentsService.getMercadoPagoConnectUrl()
      window.location.href = authorization_url
    } catch {
      toast.error(t('error'))
      setRedirecting(false)
    }
  }

  return (
    <div className="p-4 rounded-panel border border-border bg-surface-2">
      <div className="flex items-start gap-3 mb-1">
        {connected ? (
          <BadgeCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        ) : (
          <Wallet className="w-5 h-5 text-ink-subtle mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{t('title')}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {connected
              ? (connectedAt ? t('connectedOn', { date: formatDate(connectedAt, locale) }) : t('connected'))
              : t('notConnected')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
      ) : !connected && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button size="sm" loading={redirecting} onClick={connect} className="w-full">
            {t('connectButton')}
          </Button>
        </div>
      )}
    </div>
  )
}
