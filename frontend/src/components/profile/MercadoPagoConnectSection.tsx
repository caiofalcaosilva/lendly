'use client'
import { useEffect, useState } from 'react'
import { BadgeCheck, Wallet } from 'lucide-react'
import { paymentsService } from '@/services/payments'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function MercadoPagoConnectSection() {
  const [connected, setConnected] = useState(false)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

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
    } finally {
      setRedirecting(false)
    }
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <div className="flex items-start gap-3 mb-1">
        {connected ? (
          <BadgeCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
        ) : (
          <Wallet className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Conta Mercado Pago</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {connected
              ? `Conectada${connectedAt ? ` em ${formatDate(connectedAt)}` : ''} — você já pode anunciar itens pagos.`
              : 'Conecte sua conta pra poder anunciar itens pagos e receber o valor via Pix quando o item for retirado.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-green-600" /></div>
      ) : !connected && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button size="sm" loading={redirecting} onClick={connect} className="w-full">
            Conectar Mercado Pago
          </Button>
        </div>
      )}
    </div>
  )
}
