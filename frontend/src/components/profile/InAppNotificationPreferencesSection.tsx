'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { notificationsService } from '@/services/notifications'
import { InAppNotificationPreferences, User } from '@/types'

const OPTION_KEYS: (keyof InAppNotificationPreferences)[] = [
  'request_status', 'new_message', 'verification_result', 'item_available', 'review_reminder',
  'group_vouch', 'favorite_item_changed',
]

export default function InAppNotificationPreferencesSection({
  user,
  updateUser,
}: {
  user: User
  updateUser: (user: User) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const t = useTranslations('Common.InAppNotificationPreferencesSection')

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
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('title')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('independentNotice')}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
        {OPTION_KEYS.map((key) => (
          <label key={key} className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
            {t(`options.${key}`)}
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
