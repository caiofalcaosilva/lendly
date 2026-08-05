'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Leaf, MailCheck } from 'lucide-react'
import { authService } from '@/services/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await authService.forgotPassword(data.email)
      setSent(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao enviar o link de redefinição')
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Esqueci minha senha</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Informe seu e-mail e enviamos um link pra redefinir sua senha
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          {sent ? (
            <div className="text-center py-4">
              <MailCheck className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Se esse e-mail estiver cadastrado, você vai receber um link pra redefinir sua senha em instantes.
              </p>
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
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  error={errors.email?.message}
                  placeholder="seu@email.com"
                  required
                />
                <Button type="submit" loading={loading} className="w-full mt-2">
                  Enviar link
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          <Link href="/login" className="text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-300">
            Voltar pro login
          </Link>
        </p>
      </div>
    </div>
  )
}
