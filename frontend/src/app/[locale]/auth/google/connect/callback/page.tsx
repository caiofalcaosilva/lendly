'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import Spinner from '@/components/ui/Spinner'

export default function GoogleConnectCallbackPage() {
  return (
    <Suspense>
      <GoogleConnectCallback />
    </Suspense>
  )
}

function GoogleConnectCallback() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const t = useTranslations('GoogleConnect.Callback')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || !state) {
      setStatus('error')
      setError(t('incompleteLink'))
      return
    }
    authService.googleConnectCallback(code, state)
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error')
        setError(e.response?.data?.detail || t('errorConnecting'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-ink-muted">{t('connecting')}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="bg-primary-subtle border border-primary/30 rounded-panel p-6">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-primary mb-1">{t('successTitle')}</p>
          <p className="text-xs text-primary mb-4">{t('successDescription')}</p>
          <Link href="/profile" className="text-sm text-primary underline">{t('backToProfile')}</Link>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-danger-subtle border border-danger/30 rounded-panel p-6">
          <XCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="text-sm font-medium text-danger mb-1">{t('errorTitle')}</p>
          <p className="text-xs text-danger mb-4">{error}</p>
          <Link href="/profile" className="text-sm text-danger underline">{t('backToProfile')}</Link>
        </div>
      )}
    </div>
  )
}
