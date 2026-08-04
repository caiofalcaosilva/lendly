'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { paymentsService } from '@/services/payments'
import Spinner from '@/components/ui/Spinner'

export default function MercadoPagoCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || !state) {
      setStatus('error')
      setError('Link de retorno do Mercado Pago incompleto.')
      return
    }
    paymentsService.handleMercadoPagoCallback(code, state)
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error')
        setError(e.response?.data?.detail || 'Erro ao conectar sua conta Mercado Pago.')
      })
  }, [searchParams])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-8 h-8 text-green-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Conectando sua conta Mercado Pago...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">Conta conectada com sucesso!</p>
          <p className="text-xs text-green-700 dark:text-green-400 mb-4">Agora você já pode anunciar itens pagos.</p>
          <Link href="/profile" className="text-sm text-green-700 dark:text-green-400 underline">Voltar ao perfil</Link>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <XCircle className="w-10 h-10 text-red-600 dark:text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Não foi possível conectar</p>
          <p className="text-xs text-red-700 dark:text-red-400 mb-4">{error}</p>
          <Link href="/profile" className="text-sm text-red-700 dark:text-red-400 underline">Voltar ao perfil</Link>
        </div>
      )}
    </div>
  )
}
