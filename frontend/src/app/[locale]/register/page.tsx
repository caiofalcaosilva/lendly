'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, User as UserIcon, Store } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { isValidCnpj, formatCnpj, lookupCnpj } from '@/lib/cnpj'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import AddressFields from '@/components/ui/AddressFields'
import { LogoMark } from '@/components/ui/Logo'

const opt = z.string().optional().or(z.literal(''))

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const t = useTranslations('Register')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const schema = z
    .object({
      name: z.string().min(2, t('errors.minChars', { count: 2 })),
      email: z.string().email(t('errors.invalidEmail')),
      password: z.string().min(6, t('errors.minChars', { count: 6 })),
      phone: opt,
      zip_code: z.string().max(9).optional().or(z.literal('')),
      street: opt,
      number: opt,
      complement: opt,
      neighborhood: opt,
      city: opt,
      state: opt,
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      account_type: z.enum(['individual', 'business']),
      company_name: opt,
      trade_name: opt,
      cnpj: opt,
      business_category: opt,
      accepted_terms: z.boolean(),
    })
    .refine((d) => d.account_type !== 'business' || !!d.company_name?.trim(), {
      message: t('errors.companyNameRequired'), path: ['company_name'],
    })
    .refine((d) => d.account_type !== 'business' || isValidCnpj(d.cnpj || ''), {
      message: t('errors.invalidCnpj'), path: ['cnpj'],
    })
    .refine((d) => d.accepted_terms === true, {
      message: t('errors.termsRequired'), path: ['accepted_terms'],
    })

  type FormData = z.infer<typeof schema>

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAuthenticated, router])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { account_type: 'individual', accepted_terms: false },
  })

  const accountType = watch('account_type')
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false)

  const goToStep2 = async () => {
    const fields: (keyof FormData)[] = ['name', 'email', 'password']
    if (accountType === 'business') fields.push('company_name', 'cnpj')
    const ok = await trigger(fields)
    if (ok) setStep(2)
  }

  const handleCnpjBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatCnpj(e.target.value)
    setValue('cnpj', formatted)
    if (!isValidCnpj(formatted) || cnpjLookupDone) return
    const result = await lookupCnpj(formatted)
    if (result) {
      if (result.companyName) setValue('company_name', result.companyName)
      if (result.tradeName) setValue('trade_name', result.tradeName)
      setCnpjLookupDone(true)
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const payload = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v || undefined]),
      ) as any
      await registerUser(payload)
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errors.genericError'))
      setStep(1)
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

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s ? 'bg-primary text-primary-on' : 'bg-surface-2 text-ink-subtle'
              }`}>
                {s}
              </div>
              <span className={`text-xs flex-1 ${step >= s ? 'text-primary font-medium' : 'text-ink-subtle'}`}>
                {s === 1 ? t('step1Label') : t('step2Label')}
              </span>
              {s < 2 && <div className={`h-px flex-1 ${step > s ? 'bg-primary/40' : 'bg-surface-2'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-surface rounded-panel shadow-elevated border border-border p-8">
          {error && (
            <div className="mb-5 p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: personal info */}
            <div className={step === 1 ? 'block space-y-4' : 'hidden'}>
              <div>
                <label className="text-sm font-medium text-ink-muted block mb-1.5">{t('accountType')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'individual' as const, label: t('individual'), icon: UserIcon },
                    { value: 'business' as const, label: t('business'), icon: Store },
                  ]).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue('account_type', value)}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-control border text-sm font-medium transition-colors ${
                        accountType === value
                          ? 'bg-primary text-primary-on border-primary'
                          : 'bg-surface text-ink-muted border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label={accountType === 'business' ? t('nameLabelBusiness') : t('nameLabelIndividual')}
                {...register('name')}
                error={errors.name?.message}
                placeholder="Maria Silva"
                required
              />

              {accountType === 'business' && (
                <>
                  <Input
                    label="CNPJ"
                    {...register('cnpj')}
                    onBlur={handleCnpjBlur}
                    error={errors.cnpj?.message}
                    placeholder="00.000.000/0000-00"
                    required
                  />
                  <Input
                    label={t('companyName')}
                    {...register('company_name')}
                    error={errors.company_name?.message}
                    placeholder="Ferramentas Silva LTDA"
                    required
                  />
                  <Input
                    label={t('tradeName')}
                    {...register('trade_name')}
                    placeholder={t('tradeNamePlaceholder')}
                  />
                  <Input
                    label={t('businessCategory')}
                    {...register('business_category')}
                    placeholder={t('businessCategoryPlaceholder')}
                  />
                </>
              )}
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
                autoComplete="new-password"
                {...register('password')}
                error={errors.password?.message}
                placeholder={t('passwordPlaceholder')}
                required
              />
              <Input
                label={t('phoneLabel')}
                type="tel"
                {...register('phone')}
                placeholder="(11) 99999-0000"
              />

              <Button type="button" onClick={goToStep2} className="w-full mt-2">
                {t('continue')}
              </Button>
            </div>

            {/* Step 2: address */}
            <div className={step === 2 ? 'block space-y-5' : 'hidden'}>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-ink-subtle" />
                <p className="text-sm text-ink-muted">
                  {t('addressIntro')}
                  <span className="text-ink-subtle"> {t('addressPrivacy')}</span>
                </p>
              </div>

              <AddressFields
                control={control as any}
                register={register}
                setValue={setValue as any}
                errors={errors}
              />

              <div>
                <label className="flex items-start gap-2 cursor-pointer text-ink">
                  <input
                    type="checkbox"
                    {...register('accepted_terms')}
                    className="mt-0.5 text-primary rounded"
                  />
                  <span className="text-sm">
                    {t.rich('acceptTerms', {
                      terms: (chunks) => (
                        <Link href="/termos" target="_blank" className="text-primary hover:text-primary-hover underline">
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link href="/privacidade" target="_blank" className="text-primary hover:text-primary-hover underline">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                {errors.accepted_terms && (
                  <p className="text-danger text-xs mt-1">{errors.accepted_terms.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  {t('back')}
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  {t('submit')}
                </Button>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-ink-muted mt-6">
          {t('haveAccount')}{' '}
          <Link href="/login" className="text-primary font-medium hover:text-primary-hover">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
