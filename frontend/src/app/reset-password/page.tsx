'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Leaf, CheckCircle2 } from 'lucide-react'
import { authService } from '@/services/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const schema = z.object({
  new_password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

function ResetPasswordForm() {
  const token = useSearchParams().get('token')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      setError(e.response?.data?.detail || 'Link inválido ou expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl mb-4">
            <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Redefinir senha</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          {!token ? (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              Link inválido — falta o token de redefinição.
            </p>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Senha redefinida com sucesso. Você já pode entrar com a nova senha.
              </p>
              <Link href="/login">
                <Button className="w-full">Ir pro login</Button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  {...register('new_password')}
                  error={errors.new_password?.message}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <Button type="submit" loading={loading} className="w-full mt-2">
                  Redefinir senha
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
