'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserCog, Star, Mail, Phone, MapPin, CheckCircle2, ShieldCheck, ShieldOff, MailCheck, MailWarning, Loader2, Building2, Download, PauseCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users'
import { authService } from '@/services/auth'
import { isValidCnpj, formatCnpj } from '@/lib/cnpj'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import AddressFields from '@/components/ui/AddressFields'
import TotpSetupModal from '@/components/auth/TotpSetupModal'
import DeleteAccountModal from '@/components/profile/DeleteAccountModal'
import ChangePasswordModal from '@/components/profile/ChangePasswordModal'
import ChangeEmailModal from '@/components/profile/ChangeEmailModal'
import AvatarUploader from '@/components/profile/AvatarUploader'
import ProfileCompleteness from '@/components/profile/ProfileCompleteness'
import BusinessBadge from '@/components/ui/BusinessBadge'
import ReputationBadges from '@/components/ui/ReputationBadges'
import IdentityVerificationSection from '@/components/profile/IdentityVerificationSection'
import MercadoPagoConnectSection from '@/components/profile/MercadoPagoConnectSection'
import SessionsSection from '@/components/profile/SessionsSection'
import LoginHistorySection from '@/components/profile/LoginHistorySection'
import NotificationPreferencesSection from '@/components/profile/NotificationPreferencesSection'
import InAppNotificationPreferencesSection from '@/components/profile/InAppNotificationPreferencesSection'

