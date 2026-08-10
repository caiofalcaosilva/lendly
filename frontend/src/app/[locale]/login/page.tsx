'use client'
import { Suspense, useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Leaf } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import TwoFactorModal from '@/components/auth/TwoFactorModal'
import { isSafeRedirect } from '@/lib/utils'

function LoginForm() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect')
  const redirect = rawRedirect && isSafeRedirect(rawRedirect) ? rawRedirect : '/dashboard'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const t = useTranslations('Login')

  const schema = z.object({
    email: z.string().email(t('errors.invalidEmail')),
    password: z.string().min(1, t('errors.passwordRequired')),
  })
  type FormData = z.infer<typeof schema>

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(redirect)
    }
  }, [authLoading, isAuthenticated, redirect, router])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const result = await login(data.email, data.password)
      if (result.requires_2fa && result.temp_token) {
        setTempToken(result.temp_token)
      } else {
        router.push(redirect)
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errors.genericError'))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl mb-4">
            <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t('subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('emailLabel')}
              type="email"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="seu@email.com"
              required
            />
            <Input
              label={t('passwordLabel')}
              type="password"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
              placeholder="••••••••"
              required
            />
            <div className="text-right -mt-2">
              <Link href="/forgot-password" className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                {t('forgotPassword')}
              </Link>
            </div>
            <Button type="submit" loading={loading} className="w-full mt-2">
              {t('submit')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          {t('noAccount')}{' '}
          <Link href="/register" className="text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-300">
            {t('createFree')}
          </Link>
        </p>
      </div>

      {tempToken && (
        <TwoFactorModal
          tempToken={tempToken}
          onSuccess={() => router.push(redirect)}
          onClose={() => setTempToken(null)}
        />
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
