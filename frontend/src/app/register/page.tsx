'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Leaf, MapPin } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import AddressFields from '@/components/ui/AddressFields'

const opt = z.string().optional().or(z.literal(''))

const schema = z.object({
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
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const goToStep2 = async () => {
    const ok = await trigger(['name', 'email', 'password'])
    if (ok) setStep(2)
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

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-4">
            <Leaf className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Criar conta</h1>
          <p className="text-gray-500 mt-1 text-sm">Junte-se à comunidade Lendly</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {s}
              </div>
              <span className={`text-xs flex-1 ${step >= s ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                {s === 1 ? 'Dados pessoais' : 'Endereço'}
              </span>
              {s < 2 && <div className={`h-px flex-1 ${step > s ? 'bg-green-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: personal info */}
            <div className={step === 1 ? 'block space-y-4' : 'hidden'}>
              <Input
                label="Nome completo"
                {...register('name')}
                error={errors.name?.message}
                placeholder="Maria Silva"
                required
              />
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
                <MapPin className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Informe seu endereço para que vizinhos possam encontrá-lo.
                  <span className="text-gray-400"> Seu endereço exato nunca é exibido publicamente.</span>
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

        <p className="text-center text-sm text-gray-600 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-green-600 font-medium hover:text-green-700">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
