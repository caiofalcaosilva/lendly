'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { CheckCircle2, XCircle, Loader2, Leaf } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import { useAuth } from '@/contexts/AuthContext'

type State = 'loading' | 'success' | 'error'

function VerifyEmailContent() {
  const params = useSearchParams()
  const { updateUser, isAuthenticated } = useAuth()
  const [state, setState] = useState<State>('loading')
  const t = useTranslations('VerifyEmail')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setState('error'); return }

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
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl mb-6">
          <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>

        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{t('loading')}</h1>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('successTitle')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {t('successMessage')}
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              {t('goToDashboard')}
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('errorTitle')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {isAuthenticated ? t('errorMessageAuthenticated') : t('errorMessageAnonymous')}
            </p>
            <Link
              href={isAuthenticated ? '/profile' : '/login'}
              className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
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
