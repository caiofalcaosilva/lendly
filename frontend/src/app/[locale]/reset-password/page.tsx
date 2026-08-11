'use client'
import { Suspense, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { LogoMark } from '@/components/ui/Logo'

function ResetPasswordForm() {
  const token = useSearchParams().get('token')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useTranslations('ResetPassword')

  const schema = z.object({
    new_password: z.string().min(6, t('errors.minChars', { count: 6 })),
  })
  type FormData = z.infer<typeof schema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      await authService.resetPassword(token, data.new_password)
      setDone(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errors.invalidOrExpired'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoMark className="w-12 h-12 mb-4" />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        </div>

        <div className="bg-surface rounded-panel shadow-elevated border border-border p-8">
          {!token ? (
            <p className="text-sm text-danger text-center">
              {t('missingToken')}
            </p>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="text-sm text-ink-muted mb-4">
                {t('success')}
              </p>
              <Link href="/login">
                <Button className="w-full">{t('goToLogin')}</Button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <PasswordInput
                  label={t('newPasswordLabel')}
                  autoComplete="new-password"
                  {...register('new_password')}
                  error={errors.new_password?.message}
                  placeholder={t('newPasswordPlaceholder')}
                  required
                />
                <Button type="submit" loading={loading} className="w-full mt-2">
                  {t('submit')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
