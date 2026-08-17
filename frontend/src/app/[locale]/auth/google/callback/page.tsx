'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import { useAuth } from '@/contexts/AuthContext'
import TwoFactorModal from '@/components/auth/TwoFactorModal'
import Spinner from '@/components/ui/Spinner'

type State = 'loading' | 'success' | 'error'

function GoogleCallback() {
  const params = useSearchParams()
  const router = useRouter()
  const { loginWithTokens } = useAuth()
  const [state, setState] = useState<State>('loading')
  const [error, setError] = useState('')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const t = useTranslations('Auth.GoogleCallback')
  // The authorization code is single-use — a second exchange attempt (e.g.
  // from AuthProvider re-rendering this effect, or React StrictMode's
  // double-invoke in dev) would fail and turn a real success into an error.
  // Same guard verify-email/page.tsx uses for the same reason.
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    const code = params.get('code')
    const oauthState = params.get('state')
    if (!code || !oauthState) {
      setState('error')
      setError(t('incompleteLink'))
      return
    }
    attempted.current = true

    const deviceToken = localStorage.getItem('lendly_device')
    authService.googleCallback(code, oauthState, deviceToken)
      .then((data) => {
        if (data.requires_2fa && data.temp_token) {
          setTempToken(data.temp_token)
          return
        }
        loginWithTokens(data.access_token!, data.refresh_token!, data.user!, data.device_token!)
        setState('success')
        router.replace('/dashboard')
      })
      .catch((e) => {
        setState('error')
        setError(e.response?.data?.detail || t('errorConnecting'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  if (tempToken) {
    return (
      <TwoFactorModal
        tempToken={tempToken}
        onSuccess={() => router.replace('/dashboard')}
        onClose={() => router.replace('/login')}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-ink-muted">{t('connecting')}</p>
        </div>
      )}

      {state === 'success' && (
        <div className="bg-primary-subtle border border-primary/30 rounded-panel p-6">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-primary">{t('successTitle')}</p>
        </div>
      )}

      {state === 'error' && (
        <div className="bg-danger-subtle border border-danger/30 rounded-panel p-6">
          <XCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="text-sm font-medium text-danger mb-1">{t('errorTitle')}</p>
          <p className="text-xs text-danger mb-4">{error}</p>
          <Link href="/login" className="text-sm text-danger underline">{t('backToLogin')}</Link>
        </div>
      )}
    </div>
  )
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallback />
    </Suspense>
  )
}
