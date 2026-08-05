'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { usersService } from '@/services/users'
import { NotificationPreferences, User } from '@/types'

const OPTIONS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'request_status', label: 'Mudanças de status nas minhas solicitações' },
  { key: 'new_message', label: 'Novas mensagens no chat' },
  { key: 'verification_result', label: 'Resultado da verificação de identidade' },
  { key: 'item_available', label: 'Item da lista de espera ficou disponível' },
  { key: 'review_reminder', label: 'Lembrete pra avaliar um empréstimo finalizado' },
]

export default function NotificationPreferencesSection({
  user,
  updateUser,
}: {
  user: User
  updateUser: (user: User) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = async (key: keyof NotificationPreferences) => {
    setSaving(key)
    try {
      const updated = await usersService.updateNotificationPreferences({
        [key]: !user.notification_prefs[key],
      })
      updateUser(updated)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <div className="flex items-start gap-3 mb-1">
        <Bell className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Notificações por e-mail</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            E-mails de segurança (login, verificação de conta, redefinição de senha) não são afetados.
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
        {OPTIONS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
            {label}
            <input
              type="checkbox"
              checked={user.notification_prefs[key]}
              onChange={() => toggle(key)}
              disabled={saving === key}
              className="w-4 h-4 rounded accent-green-600 flex-shrink-0"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
