'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { LogoMark } from '@/components/ui/Logo'
import Turnstile from '@/components/ui/Turnstile'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const t = useTranslations('ForgotPassword')

  const schema = z.object({
    email: z.string().email(t('errors.invalidEmail')),
  })
  type FormData = z.infer<typeof schema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await authService.forgotPassword(data.email, turnstileToken || undefined)
      setSent(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errors.genericError'))
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
          <p className="text-ink-muted mt-1 text-sm">
            {t('subtitle')}
          </p>
        </div>

        <div className="bg-surface rounded-panel shadow-elevated border border-border p-8">
          {sent ? (
            <div className="text-center py-4">
              <MailCheck className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="text-sm text-ink-muted">
                {t('sentMessage')}
              </p>
            </div>
          ) : (
            <>
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
                <Turnstile onToken={setTurnstileToken} />
                <Button type="submit" loading={loading} className="w-full mt-2">
                  {t('submit')}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-ink-muted mt-6">
          <Link href="/login" className="text-primary font-medium hover:text-primary-hover">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
