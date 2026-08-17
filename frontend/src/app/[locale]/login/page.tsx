'use client'
import { Suspense, useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { LogoMark } from '@/components/ui/Logo'
import TwoFactorModal from '@/components/auth/TwoFactorModal'
import GoogleButton from '@/components/auth/GoogleButton'
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
  const tGoogle = useTranslations('Common.GoogleButton')

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
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoMark className="w-12 h-12 mb-4" />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('subtitle')}</p>
        </div>

        <div className="bg-surface rounded-panel shadow-elevated border border-border p-8">
          <GoogleButton />
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-ink-subtle uppercase tracking-wide">{tGoogle('orDivider')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {error && (
            <div className="mb-5 p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
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
            <PasswordInput
              label={t('passwordLabel')}
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
              placeholder="••••••••"
              required
            />
            <div className="text-right -mt-2">
              <Link href="/forgot-password" className="text-xs text-primary hover:text-primary-hover">
                {t('forgotPassword')}
              </Link>
            </div>
            <Button type="submit" loading={loading} className="w-full mt-2">
              {t('submit')}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-muted mt-6">
          {t('noAccount')}{' '}
          <Link href="/register" className="text-primary font-medium hover:text-primary-hover">
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
