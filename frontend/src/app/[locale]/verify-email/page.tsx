'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import { useAuth } from '@/contexts/AuthContext'
import { LogoMark } from '@/components/ui/Logo'

type State = 'loading' | 'success' | 'error'

function VerifyEmailContent() {
  const params = useSearchParams()
  const { updateUser, isAuthenticated } = useAuth()
  const [state, setState] = useState<State>('loading')
  const t = useTranslations('VerifyEmail')
  // updateUser isn't referentially stable (AuthContext recreates it on every
  // render), so calling it re-triggers this effect — without this guard the
  // token gets verified twice, and the second call fails because the token
  // is already consumed, flipping a successful verification to an error.
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    const token = params.get('token')
    if (!token) { setState('error'); return }
    attempted.current = true

    authService.verifyEmail(token)
      .then((user) => {
        updateUser(user)
        setState('success')
      })
      .catch(() => setState('error'))
  }, [params, updateUser])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <LogoMark className="w-12 h-12 mb-6 mx-auto" />

        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-ink">{t('loading')}</h1>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-xl font-extrabold tracking-tight text-ink mb-2">{t('successTitle')}</h1>
            <p className="text-ink-muted text-sm mb-6">
              {t('successMessage')}
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-primary text-primary-on px-6 py-2.5 rounded-control font-medium hover:bg-primary-hover transition-colors"
            >
              {t('goToDashboard')}
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h1 className="text-xl font-extrabold tracking-tight text-ink mb-2">{t('errorTitle')}</h1>
            <p className="text-ink-muted text-sm mb-6">
              {isAuthenticated ? t('errorMessageAuthenticated') : t('errorMessageAnonymous')}
            </p>
            <Link
              href={isAuthenticated ? '/profile' : '/login'}
              className="inline-block bg-primary text-primary-on px-6 py-2.5 rounded-control font-medium hover:bg-primary-hover transition-colors"
            >
              {isAuthenticated ? t('goToProfile') : t('goToLogin')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}