const opt = z.string().optional().or(z.literal(''))

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  bio: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
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
  company_name: opt,
  trade_name: opt,
  cnpj: opt,
  business_category: opt,
  business_phone: opt,
  business_hours: opt,
  website: opt,
  instagram: opt,
  whatsapp: opt,
}).refine((d) => !d.cnpj || isValidCnpj(d.cnpj), { message: 'CNPJ inválido', path: ['cnpj'] })

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
  const { user, isAuthenticated, isLoading: authLoading, updateUser, logout } = useAuth()
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
  const [exportingData, setExportingData] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [emailChanged, setEmailChanged] = useState(false)

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
      name: '', bio: '', phone: '', zip_code: '', street: '',
      number: '', complement: '', neighborhood: '', city: '', state: '',
      latitude: undefined, longitude: undefined,
      company_name: '', trade_name: '', cnpj: '', business_category: '',
      business_phone: '', business_hours: '', website: '', instagram: '', whatsapp: '',
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
        bio: user.bio ?? '',
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
        company_name: user.company_name ?? '',
        trade_name: user.trade_name ?? '',
        cnpj: user.cnpj ? formatCnpj(user.cnpj) : '',
        business_category: user.business_category ?? '',
        business_phone: user.business_phone ?? '',
        business_hours: user.business_hours ?? '',
        website: user.website ?? '',
        instagram: user.instagram ?? '',
        whatsapp: user.whatsapp ?? '',
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
        bio: updated.bio ?? '',
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
        company_name: updated.company_name ?? '',
        trade_name: updated.trade_name ?? '',
        cnpj: updated.cnpj ? formatCnpj(updated.cnpj) : '',
        business_category: updated.business_category ?? '',
        business_phone: updated.business_phone ?? '',
        business_hours: updated.business_hours ?? '',
        website: updated.website ?? '',
        instagram: updated.instagram ?? '',
        whatsapp: updated.whatsapp ?? '',
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

  const exportData = async () => {
    setExportingData(true)
    try {
      const data = await usersService.exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lendly-dados-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingData(false)
    }
  }

  const handleTogglePause = async () => {
    if (!user) return
    if (!user.is_paused && !confirm('Pausar sua conta? Seus itens somem da busca e não recebem novas solicitações até você reativar.')) return
    setPausing(true)
    try {
      const updated = user.is_paused
        ? await usersService.resumeAccount()
        : await usersService.pauseAccount()
      updateUser(updated)
    } finally {
      setPausing(false)
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Editar perfil</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Mantenha suas informações atualizadas para facilitar o contato com vizinhos
        </p>
      </div>

      {user && <ProfileCompleteness user={user} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 text-center">
            {user && (
              <AvatarUploader
                name={user.name}
                avatarUrl={user.avatar_url}
                onChange={(avatar_url) => updateUser({ ...user, avatar_url })}
              />
            )}
            <p className="font-semibold text-gray-900 dark:text-gray-100">{user?.trade_name || user?.name}</p>
            <div className="flex items-center justify-center mt-1">
              <BusinessBadge accountType={user?.account_type} />
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.average_rating.toFixed(1)}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">({user?.rating_count} avaliações)</span>
            </div>
            {user && (
              <div className="flex justify-center mt-3">
                <ReputationBadges
                  reliabilityScore={user.reliability_score}
                  reliabilityCount={user.reliability_count}
                  onTimeRate={user.on_time_rate}
                  finishedLoansCount={user.finished_loans_count}
                  averageRating={user.average_rating}
                  ratingCount={user.rating_count}
                  avgResponseMinutes={user.avg_response_minutes}
                  responseCount={user.response_count}
                />
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dados da conta</h3>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">E-mail</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-all">{user?.email}</p>
              </div>
            </div>

            {user?.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Telefone</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{user.phone}</p>
                </div>
              </div>
            )}

            {addressLine && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Endereço</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{addressLine}</p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <Button size="sm" variant="outline" loading={exportingData} onClick={exportData} className="w-full">
                <Download className="w-3.5 h-3.5" /> Baixar meus dados
              </Button>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowChangeEmail(true)}>
                Trocar e-mail
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowChangePassword(true)}>
                Trocar senha
              </Button>
              {emailChanged && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  E-mail atualizado — verifique a caixa de entrada do novo endereço.
                </p>
              )}
              {passwordChanged && (
                <p className="text-xs text-green-600 dark:text-green-400">Senha atualizada.</p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <UserCog className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Informações pessoais</h2>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {error}
              </div>
            )}

            {saved && (
              <div className="mb-5 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg text-sm flex items-center gap-2">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {user?.account_type === 'business' ? 'Sobre o negócio' : 'Sobre você'}
                </label>
                <textarea
                  {...register('bio')}
                  rows={3}
                  maxLength={500}
                  placeholder={
                    user?.account_type === 'business'
                      ? 'Conte um pouco sobre o que sua empresa oferece...'
                      : 'Uma breve apresentação, visível no seu perfil público...'
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
                />
                {errors.bio?.message && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.bio.message}</p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Endereço</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">— seu endereço exato nunca é exibido publicamente</span>
                </div>

                <AddressFields
                  control={control as any}
                  register={register}
                  setValue={setValue as any}
                  errors={errors}
                />
              </div>

              {user?.account_type === 'business' && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Dados da empresa</h3>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="CNPJ"
                      {...register('cnpj')}
                      onBlur={(e) => setValue('cnpj', formatCnpj(e.target.value), { shouldDirty: true })}
                      error={errors.cnpj?.message}
                    />
                    <Input label="Razão social" {...register('company_name')} error={errors.company_name?.message} />
                    <Input label="Nome fantasia" {...register('trade_name')} />
                    <Input label="Categoria do negócio" {...register('business_category')} placeholder="Ex: Ferramentas e equipamentos" />
                    <Input label="Telefone comercial" type="tel" {...register('business_phone')} />
                    <Input label="Horário de funcionamento" {...register('business_hours')} placeholder="Ex: Seg-Sex 9h-18h" />
                    <Input label="Site" type="url" {...register('website')} placeholder="https://" />
                    <Input label="Instagram" {...register('instagram')} placeholder="@sua_empresa" />
                    <Input label="WhatsApp" type="tel" {...register('whatsapp')} placeholder="(11) 99999-0000" />
                  </div>
                </div>
              )}

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
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Segurança</h2>
        </div>

        <div className="space-y-5">
          {/* Email verification */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <div className="flex items-start gap-3">
              {user?.is_verified ? (
                <MailCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <MailWarning className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Verificação de e-mail</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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

          {/* Identity verification */}
          {user && <IdentityVerificationSection user={user} updateUser={updateUser} />}

          {/* Mercado Pago connection — required to sell paid items */}
          <MercadoPagoConnectSection />

          {/* Connected devices / active sessions */}
          <SessionsSection />

          {/* Passive login history */}
          <LoginHistorySection />

          {/* Email notification toggles */}
          {user && <NotificationPreferencesSection user={user} updateUser={updateUser} />}

          {/* In-app (bell) notification toggles — separate from email */}
          {user && <InAppNotificationPreferencesSection user={user} updateUser={updateUser} />}

          {/* TOTP 2FA */}
          <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {user?.totp_enabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <ShieldOff className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Autenticação em 2 etapas (TOTP)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Para desativar, confirme com o código do seu aplicativo:</p>
                <div className="flex flex-wrap gap-2 items-start">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={totpDisableCode}
                    onChange={(e) => setTotpDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-32 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400"
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
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{totpDisableError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pause account — reversible, unlike deletion below */}
      {user && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-900 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <PauseCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {user.is_paused ? 'Conta pausada' : 'Pausar conta'}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {user.is_paused
              ? 'Seus itens estão escondidos da busca e não recebem novas solicitações. Reative quando quiser voltar.'
              : 'Vai viajar ou dar uma pausa? Seus itens somem da busca e param de receber solicitações, mas seu login e seus dados continuam intactos — reversível a qualquer momento.'}
          </p>
          <Button
            variant={user.is_paused ? 'secondary' : 'outline'}
            size="sm"
            loading={pausing}
            onClick={handleTogglePause}
          >
            {user.is_paused ? 'Reativar conta' : 'Pausar conta'}
          </Button>
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Zona de risco</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Excluir sua conta é permanente. Seus itens são desativados e seus dados pessoais, apagados.
        </p>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteAccount(true)}>
          Excluir minha conta
        </Button>
      </div>

      {showTotpSetup && (
        <TotpSetupModal
          onSuccess={(updated) => { updateUser(updated); setShowTotpSetup(false) }}
          onClose={() => setShowTotpSetup(false)}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false)
            setPasswordChanged(true)
            setTimeout(() => setPasswordChanged(false), 5000)
          }}
        />
      )}

      {showChangeEmail && (
        <ChangeEmailModal
          onClose={() => setShowChangeEmail(false)}
          onSuccess={(updated) => {
            updateUser(updated)
            setShowChangeEmail(false)
            setEmailChanged(true)
            setTimeout(() => setEmailChanged(false), 8000)
          }}
        />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onSuccess={() => {
            logout()
            router.push('/')
          }}
        />
      )}
    </div>
  )
}
