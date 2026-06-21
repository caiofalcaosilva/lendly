'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserCog, Star, Mail, Phone, MapPin, CheckCircle2, ShieldCheck, ShieldOff, MailCheck, MailWarning, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users'
import { authService } from '@/services/auth'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import AddressFields from '@/components/ui/AddressFields'
import TotpSetupModal from '@/components/auth/TotpSetupModal'

const opt = z.string().optional().or(z.literal(''))

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
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

function formatAddress(user: { street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; zip_code?: string }) {
  const parts = [
    user.street && user.number ? `${user.street}, ${user.number}` : user.street,
    user.complement,
    user.neighborhood,
    user.city && user.state ? `${user.city} - ${user.state}` : user.city ?? user.state,
    user.zip_code,
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, updateUser } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showTotpSetup, setShowTotpSetup] = useState(false)
  const [disablingTotp, setDisablingTotp] = useState(false)
  const [totpDisableCode, setTotpDisableCode] = useState('')
  const [totpDisableError, setTotpDisableError] = useState('')
  const [resendingEmail, setResendingEmail] = useState(false)
  const [emailResent, setEmailResent] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', phone: '', zip_code: '', street: '',
      number: '', complement: '', neighborhood: '', city: '', state: '',
      latitude: undefined, longitude: undefined,
    },
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/profile')
      return
    }
    if (user) {
      reset({
        name: user.name ?? '',
        phone: user.phone ?? '',
        zip_code: user.zip_code ?? '',
        street: user.street ?? '',
        number: user.number ?? '',
        complement: user.complement ?? '',
        neighborhood: user.neighborhood ?? '',
        city: user.city ?? '',
        state: user.state ?? '',
        latitude: user.latitude ?? undefined,
        longitude: user.longitude ?? undefined,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, isAuthenticated])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const payload = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v || undefined]),
      ) as any
      const updated = await usersService.updateMe(payload)
      updateUser(updated)
      reset({
        name: updated.name ?? '',
        phone: updated.phone ?? '',
        zip_code: updated.zip_code ?? '',
        street: updated.street ?? '',
        number: updated.number ?? '',
        complement: updated.complement ?? '',
        neighborhood: updated.neighborhood ?? '',
        city: updated.city ?? '',
        state: updated.state ?? '',
        latitude: updated.latitude ?? undefined,
        longitude: updated.longitude ?? undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  const resendEmail = async () => {
    setResendingEmail(true)
    try {
      await authService.resendVerification()
      setEmailResent(true)
    } catch (e: any) {
      const detail = e.response?.data?.detail
      if (detail === 'E-mail já verificado') {
        updateUser({ ...user!, is_verified: true })
      } else {
        setEmailResent(false)
      }
    } finally {
      setResendingEmail(false)
    }
  }

  const handleDisableTotp = async () => {
    if (totpDisableCode.length < 6) return
    setDisablingTotp(true)
    setTotpDisableError('')
    try {
      const updated = await authService.disableTotp(totpDisableCode)
      updateUser(updated)
      setTotpDisableCode('')
    } catch (e: any) {
      setTotpDisableError(e.response?.data?.detail || 'Código inválido')
    } finally {
      setDisablingTotp(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  const addressLine = user ? formatAddress(user) : ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Editar perfil</h1>
        <p className="text-gray-500 text-sm mt-1">
          Mantenha suas informações atualizadas para facilitar o contato com vizinhos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl font-bold text-green-600">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{user?.average_rating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({user?.rating_count} avaliações)</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados da conta</h3>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">E-mail</p>
                <p className="text-sm text-gray-700 break-all">{user?.email}</p>
              </div>
            </div>

            {user?.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Telefone</p>
                  <p className="text-sm text-gray-700">{user.phone}</p>
                </div>
              </div>
            )}

            {addressLine && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Endereço</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{addressLine}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
              Para alterar e-mail ou senha, entre em contato com o suporte.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <UserCog className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Informações pessoais</h2>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {saved && (
              <div className="mb-5 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Perfil atualizado com sucesso!
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Nome completo"
                {...register('name')}
                error={errors.name?.message}
                placeholder="Maria Silva"
                required
              />

              <Input
                label="Telefone"
                type="tel"
                {...register('phone')}
                error={errors.phone?.message}
                placeholder="(11) 99999-0000"
                helper="Visível apenas para a outra parte numa solicitação aceita"
              />

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-700">Endereço</h3>
                  <span className="text-xs text-gray-400">— seu endereço exato nunca é exibido publicamente</span>
                </div>

                <AddressFields
                  control={control as any}
                  register={register}
                  setValue={setValue as any}
                  errors={errors}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={saving} disabled={!isDirty} className="flex-1">
                  Salvar alterações
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                  Voltar
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Security section */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold text-gray-900">Segurança</h2>
        </div>

        <div className="space-y-5">
          {/* Email verification */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
            <div className="flex items-start gap-3">
              {user?.is_verified ? (
                <MailCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <MailWarning className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">Verificação de e-mail</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {user?.is_verified
                    ? 'Seu e-mail foi verificado.'
                    : 'E-mail ainda não verificado. Verifique sua caixa de entrada.'}
                </p>
              </div>
            </div>
            {!user?.is_verified && (
              <Button
                size="sm"
                variant="outline"
                onClick={resendEmail}
                loading={resendingEmail}
                disabled={emailResent}
              >
                {emailResent ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Enviado</>
                ) : 'Reenviar'}
              </Button>
            )}
          </div>

          {/* TOTP 2FA */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {user?.totp_enabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <ShieldOff className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">Autenticação em 2 etapas (TOTP)</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {user?.totp_enabled
                      ? 'Ativada — login em dispositivos novos exige código do aplicativo.'
                      : 'Desativada — use Google Authenticator, Authy ou similar.'}
                  </p>
                </div>
              </div>
              {!user?.totp_enabled && (
                <Button size="sm" onClick={() => setShowTotpSetup(true)}>
                  Ativar
                </Button>
              )}
            </div>

            {user?.totp_enabled && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Para desativar, confirme com o código do seu aplicativo:</p>
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={totpDisableCode}
                    onChange={(e) => setTotpDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleDisableTotp}
                    loading={disablingTotp}
                    disabled={totpDisableCode.length < 6}
                  >
                    Desativar 2FA
                  </Button>
                </div>
                {totpDisableError && (
                  <p className="text-xs text-red-600 mt-1">{totpDisableError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTotpSetup && (
        <TotpSetupModal
          onSuccess={(updated) => { updateUser(updated); setShowTotpSetup(false) }}
          onClose={() => setShowTotpSetup(false)}
        />
      )}
    </div>
  )
}
