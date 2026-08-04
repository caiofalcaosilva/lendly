'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Leaf, MapPin, User as UserIcon, Store } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isValidCnpj, formatCnpj, lookupCnpj } from '@/lib/cnpj'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import AddressFields from '@/components/ui/AddressFields'

const opt = z.string().optional().or(z.literal(''))

const schema = z
  .object({
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
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
  })
  .refine((d) => d.account_type !== 'business' || !!d.company_name?.trim(), {
    message: 'Informe a razão social', path: ['company_name'],
  })
  .refine((d) => d.account_type !== 'business' || isValidCnpj(d.cnpj || ''), {
    message: 'CNPJ inválido', path: ['cnpj'],
  })

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

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
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { account_type: 'individual' } })

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
      setError(e.response?.data?.detail || 'Erro ao criar conta')
      setStep(1)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Criar conta</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Junte-se à comunidade Lendly</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
              }`}>
                {s}
              </div>
              <span className={`text-xs flex-1 ${step >= s ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                {s === 1 ? 'Dados pessoais' : 'Endereço'}
              </span>
              {s < 2 && <div className={`h-px flex-1 ${step > s ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: personal info */}
            <div className={step === 1 ? 'block space-y-4' : 'hidden'}>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Tipo de conta</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'individual' as const, label: 'Pessoa física', icon: UserIcon },
                    { value: 'business' as const, label: 'Empresa', icon: Store },
                  ]).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue('account_type', value)}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        accountType === value
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label={accountType === 'business' ? 'Seu nome (responsável pela conta)' : 'Nome completo'}
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
                    label="Razão social"
                    {...register('company_name')}
                    error={errors.company_name?.message}
                    placeholder="Ferramentas Silva LTDA"
                    required
                  />
                  <Input
                    label="Nome fantasia"
                    {...register('trade_name')}
                    placeholder="Opcional — se diferente da razão social"
                  />
                  <Input
                    label="Categoria do negócio"
                    {...register('business_category')}
                    placeholder="Ex: Ferramentas e equipamentos"
                  />
                </>
              )}
              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
                placeholder="seu@email.com"
                required
              />
              <Input
                label="Senha"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                error={errors.password?.message}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <Input
                label="Telefone"
                type="tel"
                {...register('phone')}
                placeholder="(11) 99999-0000"
              />

              <Button type="button" onClick={goToStep2} className="w-full mt-2">
                Continuar
              </Button>
            </div>

            {/* Step 2: address */}
            <div className={step === 2 ? 'block space-y-5' : 'hidden'}>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Informe seu endereço para que vizinhos possam encontrá-lo.
                  <span className="text-gray-400 dark:text-gray-500"> Seu endereço exato nunca é exibido publicamente.</span>
                </p>
              </div>

              <AddressFields
                control={control as any}
                register={register}
                setValue={setValue as any}
                errors={errors}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  Criar conta
                </Button>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-300">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
