'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { notificationsService } from '@/services/notifications'
import { InAppNotificationPreferences, User } from '@/types'

const OPTIONS: { key: keyof InAppNotificationPreferences; label: string }[] = [
  { key: 'request_status', label: 'Mudanças de status nas minhas solicitações' },
  { key: 'new_message', label: 'Novas mensagens no chat' },
  { key: 'verification_result', label: 'Resultado da verificação de identidade' },
  { key: 'item_available', label: 'Item da lista de espera ficou disponível' },
  { key: 'review_reminder', label: 'Lembrete pra avaliar um empréstimo finalizado' },
  { key: 'group_vouch', label: 'Alguém confirmou que te conhece num grupo' },
  { key: 'favorite_item_changed', label: 'Item favoritado mudou de preço ou disponibilidade' },
]

export default function InAppNotificationPreferencesSection({
  user,
  updateUser,
}: {
  user: User
  updateUser: (user: User) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = async (key: keyof InAppNotificationPreferences) => {
    setSaving(key)
    try {
      const updated = await notificationsService.updatePreferences({
        [key]: !user.inapp_notification_prefs[key],
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
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Notificações no sino</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Independente das preferências de e-mail acima — desligar uma não desliga a outra.
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
        {OPTIONS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
            {label}
            <input
              type="checkbox"
              checked={user.inapp_notification_prefs[key]}
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
