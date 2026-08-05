'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings as SettingsIcon, CheckCircle2, Megaphone } from 'lucide-react'
import { PlatformSettings } from '@/types'
import { platformSettingsService } from '@/services/platformSettings'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

const FIELDS: { key: keyof PlatformSettings; label: string; helper: string }[] = [
  { key: 'access_token_expire_minutes', label: 'Duração da sessão (minutos)', helper: 'Tempo até o token de acesso expirar e precisar renovar.' },
  { key: 'refresh_token_expire_days', label: 'Duração do refresh token (dias)', helper: 'Por quanto tempo o usuário fica logado sem precisar entrar de novo.' },
  { key: 'email_verification_expire_hours', label: 'Expiração do link de verificação de e-mail (horas)', helper: 'Prazo pro usuário clicar no link antes de precisar reenviar.' },
  { key: 'login_rate_limit_per_minute', label: 'Limite de tentativas de login por minuto', helper: 'Por IP — protege contra força bruta.' },
  { key: 'register_rate_limit_per_minute', label: 'Limite de cadastros por minuto', helper: 'Por IP — protege contra abuso de criação de contas.' },
  { key: 'complete_2fa_rate_limit_per_minute', label: 'Limite de confirmações de 2FA por minuto', helper: 'Por IP — protege contra força bruta no código do autenticador.' },
  { key: 'refresh_rate_limit_per_minute', label: 'Limite de renovações de sessão por minuto', helper: 'Por IP — troca de refresh token por um novo par de tokens.' },
  { key: 'resend_verification_rate_limit_per_minute', label: 'Limite de reenvio de verificação por minuto', helper: 'Por IP — protege contra spam de e-mails de verificação.' },
  { key: 'chat_message_rate_limit_per_minute', label: 'Limite de mensagens de chat por minuto', helper: 'Por usuário — protege o chat de empréstimos contra flood.' },
]

export default function AdminSettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (!user?.is_admin) return
    platformSettingsService.get().then(setSettings).finally(() => setLoading(false))
  }, [user?.is_admin])

  const setField = (key: keyof PlatformSettings, value: number) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const onSave = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await platformSettingsService.update({
        access_token_expire_minutes: settings.access_token_expire_minutes,
        refresh_token_expire_days: settings.refresh_token_expire_days,
        email_verification_expire_hours: settings.email_verification_expire_hours,
        login_rate_limit_per_minute: settings.login_rate_limit_per_minute,
        register_rate_limit_per_minute: settings.register_rate_limit_per_minute,
        complete_2fa_rate_limit_per_minute: settings.complete_2fa_rate_limit_per_minute,
        refresh_rate_limit_per_minute: settings.refresh_rate_limit_per_minute,
        resend_verification_rate_limit_per_minute:
          settings.resend_verification_rate_limit_per_minute,
        chat_message_rate_limit_per_minute: settings.chat_message_rate_limit_per_minute,
        announcement_message: settings.announcement_message ?? '',
        announcement_active: settings.announcement_active,
      })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <SettingsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações da plataforma</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Parâmetros operacionais — dados sensíveis (chaves, credenciais de e-mail) continuam só no .env.
      </p>

      {loading || !settings ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {FIELDS.map(({ key, label, helper }) => (
            <Input
              key={key}
              label={label}
              helper={helper}
              type="number"
              min={1}
              value={settings[key] as number}
              onChange={(e) => setField(key, Number(e.target.value))}
            />
          ))}

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aviso da plataforma</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Banner visível a todos os visitantes, logados ou não (ex: manutenção programada).
            </p>
            <textarea
              value={settings.announcement_message ?? ''}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, announcement_message: e.target.value.slice(0, 280) } : prev))}
              rows={2}
              maxLength={280}
              placeholder="Ex: Manutenção programada hoje às 22h — o site pode ficar instável."
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.announcement_active}
                onChange={(e) => setSettings((prev) => (prev ? { ...prev, announcement_active: e.target.checked } : prev))}
                className="w-4 h-4 rounded accent-green-600"
              />
              Aviso ativo
            </label>
          </div>

          {settings.updated_by_name && settings.updated_at && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Última alteração por {settings.updated_by_name} em {formatDate(settings.updated_at)}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={onSave} loading={saving}>
              Salvar alterações
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" /> Salvo
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
