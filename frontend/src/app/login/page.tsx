'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Leaf } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import TwoFactorModal from '@/components/auth/TwoFactorModal'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
type FormData = z.infer<typeof schema>

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)

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
      setError(e.response?.data?.detail || 'E-mail ou senha incorretos')
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
          <h1 className="text-2xl font-bold text-gray-900">Entrar no Lendly</h1>
          <p className="text-gray-500 mt-1 text-sm">Bem-vindo de volta!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
              placeholder="••••••••"
              required
            />
            <Button type="submit" loading={loading} className="w-full mt-2">
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Não tem conta?{' '}
          <Link href="/register" className="text-green-600 font-medium hover:text-green-700">
            Criar conta grátis
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
